import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {verifyChain} from '../apps/api/dist/domain/integrity.js';
const directory=process.argv[2];
if(!directory)throw new Error('Usage: node scripts/verify-audit.mjs <export-directory>');
const groups=new Map();
for(const filename of await readdir(directory)) {
  if(!filename.endsWith('.json'))continue;
  const event=JSON.parse(await readFile(resolve(directory,filename),'utf8'));
  if(typeof event.municipalityId!=='string'||typeof event.sequence!=='string'||!/^\d+$/.test(event.sequence))throw new Error(`Invalid audit record: ${filename}`);
  const records=groups.get(event.municipalityId)??[];records.push(event);groups.set(event.municipalityId,records);
}
if(!groups.size)throw new Error('No audit evidence found; an empty directory is not verified evidence.');
for(const [municipalityId,events] of groups) {
  events.sort((a,b)=>BigInt(a.sequence)<BigInt(b.sequence)?-1:1);
  if(!verifyChain(events))throw new Error(`Audit verification failed for municipality ${municipalityId}`);
  console.log(JSON.stringify({municipalityId,verifiedEvents:events.length,lastSequence:events.at(-1).sequence,lastHash:events.at(-1).hash}));
}
console.log('Compare each last sequence/hash with the trusted database checkpoint or independent manifest. Chain verification alone cannot detect a truncated tail.');
