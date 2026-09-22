import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { idSchema, paginationSchema, referralCloseSchema, referralCreateSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { assignedCommitteeIds, canMunicipality, measureVisibility, requirePermission } from './access.js';
import { can } from './domain/policy.js';
import { fail, type AuthRequest } from './http.js';
import type { Prisma } from './database.js';

const SOURCE_KIND='SECRETARIAT_RECORDED';
const include={committee:{select:{id:true,code:true,name:true}},measure:{select:{id:true,title:true,typeCode:true,stage:true}}} as const;
function day(value:Date):string {return value.toISOString().slice(0,10);}
function view(row:{referredOn:Date;dueOn:Date|null;[key:string]:unknown}) {
  return {...row,referredOn:day(row.referredOn),dueOn:row.dueOn?day(row.dueOn):null};
}

@Injectable()
export class ReferralsService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  private requireList(r:AuthRequest,permission:'measure.view'|'committee.referral.view') {
    const where=measureVisibility(r.principal,permission);
    if(!where) fail(403,'ACCESS_DENIED','You do not have access to this action.');
    return where;
  }
  async forMeasure(r:AuthRequest,rawId:string) {
    const id=idSchema.parse(rawId);
    const where=this.requireList(r,'measure.view');
    if(!await this.ctx.db.legislativeMeasure.findFirst({where:{id,...where}})) fail(404,'NOT_FOUND','Measure not found.');
    requirePermission(r.principal,'committee.referral.view',canMunicipality(r.principal,'committee.referral.view')?this.scope(r):{...this.scope(r),committeeId:assignedCommitteeIds(r.principal,'committee.referral.view')[0]});
    const items=await this.ctx.db.committeeReferral.findMany({where:{measureId:id,...this.scope(r)},include,orderBy:[{createdAt:'asc'},{role:'asc'}]});
    return {items:items.map(view)};
  }
  async forCommittee(r:AuthRequest,rawId:string,q:unknown) {
    const id=idSchema.parse(rawId);
    if(!canMunicipality(r.principal,'committee.view') && !can(r.principal,'committee.view',{...this.scope(r),committeeId:id})) fail(404,'NOT_FOUND','Committee not found.');
    if(!await this.ctx.db.committee.findFirst({where:{id,...this.scope(r)}})) fail(404,'NOT_FOUND','Committee not found.');
    requirePermission(r.principal,'committee.referral.view',canMunicipality(r.principal,'committee.referral.view')?this.scope(r):{...this.scope(r),committeeId:id});
    const {page,limit}=paginationSchema.parse(q);
    const where={committeeId:id,...this.scope(r)};
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.committeeReferral.findMany({where,include,skip:(page-1)*limit,take:limit,orderBy:[{createdAt:'desc'},{id:'desc'}]}),this.ctx.db.committeeReferral.count({where})]);
    return {items:items.map(view),pageInfo:{page,limit,total}};
  }
  async create(r:AuthRequest,rawId:string,body:unknown) {
    const measureId=idSchema.parse(rawId),input=referralCreateSchema.parse(body);
    return {data:await this.commands.execute(r,'committee.referral.create','referral.created',{measureId,...input},async tx=>{
      const measure=await tx.legislativeMeasure.findFirst({where:{id:measureId,...this.scope(r)},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
      if(!measure) fail(404,'NOT_FOUND','Measure not found.');
      if(measure.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this measure before recording a referral.');
      if(measure.stage==='WITHDRAWN') fail(422,'TRANSITION_DENIED','Withdrawn measures cannot be referred.');
      const current=measure.versions[0];
      if(!current) fail(422,'VERSION_REQUIRED','A measure needs a text version before it can be referred.');
      const committeeIds=[input.leadCommitteeId,...input.jointCommitteeIds];
      const committees=await tx.committee.findMany({where:{municipalityId:r.principal.municipalityId,id:{in:committeeIds}}});
      if(committees.length!==committeeIds.length) fail(404,'NOT_FOUND','Committee not found.');
      if(committees.some(c=>c.termId!==measure.termId)) fail(422,'TERM_MISMATCH','Referrals must use committees of the same council term as the measure.');
      const open=await tx.committeeReferral.findFirst({where:{measureId,disposition:'OPEN'}});
      if(open) fail(422,'REFERRAL_OPEN','Close every open referral before recording a new assignment.');
      const prior=await tx.committeeReferral.findMany({where:{measureId,committeeId:{in:committeeIds}},select:{committeeId:true,referralSequence:true}});
      const next=new Map<string,number>();
      for(const id of committeeIds) next.set(id,1);
      for(const row of prior) next.set(row.committeeId,Math.max(next.get(row.committeeId)??1,row.referralSequence+1));
      const byId=new Map(committees.map(item=>[item.id,item]));
      const groupId=randomUUID();
      const created:Prisma.CommitteeReferralGetPayload<{include:typeof include}>[]=[];
      for(const committeeId of committeeIds) {
        const committee=byId.get(committeeId)!;
        const role=committee.id===input.leadCommitteeId?'LEAD':'JOINT';
        const row=await tx.committeeReferral.create({data:{
          id:randomUUID(),municipalityId:r.principal.municipalityId,measureId,measureVersionId:current.id,committeeId:committee.id,
          groupId,referralSequence:next.get(committee.id)!,role,sourceKind:SOURCE_KIND,referredOn:new Date(input.referredOn),
          dueOn:input.dueOn?new Date(input.dueOn):null,disposition:'OPEN',
        },include});
        created.push(row);
        const staff=await tx.userRole.findMany({where:{role:'CS',scopeType:'COMMITTEE',scopeId:committee.id,revokedAt:null,validUntil:{gt:new Date()}}});
        const assignee=staff[0]?.userId??null;
        await tx.workTask.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,ownerType:'REFERRAL',ownerId:row.id,measureId,title:`Review ${role.toLowerCase()} referral: ${measure.title}`,state:'OPEN',assigneeId:assignee}});
        for(const grant of staff) {
          await tx.inAppNotification.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,userId:grant.userId,eventKey:`referral.create.${row.id}`,summary:`A measure was referred to ${committee.name}.`,ownerType:'MEASURE',ownerId:measureId}});
        }
      }
      return {entityId:measureId,result:created.map(view),changes:{measureId,groupId,leadCommitteeId:input.leadCommitteeId,jointCommitteeIds:input.jointCommitteeIds,measureVersionId:current.id,sourceKind:SOURCE_KIND,reason:input.reason}};
    })};
  }
  async close(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=referralCloseSchema.parse(body);
    return {data:await this.commands.execute(r,'committee.referral.close','referral.closed',{id,...input},async tx=>{
      const old=await tx.committeeReferral.findFirst({where:{id,...this.scope(r)},include});
      if(!old) fail(404,'NOT_FOUND','Referral not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this referral before closing it.');
      if(old.disposition!=='OPEN') fail(409,'STALE_REVISION','This referral has already been closed.');
      const result=await tx.committeeReferral.update({where:{id},data:{disposition:'CLOSED',closedAt:new Date(),closedBy:r.principal.id,closeReason:input.reason,revision:{increment:1}},include});
      return {entityId:id,result:view(result),changes:{measureId:old.measureId,committeeId:old.committeeId,note:'Closing a referral is not a committee report.',reason:input.reason}};
    })};
  }
}
