import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { Commands } from './commands.js';
import { loadPrincipal } from './access.js';
import { createDatabase, type Database } from './database.js';
import { genesisHash } from './domain/integrity.js';
import { MemoryObjectStore } from './domain/storage.js';
import { MeasuresService } from './measures.service.js';
import { DocumentsService } from './documents.service.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';
import type { Principal } from './domain/policy.js';

loadEnv({path:resolve(import.meta.dirname,'../../../.env')});
const appUrl=process.env['DATABASE_URL'];
const migratorUrl=process.env['MIGRATION_DATABASE_URL'];
const live=Boolean(appUrl && migratorUrl);
const reason='Synthetic measure-gate fixture.';
function statusOf(error:unknown):number {
  if(error instanceof HttpException) return error.getStatus();
  throw error;
}
function key(label:string):string {return `mtest-${label}-${randomUUID().replaceAll('-','')}`.slice(0,100);}
function asRequest(principal:Principal):AuthRequest {
  return {principal,correlationId:randomUUID(),get:(header:string)=>header.toLowerCase()==='idempotency-key'?key(principal.id.slice(0,8)):undefined} as unknown as AuthRequest;
}

describe.skipIf(!live)('T-FR-MEASURE MySQL 8.4 gates',{timeout:30000},()=>{
  let app:Database; let peer:Database; let migrator:Database;
  let municipalityId:string; let termId:string; let personId:string;
  let sysId:string; let secId:string; let lsId:string;
  let measures:MeasuresService; let peerMeasures:MeasuresService; let documents:DocumentsService;
  const issuer='http://ltas.test/realms/measure';
  const store=new MemoryObjectStore();

  async function actor(id:string,db:Database=app):Promise<AuthRequest> {return asRequest(await loadPrincipal(db,id));}
  function services(db:Database) {
    const ctx={db,config:{AUDIT_MAX_LAG_SECONDS:3600,OIDC_ISSUER:issuer,MINIO_BUCKET_QUARANTINE:'ltas-quarantine'},store} as unknown as AppContext;
    const commands=new Commands(ctx);
    return {measures:new MeasuresService(ctx,commands),documents:new DocumentsService(ctx,commands)};
  }

  beforeAll(async()=>{
    app=createDatabase(appUrl!); peer=createDatabase(appUrl!); migrator=createDatabase(migratorUrl!);
    municipalityId=randomUUID(); termId=randomUUID(); personId=randomUUID(); sysId=randomUUID(); secId=randomUUID(); lsId=randomUUID();
    const code=`MTEST${municipalityId.replaceAll('-','').slice(0,10)}`;
    await migrator.$transaction(async tx=>{
      await tx.municipality.create({data:{id:municipalityId,code,name:'Measure Test Municipality (Fictional)',province:'Demonstration'}});
      await tx.councilTerm.create({data:{id:termId,municipalityId,label:'Measure term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
      await tx.person.create({data:{id:personId,municipalityId,displayName:'Taylor Mendoza'}});
      for(const [id,name] of [[sysId,'Sys Gate'],[secId,'Secretary Gate'],[lsId,'Staff Gate']] as const) {
        await tx.user.create({data:{id,municipalityId,issuer,subject:id,displayName:name}});
      }
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:sysId,role:'SYS',scopeType:'MUNICIPALITY',scopeId:municipalityId,validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01'),approvedBy:secId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:secId,role:'SEC',scopeType:'MUNICIPALITY',scopeId:municipalityId,validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01'),approvedBy:sysId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:lsId,role:'LS',scopeType:'MUNICIPALITY',scopeId:municipalityId,validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01'),approvedBy:sysId}});
      await tx.auditCursor.create({data:{municipalityId,sequence:0n,hash:genesisHash}});
    });
    ({measures,documents}=services(app));
    peerMeasures=services(peer).measures;
  },30000);

  afterAll(async()=>{
    try {
      if(municipalityId && migrator) {
        await migrator.inAppNotification.deleteMany({where:{municipalityId}});
        await migrator.workTask.deleteMany({where:{municipalityId}});
        await migrator.documentVersion.deleteMany({where:{document:{municipalityId}}});
        await migrator.document.deleteMany({where:{municipalityId}});
        await migrator.uploadSession.deleteMany({where:{municipalityId}});
        await migrator.measureStatusHistory.deleteMany({where:{municipalityId}});
        await migrator.measureAuthor.deleteMany({where:{municipalityId}});
        await migrator.measureVersion.deleteMany({where:{municipalityId}});
        await migrator.workflowInstance.deleteMany({where:{measure:{municipalityId}}});
        await migrator.legislativeMeasure.deleteMany({where:{municipalityId}});
        await migrator.workflowTransition.deleteMany({where:{profileVersion:{profile:{municipalityId}}}});
        await migrator.workflowProfileVersion.deleteMany({where:{profile:{municipalityId}}});
        await migrator.workflowProfile.deleteMany({where:{municipalityId}});
        await migrator.numberSequence.deleteMany({where:{municipalityId}});
        await migrator.measureType.deleteMany({where:{municipalityId}});
        await migrator.idempotencyRecord.deleteMany({where:{actorId:{in:[sysId,secId,lsId]}}});
        await migrator.outboxEvent.deleteMany({where:{municipalityId}});
        await migrator.auditLog.deleteMany({where:{municipalityId}});
        await migrator.auditCursor.deleteMany({where:{municipalityId}});
        await migrator.userRole.deleteMany({where:{municipalityId}});
        await migrator.user.deleteMany({where:{municipalityId}});
        await migrator.person.deleteMany({where:{municipalityId}});
        await migrator.councilTerm.deleteMany({where:{municipalityId}});
        await migrator.municipality.deleteMany({where:{id:municipalityId}});
      }
    } finally {await Promise.allSettled([app?.$disconnect(),peer?.$disconnect(),migrator?.$disconnect()]);}
  });

  const draftBody=()=>({typeCode:'ORDINANCE' as const,termId,title:'An Ordinance Establishing a Draft Record',subject:'Synthetic case file',authors:[{personId,role:'AUTHOR' as const,ordering:0}],synopsis:'First synopsis text for the draft.',reason});

  it('T-FR-MEASURE-001 refuses official filing without D-04 and denies SYS/LS file',async()=>{
    const created=await measures.create(await actor(lsId),draftBody());
    const submitted=await measures.transition(await actor(lsId),created.data.id,'submit',{expectedRevision:created.data.revision,reason});
    await expect(measures.file(await actor(secId),created.data.id,{expectedRevision:submitted.data.revision,reason})).rejects.toMatchObject({status:422});
    await expect(measures.create(await actor(sysId),draftBody())).rejects.toMatchObject({status:403});
    await expect(measures.file(await actor(lsId),created.data.id,{expectedRevision:submitted.data.revision,reason})).rejects.toMatchObject({status:403});
  });

  it('creates a new frozen version instead of overwriting',async()=>{
    const created=await measures.create(await actor(lsId),draftBody());
    const first=created.data.currentVersion!;
    const next=await measures.addVersion(await actor(lsId),created.data.id,{synopsis:'Second synopsis, new row.',expectedRevision:created.data.revision,reason});
    expect(next.data.currentVersion!.sequence).toBe(2);
    expect(next.data.currentVersion!.id).not.toBe(first.id);
    const reloaded=await measures.get(await actor(lsId),created.data.id);
    expect(reloaded.data.versions).toHaveLength(2);
    expect(reloaded.data.versions[0]!.synopsis).toBe(first.synopsis);
  });

  it('rejects a disallowed transition and a stale submit',async()=>{
    const created=await measures.create(await actor(lsId),draftBody());
    await expect(measures.transition(await actor(lsId),created.data.id,'withdraw',{expectedRevision:created.data.revision+1,reason})).rejects.toMatchObject({status:409});
    const withdrawn=await measures.transition(await actor(lsId),created.data.id,'withdraw',{expectedRevision:created.data.revision,reason});
    expect(withdrawn.data.stage).toBe('WITHDRAWN');
    await expect(measures.transition(await actor(lsId),created.data.id,'submit',{expectedRevision:withdrawn.data.revision,reason})).rejects.toMatchObject({status:422});
  });

  it('allocates exactly one official number under concurrent file with a synthetic series',async()=>{
    const created=await measures.create(await actor(lsId),draftBody());
    const submitted=await measures.transition(await actor(lsId),created.data.id,'submit',{expectedRevision:created.data.revision,reason});
    await migrator.numberSequence.create({data:{id:randomUUID(),municipalityId,series:'SYN-TEST',typeCode:'ORDINANCE',year:created.data.createdAt?new Date(created.data.createdAt).getUTCFullYear():new Date().getUTCFullYear(),nextValue:1}});
    const body={expectedRevision:submitted.data.revision,reason};
    const settled=await Promise.allSettled([
      measures.file(await actor(secId),created.data.id,body),
      peerMeasures.file(await actor(secId,peer),created.data.id,body),
    ]);
    const accepted=settled.filter(item=>item.status==='fulfilled');
    const denied=settled.filter(item=>item.status==='rejected');
    expect(accepted).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(statusOf((denied[0] as PromiseRejectedResult).reason)).toBe(409);
    const row=await app.legislativeMeasure.findUniqueOrThrow({where:{id:created.data.id}});
    expect(row.officialNumber).toBe(1);
    expect(row.officialSeries).toBe('SYN-TEST');
  });

  it('keeps an unknown scan in quarantine',async()=>{
    const created=await measures.create(await actor(lsId),draftBody());
    const intent=await documents.createIntent(await actor(lsId),{ownerType:'MEASURE',ownerId:created.data.id,originalFilename:'draft.pdf',declaredMime:'application/pdf',expectedBytes:20,reason});
    await documents.storeContent(await actor(lsId),intent.data.id,Buffer.from('%PDF-1.4 fixture'));
    const finalized=await documents.finalize(await actor(lsId),intent.data.id,{reason});
    expect(finalized.data.latestState).toBe('QUARANTINED');
    expect(finalized.data.scanVerdict).toBe('UNKNOWN');
    await expect(documents.download(await actor(lsId),finalized.data.id)).rejects.toMatchObject({status:422});
  });
});
