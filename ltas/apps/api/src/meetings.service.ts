import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { idSchema, meetingAgendaSchema, meetingCreateSchema, meetingEditSchema, paginationSchema, reviewSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { canMunicipality, requireCommitteePermission } from './access.js';
import { can } from './domain/policy.js';
import { fail, type AuthRequest } from './http.js';
import type { Prisma } from './database.js';

const agendaInclude={referral:{include:{measure:{select:{id:true,title:true,typeCode:true,stage:true}},committee:{select:{id:true,code:true,name:true}}}}} as const;
const include={agenda:{include:agendaInclude,orderBy:{sequence:'asc'}}} as const;

@Injectable()
export class MeetingsService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  private canSeeCommittee(r:AuthRequest,committeeId:string):boolean {
    return canMunicipality(r.principal,'committee.view') || can(r.principal,'committee.view',{...this.scope(r),committeeId});
  }
  private view(row:{scheduledAt:Date;agenda?:Array<{referral:unknown;[key:string]:unknown}>}) {
    return {...row,scheduledAt:row.scheduledAt.toISOString(),agenda:row.agenda?.map(item=>({...item,referral:item.referral}))};
  }
  async list(r:AuthRequest,rawId:string,q:unknown) {
    const committeeId=idSchema.parse(rawId);
    if(!this.canSeeCommittee(r,committeeId) || !await this.ctx.db.committee.findFirst({where:{id:committeeId,...this.scope(r)}})) fail(404,'NOT_FOUND','Committee not found.');
    requireCommitteePermission(r.principal,'committee.meeting.view',committeeId);
    const {page,limit}=paginationSchema.parse(q);
    const where={committeeId,...this.scope(r)};
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.committeeMeeting.findMany({where,include,skip:(page-1)*limit,take:limit,orderBy:[{scheduledAt:'desc'},{id:'desc'}]}),this.ctx.db.committeeMeeting.count({where})]);
    return {items:items.map(item=>this.view(item)),pageInfo:{page,limit,total}};
  }
  async get(r:AuthRequest,rawId:string) {
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.committeeMeeting.findFirst({where:{id,...this.scope(r)},include});
    if(!row || !this.canSeeCommittee(r,row.committeeId)) fail(404,'NOT_FOUND','Meeting not found.');
    requireCommitteePermission(r.principal,'committee.meeting.view',row.committeeId);
    return {data:this.view(row)};
  }
  async create(r:AuthRequest,rawId:string,body:unknown) {
    const committeeId=idSchema.parse(rawId),input=meetingCreateSchema.parse(body);
    return {data:await this.commands.execute(r,'committee.meeting.manage','meeting.created',{committeeId,...input},async tx=>{
      const committee=await tx.committee.findFirst({where:{id:committeeId,...this.scope(r)}});
      if(!committee) fail(404,'NOT_FOUND','Committee not found.');
      const scheduledAt=new Date(input.scheduledAt);
      const year=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric'}).format(scheduledAt);
      const prior=await tx.committeeMeeting.count({where:{committeeId,reference:{startsWith:`M-${year}-`}}});
      const reference=`M-${year}-${prior+1}`;
      const id=randomUUID();
      await tx.committeeMeeting.create({data:{id,municipalityId:r.principal.municipalityId,committeeId,reference,title:input.title,venue:input.venue,scheduledAt,state:'SCHEDULED'}});
      await this.addAgenda(tx,r,id,committeeId,input.referralIds,0);
      const staff=await tx.userRole.findMany({where:{role:'CS',scopeType:'COMMITTEE',scopeId:committeeId,revokedAt:null,validUntil:{gt:new Date()}}});
      const assignee=staff[0]?.userId??null;
      await tx.workTask.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,ownerType:'MEETING',ownerId:id,title:`Prepare committee meeting ${reference}`,state:'OPEN',assigneeId:assignee}});
      for(const grant of staff) await tx.inAppNotification.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,userId:grant.userId,eventKey:`meeting.create.${id}`,summary:`A committee meeting was scheduled: ${input.title}.`,ownerType:'MEETING',ownerId:id}});
      const result=await tx.committeeMeeting.findUniqueOrThrow({where:{id},include});
      return {entityId:id,result:this.view(result),changes:{committeeId,reference,title:input.title,scheduledAt:input.scheduledAt,reason:input.reason}};
    },canMunicipality(r.principal,'committee.meeting.manage')?undefined:committeeId)};
  }
  async edit(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=meetingEditSchema.parse(body);
    const preview=await this.ctx.db.committeeMeeting.findFirst({where:{id,...this.scope(r)}});
    if(!preview) fail(404,'NOT_FOUND','Meeting not found.');
    return {data:await this.commands.execute(r,'committee.meeting.manage','meeting.updated',{id,...input},async tx=>{
      const old=await tx.committeeMeeting.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Meeting not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this meeting before editing.');
      if(old.state!=='SCHEDULED') fail(422,'MEETING_CLOSED','Closed meetings cannot be edited.');
      const result=await tx.committeeMeeting.update({where:{id},data:{title:input.title,venue:input.venue,scheduledAt:new Date(input.scheduledAt),revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{before:{title:old.title,venue:old.venue},after:{title:input.title,venue:input.venue},reason:input.reason}};
    },canMunicipality(r.principal,'committee.meeting.manage')?undefined:preview.committeeId)};
  }
  async close(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=reviewSchema.parse(body);
    const preview=await this.ctx.db.committeeMeeting.findFirst({where:{id,...this.scope(r)}});
    if(!preview) fail(404,'NOT_FOUND','Meeting not found.');
    return {data:await this.commands.execute(r,'committee.meeting.close','meeting.closed',{id,...input},async tx=>{
      const old=await tx.committeeMeeting.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Meeting not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this meeting before closing it.');
      if(old.state!=='SCHEDULED') fail(409,'STALE_REVISION','This meeting has already been closed.');
      const result=await tx.committeeMeeting.update({where:{id},data:{state:'CLOSED',closedAt:new Date(),closedBy:r.principal.id,closeReason:input.reason,revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{note:'Closing a meeting is not certified minutes.',reason:input.reason}};
    },canMunicipality(r.principal,'committee.meeting.close')?undefined:preview.committeeId)};
  }
  async addReferral(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=meetingAgendaSchema.parse(body);
    const preview=await this.ctx.db.committeeMeeting.findFirst({where:{id,...this.scope(r)}});
    if(!preview) fail(404,'NOT_FOUND','Meeting not found.');
    return {data:await this.commands.execute(r,'committee.meeting.manage','meeting.agenda-added',{id,...input},async tx=>{
      const meeting=await tx.committeeMeeting.findFirst({where:{id,...this.scope(r)},include:{agenda:true}});
      if(!meeting) fail(404,'NOT_FOUND','Meeting not found.');
      if(meeting.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this meeting before changing the agenda.');
      if(meeting.state!=='SCHEDULED') fail(422,'MEETING_CLOSED','Closed meetings cannot receive agenda items.');
      await this.addAgenda(tx,r,id,meeting.committeeId,[input.referralId],meeting.agenda.length);
      await tx.committeeMeeting.update({where:{id},data:{revision:{increment:1}}});
      const result=await tx.committeeMeeting.findUniqueOrThrow({where:{id},include});
      return {entityId:id,result:this.view(result),changes:{referralId:input.referralId,reason:input.reason}};
    },canMunicipality(r.principal,'committee.meeting.manage')?undefined:preview.committeeId)};
  }
  private async addAgenda(tx:Prisma.TransactionClient,r:AuthRequest,meetingId:string,committeeId:string,referralIds:string[],start:number) {
    if(new Set(referralIds).size!==referralIds.length) fail(422,'DUPLICATE_REFERRAL','A referral can appear on a meeting only once.');
    for(const [index,referralId] of referralIds.entries()) {
      const referral=await tx.committeeReferral.findFirst({where:{id:referralId,...this.scope(r)}});
      if(!referral || referral.committeeId!==committeeId) fail(404,'NOT_FOUND','Referral not found for this committee.');
      if(referral.disposition!=='OPEN') fail(422,'REFERRAL_CLOSED','A closed referral cannot be placed on a meeting agenda.');
      if(await tx.meetingReferral.findFirst({where:{meetingId,referralId}})) fail(409,'CONFLICT','This referral is already on the meeting agenda.');
      await tx.meetingReferral.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,meetingId,referralId,measureVersionId:referral.measureVersionId,sequence:start+index+1}});
    }
  }
}
