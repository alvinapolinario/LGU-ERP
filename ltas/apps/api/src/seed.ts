import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  {id:'50000000-0000-4000-8000-000000000001',name:'Taylor Mendoza',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000002',name:'Jordan Villanueva',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000003',name:'Avery Ramos',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000004',name:'Quinn Navarro',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000009',name:'Ellis Mercado',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000010',name:'Rowan Aquino',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000011',name:'Sage Del Rosario',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000012',name:'Parker Salazar',positionCode:'COUNCILOR'},
  {id:'50000000-0000-4000-8000-000000000013',name:'Lane Gutierrez',positionCode:'LIGA_PRESIDENT'},
  {id:'50000000-0000-4000-8000-000000000014',name:'Marlowe Ignacio',positionCode:'SK_PRESIDENT'},
  {id:'50000000-0000-4000-8000-000000000005',name:'Hayden Cruz',positionCode:'VICE_MAYOR'},
  {id:'50000000-0000-4000-8000-000000000006',name:'Cameron Dela Peña',positionCode:'SB_STAFF'},
  {id:'50000000-0000-4000-8000-000000000007',name:'Reese Bautista',positionCode:'SB_SECRETARY'},
  {id:'50000000-0000-4000-8000-000000000008',name:'Skyler Gonzales',positionCode:'MAYOR'},
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
    const existing=await tx.person.findFirst({where:{municipalityId,termId,displayName:person.name}});
    if(existing) {
      byName.set(person.name,existing.id);
      if(existing.positionCode!==person.positionCode && (existing.id===person.id || existing.positionCode==='OTHER')) {
        await tx.person.update({where:{id:existing.id},data:{positionCode:person.positionCode}});
        added=true;
      }
      continue;
    }
    await tx.person.create({data:{id:person.id,municipalityId,termId,displayName:person.name,positionCode:person.positionCode}});
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

const officialsFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/public/libungan_municipal_officials_2013_2025.csv');

function officialPosition(label:string) {
  const value = label.trim().toLowerCase();
  if (value === 'municipal mayor') return 'MAYOR';
  if (value === 'municipal vice mayor') return 'VICE_MAYOR';
  if (value === 'sb member') return 'COUNCILOR';
  return null;
}

async function importOfficials(tx:Prisma.TransactionClient) {
  const text = readFileSync(officialsFile, 'utf8');
  const rows = text.split(/\r?\n/).slice(1).map(line => line.trim()).filter(Boolean);
  const terms = await tx.councilTerm.findMany({where:{municipalityId}});
  const added:Array<{term:string; name:string; positionCode:string}> = [];
  const skipped:string[] = [];
  const unmatched = new Set<string>();
  for (const line of rows) {
    const [span, position, name] = line.split(',').map(part => part.trim());
    if (!span || !position || !name) continue;
    const positionCode = officialPosition(position);
    if (!positionCode || name.toUpperCase() === 'TBD') { skipped.push(`${span} ${position}`); continue; }
    const term = terms.find(item => item.label.replaceAll('–', '-').includes(span));
    if (!term) { unmatched.add(span); continue; }
    const existing = await tx.person.findFirst({where:{municipalityId:term.municipalityId, termId:term.id, displayName:name}});
    if (existing) continue;
    await tx.person.create({data:{id:randomUUID(), municipalityId:term.municipalityId, termId:term.id, displayName:name, positionCode}});
    added.push({term:term.label, name, positionCode});
  }
  return {added, skipped, unmatched:[...unmatched]};
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
      const officials=await importOfficials(tx);
      if(!addedLs && !addedRoster && officials.added.length===0) throw new Error('Seed refused: the database is not empty. Existing data will not be overwritten.');
      if(addedRoster) await appendAudit(tx,'foundation.roster-seeded',municipalityId,{reason:'User-authorized fictional Sanggunian member names for committee assignment; not elected-office records',people:people.map(person=>person.name),committees:committees.map(committee=>committee.code)});
      if(officials.added.length) await appendAudit(tx,'foundation.officials-imported',municipalityId,{reason:'Directory names from the user-supplied officials list, matched to existing council terms by year span. A position label is not a certified election result.',source:'libungan_municipal_officials_2013_2025.csv',people:officials.added,skipped:officials.skipped,unmatchedTerms:officials.unmatched});
      if(officials.unmatched.length) throw new Error(`Officials list has council terms that are not in this installation: ${officials.unmatched.join(', ')}`);
      if(officials.added.length || officials.skipped.length) console.log(JSON.stringify({imported:officials.added.length,skipped:officials.skipped,unmatchedTerms:officials.unmatched}));
      if(officials.added.length && !addedLs && !addedRoster) return 'officials';
      return addedLs && addedRoster?'ls-roster':addedLs?'ls':'roster';
    }
    await tx.municipality.create({data:{id:municipalityId,code:'DEMO-001',name:'Municipality of Libungan',province:'North Cotabato'}});
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
    officials:'Added directory names from the officials list onto the matching council terms.',
    'ls-roster':'Added fictional legislative staff identity plus people and committee roster.',
  };
  console.log(messages[result]??'Fictional development records updated.');
} finally {await db.$disconnect();}
