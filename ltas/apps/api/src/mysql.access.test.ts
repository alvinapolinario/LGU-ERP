import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { AdministrationService } from './administration.service.js';
import { Commands } from './commands.js';
import { loadPrincipal } from './access.js';
import { createDatabase, type Database } from './database.js';
import { genesisHash } from './domain/integrity.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';
import type { Principal } from './domain/policy.js';

loadEnv({path:resolve(import.meta.dirname,'../../../.env')});

const appUrl=process.env['DATABASE_URL'];
const migratorUrl=process.env['MIGRATION_DATABASE_URL'];
const live=Boolean(appUrl && migratorUrl);
const reason='Synthetic access-gate fixture.';
const window={validFrom:'2026-01-01T00:00:00.000Z',validUntil:'2028-01-01T00:00:00.000Z'};

function statusOf(error:unknown):number {
  if(error instanceof HttpException) return error.getStatus();
  throw error;
}
function key(label:string):string {
  return `itest-${label}-${randomUUID().replaceAll('-','')}`.slice(0,100);
}
function asRequest(principal:Principal):AuthRequest {
  const idempotency=key(principal.id.slice(0,8));
  return {principal,correlationId:randomUUID(),get:(header:string)=>header.toLowerCase()==='idempotency-key'?idempotency:undefined} as unknown as AuthRequest;
}

describe.skipIf(!live)('T-FR-ACCESS MySQL 8.4 gates',{timeout:20000},()=>{
  let app:Database;
  let peer:Database;
  let migrator:Database;
  let municipalityId:string;
  let committeeA:string;
  let committeeB:string;
  let termId:string;
  let sysA:string;
  let sysB:string;
  let sysC:string;
  let staff:string;
  let officer:string;
  let service:AdministrationService;
  let peerService:AdministrationService;
  const issuer='http://ltas.test/realms/integration';

  async function actor(id:string,db:Database=app):Promise<AuthRequest> {
    return asRequest(await loadPrincipal(db,id));
  }
  async function adminFor(db:Database):Promise<AdministrationService> {
    const ctx={db,config:{AUDIT_MAX_LAG_SECONDS:3600,OIDC_ISSUER:issuer}} as unknown as AppContext;
    return new AdministrationService(ctx,new Commands(ctx));
  }

  beforeAll(async()=>{
    app=createDatabase(appUrl!);
    peer=createDatabase(appUrl!);
    migrator=createDatabase(migratorUrl!);
    const version=await app.$queryRaw<Array<{v:string}>>`SELECT VERSION() AS v`;
    expect(String(version[0]?.v ?? ''),'Phase 1 access gates require MySQL 8.4').toMatch(/^8\.4/);
    municipalityId=randomUUID();
    termId=randomUUID();
    committeeA=randomUUID();
    committeeB=randomUUID();
    sysA=randomUUID();
    sysB=randomUUID();
    sysC=randomUUID();
    staff=randomUUID();
    officer=randomUUID();
    const code=`ITEST${municipalityId.replaceAll('-','').slice(0,10)}`;
    await migrator.$transaction(async tx=>{
      await tx.municipality.create({data:{id:municipalityId,code,name:'Integration Test Municipality (Fictional)',province:'Demonstration'}});
      await tx.councilTerm.create({data:{id:termId,municipalityId,label:'Integration term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
      await tx.committee.create({data:{id:committeeA,municipalityId,termId,code:'ALPHA',name:'Committee Alpha'}});
      await tx.committee.create({data:{id:committeeB,municipalityId,termId,code:'BETA',name:'Committee Beta'}});
      for(const [id,name] of [[sysA,'Sys One'],[sysB,'Sys Two'],[sysC,'Sys Three'],[staff,'Committee Staff'],[officer,'Grant Officer']] as const) {
        await tx.user.create({data:{id,municipalityId,issuer,subject:id,displayName:name}});
      }
      for(const [userId,approvedBy] of [[sysA,sysB],[sysB,sysA],[sysC,sysA]] as const) {
        await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId,role:'SYS',scopeType:'MUNICIPALITY',scopeId:municipalityId,validFrom:new Date(window.validFrom),validUntil:new Date(window.validUntil),approvedBy}});
      }
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:staff,role:'CS',scopeType:'COMMITTEE',scopeId:committeeA,validFrom:new Date(window.validFrom),validUntil:new Date(window.validUntil),approvedBy:sysA}});
      await tx.auditCursor.create({data:{municipalityId,sequence:0n,hash:genesisHash}});
    });
    service=await adminFor(app);
    peerService=await adminFor(peer);
  },30000);

  afterAll(async()=>{
    try {
      if(municipalityId && migrator) {
        await migrator.idempotencyRecord.deleteMany({where:{actorId:{in:[sysA,sysB,sysC,staff,officer]}}});
        await migrator.outboxEvent.deleteMany({where:{municipalityId}});
        await migrator.auditLog.deleteMany({where:{municipalityId}});
        await migrator.auditCursor.deleteMany({where:{municipalityId}});
        await migrator.committeeMember.deleteMany({where:{municipalityId}});
        await migrator.committee.deleteMany({where:{municipalityId}});
        await migrator.person.deleteMany({where:{municipalityId}});
        await migrator.grantRequest.deleteMany({where:{municipalityId}});
        await migrator.userRole.deleteMany({where:{municipalityId}});
        await migrator.user.deleteMany({where:{municipalityId}});
        await migrator.councilTerm.deleteMany({where:{municipalityId}});
        await migrator.municipality.deleteMany({where:{id:municipalityId}});
      }
    } finally {
      await Promise.allSettled([app?.$disconnect(),peer?.$disconnect(),migrator?.$disconnect()]);
    }
  });

  it('T-FR-ACCESS-001 denies a disabled account on the next protected command',async()=>{
    const linked=await service.createUser(await actor(sysA),{subject:`disabled-${randomUUID()}`,displayName:'Soon Disabled',reason});
    await service.userState(await actor(sysA),linked.data.id,{enabled:false,expectedRevision:linked.data.revision,reason});
    await expect(loadPrincipal(app,linked.data.id)).rejects.toMatchObject({status:401});
    const stale=asRequest({id:linked.data.id,municipalityId,displayName:linked.data.displayName,enabled:true,grants:[]});
    await expect(service.createPerson(stale,{displayName:'Should Fail',reason})).rejects.toSatisfy(error=>statusOf(error)===401);
  });

  it('T-FR-ACCESS-002 hides another committee from scoped staff',async()=>{
    const staffReq=await actor(staff);
    const listed=await service.committees(staffReq,{page:1,limit:25});
    expect(listed.items.map(item=>item.id)).toEqual([committeeA]);
    await expect(service.committee(staffReq,committeeB)).rejects.toMatchObject({status:404});
    await expect(service.createCommittee(await actor(sysA),{termId,code:'GAMMA',name:'Should Be Denied',reason})).rejects.toMatchObject({status:403});
  });

  it('revokes a grant so the next write cannot use the prior role',async()=>{
    const request=await service.requestGrant(await actor(sysA),{userId:officer,role:'SEC',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,reason});
    await service.reviewGrant(await actor(sysB),request.data.id,'approve',{expectedRevision:request.data.revision,reason});
    const granted=await actor(officer);
    await service.createPerson(granted,{displayName:'Pat Blanca',reason});
    const liveRole=await app.userRole.findFirstOrThrow({where:{requestId:request.data.id}});
    await service.revoke(await actor(sysA),liveRole.id,{expectedRevision:liveRole.revision,reason});
    await expect(service.createPerson(await actor(officer),{displayName:'Should Be Denied',reason})).rejects.toMatchObject({status:403});
  });

  it('lets only one of two concurrent reviewers approve the same grant request',async()=>{
    const pending=await service.requestGrant(await actor(sysA),{userId:officer,role:'AUD',scopeType:'MUNICIPALITY',scopeId:municipalityId,...window,reason});
    const body={expectedRevision:pending.data.revision,reason};
    const settled=await Promise.allSettled([
      service.reviewGrant(await actor(sysB),pending.data.id,'approve',body),
      peerService.reviewGrant(await actor(sysC,peer),pending.data.id,'approve',body),
    ]);
    const accepted=settled.filter(item=>item.status==='fulfilled');
    const denied=settled.filter(item=>item.status==='rejected');
    expect(accepted).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(statusOf((denied[0] as PromiseRejectedResult).reason)).toBe(409);
    const roles=await app.userRole.findMany({where:{userId:officer,role:'AUD',revokedAt:null}});
    expect(roles).toHaveLength(1);
    const request=await app.grantRequest.findUniqueOrThrow({where:{id:pending.data.id}});
    expect(request.state).toBe('APPROVED');
  });
});
