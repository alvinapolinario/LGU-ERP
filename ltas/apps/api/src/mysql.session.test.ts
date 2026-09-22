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
import { MeasuresService } from './measures.service.js';
import { SessionsService } from './sessions.service.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';
import type { Principal } from './domain/policy.js';

loadEnv({path:resolve(import.meta.dirname,'../../../.env')});
const appUrl=process.env['DATABASE_URL'];
const migratorUrl=process.env['MIGRATION_DATABASE_URL'];
const live=Boolean(appUrl && migratorUrl);
const reason='Synthetic session-gate fixture.';
const scheduledAt='2026-09-22T02:00:00.000Z';
function key(label:string):string {return `stest-${label}-${randomUUID().replaceAll('-','')}`.slice(0,100);}
function asRequest(principal:Principal):AuthRequest {
  return {principal,correlationId:randomUUID(),get:(header:string)=>header.toLowerCase()==='idempotency-key'?key(principal.id.slice(0,8)):undefined} as unknown as AuthRequest;
}

describe.skipIf(!live)('T-FR-SESSION-001 MySQL 8.4 session gates',{timeout:30000},()=>{
  let app:Database; let migrator:Database;
  let municipalityId:string; let termId:string; let personId:string; let committeeId:string;
  let sysId:string; let secId:string; let lsId:string; let csId:string;
  let measures:MeasuresService; let sessions:SessionsService; let documents:DocumentsService;
  const issuer='http://ltas.test/realms/session';
  const store=new MemoryObjectStore();

  async function actor(id:string):Promise<AuthRequest> {return asRequest(await loadPrincipal(app,id));}
  function draft() {return {typeCode:'ORDINANCE' as const,termId,title:'An Ordinance Establishing a Session Record',subject:'Synthetic session case',authors:[{personId,role:'AUTHOR' as const,ordering:0}],synopsis:'Session fixture synopsis.',reason};}

  beforeAll(async()=>{
    app=createDatabase(appUrl!); migrator=createDatabase(migratorUrl!);
    municipalityId=randomUUID(); termId=randomUUID(); personId=randomUUID(); committeeId=randomUUID();
    sysId=randomUUID(); secId=randomUUID(); lsId=randomUUID(); csId=randomUUID();
    const code=`STEST${municipalityId.replaceAll('-','').slice(0,10)}`;
    await migrator.$transaction(async tx=>{
      await tx.municipality.create({data:{id:municipalityId,code,name:'Session Test Municipality (Fictional)',province:'Demonstration'}});
      await tx.councilTerm.create({data:{id:termId,municipalityId,label:'Session term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
      await tx.person.create({data:{id:personId,municipalityId,displayName:'Taylor Mendoza'}});
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
    measures=new MeasuresService(ctx,commands);
    sessions=new SessionsService(ctx,commands);
    documents=new DocumentsService(ctx,commands);
  },30000);

  afterAll(async()=>{
    try {
      if(municipalityId && migrator) {
        await migrator.inAppNotification.deleteMany({where:{municipalityId}});
        await migrator.workTask.deleteMany({where:{municipalityId}});
        await migrator.documentVersion.deleteMany({where:{document:{municipalityId}}});
        await migrator.document.deleteMany({where:{municipalityId}});
        await migrator.uploadSession.deleteMany({where:{municipalityId}});
        await migrator.sessionVote.deleteMany({where:{municipalityId}});
        await migrator.sessionAttendance.deleteMany({where:{municipalityId}});
        await migrator.sessionAgendaItem.deleteMany({where:{municipalityId}});
        await migrator.legislativeSession.deleteMany({where:{municipalityId}});
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

  it('schedules a session, records attendance and a tally, and keeps the result unofficial',async()=>{
    const created=await measures.create(await actor(lsId),draft());
    const body={termId,title:'Regular sitting',venue:'Session hall',kind:'REGULAR' as const,scheduledAt,measureIds:[created.data.id],reason};
    await expect(sessions.create(await actor(sysId),body)).rejects.toMatchObject({status:403});
    await expect(sessions.create(await actor(csId),body)).rejects.toMatchObject({status:403});
    await expect(sessions.create(await actor(lsId),body)).rejects.toMatchObject({status:403});
    const scheduled=await sessions.create(await actor(secId),body);
    expect(scheduled.data).toMatchObject({reference:'S-2026-1',state:'SCHEDULED',kind:'REGULAR'});
    expect(scheduled.data.agenda).toHaveLength(1);
    await expect(sessions.list(await actor(lsId),{page:1,limit:25})).resolves.toMatchObject({pageInfo:{total:1}});
    await expect(sessions.list(await actor(csId),{page:1,limit:25})).rejects.toMatchObject({status:403});
    const present=await sessions.recordAttendance(await actor(lsId),scheduled.data.id,{personId,disposition:'PRESENT',expectedRevision:scheduled.data.revision,reason});
    expect(present.data.attendance?.[0]).toMatchObject({personId,disposition:'PRESENT'});
    await expect(sessions.recordVote(await actor(lsId),present.data.id,{measureId:created.data.id,yesCount:5,noCount:1,abstainCount:0,expectedRevision:present.data.revision,reason})).rejects.toMatchObject({status:403});
    const tallied=await sessions.recordVote(await actor(secId),present.data.id,{measureId:created.data.id,yesCount:5,noCount:1,abstainCount:0,expectedRevision:present.data.revision,reason});
    expect(tallied.data.votes?.[0]).toMatchObject({yesCount:5,noCount:1,abstainCount:0,result:'RECORDED'});
    const closed=await sessions.close(await actor(secId),tallied.data.id,{expectedRevision:tallied.data.revision,reason});
    expect(closed.data.state).toBe('CLOSED');
    await expect(sessions.recordAttendance(await actor(secId),closed.data.id,{personId,disposition:'ABSENT',expectedRevision:closed.data.revision,reason})).rejects.toMatchObject({status:422});
    const intent=await documents.createIntent(await actor(secId),{ownerType:'SESSION',ownerId:closed.data.id,originalFilename:'notes.pdf',declaredMime:'application/pdf',expectedBytes:20,reason});
    await documents.storeContent(await actor(secId),intent.data.id,Buffer.from('%PDF-1.4 fixture'));
    const file=await documents.finalize(await actor(secId),intent.data.id,{reason});
    expect(file.data.latestState).toBe('QUARANTINED');
    const calendar=await sessions.calendar(await actor(secId),{page:1,limit:25});
    expect(calendar.items.some(item=>item.kind==='SESSION' && item.reference==='S-2026-1')).toBe(true);
  });
});
