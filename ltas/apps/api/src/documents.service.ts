import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { documentIntentSchema, idSchema, paginationSchema, reasonSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { assignedCommitteeIds, canMunicipality, measureVisibility, requireCommitteePermission, requirePermission } from './access.js';
import { can } from './domain/policy.js';
import { fail, type AuthRequest } from './http.js';
import { readyVersionId, scanBytes, validationStateFor } from './domain/scanner.js';
import { detectMime } from './domain/mime.js';

const maxBytes=25*1024*1024;
function sanitizeName(name:string):string {
  return name.replace(/[/\\]/g,'_').slice(0,200);
}

@Injectable()
export class DocumentsService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  private visibleMeasure(r:AuthRequest) {
    const where=measureVisibility(r.principal,'measure.view');
    if(!where) fail(403,'ACCESS_DENIED','You do not have access to this action.');
    return where;
  }
  private documentCommittee(r:AuthRequest,permission:'document.view'|'document.upload'|'document.download') {
    if(canMunicipality(r.principal,permission)) return undefined;
    const committeeId=assignedCommitteeIds(r.principal,permission)[0];
    if(!committeeId) fail(403,'ACCESS_DENIED','You do not have access to this action.');
    return committeeId;
  }
  private async assertOwner(r:AuthRequest,ownerType:string,ownerId:string) {
    if(ownerType==='MEASURE') {
      if(!await this.ctx.db.legislativeMeasure.findFirst({where:{id:ownerId,...this.visibleMeasure(r)}})) fail(404,'NOT_FOUND','Measure not found.');
      return;
    }
    if(ownerType==='COMMITTEE') {
      const committee=await this.ctx.db.committee.findFirst({where:{id:ownerId,...this.scope(r)}});
      if(!committee || !(canMunicipality(r.principal,'committee.view') || can(r.principal,'committee.view',{...this.scope(r),committeeId:ownerId}))) fail(404,'NOT_FOUND','Committee not found.');
      return;
    }
    if(ownerType==='MEETING') {
      const meeting=await this.ctx.db.committeeMeeting.findFirst({where:{id:ownerId,...this.scope(r)}});
      if(!meeting || !(canMunicipality(r.principal,'committee.view') || can(r.principal,'committee.view',{...this.scope(r),committeeId:meeting.committeeId}))) fail(404,'NOT_FOUND','Meeting not found.');
      requireCommitteePermission(r.principal,'committee.meeting.view',meeting.committeeId);
      return;
    }
    if(ownerType==='SESSION') {
      if(!canMunicipality(r.principal,'session.view') || !await this.ctx.db.legislativeSession.findFirst({where:{id:ownerId,...this.scope(r)}})) fail(404,'NOT_FOUND','Session not found.');
      return;
    }
    fail(422,'UNSUPPORTED_OWNER','This owner type cannot receive documents in this slice.');
  }
  async createIntent(r:AuthRequest,body:unknown) {
    const input=documentIntentSchema.parse(body);
    const committeeId=this.documentCommittee(r,'document.upload');
    return {data:await this.commands.execute(r,'document.upload','document.intent-created',input,async tx=>{
      if(input.ownerType==='MEASURE' && !await tx.legislativeMeasure.findFirst({where:{id:input.ownerId,...this.visibleMeasure(r)}})) fail(404,'NOT_FOUND','Measure not found.');
      if(input.ownerType==='COMMITTEE') {
        const committee=await tx.committee.findFirst({where:{id:input.ownerId,...this.scope(r)}});
        if(!committee || !(canMunicipality(r.principal,'committee.view') || can(r.principal,'committee.view',{...this.scope(r),committeeId:input.ownerId}))) fail(404,'NOT_FOUND','Committee not found.');
      }
      if(input.ownerType==='MEETING') {
        const meeting=await tx.committeeMeeting.findFirst({where:{id:input.ownerId,...this.scope(r)}});
        if(!meeting || !(canMunicipality(r.principal,'committee.view') || can(r.principal,'committee.view',{...this.scope(r),committeeId:meeting.committeeId}))) fail(404,'NOT_FOUND','Meeting not found.');
      }
      if(input.ownerType==='SESSION') {
        if(!canMunicipality(r.principal,'session.view') || !await tx.legislativeSession.findFirst({where:{id:input.ownerId,...this.scope(r)}})) fail(404,'NOT_FOUND','Session not found.');
      }
      const id=randomUUID();
      const quarantineKey=`municipalities/${r.principal.municipalityId}/documents/${id}/versions/${randomUUID()}/object`;
      const result=await tx.uploadSession.create({data:{id,municipalityId:r.principal.municipalityId,uploaderId:r.principal.id,ownerType:input.ownerType,ownerId:input.ownerId,originalFilename:sanitizeName(input.originalFilename),declaredMime:input.declaredMime,expectedBytes:input.expectedBytes,quarantineKey,status:'OPEN',expiresAt:new Date(Date.now()+60*60*1000)}});
      return {entityId:id,result,changes:{ownerId:input.ownerId,filename:result.originalFilename,reason:input.reason}};
    },committeeId)};
  }
  async storeContent(r:AuthRequest,rawId:string,body:Buffer) {
    const id=idSchema.parse(rawId);
    const reason=reasonSchema.parse(r.get('x-audit-reason'));
    if(body.length===0 || body.length>maxBytes) fail(422,'FILE_TOO_LARGE','Each file must be between 1 byte and 25 MiB (proposed cap).');
    const preview=await this.ctx.db.uploadSession.findFirst({where:{id,...this.scope(r),uploaderId:r.principal.id}});
    if(!preview || preview.expiresAt<=new Date() || (preview.status!=='OPEN' && preview.status!=='STORED')) fail(404,'NOT_FOUND','Upload intent not found or expired.');
    if(body.length>preview.expectedBytes) fail(422,'FILE_TOO_LARGE','The upload exceeds the declared size.');
    const detected=detectMime(body,preview.declaredMime);
    if(detected!==preview.declaredMime) fail(422,'UNSUPPORTED_TYPE','The file signature does not match the declared type.');
    const sha256=createHash('sha256').update(body).digest('hex');
    const bucket=this.ctx.config.MINIO_BUCKET_QUARANTINE;
    const data=await this.commands.execute(r,'document.upload','document.content-stored',{id,sha256,bytes:body.length,detectedMime:detected,reason},async tx=>{
      const claimed=await tx.uploadSession.updateMany({where:{id,...this.scope(r),uploaderId:r.principal.id,status:'OPEN',expiresAt:{gt:new Date()}},data:{status:'STORED'}});
      if(claimed.count!==1) fail(409,'UPLOAD_ALREADY_STORED','This upload intent already received file bytes. Create a new intent to send a different file.');
      await this.ctx.store.put(bucket,preview.quarantineKey,body,detected);
      return {entityId:id,result:{id,bytes:body.length,sha256},changes:{sha256,bytes:body.length,detectedMime:detected,filename:preview.originalFilename,reason}};
    },this.documentCommittee(r,'document.upload'));
    return {data};
  }
  async finalize(r:AuthRequest,rawId:string,body:unknown) {
    const id=idSchema.parse(rawId);
    const reason=reasonSchema.parse((body as {reason?:unknown})?.reason);
    return {data:await this.commands.execute(r,'document.upload','document.finalized',{id,reason},async tx=>{
      const session=await tx.uploadSession.findFirst({where:{id,...this.scope(r),uploaderId:r.principal.id}});
      if(!session || session.status!=='STORED') fail(422,'UPLOAD_INCOMPLETE','Upload the file bytes before finalizing.');
      const bytes=await this.ctx.store.get(this.ctx.config.MINIO_BUCKET_QUARANTINE,session.quarantineKey);
      const sha256=createHash('sha256').update(bytes).digest('hex');
      const verdict=scanBytes(bytes);
      const documentId=randomUUID();
      const versionId=randomUUID();
      const currentReadyVersionId=readyVersionId(verdict,versionId);
      const version=await tx.document.create({data:{id:documentId,municipalityId:r.principal.municipalityId,ownerType:session.ownerType,ownerId:session.ownerId,measureId:session.ownerType==='MEASURE'?session.ownerId:null,title:session.originalFilename,classification:'INTERNAL',currentReadyVersionId}}).then(async doc=>{
        return tx.documentVersion.create({data:{id:versionId,documentId:doc.id,sequence:1,bucket:this.ctx.config.MINIO_BUCKET_QUARANTINE,objectKey:session.quarantineKey,sha256,bytes:bytes.length,detectedMime:session.declaredMime,originalFilename:session.originalFilename,uploadedBy:r.principal.id,validationState:validationStateFor(verdict),scanVerdict:verdict}});
      });
      await tx.uploadSession.update({where:{id},data:{status:'FINALIZED'}});
      return {entityId:documentId,result:{id:documentId,title:session.originalFilename,classification:'INTERNAL',currentReadyVersionId,latestState:version.validationState,scanVerdict:version.scanVerdict},changes:{documentId,scanVerdict:verdict,currentReadyVersionId,reason}};
    },this.documentCommittee(r,'document.upload'))};
  }
  async get(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'document.view',{...this.scope(r),committeeId:this.documentCommittee(r,'document.view')});
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.document.findFirst({where:{id,...this.scope(r)},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
    if(!row) fail(404,'NOT_FOUND','Document not found.');
    if(row.measureId && !await this.ctx.db.legislativeMeasure.findFirst({where:{id:row.measureId,...this.visibleMeasure(r)}})) fail(404,'NOT_FOUND','Document not found.');
    if(row.ownerType!=='MEASURE') await this.assertOwner(r,row.ownerType,row.ownerId);
    const latest=row.versions[0];
    return {data:{id:row.id,title:row.title,classification:row.classification,currentReadyVersionId:row.currentReadyVersionId,latestState:latest?.validationState??'UNKNOWN',scanVerdict:latest?.scanVerdict??null}};
  }
  async download(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'document.download',{...this.scope(r),committeeId:this.documentCommittee(r,'document.download')});
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.document.findFirst({where:{id,...this.scope(r)},include:{versions:true}});
    if(!row) fail(404,'NOT_FOUND','Document not found.');
    if(row.measureId && !await this.ctx.db.legislativeMeasure.findFirst({where:{id:row.measureId,...this.visibleMeasure(r)}})) fail(404,'NOT_FOUND','Document not found.');
    if(row.ownerType!=='MEASURE') await this.assertOwner(r,row.ownerType,row.ownerId);
    const ready=row.currentReadyVersionId ? row.versions.find(v=>v.id===row.currentReadyVersionId && v.validationState==='READY') : undefined;
    if(!ready) fail(422,'DOCUMENT_NOT_READY','Quarantined files cannot be downloaded until an approved scanner marks them ready (D-13).');
    const bytes=await this.ctx.store.get(ready.bucket,ready.objectKey);
    return new StreamableFile(bytes,{type:ready.detectedMime,disposition:`attachment; filename="${ready.originalFilename.replaceAll('"','')}"`});
  }
  certify(_r:AuthRequest,_rawId:string):never {
    fail(422,'CERTIFIER_NOT_CONFIGURED','Certification requires designated officers (D-03 Q7) and is not available in this slice.');
  }
  async forMeasure(r:AuthRequest,measureId:string) {
    requirePermission(r.principal,'document.view',{...this.scope(r),committeeId:this.documentCommittee(r,'document.view')});
    if(!await this.ctx.db.legislativeMeasure.findFirst({where:{id:measureId,...this.visibleMeasure(r)}})) fail(404,'NOT_FOUND','Measure not found.');
    const items=await this.ctx.db.document.findMany({where:{measureId,municipalityId:r.principal.municipalityId},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
    return {items:items.map(row=>({id:row.id,title:row.title,classification:row.classification,currentReadyVersionId:row.currentReadyVersionId,latestState:row.versions[0]?.validationState??'UNKNOWN'}))};
  }
  async forOwner(r:AuthRequest,ownerType:'COMMITTEE'|'MEETING'|'SESSION',ownerId:string) {
    requirePermission(r.principal,'document.view',{...this.scope(r),committeeId:this.documentCommittee(r,'document.view')});
    await this.assertOwner(r,ownerType,ownerId);
    const items=await this.ctx.db.document.findMany({where:{ownerType,ownerId,municipalityId:r.principal.municipalityId},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
    return {items:items.map(row=>({id:row.id,title:row.title,classification:row.classification,currentReadyVersionId:row.currentReadyVersionId,latestState:row.versions[0]?.validationState??'UNKNOWN'}))};
  }
  async pageVisible(r:AuthRequest, needle:string, skip:number, take:number) {
    const where=await this.documentWhere(r);
    const filtered=needle?{AND:[where,{OR:[{title:{contains:needle}},{ownerType:{contains:needle}}]}]}:where;
    const [rows,total]=await this.ctx.db.$transaction([
      this.ctx.db.document.findMany({where:filtered,include:{versions:{orderBy:{sequence:'desc' as const},take:1}},orderBy:{createdAt:'desc'},skip,take}),
      this.ctx.db.document.count({where:filtered}),
    ]);
    return {rows,total};
  }
  async visible(r:AuthRequest) {
    const where=await this.documentWhere(r);
    return this.ctx.db.document.findMany({where,include:{versions:{orderBy:{sequence:'desc' as const},take:1}},orderBy:{createdAt:'desc'}});
  }
  private async documentWhere(r:AuthRequest) {
    requirePermission(r.principal,'document.view',{...this.scope(r),committeeId:this.documentCommittee(r,'document.view')});
    if(canMunicipality(r.principal,'document.view')) return this.scope(r);
    const committeeIds=assignedCommitteeIds(r.principal,'document.view');
    const meetings=await this.ctx.db.committeeMeeting.findMany({where:{...this.scope(r),committeeId:{in:committeeIds}},select:{id:true}});
    return {municipalityId:r.principal.municipalityId,OR:[
      {ownerType:'MEASURE',measure:{referrals:{some:{committeeId:{in:committeeIds}}}}},
      {ownerType:'COMMITTEE',ownerId:{in:committeeIds}},
      {ownerType:'MEETING',ownerId:{in:meetings.map(row=>row.id)}},
    ]};
  }
  async list(r:AuthRequest,q:unknown) {
    const {page,limit}=paginationSchema.parse(q);
    const where=await this.documentWhere(r);
    const [rows,total]=await this.ctx.db.$transaction([
      this.ctx.db.document.findMany({where,include:{versions:{orderBy:{sequence:'desc' as const},take:1}},orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:limit}),
      this.ctx.db.document.count({where}),
    ]);
    const items=rows.map(row=>({id:row.id,title:row.title,classification:row.classification,currentReadyVersionId:row.currentReadyVersionId,latestState:row.versions[0]?.validationState??'UNKNOWN',ownerType:row.ownerType,ownerId:row.ownerId}));
    return {items,pageInfo:{page,limit,total}};
  }
}
