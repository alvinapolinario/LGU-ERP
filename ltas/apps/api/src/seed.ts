import { randomUUID } from 'node:crypto';
import { createDatabase } from './database.js';
import { digest, genesisHash } from './domain/integrity.js';
import { jsonValue } from './commands.js';

if(process.env['NODE_ENV']==='production' || process.env['ALLOW_SYNTHETIC_SEED']!=='yes') throw new Error('Synthetic seed requires ALLOW_SYNTHETIC_SEED=yes outside production.');
const connection=process.env['MIGRATION_DATABASE_URL'];
const issuer=process.env['OIDC_ISSUER'];
if(!connection || !issuer) throw new Error('MIGRATION_DATABASE_URL and OIDC_ISSUER are required.');
const db=createDatabase(connection);
const municipalityId='10000000-0000-4000-8000-000000000001';
const termId='20000000-0000-4000-8000-000000000001';
const committeeId='30000000-0000-4000-8000-000000000001';
const identities=[
  {id:'40000000-0000-4000-8000-000000000001',name:'Alex Rivera',username:'alex.admin',role:'SYS'},
  {id:'40000000-0000-4000-8000-000000000002',name:'Sam Torres',username:'sam.reviewer',role:'SYS'},
  {id:'40000000-0000-4000-8000-000000000003',name:'Jamie Cruz',username:'jamie.secretary',role:'SEC'},
  {id:'40000000-0000-4000-8000-000000000004',name:'Morgan Reyes',username:'morgan.auditor',role:'AUD'},
  {id:'40000000-0000-4000-8000-000000000005',name:'Casey Santos',username:'casey.committee',role:'CS'},
];
try {
  await db.$transaction(async tx=>{
    if(await tx.municipality.count()!==0) throw new Error('Seed refused: the database is not empty. Existing data will not be overwritten.');
    await tx.municipality.create({data:{id:municipalityId,code:'DEMO-001',name:'Municipality of San Isidro (Fictional)',province:'Demonstration Province'}});
    await tx.councilTerm.create({data:{id:termId,municipalityId,label:'2025–2028 demonstration term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
    await tx.committee.create({data:{id:committeeId,municipalityId,termId,code:'GOOD-GOV',name:'Committee on Good Governance'}});
    for(const identity of identities) {
      await tx.user.create({data:{id:identity.id,municipalityId,issuer,subject:identity.id,displayName:identity.name}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:identity.id,role:identity.role,scopeType:identity.role==='CS'?'COMMITTEE':'MUNICIPALITY',scopeId:identity.role==='CS'?committeeId:municipalityId,validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01'),approvedBy:identities[identity.role==='SYS'?2:0]!.id}});
    }
    const person=await tx.person.create({data:{id:randomUUID(),municipalityId,displayName:'Taylor Mendoza'}});
    await tx.committeeMember.create({data:{id:randomUUID(),municipalityId,committeeId,personId:person.id,role:'CHAIR',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
    const content={id:randomUUID(),municipalityId,sequence:'1',actorId:identities[0]!.id,actorName:'Synthetic bootstrap',action:'foundation.seeded',entityId:municipalityId,correlationId:randomUUID(),payload:{reason:'User-authorized fictional development fixture; no municipal approval implied',users:identities.map(i=>({id:i.id,role:i.role})),termId,committeeId},previousHash:genesisHash,recordedAt:new Date().toISOString()};
    const hash=digest(content);
    await tx.auditLog.create({data:{...content,sequence:1n,recordedAt:new Date(content.recordedAt),hash}});
    await tx.auditCursor.create({data:{municipalityId,sequence:1n,hash}});
    await tx.outboxEvent.create({data:{id:randomUUID(),municipalityId,type:'audit.recorded',payload:jsonValue({...content,hash})}});
  });
  console.log('Fictional foundation seeded. Login accounts must be created through the local Keycloak setup script.');
} finally {await db.$disconnect();}
