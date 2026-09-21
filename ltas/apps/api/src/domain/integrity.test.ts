import { describe, expect, it } from 'vitest';
import { canonical, digest, genesisHash, verifyChain } from './integrity.js';
describe('audit evidence',()=>{
  const event={id:'event',sequence:'1',previousHash:genesisHash,payload:{reason:'Synthetic test'},recordedAt:'2026-09-21T00:00:00.000Z'};
  const record={...event,hash:digest(event)};
  it('canonicalizes property order before hashing',()=>expect(digest({b:1,a:{d:2,c:3}})).toBe(digest({a:{c:3,d:2},b:1})));
  it('normalizes dates consistently with JSON storage',()=>expect(canonical({at:new Date(event.recordedAt)})).toBe(canonical({at:event.recordedAt})));
  it('verifies the original chain',()=>expect(verifyChain([record])).toBe(true));
  it('detects altered content',()=>expect(verifyChain([{...record,payload:{reason:'Altered'}}])).toBe(false));
  it('detects missing sequences',()=>{const changed={...event,sequence:'2'};expect(verifyChain([{...changed,hash:digest(changed)}])).toBe(false);});
  it('detects changed previous hashes',()=>expect(verifyChain([{...record,previousHash:'f'.repeat(64)}])).toBe(false));
});
