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
import { DocumentsService } from './documents.service.js';
import { MeasuresService } from './measures.service.js';
import { MeetingsService } from './meetings.service.js';
import { ReferralsService } from './referrals.service.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';
import type { Principal } from './domain/policy.js';

loadEnv({path:resolve(import.meta.dirname,'../../../.env')});
const appUrl=process.env['DATABASE_URL'];
const migratorUrl=process.env['MIGRATION_DATABASE_URL'];
const live=Boolean(appUrl && migratorUrl);
const reason='Synthetic meeting-gate fixture.';
const scheduledAt='2026-09-22T02:00:00.000Z';
function statusOf(error:unknown):number {
  if(error instanceof HttpException) return error.getStatus();
  throw error;
}
function key(label:string):string {return `gtest-${label}-${randomUUID().replaceAll('-','')}`.slice(0,100);}
function asRequest(principal:Principal):AuthRequest {
  return {principal,correlationId:randomUUID(),get:(header:string)=>header.toLowerCase()==='idempotency-key'?key(principal.id.slice(0,8)):undefined} as unknown as AuthRequest;
}

describe.skipIf(!live)('T-FR-COMMITTEE-002 MySQL 8.4 meeting gates',{timeout:30000},()=>{
  let app:Database; let migrator:Database;
  let municipalityId:string; let termId:string;
  let personId:string; let leadId:string; let jointId:string;
  let sysId:string; let secId:string; let lsId:string; let csLeadId:string; let csJointId:string;
  let measures:MeasuresService; let referrals:ReferralsService; let meetings:MeetingsService; let documents:DocumentsService;
  const issuer='http://ltas.test/realms/meeting';
  const store=new MemoryObjectStore();

  async function actor(id:string):Promise<AuthRequest> {return asRequest(await loadPrincipal(app,id));}
  function draft() {return {typeCode:'ORDINANCE' as const,termId,title:'An Ordinance Establishing a Meeting Record',subject:'Synthetic meeting case',authors:[{personId,role:'AUTHOR' as const,ordering:0}],synopsis:'Meeting fixture synopsis.',reason};}

  beforeAll(async()=>{
    app=createDatabase(appUrl!); migrator=createDatabase(migratorUrl!);
    municipalityId=randomUUID(); termId=randomUUID(); personId=randomUUID();
    leadId=randomUUID(); jointId=randomUUID();
    sysId=randomUUID(); secId=randomUUID(); lsId=randomUUID(); csLeadId=randomUUID(); csJointId=randomUUID();
    const code=`GTEST${municipalityId.replaceAll('-','').slice(0,10)}`;
    await migrator.$transaction(async tx=>{
      await tx.municipality.create({data:{id:municipalityId,code,name:'Meeting Test Municipality (Fictional)',province:'Demonstration'}});
      await tx.councilTerm.create({data:{id:termId,municipalityId,label:'Meeting term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
      await tx.person.create({data:{id:personId,municipalityId,displayName:'Taylor Mendoza'}});
      await tx.committee.create({data:{id:leadId,municipalityId,termId,code:'GOOD-GOV',name:'Committee on Good Governance'}});
      await tx.committee.create({data:{id:jointId,municipalityId,termId,code:'WAYS-MEANS',name:'Committee on Ways and Means'}});
      for(const [id,name] of [[sysId,'Sys Gate'],[secId,'Secretary Gate'],[lsId,'Staff Gate'],[csLeadId,'Lead Staff'],[csJointId,'Joint Staff']] as const) {
        await tx.user.create({data:{id,municipalityId,issuer,subject:id,displayName:name}});
      }
      const window={validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01')};
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:sysId,role:'SYS',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,approvedBy:secId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:secId,role:'SEC',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,approvedBy:sysId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:lsId,role:'LS',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,approvedBy:sysId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:csLeadId,role:'CS',scopeType:'COMMITTEE',scopeId:leadId,...window,approvedBy:sysId}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:csJointId,role:'CS',scopeType:'COMMITTEE',scopeId:jointId,...window,approvedBy:sysId}});
      await tx.auditCursor.create({data:{municipalityId,sequence:0n,hash:genesisHash}});
    });
    const ctx={db:app,config:{AUDIT_MAX_LAG_SECONDS:3600,OIDC_ISSUER:issuer,MINIO_BUCKET_QUARANTINE:'ltas-quarantine'},store} as unknown as AppContext;
    const commands=new Commands(ctx);
    measures=new MeasuresService(ctx,commands);
    referrals=new ReferralsService(ctx,commands);
    meetings=new MeetingsService(ctx,commands);
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
        await migrator.meetingReferral.deleteMany({where:{municipalityId}});
        await migrator.committeeMeeting.deleteMany({where:{municipalityId}});
        await migrator.committeeReferral.deleteMany({where:{municipalityId}});
        await migrator.measureStatusHistory.deleteMany({where:{municipalityId}});
        await migrator.measureAuthor.deleteMany({where:{municipalityId}});
        await migrator.measureVersion.deleteMany({where:{municipalityId}});
        await migrator.workflowInstance.deleteMany({where:{measure:{municipalityId}}});
        await migrator.legislativeMeasure.deleteMany({where:{municipalityId}});
        await migrator.workflowTransition.deleteMany({where:{profileVersion:{profile:{municipalityId}}}});
        await migrator.workflowProfileVersion.deleteMany({where:{profile:{municipalityId}}});
        await migrator.workflowProfile.deleteMany({where:{municipalityId}});
        await migrator.measureType.deleteMany({where:{municipalityId}});
        await migrator.idempotencyRecord.deleteMany({where:{actorId:{in:[sysId,secId,lsId,csLeadId,csJointId]}}});
        await migrator.outboxEvent.deleteMany({where:{municipalityId}});
        await migrator.auditLog.deleteMany({where:{municipalityId}});
        await migrator.auditCursor.deleteMany({where:{municipalityId}});
        await migrator.userRole.deleteMany({where:{municipalityId}});
        await migrator.user.deleteMany({where:{municipalityId}});
        await migrator.committeeMember.deleteMany({where:{municipalityId}});
        await migrator.committee.deleteMany({where:{municipalityId}});
        await migrator.person.deleteMany({where:{municipalityId}});
        await migrator.councilTerm.deleteMany({where:{municipalityId}});
        await migrator.municipality.deleteMany({where:{id:municipalityId}});
      }
    } finally {await Promise.allSettled([app?.$disconnect(),migrator?.$disconnect()]);}
  });

  it('schedules a meeting, binds same-committee referrals, and blocks other scopes',async()=>{
    const created=await measures.create(await actor(lsId),draft());
    const second=await measures.create(await actor(lsId),{...draft(),title:'An Ordinance For A Later Agenda Item'});
    const assigned=await referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[jointId],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason});
    const later=await referrals.create(await actor(secId),second.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:second.data.revision,reason});
    const body={title:'Regular committee meeting',venue:'Session hall',scheduledAt,referralIds:[assigned.data[0]!.id],reason};
    await expect(meetings.create(await actor(sysId),leadId,body)).rejects.toMatchObject({status:403});
    await expect(meetings.create(await actor(lsId),leadId,body)).rejects.toMatchObject({status:403});
    await expect(meetings.create(await actor(csJointId),leadId,body)).rejects.toMatchObject({status:403});
    await expect(meetings.create(await actor(secId),leadId,{...body,referralIds:[assigned.data[1]!.id]})).rejects.toMatchObject({status:404});
    const scheduled=await meetings.create(await actor(secId),leadId,body);
    expect(scheduled.data).toMatchObject({reference:'M-2026-1',state:'SCHEDULED',title:body.title,venue:body.venue});
    expect(scheduled.data.agenda).toHaveLength(1);
    expect(scheduled.data.agenda?.[0]).toMatchObject({referralId:assigned.data[0]!.id,measureVersionId:assigned.data[0]!.measureVersionId,sequence:1});
    await expect(meetings.list(await actor(csJointId),leadId,{page:1,limit:25})).rejects.toMatchObject({status:404});
    await expect(meetings.list(await actor(lsId),leadId,{page:1,limit:25})).resolves.toMatchObject({pageInfo:{total:1}});
    await expect(meetings.addReferral(await actor(csLeadId),scheduled.data.id,{referralId:assigned.data[0]!.id,expectedRevision:scheduled.data.revision,reason})).rejects.toMatchObject({status:409});
    const withAgenda=await meetings.addReferral(await actor(csLeadId),scheduled.data.id,{referralId:later.data[0]!.id,expectedRevision:scheduled.data.revision,reason});
    expect(withAgenda.data.agenda).toHaveLength(2);
    const closed=await meetings.close(await actor(csLeadId),scheduled.data.id,{expectedRevision:withAgenda.data.revision,reason});
    expect(closed.data.state).toBe('CLOSED');
    await expect(meetings.edit(await actor(secId),scheduled.data.id,{title:'Amended title',venue:'Other hall',scheduledAt,expectedRevision:closed.data.revision,reason})).rejects.toMatchObject({status:422});
    await expect(meetings.addReferral(await actor(secId),scheduled.data.id,{referralId:later.data[0]!.id,expectedRevision:closed.data.revision,reason})).rejects.toMatchObject({status:422});
    const next=await meetings.create(await actor(csLeadId),leadId,{title:'Follow-up meeting',venue:'Committee room',scheduledAt,referralIds:[],reason});
    expect(next.data.reference).toBe('M-2026-2');
    expect(statusOf(Object.assign(new HttpException({code:'MEETING_CLOSED'},422)))).toBe(422);
  });

  it('keeps committee and meeting uploads quarantined after close',async()=>{
    const created=await measures.create(await actor(lsId),{...draft(),title:'An Ordinance With Meeting Files'});
    const assigned=await referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason});
    const scheduled=await meetings.create(await actor(secId),leadId,{title:'File attachment meeting',venue:'Session hall',scheduledAt,referralIds:[assigned.data[0]!.id],reason});
    await meetings.close(await actor(secId),scheduled.data.id,{expectedRevision:scheduled.data.revision,reason});
    const committeeIntent=await documents.createIntent(await actor(secId),{ownerType:'COMMITTEE',ownerId:leadId,originalFilename:'committee.pdf',declaredMime:'application/pdf',expectedBytes:20,reason});
    await documents.storeContent(await actor(secId),committeeIntent.data.id,Buffer.from('%PDF-1.4 fixture'));
    const committeeFile=await documents.finalize(await actor(secId),committeeIntent.data.id,{reason});
    expect(committeeFile.data.latestState).toBe('QUARANTINED');
    const meetingIntent=await documents.createIntent(await actor(csLeadId),{ownerType:'MEETING',ownerId:scheduled.data.id,originalFilename:'minutes-draft.pdf',declaredMime:'application/pdf',expectedBytes:20,reason});
    await documents.storeContent(await actor(csLeadId),meetingIntent.data.id,Buffer.from('%PDF-1.4 fixture'));
    const meetingFile=await documents.finalize(await actor(csLeadId),meetingIntent.data.id,{reason});
    expect(meetingFile.data.scanVerdict).toBe('UNKNOWN');
    await expect(documents.download(await actor(secId),meetingFile.data.id)).rejects.toMatchObject({status:422});
    await expect(documents.createIntent(await actor(csJointId),{ownerType:'COMMITTEE',ownerId:leadId,originalFilename:'other.pdf',declaredMime:'application/pdf',expectedBytes:20,reason})).rejects.toMatchObject({status:404});
    const listed=await documents.forOwner(await actor(secId),'MEETING',scheduled.data.id);
    expect(listed.items.some(item=>item.id===meetingFile.data.id)).toBe(true);
  });
});
