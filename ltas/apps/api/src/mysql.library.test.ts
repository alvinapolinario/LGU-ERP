import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Commands } from './commands.js';
import { loadPrincipal } from './access.js';
import { createDatabase, type Database } from './database.js';
import { genesisHash } from './domain/integrity.js';
import { MemoryObjectStore } from './domain/storage.js';
import { DocumentsService } from './documents.service.js';
import { LibraryService } from './library.service.js';
import { MeasuresService } from './measures.service.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';
import type { Principal } from './domain/policy.js';

loadEnv({path:resolve(import.meta.dirname,'../../../.env')});
const appUrl=process.env['DATABASE_URL'];
const migratorUrl=process.env['MIGRATION_DATABASE_URL'];
const live=Boolean(appUrl && migratorUrl);
const reason='Synthetic library-gate fixture.';
function key(label:string):string {return `ltest-${label}-${randomUUID().replaceAll('-','')}`.slice(0,100);}
function asRequest(principal:Principal):AuthRequest {
  return {principal,correlationId:randomUUID(),get:(header:string)=>header.toLowerCase()==='idempotency-key'?key(principal.id.slice(0,8)):undefined} as unknown as AuthRequest;
}

describe.skipIf(!live)('T-FR-LIBRARY-001 / T-FR-REPORT-001 MySQL 8.4 library gates',{timeout:30000},()=>{
  let app:Database; let migrator:Database;
  let municipalityId:string; let termId:string; let personId:string; let committeeId:string;
  let sysId:string; let secId:string; let lsId:string; let csId:string;
  let measures:MeasuresService; let library:LibraryService;
  const issuer='http://ltas.test/realms/library';
  const store=new MemoryObjectStore();

  async function actor(id:string):Promise<AuthRequest> {return asRequest(await loadPrincipal(app,id));}
  function draft() {return {typeCode:'ORDINANCE' as const,termId,title:'An Ordinance Establishing a Library Record',subject:'Synthetic library case',authors:[{personId,role:'AUTHOR' as const,ordering:0}],synopsis:'Library fixture synopsis.',reason};}

  beforeAll(async()=>{
    app=createDatabase(appUrl!); migrator=createDatabase(migratorUrl!);
    municipalityId=randomUUID(); termId=randomUUID(); personId=randomUUID(); committeeId=randomUUID();
    sysId=randomUUID(); secId=randomUUID(); lsId=randomUUID(); csId=randomUUID();
    const code=`LTEST${municipalityId.replaceAll('-','').slice(0,10)}`;
    await migrator.$transaction(async tx=>{
      await tx.municipality.create({data:{id:municipalityId,code,name:'Library Test Municipality (Fictional)',province:'Demonstration'}});
      await tx.councilTerm.create({data:{id:termId,municipalityId,label:'Library term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
      await tx.person.create({data:{id:personId,municipalityId,termId,displayName:'Taylor Mendoza'}});
      await tx.committee.create({data:{id:committeeId,municipalityId,termId,code:'GOOD-GOV',name:'Committee on Good Governance'}});
      for(const [id,name] of [[sysId,'Sys Gate'],[secId,'Secretary Gate'],[lsId,'Staff Gate'],[csId,'Committee Gate']] as const) {
        await tx.user.create({data:{id,municipalityId,issuer,subject:id,displayName:name}});
      }
      const window={validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01')};
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:sysId,role:'SYS',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,approvedBy:secId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:secId,role:'SEC',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,approvedBy:sysId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:lsId,role:'LS',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,approvedBy:sysId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:csId,role:'CS',scopeType:'COMMITTEE',scopeId:committeeId,...window,approvedBy:sysId}});
      await tx.auditCursor.create({data:{municipalityId,sequence:0n,hash:genesisHash}});
    });
    const ctx={db:app,config:{AUDIT_MAX_LAG_SECONDS:3600,OIDC_ISSUER:issuer,MINIO_BUCKET_QUARANTINE:'ltas-quarantine'},store} as unknown as AppContext;
    const commands=new Commands(ctx);
    const documents=new DocumentsService(ctx,commands);
    measures=new MeasuresService(ctx,commands);
    library=new LibraryService(ctx,documents);
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
        await migrator.measureType.deleteMany({where:{municipalityId}});
        await migrator.idempotencyRecord.deleteMany({where:{actorId:{in:[sysId,secId,lsId,csId]}}});
        await migrator.outboxEvent.deleteMany({where:{municipalityId}});
        await migrator.auditLog.deleteMany({where:{municipalityId}});
        await migrator.auditCursor.deleteMany({where:{municipalityId}});
        await migrator.userRole.deleteMany({where:{municipalityId}});
        await migrator.user.deleteMany({where:{municipalityId}});
        await migrator.committee.deleteMany({where:{municipalityId}});
        await migrator.person.deleteMany({where:{municipalityId}});
        await migrator.councilTerm.deleteMany({where:{municipalityId}});
        await migrator.municipality.deleteMany({where:{id:municipalityId}});
      }
    } finally {await Promise.allSettled([app?.$disconnect(),migrator?.$disconnect()]);}
  });

  it('filters library hits and reconciles report totals to dashboard stats',async()=>{
    const created=await measures.create(await actor(lsId),draft());
    await expect(library.search(await actor(sysId),{page:1,limit:25})).rejects.toMatchObject({status:403});
    await expect(library.reports(await actor(sysId))).rejects.toMatchObject({status:403});
    const hits=await library.search(await actor(secId),{page:1,limit:25,q:'Library Record',kind:'MEASURE'});
    expect(hits.items.some(item=>item.id===created.data.id && item.kind==='MEASURE')).toBe(true);
    const hidden=await library.search(await actor(csId),{page:1,limit:25,q:'Library Record',kind:'MEASURE'});
    expect(hidden.items.some(item=>item.id===created.data.id)).toBe(false);
    const stats=await measures.stats(await actor(secId));
    const report=await library.reports(await actor(secId));
    const proposed=report.data.metrics.find(item=>item.key==='measures.proposed')?.value;
    const pending=report.data.metrics.find(item=>item.key==='referrals.pendingMeasures')?.value;
    expect(report.data.definitionVersion).toBe('P-REPORT-INTERIM-1');
    expect(proposed).toBe(stats.data.proposed);
    expect(pending).toBe(stats.data.pendingCommittee);
    const scoped=await library.reports(await actor(csId));
    expect(scoped.data.metrics.find(item=>item.key==='measures.proposed')?.value).toBe(0);
    expect(scoped.data.metrics.find(item=>item.key==='sessions.scheduled')?.value).toBe(0);
  });
});
