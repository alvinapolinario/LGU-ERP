import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { idSchema, measureCreateSchema, measureEditSchema, measureVersionSchema, paginationSchema, reviewSchema, taskCompleteSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { requirePermission } from './access.js';
import { fail, type AuthRequest } from './http.js';
import { INTERIM_NOTE, INTERIM_PROFILE, interimEdges, resolveTransition } from './domain/workflow.js';
import { takeOfficialNumber } from './domain/numbering.js';
import type { Prisma } from './database.js';

const include={authors:{orderBy:{ordering:'asc'}},versions:{orderBy:{sequence:'desc'},take:1}} as const;

@Injectable()
export class MeasuresService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  async ensureCatalog(tx:Prisma.TransactionClient,municipalityId:string) {
    for(const [code,label] of [['ORDINANCE','Ordinance'],['RESOLUTION','Resolution']] as const) {
      if(!await tx.measureType.findUnique({where:{municipalityId_code:{municipalityId,code}}})) await tx.measureType.create({data:{id:randomUUID(),municipalityId,code,label}});
    }
    let profile=await tx.workflowProfile.findUnique({where:{municipalityId_code:{municipalityId,code:INTERIM_PROFILE}}});
    if(!profile) {
      profile=await tx.workflowProfile.create({data:{id:randomUUID(),municipalityId,code:INTERIM_PROFILE,description:INTERIM_NOTE}});
      const version=await tx.workflowProfileVersion.create({data:{id:randomUUID(),profileId:profile.id,version:1,state:'APPROVED',authorityNote:INTERIM_NOTE}});
      for(const edge of interimEdges) await tx.workflowTransition.create({data:{id:randomUUID(),profileVersionId:version.id,code:edge.code,fromStage:edge.fromStage,toStage:edge.toStage,permission:edge.permission}});
    }
    return tx.workflowProfileVersion.findFirstOrThrow({where:{profile:{municipalityId,code:INTERIM_PROFILE},version:1}});
  }
  private view(row:{versions:Array<{id:string;sequence:number;synopsis:string;frozenAt:Date|null}>;authors:Array<{personId:string;role:string;ordering:number;displayName:string}>;[key:string]:unknown}) {
    const current=row.versions[0]??null;
    return {...row,currentVersionId:current?.id??null,currentVersion:current,versions:undefined};
  }
  async stats(r:AuthRequest) {
    requirePermission(r.principal,'measure.view',this.scope(r));
    const proposed=await this.ctx.db.legislativeMeasure.count({where:{...this.scope(r),stage:{in:['DRAFT','SUBMITTED']}}});
    return {data:{proposed}};
  }
  async list(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'measure.view',this.scope(r));
    const {page,limit}=paginationSchema.parse(q),where=this.scope(r);
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.legislativeMeasure.findMany({where,include,skip:(page-1)*limit,take:limit,orderBy:[{createdAt:'desc'},{id:'desc'}]}),this.ctx.db.legislativeMeasure.count({where})]);
    return {items:items.map(item=>this.view(item)),pageInfo:{page,limit,total}};
  }
  async get(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'measure.view',this.scope(r));
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.legislativeMeasure.findFirst({where:{id,...this.scope(r)},include:{authors:{orderBy:{ordering:'asc'}},versions:{orderBy:{sequence:'asc'}}}});
    if(!row) fail(404,'NOT_FOUND','Measure not found.');
    const current=row.versions.at(-1)??null;
    return {data:{...row,currentVersionId:current?.id??null,currentVersion:current}};
  }
  async timeline(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'measure.view',this.scope(r));
    const id=idSchema.parse(rawId);
    if(!await this.ctx.db.legislativeMeasure.findFirst({where:{id,...this.scope(r)}})) fail(404,'NOT_FOUND','Measure not found.');
    const items=await this.ctx.db.measureStatusHistory.findMany({where:{measureId:id},orderBy:{sequence:'asc'}});
    return {items};
  }
  async create(r:AuthRequest,body:unknown) {
    const input=measureCreateSchema.parse(body);
    return {data:await this.commands.execute(r,'measure.create','measure.created',input,async tx=>{
      const profile=await this.ensureCatalog(tx,r.principal.municipalityId);
      const type=await tx.measureType.findUnique({where:{municipalityId_code:{municipalityId:r.principal.municipalityId,code:input.typeCode}}});
      const term=await tx.councilTerm.findFirst({where:{id:input.termId,...this.scope(r)}});
      if(!type || !term) fail(404,'NOT_FOUND','Measure type or council term not found.');
      const people=await tx.person.findMany({where:{municipalityId:r.principal.municipalityId,id:{in:input.authors.map(a=>a.personId)}}});
      if(people.length!==new Set(input.authors.map(a=>a.personId)).size) fail(404,'NOT_FOUND','Author person not found.');
      const byId=new Map(people.map(p=>[p.id,p]));
      const id=randomUUID();
      const versionId=randomUUID();
      await tx.legislativeMeasure.create({data:{id,municipalityId:r.principal.municipalityId,typeId:type.id,typeCode:input.typeCode,termId:input.termId,title:input.title,subject:input.subject,stage:'DRAFT',currentVersionId:versionId}});
      await tx.measureAuthor.createMany({data:input.authors.map(a=>({id:randomUUID(),municipalityId:r.principal.municipalityId,measureId:id,personId:a.personId,role:a.role,ordering:a.ordering,displayName:byId.get(a.personId)!.displayName}))});
      await tx.measureVersion.create({data:{id:versionId,municipalityId:r.principal.municipalityId,measureId:id,sequence:1,synopsis:input.synopsis}});
      await tx.workflowInstance.create({data:{id:randomUUID(),measureId:id,profileVersionId:profile.id}});
      await tx.measureStatusHistory.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,measureId:id,sequence:1,fromStage:null,toStage:'DRAFT',profileVersionId:profile.id,actorId:r.principal.id,reason:input.reason,recordedAt:new Date()}});
      const result=await tx.legislativeMeasure.findUniqueOrThrow({where:{id},include});
      return {entityId:id,result:this.view(result),changes:{title:input.title,typeCode:input.typeCode,reason:input.reason}};
    })};
  }
  async edit(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=measureEditSchema.parse(body);
    return {data:await this.commands.execute(r,'measure.edit','measure.updated',{id,...input},async tx=>{
      const old=await tx.legislativeMeasure.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Measure not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this measure before editing.');
      if(old.stage!=='DRAFT') fail(422,'TRANSITION_DENIED','Metadata can be edited only while the draft is open.');
      const result=await tx.legislativeMeasure.update({where:{id},data:{title:input.title,subject:input.subject,revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{before:{title:old.title,subject:old.subject},after:{title:input.title,subject:input.subject},reason:input.reason}};
    })};
  }
  async addVersion(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=measureVersionSchema.parse(body);
    return {data:await this.commands.execute(r,'measure.version.create','measure.version-created',{id,...input},async tx=>{
      const old=await tx.legislativeMeasure.findFirst({where:{id,...this.scope(r)},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
      if(!old) fail(404,'NOT_FOUND','Measure not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this measure before adding a version.');
      if(old.stage==='WITHDRAWN') fail(422,'TRANSITION_DENIED','Withdrawn measures cannot receive new text versions.');
      const previous=old.versions[0];
      if(previous && !previous.frozenAt) await tx.measureVersion.update({where:{id:previous.id},data:{frozenAt:new Date()}});
      const sequence=(previous?.sequence??0)+1;
      const version=await tx.measureVersion.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,measureId:id,sequence,parentVersionId:previous?.id,synopsis:input.synopsis}});
      const result=await tx.legislativeMeasure.update({where:{id},data:{currentVersionId:version.id,revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{sequence,reason:input.reason}};
    })};
  }
  async transition(r:AuthRequest,rawId:string,code:string,body:unknown) {
    const id=idSchema.parse(rawId),input=reviewSchema.parse(body);
    const preview=await this.ctx.db.legislativeMeasure.findFirst({where:{id,...this.scope(r)}});
    if(!preview) fail(404,'NOT_FOUND','Measure not found.');
    const edge=resolveTransition(preview.stage,code);
    return {data:await this.commands.execute(r,edge.permission,`measure.${code}`,{id,...input},async tx=>{
      const old=await tx.legislativeMeasure.findFirst({where:{id,...this.scope(r)},include:{versions:{orderBy:{sequence:'desc'},take:1},history:true,workflow:true}});
      if(!old) fail(404,'NOT_FOUND','Measure not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this measure before this action.');
      const live=resolveTransition(old.stage,code);
      const current=old.versions[0];
      if(code==='submit' && current && !current.frozenAt) await tx.measureVersion.update({where:{id:current.id},data:{frozenAt:new Date()}});
      await tx.measureStatusHistory.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,measureId:id,sequence:old.history.length+1,fromStage:old.stage,toStage:live.toStage,profileVersionId:old.workflow!.profileVersionId,actorId:r.principal.id,reason:input.reason,recordedAt:new Date()}});
      if(code==='submit') {
        const secretaries=await tx.userRole.findMany({where:{municipalityId:r.principal.municipalityId,role:'SEC',revokedAt:null,validUntil:{gt:new Date()}}});
        const assignee=secretaries.find(g=>g.userId!==r.principal.id)?.userId ?? secretaries[0]?.userId ?? null;
        await tx.workTask.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,ownerType:'MEASURE',ownerId:id,measureId:id,title:`Review submitted draft: ${old.title}`,state:'OPEN',assigneeId:assignee}});
        if(assignee) await tx.inAppNotification.create({data:{id:randomUUID(),municipalityId:r.principal.municipalityId,userId:assignee,eventKey:`measure.submit.${id}`,summary:`A draft measure was submitted for secretariat review.`,ownerType:'MEASURE',ownerId:id}});
      }
      const result=await tx.legislativeMeasure.update({where:{id},data:{stage:live.toStage,revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{from:old.stage,to:live.toStage,reason:input.reason}};
    })};
  }
  async file(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=reviewSchema.parse(body);
    return {data:await this.commands.execute(r,'measure.file','measure.filed',{id,...input},async tx=>{
      const old=await tx.legislativeMeasure.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Measure not found.');
      if(old.revision!==input.expectedRevision) fail(409,'STALE_REVISION','Reload this measure before filing.');
      if(old.stage!=='SUBMITTED') fail(422,'TRANSITION_DENIED','Official numbering is only available after submit.');
      const year=old.createdAt.getUTCFullYear();
      const series=await tx.numberSequence.findFirst({where:{municipalityId:r.principal.municipalityId,typeCode:old.typeCode,year}});
      if(!series) takeOfficialNumber(old.officialNumber,null);
      await tx.$queryRaw`SELECT id FROM number_sequences WHERE id = ${series!.id} FOR UPDATE`;
      const locked=await tx.numberSequence.findUniqueOrThrow({where:{id:series!.id}});
      const official=takeOfficialNumber(old.officialNumber,{series:locked.series,year,nextValue:locked.nextValue});
      await tx.numberSequence.update({where:{id:locked.id},data:{nextValue:{increment:1},revision:{increment:1}}});
      const result=await tx.legislativeMeasure.update({where:{id},data:{officialSeries:official.officialSeries,officialYear:official.officialYear,officialNumber:official.officialNumber,revision:{increment:1}},include});
      return {entityId:id,result:this.view(result),changes:{...official,reason:input.reason}};
    })};
  }
  async tasks(r:AuthRequest,q:unknown) {
    requirePermission(r.principal,'task.manage',this.scope(r));
    const {page,limit}=paginationSchema.parse(q);
    const where={municipalityId:r.principal.municipalityId};
    const [items,total]=await this.ctx.db.$transaction([this.ctx.db.workTask.findMany({where,skip:(page-1)*limit,take:limit,orderBy:{createdAt:'desc'}}),this.ctx.db.workTask.count({where})]);
    return {items,pageInfo:{page,limit,total}};
  }
  async completeTask(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId),input=taskCompleteSchema.parse(body);
    return {data:await this.commands.execute(r,'task.manage','task.completed',{id,...input},async tx=>{
      const old=await tx.workTask.findFirst({where:{id,...this.scope(r)}});
      if(!old) fail(404,'NOT_FOUND','Task not found.');
      if(old.revision!==input.expectedRevision || old.state!=='OPEN') fail(409,'STALE_REVISION','This task has already changed.');
      const result=await tx.workTask.update({where:{id},data:{state:'COMPLETED',completionNote:input.reason,revision:{increment:1}}});
      return {entityId:id,result,changes:{ownerId:old.ownerId,reason:input.reason,note:'Completing a task does not file the measure.'}};
    })};
  }
  async notifications(r:AuthRequest) {
    requirePermission(r.principal,'notification.view',this.scope(r));
    const items=await this.ctx.db.inAppNotification.findMany({where:{userId:r.principal.id},orderBy:{createdAt:'desc'},take:50});
    return {items};
  }
}
