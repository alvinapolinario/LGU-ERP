import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { committeeSchema, comparePeopleByPosition, grantSchema, idSchema, memberSchema, municipalitySchema, paginationSchema, PERSON_PHOTO_MAX_BYTES, personListSchema, personPhotoSchema, personSchema, personUpdateSchema, reviewSchema, rolePermissions, termSchema, termUpdateSchema, userSchema, userStateSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { requirePermission } from './access.js';
import { can, conflictingGrant, independentApproval, overlaps } from './domain/policy.js';
import { fail, type AuthRequest } from './http.js';
import { detectPhotoMime } from './domain/mime.js';

const personPublic = {id:true, displayName:true, positionCode:true, photoSha256:true, termId:true, revision:true} as const;
function viewPerson(row:{id:string;displayName:string;positionCode:string;photoSha256:string|null;termId:string;revision:number}, termLabel?:string) {
  return {id:row.id, displayName:row.displayName, positionCode:row.positionCode, termId:row.termId, termLabel:termLabel??null, revision:row.revision, hasPhoto:Boolean(row.photoSha256), photoVersion:row.photoSha256};
}
function manilaDay(value:Date) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(value);
}

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
      const window={role:input.role,scopeType:input.scopeType,scopeId:input.scopeId,validFrom:new Date(input.validFrom),validUntil:new Date(input.validUntil)};
      const [grants,pending]=await Promise.all([
        tx.userRole.findMany({where:{userId:input.userId,role:input.role,scopeType:input.scopeType,scopeId:input.scopeId,revokedAt:null}}),
        tx.grantRequest.findMany({where:{userId:input.userId,role:input.role,scopeType:input.scopeType,scopeId:input.scopeId,state:'PENDING'}}),
      ]);
      if(grants.some(g=>conflictingGrant(g,window)) || pending.some(g=>conflictingGrant({...g,revokedAt:null},window))) fail(409,'GRANT_OVERLAP','An overlapping grant already exists or is awaiting review.');
      const result=await tx.grantRequest.create({data:{...input,id:randomUUID(),municipalityId:r.principal.municipalityId,validFrom:window.validFrom,validUntil:window.validUntil,requestedBy:r.principal.id}});
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
        const window={role:request.role,scopeType:request.scopeType,scopeId:request.scopeId,validFrom:request.validFrom,validUntil:request.validUntil};
        const grants=await tx.userRole.findMany({where:{userId:request.userId,role:request.role,scopeType:request.scopeType,scopeId:request.scopeId,revokedAt:null}});
        if(grants.some(g=>conflictingGrant(g,window))) fail(409,'GRANT_OVERLAP','An overlapping grant already exists for this role and scope.');
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
    const [rows,total]=await this.ctx.db.$transaction([this.ctx.db.councilTerm.findMany({where,include:{_count:{select:{people:true}}},skip:(page-1)*limit,take:limit,orderBy:[{startsOn:'desc'},{id:'asc'}]}),this.ctx.db.councilTerm.count({where})]);
    return {items:rows.map(({_count,...item})=>({...item,peopleCount:_count.people})),pageInfo:{page,limit,total}};
  }
  async createTerm(r:AuthRequest,body:unknown) {
    const input=termSchema.parse(body);
    return {data:await this.commands.execute(r,'term.manage','term.created',input,async tx=>{
      const result=await tx.councilTerm.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,label:input.label,startsOn:new Date(input.startsOn),endsOn:new Date(input.endsOn)}});
      return {entityId:result.id,result:{...result,peopleCount:0},changes:input};
    })};
  }
  async editTerm(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=termUpdateSchema.parse(body);
    return {data:await this.commands.execute(r,'term.manage','term.updated',{id,...input},async tx=>{
      const old=await tx.councilTerm.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Council term not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload the council term before editing.');
      const startsOn=new Date(input.startsOn),endsOn=new Date(input.endsOn);
      const committees=await tx.committee.findMany({where:{termId:id,...this.scope(r)},include:{members:true}});
      if(committees.flatMap(item=>item.members).some(member=>member.startsOn<startsOn || member.endsOn>endsOn)) fail(422,'OUTSIDE_TERM','Committee assignments fall outside these dates. Correct those assignments before shortening the term.');
      const sessions=await tx.legislativeSession.findMany({where:{termId:id,...this.scope(r)},select:{scheduledAt:true}});
      if(sessions.some(item=>{const day=manilaDay(item.scheduledAt);return day<input.startsOn || day>input.endsOn;})) fail(422,'OUTSIDE_TERM','A session is scheduled outside these dates. Move it before shortening the term.');
      const updated=await tx.councilTerm.update({where:{id},data:{label:input.label,startsOn,endsOn,revision:{increment:1}},include:{_count:{select:{people:true}}}});
      const {_count,...result}=updated;
      return {entityId:id,result:{...result,peopleCount:_count.people},changes:{label:input.label,startsOn:input.startsOn,endsOn:input.endsOn,reason:input.reason}};
    })};
  }
  async persons(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'person.view',this.scope(r));const {page,limit,termId}=personListSchema.parse(q);
    const where={...this.scope(r),...(termId?{termId}:{})};
    const [rows,total]=await this.ctx.db.$transaction([this.ctx.db.person.findMany({where,select:{...personPublic,term:{select:{label:true}}}}),this.ctx.db.person.count({where})]);
    const items=rows.map(row=>viewPerson(row,row.term.label)).sort(comparePeopleByPosition).slice((page-1)*limit,page*limit);
    return {items,pageInfo:{page,limit,total}};
  }
  async createPerson(r:AuthRequest,body:unknown) {
    const input=personSchema.parse(body);
    return {data:await this.commands.execute(r,'person.manage','person.created',input,async tx=>{
      const term=await tx.councilTerm.findFirst({where:{id:input.termId,...this.scope(r)}});
      if(!term) fail(404,'NOT_FOUND','Council term not found.');
      const result=await tx.person.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,termId:input.termId,displayName:input.displayName,positionCode:input.positionCode},select:{...personPublic,term:{select:{label:true}}}});
      return {entityId:result.id,result:viewPerson(result,result.term.label),changes:input};
    })};
  }
  async editPerson(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=personUpdateSchema.parse(body);
    return {data:await this.commands.execute(r,'person.manage','person.updated',{id,...input},async tx=>{
      const old=await tx.person.findFirst({where:{id,...this.scope(r)},select:{id:true,revision:true,termId:true}});
      if(!old) fail(404,'NOT_FOUND','Person not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this person before editing.');
      const result=await tx.person.update({where:{id},data:{displayName:input.displayName,positionCode:input.positionCode,revision:{increment:1}},select:{...personPublic,term:{select:{label:true}}}});
      await tx.measureAuthor.updateMany({where:{personId:id,...this.scope(r)},data:{displayName:input.displayName}});
      return {entityId:id,result:viewPerson(result,result.term.label),changes:{displayName:input.displayName,positionCode:input.positionCode,termId:old.termId,reason:input.reason}};
    })};
  }
  async setPhoto(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=personPhotoSchema.parse({reason:r.get('x-audit-reason')});
    if(!Buffer.isBuffer(body) || body.length===0) fail(422,'FILE_REQUIRED','Attach a JPEG or PNG photograph.');
    if(body.length>PERSON_PHOTO_MAX_BYTES) fail(422,'FILE_TOO_LARGE','Each photograph must be 2 MiB or smaller.');
    const mime=detectPhotoMime(body),sha256=createHash('sha256').update(body).digest('hex');
    return {data:await this.commands.execute(r,'person.manage','person.photo-updated',{id,...input,mime,sha256,bytes:body.length},async tx=>{
      if(!await tx.person.findFirst({where:{id,...this.scope(r)},select:{id:true}})) fail(404,'NOT_FOUND','Person not found.');
      const result=await tx.person.update({where:{id},data:{photoMime:mime,photoSha256:sha256,photoBytes:Uint8Array.from(body)},select:personPublic});
      return {entityId:id,result:viewPerson(result),changes:{personId:id,mime,sha256,bytes:body.length,reason:input.reason}};
    })};
  }
  async photo(r:AuthRequest,rawId:string) {
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.person.findFirst({where:{id,...this.scope(r)},select:{photoBytes:true,photoMime:true,displayName:true}});
    if(!row) fail(404,'NOT_FOUND','Person not found.');
    if(!row.photoBytes || !row.photoMime) fail(404,'NOT_FOUND','No photograph is on file for this person.');
    return new StreamableFile(Buffer.from(row.photoBytes),{type:row.photoMime,disposition:'inline'});
  }
  async personProfile(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'person.view',this.scope(r));
    const id=idSchema.parse(rawId);
    const person=await this.ctx.db.person.findFirst({where:{id,...this.scope(r)},select:personPublic});
    if(!person) fail(404,'NOT_FOUND','Person not found.');
    const seats=await this.ctx.db.person.findMany({
      where:{...this.scope(r),displayName:person.displayName},
      select:{id:true,positionCode:true,term:{select:{id:true,label:true,startsOn:true,endsOn:true}},members:{select:{role:true,startsOn:true,endsOn:true,committee:{select:{name:true}}}}},
      orderBy:{term:{startsOn:'desc'}},
    });
    const authoredRows=await this.ctx.db.measureAuthor.findMany({
      where:{personId:{in:seats.map(item=>item.id)},role:{in:['AUTHOR','CO_AUTHOR']},measure:{municipalityId:r.principal.municipalityId,stage:'SUBMITTED'}},
      select:{personId:true,role:true},
    });
    const today=manilaDay(new Date());
    const roleRank:Record<string,number>={CHAIR:0,VICE_CHAIR:1,MEMBER:2,STAFF:3};
    const tally=(personId:string)=>{
      const rows=authoredRows.filter(item=>item.personId===personId);
      return {authored:rows.filter(item=>item.role==='AUTHOR').length,coAuthored:rows.filter(item=>item.role==='CO_AUTHOR').length};
    };
    const listed=seats.map(item=>({
      ...tally(item.id),
      termId:item.term.id,
      termLabel:item.term.label,
      startsOn:item.term.startsOn.toISOString(),
      endsOn:item.term.endsOn.toISOString(),
      positionCode:item.positionCode,
      committees:item.members.map(member=>{
        const startsOn=member.startsOn.toISOString().slice(0,10);
        const endsOn=member.endsOn.toISOString().slice(0,10);
        return {name:member.committee.name,role:member.role,active:startsOn<=today && endsOn>=today};
      }).sort((a,b)=>(roleRank[a.role]??9)-(roleRank[b.role]??9) || a.name.localeCompare(b.name)),
    }));
    return {data:{
      ...viewPerson(person),
      termsListed:listed.length,
      authored:listed.reduce((sum,item)=>sum+item.authored,0),
      coAuthored:listed.reduce((sum,item)=>sum+item.coAuthored,0),
      seats:listed,
      note:'Directory rows with this display name. A position label is not a certified service history. Authored counts are submitted records only.',
    }};
  }
  async grantCommittees(r:AuthRequest) {
    requirePermission(r.principal,'role.assign',this.scope(r));
    const rows=await this.ctx.db.committee.findMany({where:this.scope(r),select:{id:true,name:true,code:true,term:{select:{label:true}}},orderBy:[{name:'asc'},{id:'asc'}]});
    return {items:rows.map(row=>({id:row.id,name:row.name,code:row.code,termLabel:row.term.label}))};
  }
  async committees(r:AuthRequest,q:unknown) {
    const {page,limit}=paginationSchema.parse(q),scope=this.scope(r);
    const full=can(r.principal,'committee.view',scope);
    const ids=r.principal.grants.filter(g=>g.scopeType==='COMMITTEE' && can(r.principal,'committee.view',{...scope,committeeId:g.scopeId})).map(g=>g.scopeId);
    if(!full && !ids.length) fail(403,'ACCESS_DENIED','You do not have committee access.');
    const where={...scope,...(!full?{id:{in:ids}}:{})};
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.committee.findMany({where,include:{term:true,members:{include:{person:{select:personPublic}},orderBy:[{startsOn:'desc'},{id:'asc'}]}},skip:(page-1)*limit,take:limit,orderBy:[{name:'asc'},{id:'asc'}]}),this.ctx.db.committee.count({where})]);
    return {items:items.map(item=>({...item,members:item.members.map(member=>({...member,person:viewPerson(member.person)}))})),pageInfo:{page,limit,total}};
  }
  async committee(r:AuthRequest,rawId:string) {
    const id=idSchema.parse(rawId);
    if(!can(r.principal,'committee.view',{...this.scope(r),committeeId:id})) fail(404,'NOT_FOUND','Committee not found.');
    const result=await this.ctx.db.committee.findFirst({where:{id,...this.scope(r)},include:{term:true,members:{include:{person:{select:personPublic}},orderBy:[{startsOn:'desc'},{id:'asc'}]}}});
    if(!result) fail(404,'NOT_FOUND','Committee not found.');
    return {data:{...result,members:result.members.map(member=>({...member,person:viewPerson(member.person)}))}};
  }
  async createCommittee(r:AuthRequest,body:unknown) {
    const input=committeeSchema.parse(body);
    return {data:await this.commands.execute(r,'committee.manage','committee.created',input,async tx=>{
      if(!await tx.councilTerm.findFirst({where:{id:input.termId,...this.scope(r)}})) fail(404,'NOT_FOUND','Term not found.');
      if(await tx.person.count({where:{termId:input.termId,...this.scope(r)}})==0) fail(422,'TERM_WITHOUT_COUNCIL','Encode the people of this council term before using it.');
      const result=await tx.committee.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,termId:input.termId,code:input.code,name:input.name}});
      return {entityId:result.id,result,changes:input};
    })};
  }
  async addMember(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=memberSchema.parse(body);
    return {data:await this.commands.execute(r,'committee.members.manage','committee.member-added',{id,...input},async tx=>{
      const committee=await tx.committee.findFirst({where:{id,...this.scope(r)},include:{term:true,members:true}});
      const person=await tx.person.findFirst({where:{id:input.personId,...this.scope(r)}});
      if(!committee || !person) fail(404,'NOT_FOUND','Committee or person not found.');
      if(person.termId!==committee.termId) fail(422,'TERM_MISMATCH','Committee members must be people encoded on this council term.');
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
