import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { attendanceSchema, idSchema, paginationSchema, reviewSchema, sessionAgendaSchema, sessionCreateSchema, sessionEditSchema, sessionVoteSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { assignedCommitteeIds, canMunicipality, requirePermission } from './access.js';
import { fail, type AuthRequest } from './http.js';
import type { Prisma } from './database.js';

const measureSelect={id:true,title:true,typeCode:true,stage:true} as const;
const include={
  agenda:{include:{measure:{select:measureSelect}},orderBy:{sequence:'asc'}},
  attendance:{include:{person:{select:{id:true,displayName:true}}},orderBy:{createdAt:'asc'}},
  votes:{include:{measure:{select:measureSelect}},orderBy:{createdAt:'asc'}},
} as const;

@Injectable()
export class SessionsService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  private view(row:{scheduledAt:Date}) {return {...row,scheduledAt:row.scheduledAt.toISOString()};}
  async list(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'session.view',this.scope(r));
    const {page,limit}=paginationSchema.parse(q);
    const where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.legislativeSession.findMany({where,include,skip:(page-1)*limit,take:limit,orderBy:[{scheduledAt:'desc'},{id:'desc'}]}),this.ctx.db.legislativeSession.count({where})]);
    return {items:items.map(item=>this.view(item)),pageInfo:{page,limit,total}};
  }
  async get(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'session.view',this.scope(r));
    const row=await this.ctx.db.legislativeSession.findFirst({where:{id:idSchema.parse(rawId),...this.scope(r)},include});
    if(!row) fail(404,'NOT_FOUND','Session not found.');
    return {data:this.view(row)};
  }
  async create(r:AuthRequest,body:unknown) {
    const input=sessionCreateSchema.parse(body);
    return {data:await this.commands.execute(r,'session.manage','session.created',input,async tx=>{
      const term=await tx.councilTerm.findFirst({where:{id:input.termId,...this.scope(r)}});
      if(!term) fail(404,'NOT_FOUND','Council term not found.');
      const scheduledAt=new Date(input.scheduledAt);
      const year=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric'}).format(scheduledAt);
      const prior=await tx.legislativeSession.count({where:{municipalityId:r.principal.municipalityId,reference:{startsWith:`S-${year}-`}}});
      const reference=`S-${year}-${prior+1}`;
      const id=randomUUID();
      await tx.legislativeSession.create({data:{id,municipalityId:r.principal.municipalityId,termId:input.termId,reference,title:input.title,venue:input.venue,kind:input.kind,scheduledAt,state:'SCHEDULED'}});
      await this.addAgenda(tx,r,id,input.measureIds,0);
      await tx.workTask.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,ownerType:'SESSION',ownerId:id,title:`Prepare session ${reference}`,state:'OPEN',assigneeId:r.principal.id}});
      const result=await tx.legislativeSession.findUniqueOrThrow({where:{id},include});
      return {entityId:id,result:this.view(result),changes:{reference,title:input.title,kind:input.kind,reason:input.reason}};
    })};
  }
  async edit(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=sessionEditSchema.parse(body);
    return {data:await this.commands.execute(r,'session.manage','session.updated',{id,...input},async tx=>{
      const old=await tx.legislativeSession.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Session not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this session before editing.');
      if(old.state!=='SCHEDULED') fail(422,'SESSION_CLOSED','Closed sessions cannot be edited.');
      const result=await tx.legislativeSession.update({where:{id},data:{title:input.title,venue:input.venue,kind:input.kind,scheduledAt:new Date(input.scheduledAt),revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{before:{title:old.title},after:{title:input.title},reason:input.reason}};
    })};
  }
  async close(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=reviewSchema.parse(body);
    return {data:await this.commands.execute(r,'session.close','session.closed',{id,...input},async tx=>{
      const old=await tx.legislativeSession.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Session not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this session before closing it.');
      if(old.state!=='SCHEDULED') fail(409,'STALE_REVISION','This session has already been closed.');
      const result=await tx.legislativeSession.update({where:{id},data:{state:'CLOSED',closedAt:new Date(),closedBy:r.principal.id,closeReason:input.reason,revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{note:'Closing a session is not certified minutes.',reason:input.reason}};
    })};
  }
  async addMeasure(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=sessionAgendaSchema.parse(body);
    return {data:await this.commands.execute(r,'session.manage','session.agenda-added',{id,...input},async tx=>{
      const session=await tx.legislativeSession.findFirst({where:{id,...this.scope(r)},include:{agenda:true}});
      if(!session) fail(404,'NOT_FOUND','Session not found.');
      if(session.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this session before changing the agenda.');
      if(session.state!=='SCHEDULED') fail(422,'SESSION_CLOSED','Closed sessions cannot receive agenda items.');
      await this.addAgenda(tx,r,id,[input.measureId],session.agenda.length);
      await tx.legislativeSession.update({where:{id},data:{revision:{increment:1}}});
      const result=await tx.legislativeSession.findUniqueOrThrow({where:{id},include});
      return {entityId:id,result:this.view(result),changes:{measureId:input.measureId,reason:input.reason}};
    })};
  }
  async recordAttendance(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=attendanceSchema.parse(body);
    return {data:await this.commands.execute(r,'attendance.record','session.attendance-recorded',{id,...input},async tx=>{
      const session=await tx.legislativeSession.findFirst({where:{id,...this.scope(r)}});
      if(!session) fail(404,'NOT_FOUND','Session not found.');
      if(session.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this session before recording attendance.');
      if(session.state!=='SCHEDULED') fail(422,'SESSION_CLOSED','Closed sessions cannot change attendance.');
      const person=await tx.person.findFirst({where:{id:input.personId,...this.scope(r)}});
      if(!person) fail(404,'NOT_FOUND','Person not found.');
      const existing=await tx.sessionAttendance.findFirst({where:{sessionId:id,personId:input.personId}});
      if(existing) await tx.sessionAttendance.update({where:{id:existing.id},data:{disposition:input.disposition}});
      else await tx.sessionAttendance.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,sessionId:id,personId:input.personId,disposition:input.disposition}});
      await tx.legislativeSession.update({where:{id},data:{revision:{increment:1}}});
      const result=await tx.legislativeSession.findUniqueOrThrow({where:{id},include});
      return {entityId:id,result:this.view(result),changes:{personId:input.personId,disposition:input.disposition,note:'Attendance is not a quorum declaration.',reason:input.reason}};
    })};
  }
  async recordVote(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=sessionVoteSchema.parse(body);
    return {data:await this.commands.execute(r,'vote.record','session.vote-recorded',{id,...input},async tx=>{
      const session=await tx.legislativeSession.findFirst({where:{id,...this.scope(r)},include:{agenda:true}});
      if(!session) fail(404,'NOT_FOUND','Session not found.');
      if(session.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this session before recording a vote.');
      if(session.state!=='SCHEDULED') fail(422,'SESSION_CLOSED','Closed sessions cannot change vote records.');
      const item=session.agenda.find(row=>row.measureId===input.measureId);
      if(!item) fail(422,'NOT_ON_AGENDA','Record the measure on the session agenda before entering a tally.');
      const existing=await tx.sessionVote.findFirst({where:{sessionId:id,measureId:input.measureId}});
      if(existing) await tx.sessionVote.update({where:{id:existing.id},data:{yesCount:input.yesCount,noCount:input.noCount,abstainCount:input.abstainCount,measureVersionId:item.measureVersionId,result:'RECORDED'}});
      else await tx.sessionVote.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,sessionId:id,measureId:input.measureId,measureVersionId:item.measureVersionId,yesCount:input.yesCount,noCount:input.noCount,abstainCount:input.abstainCount,result:'RECORDED'}});
      await tx.legislativeSession.update({where:{id},data:{revision:{increment:1}}});
      const result=await tx.legislativeSession.findUniqueOrThrow({where:{id},include});
      return {entityId:id,result:this.view(result),changes:{measureId:input.measureId,note:'A recorded tally is not a certified vote and does not pass or fail a measure.',reason:input.reason}};
    })};
  }
  async calendar(r:AuthRequest,q:unknown) {
    const {page,limit}=paginationSchema.parse(q);
    const events:{id:string;kind:string;reference:string;title:string;venue:string;scheduledAt:Date;state:string;ownerLabel:string}[]=[];
    if(canMunicipality(r.principal,'session.view')) {
      const sessions=await this.ctx.db.legislativeSession.findMany({where:this.scope(r),include:{term:{select:{label:true}}}});
      for(const row of sessions) events.push({id:row.id,kind:'SESSION',reference:row.reference,title:row.title,venue:row.venue,scheduledAt:row.scheduledAt,state:row.state,ownerLabel:row.term.label});
    }
    if(canMunicipality(r.principal,'committee.meeting.view') || assignedCommitteeIds(r.principal,'committee.meeting.view').length) {
      const committeeIds=canMunicipality(r.principal,'committee.meeting.view')?undefined:assignedCommitteeIds(r.principal,'committee.meeting.view');
      const meetings=await this.ctx.db.committeeMeeting.findMany({where:{...this.scope(r),...(committeeIds?{committeeId:{in:committeeIds}}:{})},include:{committee:{select:{name:true}}}});
      for(const row of meetings) events.push({id:row.id,kind:'MEETING',reference:row.reference,title:row.title,venue:row.venue,scheduledAt:row.scheduledAt,state:row.state,ownerLabel:row.committee.name});
    }
    if(!canMunicipality(r.principal,'session.view') && !canMunicipality(r.principal,'committee.meeting.view') && !assignedCommitteeIds(r.principal,'committee.meeting.view').length) fail(403,'ACCESS_DENIED','You do not have access to this action.');
    events.sort((a,b)=>b.scheduledAt.getTime()-a.scheduledAt.getTime()||b.id.localeCompare(a.id));
    const total=events.length;
    const items=events.slice((page-1)*limit,page*limit).map(item=>({...item,scheduledAt:item.scheduledAt.toISOString()}));
    return {items,pageInfo:{page,limit,total}};
  }
  private async addAgenda(tx:Prisma.TransactionClient,r:AuthRequest,sessionId:string,measureIds:string[],start:number) {
    if(new Set(measureIds).size!==measureIds.length) fail(422,'DUPLICATE_MEASURE','A measure can appear on a session agenda only once.');
    for(const [index,measureId] of measureIds.entries()) {
      const measure=await tx.legislativeMeasure.findFirst({where:{id:measureId,...this.scope(r)}});
      if(!measure?.currentVersionId) fail(404,'NOT_FOUND','Measure not found or has no current version.');
      if(await tx.sessionAgendaItem.findFirst({where:{sessionId,measureId}})) fail(409,'CONFLICT','This measure is already on the session agenda.');
      await tx.sessionAgendaItem.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,sessionId,measureId,measureVersionId:measure.currentVersionId,sequence:start+index+1}});
    }
  }
}
