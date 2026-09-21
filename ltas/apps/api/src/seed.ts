import { randomUUID } from 'node:crypto';
import { createDatabase, type Prisma } from './database.js';
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
const waysId='30000000-0000-4000-8000-000000000002';
const identities=[
  {id:'40000000-0000-4000-8000-000000000001',name:'Alex Rivera',username:'alex.admin',role:'SYS'},
  {id:'40000000-0000-4000-8000-000000000002',name:'Sam Torres',username:'sam.reviewer',role:'SYS'},
  {id:'40000000-0000-4000-8000-000000000003',name:'Jamie Cruz',username:'jamie.secretary',role:'SEC'},
  {id:'40000000-0000-4000-8000-000000000004',name:'Morgan Reyes',username:'morgan.auditor',role:'AUD'},
  {id:'40000000-0000-4000-8000-000000000005',name:'Casey Santos',username:'casey.committee',role:'CS'},
  {id:'40000000-0000-4000-8000-000000000006',name:'Riley Flores',username:'riley.staff',role:'LS'},
];
const people=[
  {id:'50000000-0000-4000-8000-000000000001',name:'Taylor Mendoza'},
  {id:'50000000-0000-4000-8000-000000000002',name:'Jordan Villanueva'},
  {id:'50000000-0000-4000-8000-000000000003',name:'Avery Ramos'},
  {id:'50000000-0000-4000-8000-000000000004',name:'Quinn Navarro'},
  {id:'50000000-0000-4000-8000-000000000005',name:'Hayden Cruz'},
  {id:'50000000-0000-4000-8000-000000000006',name:'Cameron Dela Peña'},
  {id:'50000000-0000-4000-8000-000000000007',name:'Reese Bautista'},
  {id:'50000000-0000-4000-8000-000000000008',name:'Skyler Gonzales'},
];
const committees=[
  {id:committeeId,code:'GOOD-GOV',name:'Committee on Good Governance'},
  {id:waysId,code:'WAYS-MEANS',name:'Committee on Ways and Means'},
];
const memberships=[
  {committeeId,person:'Taylor Mendoza',role:'CHAIR'},
  {committeeId,person:'Jordan Villanueva',role:'VICE_CHAIR'},
  {committeeId,person:'Avery Ramos',role:'MEMBER'},
  {committeeId:waysId,person:'Quinn Navarro',role:'CHAIR'},
  {committeeId:waysId,person:'Hayden Cruz',role:'VICE_CHAIR'},
  {committeeId:waysId,person:'Jordan Villanueva',role:'MEMBER'},
] as const;

async function appendAudit(tx:Prisma.TransactionClient,action:string,entityId:string,payload:Record<string,unknown>) {
  const cursor=await tx.auditCursor.findUnique({where:{municipalityId}});
  const previousHash=cursor?.hash??genesisHash;
  const sequence=(cursor?.sequence??0n)+1n;
  const content={id:randomUUID(),municipalityId,sequence:sequence.toString(),actorId:identities[0]!.id,actorName:'Synthetic bootstrap',action,entityId,correlationId:randomUUID(),payload:jsonValue(payload),previousHash,recordedAt:new Date().toISOString()};
  const hash=digest(content);
  await tx.auditLog.create({data:{...content,sequence,recordedAt:new Date(content.recordedAt),hash}});
  if(cursor) await tx.auditCursor.update({where:{municipalityId},data:{sequence,hash}});
  else await tx.auditCursor.create({data:{municipalityId,sequence,hash}});
  await tx.outboxEvent.create({data:{id:randomUUID(),municipalityId,type:'audit.recorded',payload:jsonValue({...content,hash})}});
}

async function ensureRoster(tx:Prisma.TransactionClient) {
  const byName=new Map<string,string>();
  let added=false;
  for(const person of people) {
    const existing=await tx.person.findFirst({where:{municipalityId,displayName:person.name}});
    if(existing) {byName.set(person.name,existing.id); continue;}
    await tx.person.create({data:{id:person.id,municipalityId,displayName:person.name}});
    byName.set(person.name,person.id);
    added=true;
  }
  for(const committee of committees) {
    const existing=await tx.committee.findUnique({where:{municipalityId_termId_code:{municipalityId,termId,code:committee.code}}});
    if(existing) continue;
    await tx.committee.create({data:{id:committee.id,municipalityId,termId,code:committee.code,name:committee.name}});
    added=true;
  }
  const liveCommittees=await tx.committee.findMany({where:{municipalityId,termId}});
  const committeeByCode=new Map(liveCommittees.map(row=>[row.code,row]));
  for(const seat of memberships) {
    const committee=liveCommittees.find(row=>row.id===seat.committeeId) ?? [...committeeByCode.values()].find(row=>committees.find(item=>item.id===seat.committeeId)?.code===row.code);
    const personId=byName.get(seat.person);
    if(!committee || !personId) continue;
    const members=await tx.committeeMember.findMany({where:{committeeId:committee.id}});
    if(members.some(member=>member.personId===personId)) continue;
    if(['CHAIR','VICE_CHAIR'].includes(seat.role) && members.some(member=>member.role===seat.role)) continue;
    await tx.committeeMember.create({data:{id:randomUUID(),municipalityId,committeeId:committee.id,personId,role:seat.role,startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
    added=true;
  }
  return added;
}

try {
  const result=await db.$transaction(async tx=>{
    const ls=identities.find(identity=>identity.role==='LS')!;
    if(await tx.municipality.count()!==0) {
      let addedLs=false;
      if(!await tx.user.findUnique({where:{id:ls.id}})) {
        await tx.user.create({data:{id:ls.id,municipalityId,issuer,subject:ls.id,displayName:ls.name}});
        await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:ls.id,role:'LS',scopeType:'MUNICIPALITY',scopeId:municipalityId,validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01'),approvedBy:identities[0]!.id}});
        addedLs=true;
      }
      const addedRoster=await ensureRoster(tx);
      if(!addedLs && !addedRoster) throw new Error('Seed refused: the database is not empty. Existing data will not be overwritten.');
      if(addedRoster) await appendAudit(tx,'foundation.roster-seeded',municipalityId,{reason:'User-authorized fictional Sanggunian member names for committee assignment; not elected-office records',people:people.map(person=>person.name),committees:committees.map(committee=>committee.code)});
      return addedLs && addedRoster?'ls-roster':addedLs?'ls':'roster';
    }
    await tx.municipality.create({data:{id:municipalityId,code:'DEMO-001',name:'Municipality of San Isidro (Fictional)',province:'Demonstration Province'}});
    await tx.councilTerm.create({data:{id:termId,municipalityId,label:'2025–2028 demonstration term',startsOn:new Date('2025-07-01'),endsOn:new Date('2028-06-30')}});
    for(const identity of identities) {
      await tx.user.create({data:{id:identity.id,municipalityId,issuer,subject:identity.id,displayName:identity.name}});
      await tx.userRole.create({data:{id:randomUUID(),municipalityId,userId:identity.id,role:identity.role,scopeType:identity.role==='CS'?'COMMITTEE':'MUNICIPALITY',scopeId:identity.role==='CS'?committeeId:municipalityId,validFrom:new Date('2025-07-01'),validUntil:new Date('2028-07-01'),approvedBy:identities[identity.role==='SYS'?2:0]!.id}});
    }
    await ensureRoster(tx);
    await appendAudit(tx,'foundation.seeded',municipalityId,{reason:'User-authorized fictional development fixture; no municipal approval implied',users:identities.map(i=>({id:i.id,role:i.role})),termId,people:people.map(person=>person.name),committees:committees.map(committee=>committee.code)});
    return 'foundation';
  });
  const messages:Record<string,string>={
    foundation:'Fictional foundation seeded. Login accounts must be created through the local Keycloak setup script.',
    ls:'Added fictional legislative staff identity to the existing development municipality.',
    roster:'Added fictional people and committee roster to the existing development municipality.',
    'ls-roster':'Added fictional legislative staff identity plus people and committee roster.',
  };
  console.log(messages[result]??'Fictional development records updated.');
} finally {await db.$disconnect();}
