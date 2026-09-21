import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { committeeSchema, grantSchema, idSchema, memberSchema, municipalitySchema, paginationSchema, personSchema, reviewSchema, rolePermissions, termSchema, userSchema, userStateSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { requirePermission, SessionGuard } from './access.js';
import { can, independentApproval, overlaps } from './domain/policy.js';
import { fail, type AuthRequest } from './http.js';

@Injectable()
export class AdministrationService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  async municipality(r:AuthRequest) {
    requirePermission(r.principal,'municipality.view',this.scope(r));
    return {data:await this.ctx.db.municipality.findUniqueOrThrow({where:{id:r.principal.municipalityId}})};
  }
  async editMunicipality(r:AuthRequest,body:unknown) {
    const input=municipalitySchema.parse(body);
    return {data:await this.commands.execute(r,'settings.manage','municipality.updated',input,async tx=>{
      const old=await tx.municipality.findUniqueOrThrow({where:{id:r.principal.municipalityId}});
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload the municipality before editing.');
      const result=await tx.municipality.update({where:{id:old.id},data:{name:input.name,province:input.province,revision:{increment:1}}});
      return {entityId:old.id,result,changes:{before:{name:old.name,province:old.province},after:{name:result.name,province:result.province},reason:input.reason}};
    })};
  }
  roles(r:AuthRequest) {requirePermission(r.principal,'user.view',this.scope(r));return {data:rolePermissions};}
  async users(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'user.view',this.scope(r));const {page,limit}=paginationSchema.parse(q),where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.user.findMany({where,skip:(page-1)*limit,take:limit,orderBy:{id:'asc'},select:{id:true,displayName:true,subject:true,enabled:true,revision:true}}),this.ctx.db.user.count({where})]);
    return {items,pageInfo:{page,limit,total}};
  }
  async createUser(r:AuthRequest,body:unknown) {
    const input=userSchema.parse(body);
    return {data:await this.commands.execute(r,'user.manage','user.linked',input,async tx=>{
      const result=await tx.user.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,issuer:this.ctx.config.OIDC_ISSUER,subject:input.subject,displayName:input.displayName},select:{id:true,displayName:true,subject:true,enabled:true,revision:true}});
      return {entityId:result.id,result,changes:{subject:input.subject,displayName:input.displayName,reason:input.reason}};
    })};
  }
  async userState(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=userStateSchema.parse(body);
    if(id===r.principal.id) fail(403,'SELF_CHANGE_DENIED','Ask another administrator to change your account state.');
    return {data:await this.commands.execute(r,'user.manage','user.state-changed',{id,...input},async tx=>{
      const old=await tx.user.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','User not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this user before editing.');
      const result=await tx.user.update({where:{id},data:{enabled:input.enabled,revision:{increment:1},policyVersion:{increment:1}},select:{id:true,displayName:true,subject:true,enabled:true,revision:true}});
      return {entityId:id,result,changes:{before:old.enabled,after:input.enabled,reason:input.reason}};
    })};
  }
  async requests(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'role.assign',this.scope(r));const {page,limit}=paginationSchema.parse(q),where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.grantRequest.findMany({where,skip:(page-1)*limit,take:limit,orderBy:[{createdAt:'desc'},{id:'desc'}]}),this.ctx.db.grantRequest.count({where})]);
    return {items,pageInfo:{page,limit,total}};
  }
  async requestGrant(r:AuthRequest,body:unknown) {
    const input=grantSchema.parse(body);
    if(input.userId===r.principal.id) fail(403,'SELF_GRANT_DENIED','You cannot request your own access grant.');
    return {data:await this.commands.execute(r,'role.assign','grant.requested',input,async tx=>{
      const user=await tx.user.findFirst({where:{id:input.userId,...this.scope(r),enabled:true}});
      if(!user) fail(404,'NOT_FOUND','Active user not found.');
      if(new Date(input.validUntil)<=new Date()) fail(422,'GRANT_EXPIRED','The proposed grant has already expired.');
      if(input.scopeType==='MUNICIPALITY' && input.scopeId!==r.principal.municipalityId) fail(403,'INVALID_SCOPE','The grant must belong to your municipality.');
      if(input.scopeType==='COMMITTEE' && !await tx.committee.findFirst({where:{id:input.scopeId,...this.scope(r)}})) fail(404,'NOT_FOUND','Committee not found.');
      const result=await tx.grantRequest.create({data:{...input,id:randomUUID(),municipalityId:r.principal.municipalityId,validFrom:new Date(input.validFrom),validUntil:new Date(input.validUntil),requestedBy:r.principal.id}});
      return {entityId:result.id,result,changes:input};
    })};
  }
  async reviewGrant(r:AuthRequest,rawId:string,decision:string,body:unknown) {
    const id=idSchema.parse(rawId),input=reviewSchema.parse(body);
    if(!['approve','reject'].includes(decision)) fail(404,'NOT_FOUND','Unknown review action.');
    return {data:await this.commands.execute(r,'grant.approve',`grant.${decision}`,{id,...input},async tx=>{
      const request=await tx.grantRequest.findFirst({where:{id,...this.scope(r)}});
      if(!request) fail(404,'NOT_FOUND','Grant request not found.');
      if(request.revision!==input.expectedRevision || request.state!=='PENDING') fail(409,'STALE_REVISION','This request has already changed.');
      if(!independentApproval(request.requestedBy,r.principal.id,request.userId)) fail(403,'INDEPENDENT_APPROVER_REQUIRED','The reviewer must differ from both requester and recipient.');
      if(decision==='approve') {
        const user=await tx.user.findFirst({where:{id:request.userId,...this.scope(r),enabled:true}});
        if(!user || request.validUntil<=new Date()) fail(422,'GRANT_NOT_APPLICABLE','The recipient is disabled or the grant expired.');
        await tx.userRole.create({data:{id:randomUUID(),municipalityId:request.municipalityId,userId:request.userId,role:request.role,scopeType:request.scopeType,scopeId:request.scopeId,validFrom:request.validFrom,validUntil:request.validUntil,approvedBy:r.principal.id,requestId:id}});
        await tx.user.update({where:{id:request.userId},data:{policyVersion:{increment:1},revision:{increment:1}}});
      }
      const result=await tx.grantRequest.update({where:{id},data:{state:decision==='approve'?'APPROVED':'REJECTED',reviewedBy:r.principal.id,reviewReason:input.reason,revision:{increment:1}}});
      return {entityId:id,result,changes:{requestId:id,recipient:request.userId,role:request.role,decision,reason:input.reason}};
    })};
  }
  async grants(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'role.assign',this.scope(r));const {page,limit}=paginationSchema.parse(q),where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.userRole.findMany({where,skip:(page-1)*limit,take:limit,orderBy:{id:'asc'}}),this.ctx.db.userRole.count({where})]);
    return {items,pageInfo:{page,limit,total}};
  }
  async revoke(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=reviewSchema.parse(body);
    return {data:await this.commands.execute(r,'role.assign','grant.revoked',{id,...input},async tx=>{
      const old=await tx.userRole.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Grant not found.');
      if(old.userId===r.principal.id) fail(403,'SELF_CHANGE_DENIED','Another administrator must revoke your grant.');
      if(old.revision!==input.expectedRevision || old.revokedAt) fail(409,'STALE_REVISION','Reload the grant before revoking.');
      const result=await tx.userRole.update({where:{id},data:{revokedAt:new Date(),revision:{increment:1}}});
      await tx.user.update({where:{id:old.userId},data:{policyVersion:{increment:1},revision:{increment:1}}});
      return {entityId:id,result,changes:{userId:old.userId,role:old.role,reason:input.reason}};
    })};
  }
  async terms(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'term.view',this.scope(r));const {page,limit}=paginationSchema.parse(q),where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.councilTerm.findMany({where,skip:(page-1)*limit,take:limit,orderBy:[{startsOn:'desc'},{id:'asc'}]}),this.ctx.db.councilTerm.count({where})]);return {items,pageInfo:{page,limit,total}};
  }
  async createTerm(r:AuthRequest,body:unknown) {
    const input=termSchema.parse(body);
    return {data:await this.commands.execute(r,'term.manage','term.created',input,async tx=>{
      const result=await tx.councilTerm.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,label:input.label,startsOn:new Date(input.startsOn),endsOn:new Date(input.endsOn)}});
      return {entityId:result.id,result,changes:input};
    })};
  }
  async persons(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'person.view',this.scope(r));const {page,limit}=paginationSchema.parse(q),where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.person.findMany({where,skip:(page-1)*limit,take:limit,orderBy:[{displayName:'asc'},{id:'asc'}]}),this.ctx.db.person.count({where})]);return {items,pageInfo:{page,limit,total}};
  }
  async createPerson(r:AuthRequest,body:unknown) {
    const input=personSchema.parse(body);
    return {data:await this.commands.execute(r,'person.manage','person.created',input,async tx=>{
      const result=await tx.person.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,displayName:input.displayName}});
      return {entityId:result.id,result,changes:input};
    })};
  }
  async committees(r:AuthRequest,q:unknown) {
    const {page,limit}=paginationSchema.parse(q),scope=this.scope(r);
    const full=can(r.principal,'committee.view',scope);
    const ids=r.principal.grants.filter(g=>g.scopeType==='COMMITTEE' && can(r.principal,'committee.view',{...scope,committeeId:g.scopeId})).map(g=>g.scopeId);
    if(!full && !ids.length) fail(403,'ACCESS_DENIED','You do not have committee access.');
    const where={...scope,...(!full?{id:{in:ids}}:{})};
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.committee.findMany({where,include:{term:true},skip:(page-1)*limit,take:limit,orderBy:[{name:'asc'},{id:'asc'}]}),this.ctx.db.committee.count({where})]);return {items,pageInfo:{page,limit,total}};
  }
  async committee(r:AuthRequest,rawId:string) {
    const id=idSchema.parse(rawId);
    if(!can(r.principal,'committee.view',{...this.scope(r),committeeId:id})) fail(404,'NOT_FOUND','Committee not found.');
    const result=await this.ctx.db.committee.findFirst({where:{id,...this.scope(r)},include:{term:true,members:{include:{person:true},orderBy:[{startsOn:'desc'},{id:'asc'}]}}});
    if(!result) fail(404,'NOT_FOUND','Committee not found.');return {data:result};
  }
  async createCommittee(r:AuthRequest,body:unknown) {
    const input=committeeSchema.parse(body);
    return {data:await this.commands.execute(r,'committee.manage','committee.created',input,async tx=>{
      if(!await tx.councilTerm.findFirst({where:{id:input.termId,...this.scope(r)}})) fail(404,'NOT_FOUND','Term not found.');
      const result=await tx.committee.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,termId:input.termId,code:input.code,name:input.name}});
      return {entityId:result.id,result,changes:input};
    })};
  }
  async addMember(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=memberSchema.parse(body);
    return {data:await this.commands.execute(r,'committee.members.manage','committee.member-added',{id,...input},async tx=>{
      const committee=await tx.committee.findFirst({where:{id,...this.scope(r)},include:{term:true,members:true}});
      if(!committee || !await tx.person.findFirst({where:{id:input.personId,...this.scope(r)}})) fail(404,'NOT_FOUND','Committee or person not found.');
      if(committee.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload the committee before adding a member.');
      const start=new Date(input.startsOn),end=new Date(input.endsOn);
      if(start<committee.term.startsOn || end>committee.term.endsOn) fail(422,'OUTSIDE_TERM','Membership dates must fall within the council term.');
      if(committee.members.some(m=>overlaps(start,end,m.startsOn,m.endsOn) && (m.personId===input.personId || (['CHAIR','VICE_CHAIR'].includes(input.role) && m.role===input.role)))) fail(409,'MEMBERSHIP_OVERLAP','This person or leadership position already has an overlapping assignment.');
      const result=await tx.committeeMember.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,committeeId:id,personId:input.personId,role:input.role,startsOn:start,endsOn:end}});
      await tx.committee.update({where:{id},data:{revision:{increment:1}}});
      return {entityId:id,result,changes:input};
    },id)};
  }
  async audit(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'audit.view',this.scope(r));const {page,limit}=paginationSchema.parse(q),where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.auditLog.findMany({where,skip:(page-1)*limit,take:limit,orderBy:{sequence:'desc'}}),this.ctx.db.auditLog.count({where})]);
    return {items:items.map(e=>({...e,sequence:e.sequence.toString()})),pageInfo:{page,limit,total}};
  }
}
