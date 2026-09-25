import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Commands } from './commands.js';
import { loadPrincipal } from './access.js';
import { createDatabase, type Database } from './database.js';
import { genesisHash } from './domain/integrity.js';
import { ArchivesService } from './archives.service.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';
import type { Principal } from './domain/policy.js';

loadEnv({path:resolve(import.meta.dirname,'../../../.env')});
const appUrl=process.env['DATABASE_URL'];
const migratorUrl=process.env['MIGRATION_DATABASE_URL'];
const live=Boolean(appUrl && migratorUrl);
const reason='Synthetic ordinance image reading.';
function key(label:string):string {return `atest-${label}-${randomUUID().replaceAll('-','')}`.slice(0,100);}
function asRequest(principal:Principal, revision=1):AuthRequest {
  return {principal,correlationId:randomUUID(),get:(header:string)=>{
    const name=header.toLowerCase();
    if(name==='idempotency-key') return key(principal.id.slice(0,8));
    if(name==='x-audit-reason') return reason;
    if(name==='x-original-filename') return 'page.png';
    if(name==='x-expected-revision') return String(revision);
    return undefined;
  }} as unknown as AuthRequest;
}

describe.skipIf(!live)('historical ordinance image text',{timeout:30000},()=>{
  let app:Database; let migrator:Database;
  let municipalityId:string; let termId:string; let secId:string;
  let archives:ArchivesService;
  const issuer='http://ltas.test/realms/archive';

  async function actor(revision=1):Promise<AuthRequest> {return asRequest(await loadPrincipal(app,secId),revision);}

  beforeAll(async()=>{
    app=createDatabase(appUrl!); migrator=createDatabase(migratorUrl!);
    municipalityId=randomUUID(); termId=randomUUID(); secId=randomUUID();
    const code=`ATEST${municipalityId.replaceAll('-','').slice(0,10)}`;
    await migrator.$transaction(async tx=>{
      await tx.municipality.create({data:{id:municipalityId,code,name:'Archive Test Municipality (Fictional)',province:'Demonstration'}});
      await tx.councilTerm.create({data:{id:termId,municipalityId,label:'Archive term',startsOn:new Date('2013-06-30'),endsOn:new Date('2016-06-30')}});
      await tx.user.create({data:{id:secId,municipalityId,issuer,subject:secId,displayName:'Secretary Gate'}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:secId,role:'SEC',scopeType:'MUNICIPALITY',scopeId:municipalityId,validFrom:new Date('2013-06-30'),validUntil:new Date('2028-07-01'),approvedBy:secId}});
      await tx.auditCursor.create({data:{municipalityId,sequence:0n,hash:genesisHash}});
    });
    const ctx={db:app,config:{AUDIT_MAX_LAG_SECONDS:3600,OIDC_ISSUER:issuer,MINIO_BUCKET_QUARANTINE:'ltas-quarantine',NODE_ENV:'test',AUDIT_ENFORCE_EXPORT_LAG:'no'},store:{}} as unknown as AppContext;
    archives=new ArchivesService(ctx,new Commands(ctx));
  });

  afterAll(async()=>{
    try {
      if(municipalityId && migrator) {
        await migrator.historicalOrdinance.deleteMany({where:{municipalityId}});
        await migrator.idempotencyRecord.deleteMany({where:{actorId:secId}});
        await migrator.outboxEvent.deleteMany({where:{municipalityId}});
        await migrator.auditLog.deleteMany({where:{municipalityId}});
        await migrator.auditCursor.deleteMany({where:{municipalityId}});
        await migrator.userRole.deleteMany({where:{municipalityId}});
        await migrator.user.deleteMany({where:{municipalityId}});
        await migrator.councilTerm.deleteMany({where:{municipalityId}});
        await migrator.municipality.deleteMany({where:{id:municipalityId}});
      }
    } finally {await Promise.allSettled([app?.$disconnect(),migrator?.$disconnect()]);}
  });

  it('writes words from a page image into the ordinance text and finds them by keyword',async()=>{
    const image='/tmp/ltas-ordinance-page.png';
    execFileSync('python3',['-c',`from PIL import Image, ImageDraw\nimg=Image.new('RGB',(900,180),'white')\nd=ImageDraw.Draw(img)\nd.text((16,70),'Libungan public market ordinance',fill='black')\nimg.save(${JSON.stringify(image)})`]);
    const created=await archives.create(await actor(),{termId,title:'An earlier market ordinance',sourceNote:'Bound volume in the secretariat cabinet.',reason});
    await expect(archives.setScan(await actor(created.data.revision+1),created.data.id,readFileSync(image))).rejects.toMatchObject({status:409});
    await archives.setScan(await actor(created.data.revision),created.data.id,readFileSync(image));
    const found=await archives.list(await actor(),{q:'market',page:1,limit:25});
    expect(found.items.some(item=>item.id===created.data.id && item.snippet?.toLowerCase().includes('market'))).toBe(true);
    const detail=await archives.get(await actor(),created.data.id);
    expect(detail.data.extractedText?.toLowerCase()).toContain('market');
    await archives.saveText(await actor(),created.data.id,{extractedText:'Corrected text about the public market stalls.',expectedRevision:detail.data.revision,reason});
    const corrected=await archives.list(await actor(),{q:'stalls',page:1,limit:25});
    expect(corrected.items.some(item=>item.id===created.data.id)).toBe(true);
  });
});
