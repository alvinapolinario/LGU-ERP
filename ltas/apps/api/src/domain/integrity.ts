import { createHash } from 'node:crypto';

export function canonical(value:unknown):string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([,v])=>v !== undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
export function digest(value:unknown):string {return createHash('sha256').update(canonical(value)).digest('hex');}
export const genesisHash = '0'.repeat(64);
export function verifyChain(events:Array<{sequence:string; previousHash:string; hash:string; [key:string]:unknown}>, previousHash = genesisHash, previousSequence = 0n):boolean {
  for (const event of events) {
    const {hash,...content} = event;
    if (BigInt(event.sequence) !== previousSequence + 1n || event.previousHash !== previousHash || digest(content) !== hash) return false;
    previousHash = hash; previousSequence = BigInt(event.sequence);
  }
  return true;
}
