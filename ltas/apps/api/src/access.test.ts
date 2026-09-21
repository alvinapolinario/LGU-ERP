import { describe, expect, it } from 'vitest';
import { csrfMatches, loadPrincipal } from './access.js';
import type { AppContext } from './context.js';
describe('session safeguards',()=>{
  it('rejects missing, unequal and length-mismatched CSRF tokens',()=>{expect(csrfMatches(undefined,undefined)).toBe(false);expect(csrfMatches('token','other')).toBe(false);expect(csrfMatches('token','t')).toBe(false);expect(csrfMatches('token','token')).toBe(true);});
  it('reads enabled state again for each protected transaction',async()=>{let enabled=true;const db={user:{findUnique:async()=>({id:'u',enabled,grants:[]})}} as unknown as AppContext['db'];expect((await loadPrincipal(db,'u')).enabled).toBe(true);enabled=false;await expect(loadPrincipal(db,'u')).rejects.toMatchObject({status:401});});
});
