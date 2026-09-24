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
import { ReferralsService } from './referrals.service.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';
import type { Principal } from './domain/policy.js';

loadEnv({path:resolve(import.meta.dirname,'../../../.env')});
const appUrl=process.env['DATABASE_URL'];
const migratorUrl=process.env['MIGRATION_DATABASE_URL'];
const live=Boolean(appUrl && migratorUrl);
const reason='Synthetic referral-gate fixture.';
function statusOf(error:unknown):number {
  if(error instanceof HttpException) return error.getStatus();
  throw error;
}
function key(label:string):string {return `rtest-${label}-${randomUUID().replaceAll('-','')}`.slice(0,100);}
function asRequest(principal:Principal):AuthRequest {
  return {principal,correlationId:randomUUID(),get:(header:string)=>header.toLowerCase()==='idempotency-key'?key(principal.id.slice(0,8)):undefined} as unknown as AuthRequest;
}

describe.skipIf(!live)('T-FR-COMMITTEE-002 MySQL 8.4 referral gates',{timeout:30000},()=>{
  let app:Database; let migrator:Database;
  let municipalityId:string; let termId:string; let otherTermId:string;
  let personId:string; let leadId:string; let jointId:string; let otherTermCommitteeId:string;
  let sysId:string; let secId:string; let lsId:string; let csLeadId:string; let csJointId:string;
  let measures:MeasuresService; let referrals:ReferralsService;
  const issuer='http://ltas.test/realms/referral';

  async function actor(id:string):Promise<AuthRequest> {return asRequest(await loadPrincipal(app,id));}
  function draft() {return {typeCode:'ORDINANCE' as const,termId,title:'An Ordinance Establishing a Referral Record',subject:'Synthetic referral case',authors:[{personId,role:'AUTHOR' as const,ordering:0}],synopsis:'Referral fixture synopsis.',reason};}

  beforeAll(async()=>{
    app=createDatabase(appUrl!); migrator=createDatabase(migratorUrl!);
    municipalityId=randomUUID(); termId=randomUUID(); otherTermId=randomUUID(); personId=randomUUID();
    leadId=randomUUID(); jointId=randomUUID(); otherTermCommitteeId=randomUUID();
    sysId=randomUUID(); secId=randomUUID(); lsId=randomUUID(); csLeadId=randomUUID(); csJointId=randomUUID();
    const code=`RTEST${municipalityId.replaceAll('-','').slice(0,10)}`;
    await migrator.$transaction(async tx=>{
      await tx.municipality.create({data:{id:municipalityId,code,name:'Referral Test Municipality (Fictional)',province:'Demonstration'}});
      await tx.councilTerm.create({data:{id:termId,municipalityId,label:'Referral term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
      await tx.councilTerm.create({data:{id:otherTermId,municipalityId,label:'Prior term',startsOn:new Date('2022-07-01'),endsOn:new Date('2025-06-30')}});
      await tx.person.create({data:{id:personId,municipalityId,termId,displayName:'Taylor Mendoza'}});
      await tx.committee.create({data:{id:leadId,municipalityId,termId,code:'GOOD-GOV',name:'Committee on Good Governance'}});
      await tx.committee.create({data:{id:jointId,municipalityId,termId,code:'WAYS-MEANS',name:'Committee on Ways and Means'}});
      await tx.committee.create({data:{id:otherTermCommitteeId,municipalityId,termId:otherTermId,code:'OLD-GOV',name:'Prior Term Committee'}});
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
    const ctx={db:app,config:{AUDIT_MAX_LAG_SECONDS:3600,OIDC_ISSUER:issuer,MINIO_BUCKET_QUARANTINE:'ltas-quarantine'},store:new MemoryObjectStore()} as unknown as AppContext;
    const commands=new Commands(ctx);
    measures=new MeasuresService(ctx,commands);
    referrals=new ReferralsService(ctx,commands);
  },30000);

  afterAll(async()=>{
    try {
      if(municipalityId && migrator) {
        await migrator.inAppNotification.deleteMany({where:{municipalityId}});
        await migrator.workTask.deleteMany({where:{municipalityId}});
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

  it('records a joint referral, hides unreferred cases from CS, and blocks a second open group',async()=>{
    const created=await measures.create(await actor(lsId),draft());
    const hidden=await measures.create(await actor(lsId),{...draft(),title:'An Ordinance That Stays Unreferred'});
    await expect(referrals.create(await actor(sysId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[jointId],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason})).rejects.toMatchObject({status:403});
    await expect(referrals.create(await actor(lsId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[jointId],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason})).rejects.toMatchObject({status:403});
    await expect(referrals.create(await actor(csLeadId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[jointId],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason})).rejects.toMatchObject({status:403});
    await expect(measures.list(await actor(csLeadId),{page:1,limit:25})).resolves.toMatchObject({pageInfo:{total:0}});
    await expect(referrals.create(await actor(secId),created.data.id,{leadCommitteeId:otherTermCommitteeId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason})).rejects.toMatchObject({status:422});
    const assigned=await referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[jointId],referredOn:'2026-09-22',dueOn:'2026-10-15',expectedRevision:created.data.revision,reason});
    expect(assigned.data).toHaveLength(2);
    expect(assigned.data[0]).toMatchObject({role:'LEAD',disposition:'OPEN',sourceKind:'SECRETARIAT_RECORDED',committeeId:leadId});
    expect(assigned.data[1]).toMatchObject({role:'JOINT',committeeId:jointId,groupId:assigned.data[0]!.groupId,measureVersionId:assigned.data[0]!.measureVersionId});
    await expect(referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason})).rejects.toMatchObject({status:422});
    const visible=await measures.list(await actor(csLeadId),{page:1,limit:25});
    expect(visible.pageInfo.total).toBe(1);
    expect(visible.items[0]!.id).toBe(created.data.id);
    await expect(measures.get(await actor(csLeadId),hidden.data.id)).rejects.toMatchObject({status:404});
    await expect(measures.get(await actor(csJointId),created.data.id)).resolves.toMatchObject({data:{id:created.data.id}});
    const stats=await measures.stats(await actor(csLeadId));
    expect(stats.data.pendingCommittee).toBe(1);
    const closed=await referrals.close(await actor(secId),assigned.data[0]!.id,{expectedRevision:assigned.data[0]!.revision,reason});
    expect(closed.data.disposition).toBe('CLOSED');
    await expect(referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason})).rejects.toMatchObject({status:422});
    await referrals.close(await actor(secId),assigned.data[1]!.id,{expectedRevision:assigned.data[1]!.revision,reason});
    const again=await referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason});
    expect(again.data[0]!.referralSequence).toBe(2);
    const withdrawn=await measures.create(await actor(lsId),{...draft(),title:'An Ordinance That Is Withdrawn'});
    const stopped=await measures.transition(await actor(lsId),withdrawn.data.id,'withdraw',{expectedRevision:withdrawn.data.revision,reason});
    await expect(referrals.create(await actor(secId),withdrawn.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:stopped.data.revision,reason})).rejects.toMatchObject({status:422});
  });

  it('blocks withdraw while a referral is open and allows it after close',async()=>{
    const created=await measures.create(await actor(lsId),{...draft(),title:'An Ordinance That Cannot Withdraw Open'});
    const assigned=await referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason});
    await expect(measures.transition(await actor(lsId),created.data.id,'withdraw',{expectedRevision:created.data.revision,reason})).rejects.toMatchObject({status:422});
    const stillOpen=await measures.get(await actor(lsId),created.data.id);
    expect(stillOpen.data.stage).toBe('DRAFT');
    await referrals.close(await actor(secId),assigned.data[0]!.id,{expectedRevision:assigned.data[0]!.revision,reason});
    const stopped=await measures.transition(await actor(lsId),created.data.id,'withdraw',{expectedRevision:created.data.revision,reason});
    expect(stopped.data.stage).toBe('WITHDRAWN');
  });

  it('does not let completing a task close a referral',async()=>{
    const created=await measures.create(await actor(lsId),{...draft(),title:'An Ordinance With A Referral Task'});
    const assigned=await referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason});
    const tasks=await measures.tasks(await actor(csLeadId),{page:1,limit:50});
    const task=tasks.items.find(item=>item.ownerId===assigned.data[0]!.id);
    expect(task).toBeTruthy();
    await measures.completeTask(await actor(csLeadId),task!.id,{expectedRevision:task!.revision,reason});
    const live=await referrals.forMeasure(await actor(secId),created.data.id);
    expect(live.items[0]!.disposition).toBe('OPEN');
  });

  it('rejects a stale close without writing',async()=>{
    const created=await measures.create(await actor(lsId),{...draft(),title:'An Ordinance With A Stale Close'});
    const assigned=await referrals.create(await actor(secId),created.data.id,{leadCommitteeId:leadId,jointCommitteeIds:[],referredOn:'2026-09-22',expectedRevision:created.data.revision,reason});
    await expect(referrals.close(await actor(secId),assigned.data[0]!.id,{expectedRevision:assigned.data[0]!.revision+1,reason})).rejects.toMatchObject({status:409});
    const live=await referrals.forMeasure(await actor(secId),created.data.id);
    expect(live.items[0]!.disposition).toBe('OPEN');
    expect(statusOf(Object.assign(new HttpException({code:'STALE_REVISION'},409)))).toBe(409);
  });
});
