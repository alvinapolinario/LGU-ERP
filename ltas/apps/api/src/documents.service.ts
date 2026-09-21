import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { documentIntentSchema, idSchema, reasonSchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { requirePermission } from './access.js';
import { fail, type AuthRequest } from './http.js';
import { scanBytes, validationStateFor } from './domain/scanner.js';
import { detectMime } from './domain/mime.js';

const maxBytes=25*1024*1024;
function sanitizeName(name:string):string {
  return name.replace(/[/\\]/g,'_').slice(0,200);
}

@Injectable()
export class DocumentsService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  async createIntent(r:AuthRequest,body:unknown) {
    const input=documentIntentSchema.parse(body);
    return {data:await this.commands.execute(r,'document.upload','document.intent-created',input,async tx=>{
      if(input.ownerType==='MEASURE' && !await tx.legislativeMeasure.findFirst({where:{id:input.ownerId,...this.scope(r)}})) fail(404,'NOT_FOUND','Measure not found.');
      const id=randomUUID();
      const quarantineKey=`municipalities/${r.principal.municipalityId}/documents/${id}/versions/${randomUUID()}/object`;
      const result=await tx.uploadSession.create({data:{id,municipalityId:r.principal.municipalityId,uploaderId:r.principal.id,ownerType:input.ownerType,ownerId:input.ownerId,originalFilename:sanitizeName(input.originalFilename),declaredMime:input.declaredMime,expectedBytes:input.expectedBytes,quarantineKey,status:'OPEN',expiresAt:new Date(Date.now()+60*60*1000)}});
      return {entityId:id,result,changes:{ownerId:input.ownerId,filename:result.originalFilename,reason:input.reason}};
    })};
  }
  async storeContent(r:AuthRequest,rawId:string,body:Buffer) {
    requirePermission(r.principal,'document.upload',this.scope(r));
    const id=idSchema.parse(rawId);
    if(body.length===0 || body.length>maxBytes) fail(422,'FILE_TOO_LARGE','Each file must be between 1 byte and 25 MiB (proposed cap).');
    const session=await this.ctx.db.uploadSession.findFirst({where:{id,...this.scope(r),uploaderId:r.principal.id}});
    if(!session || session.status!=='OPEN' || session.expiresAt<=new Date()) fail(404,'NOT_FOUND','Upload intent not found or expired.');
    if(body.length>session.expectedBytes) fail(422,'FILE_TOO_LARGE','The upload exceeds the declared size.');
    const detected=detectMime(body,session.declaredMime);
    if(detected!==session.declaredMime) fail(422,'UNSUPPORTED_TYPE','The file signature does not match the declared type.');
    const bucket=this.ctx.config.MINIO_BUCKET_QUARANTINE;
    await this.ctx.store.put(bucket,session.quarantineKey,body,detected);
    await this.ctx.db.uploadSession.update({where:{id},data:{status:'STORED'}});
    return {data:{id,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')}};
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
      const version=await tx.document.create({data:{id:documentId,municipalityId:r.principal.municipalityId,ownerType:session.ownerType,ownerId:session.ownerId,measureId:session.ownerType==='MEASURE'?session.ownerId:null,title:session.originalFilename,classification:'INTERNAL'}}).then(async doc=>{
        return tx.documentVersion.create({data:{id:randomUUID(),documentId:doc.id,sequence:1,bucket:this.ctx.config.MINIO_BUCKET_QUARANTINE,objectKey:session.quarantineKey,sha256,bytes:bytes.length,detectedMime:session.declaredMime,originalFilename:session.originalFilename,uploadedBy:r.principal.id,validationState:validationStateFor(verdict),scanVerdict:verdict}});
      });
      await tx.uploadSession.update({where:{id},data:{status:'FINALIZED'}});
      return {entityId:documentId,result:{id:documentId,title:session.originalFilename,classification:'INTERNAL',currentReadyVersionId:null,latestState:version.validationState,scanVerdict:version.scanVerdict},changes:{documentId,scanVerdict:verdict,reason}};
    })};
  }
  async get(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'document.view',this.scope(r));
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.document.findFirst({where:{id,...this.scope(r)},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
    if(!row) fail(404,'NOT_FOUND','Document not found.');
    const latest=row.versions[0];
    return {data:{id:row.id,title:row.title,classification:row.classification,currentReadyVersionId:row.currentReadyVersionId,latestState:latest?.validationState??'UNKNOWN',scanVerdict:latest?.scanVerdict??null}};
  }
  async download(r:AuthRequest,rawId:string) {
    requirePermission(r.principal,'document.download',this.scope(r));
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.document.findFirst({where:{id,...this.scope(r)},include:{versions:true}});
    if(!row) fail(404,'NOT_FOUND','Document not found.');
    const ready=row.versions.find(v=>v.validationState==='READY');
    if(!ready) fail(422,'DOCUMENT_NOT_READY','Quarantined files cannot be downloaded until an approved scanner marks them ready (D-13).');
    const bytes=await this.ctx.store.get(ready.bucket,ready.objectKey);
    return new StreamableFile(bytes,{type:ready.detectedMime,disposition:`attachment; filename="${ready.originalFilename.replaceAll('"','')}"`});
  }
  certify(_r:AuthRequest,_rawId:string):never {
    fail(422,'CERTIFIER_NOT_CONFIGURED','Certification requires designated officers (D-03 Q7) and is not available in this slice.');
  }
  async forMeasure(r:AuthRequest,measureId:string) {
    requirePermission(r.principal,'document.view',this.scope(r));
    const items=await this.ctx.db.document.findMany({where:{measureId,municipalityId:r.principal.municipalityId},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
    return {items:items.map(row=>({id:row.id,title:row.title,classification:row.classification,currentReadyVersionId:row.currentReadyVersionId,latestState:row.versions[0]?.validationState??'UNKNOWN'}))};
  }
}
