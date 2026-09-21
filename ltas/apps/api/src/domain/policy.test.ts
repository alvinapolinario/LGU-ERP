import { describe, expect, it } from 'vitest';
import { can, independentApproval, overlaps, type Principal } from './policy.js';
const now=new Date('2026-09-21T00:00:00Z');
const base:Principal={id:'u',displayName:'Test officer',municipalityId:'m1',enabled:true,grants:[{role:'SYS',scopeType:'MUNICIPALITY',scopeId:'m1',validFrom:new Date('2026-01-01'),validUntil:new Date('2027-01-01'),revokedAt:null}]};
describe('deny-by-default access',()=>{
  it('allows an active administrative grant in its municipality',()=>expect(can(base,'user.manage',{municipalityId:'m1'},now)).toBe(true));
  it('never gives SYS business or audit authority',()=>{expect(can(base,'committee.manage',{municipalityId:'m1'},now)).toBe(false);expect(can(base,'audit.view',{municipalityId:'m1'},now)).toBe(false);});
  it('denies cross-municipality requests',()=>expect(can(base,'user.manage',{municipalityId:'m2'},now)).toBe(false));
  it('denies disabled users despite live grants',()=>expect(can({...base,enabled:false},'user.manage',{municipalityId:'m1'},now)).toBe(false));
  it.each([{validUntil:now},{validFrom:new Date('2028-01-01')},{revokedAt:now},{role:'SUPERADMIN'},{role:'toString'}])('denies invalid or inactive grants: %j',patch=>expect(can({...base,grants:[{...base.grants[0]!,...patch}]},'user.manage',{municipalityId:'m1'},now)).toBe(false));
  it('binds committee staff to exactly their assigned committee',()=>{const p={...base,grants:[{...base.grants[0]!,role:'CS',scopeType:'COMMITTEE',scopeId:'c1'}]};expect(can(p,'committee.view',{municipalityId:'m1',committeeId:'c1'},now)).toBe(true);expect(can(p,'committee.view',{municipalityId:'m1',committeeId:'c2'},now)).toBe(false);expect(can(p,'committee.view',{municipalityId:'m1'},now)).toBe(false);expect(can(p,'committee.manage',{municipalityId:'m1',committeeId:'c1'},now)).toBe(false);});
  it('does not let an expired broad grant widen a current narrow grant',()=>{const p={...base,grants:[{...base.grants[0]!,role:'SEC',validUntil:now},{...base.grants[0]!,role:'CS',scopeType:'COMMITTEE',scopeId:'c1'}]};expect(can(p,'committee.view',{municipalityId:'m1',committeeId:'c2'},now)).toBe(false);});
});
describe('independent authority and historical dates',()=>{
  it('requires three distinct parties for a grant',()=>{expect(independentApproval('a','b','c')).toBe(true);expect(independentApproval('a','a','c')).toBe(false);expect(independentApproval('a','b','a')).toBe(false);expect(independentApproval('a','b','b')).toBe(false);});
  it('treats touching date-only intervals as overlapping',()=>expect(overlaps(new Date('2026-01-01'),new Date('2026-06-30'),new Date('2026-06-30'),new Date('2026-12-31'))).toBe(true));
  it('allows nonoverlapping historical succession',()=>expect(overlaps(new Date('2025-01-01'),new Date('2025-12-31'),new Date('2026-01-01'),new Date('2026-12-31'))).toBe(false));
});
