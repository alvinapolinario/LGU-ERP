import { describe, expect, it } from 'vitest';
import { documentIntentSchema, grantSchema, libraryQuerySchema, meetingCreateSchema, memberSchema, paginationSchema, referralCreateSchema, rolePermissions, sessionCreateSchema, sessionVoteSchema, termSchema, userStateSchema } from './index.js';
describe('public input contracts',()=>{
  it('rejects hidden privilege fields',()=>expect(userStateSchema.safeParse({enabled:true,expectedRevision:1,reason:'Enable test account',role:'SYS'}).success).toBe(false));
  it('rejects invalid calendar dates and reversed term dates',()=>{expect(termSchema.safeParse({label:'Test',startsOn:'2026-02-30',endsOn:'2026-12-31',reason:'Synthetic test term'}).success).toBe(false);expect(termSchema.safeParse({label:'Test',startsOn:'2027-01-01',endsOn:'2026-01-01',reason:'Synthetic test term'}).success).toBe(false);});
  it('requires revisions and meaningful reasons for roster writes',()=>expect(memberSchema.safeParse({personId:'10000000-0000-4000-8000-000000000001',role:'CHAIR',startsOn:'2026-01-01',endsOn:'2026-12-31',reason:'ok'}).success).toBe(false));
  it('bounds lists and rejects unknown filters',()=>{expect(paginationSchema.parse({})).toEqual({page:1,limit:25});expect(paginationSchema.safeParse({limit:10000}).success).toBe(false);expect(paginationSchema.safeParse({rawSQL:'x'}).success).toBe(false);});
  it('prevents municipality-wide staff grants and committee-scoped system admins',()=>{const b={userId:'10000000-0000-4000-8000-000000000001',scopeId:'20000000-0000-4000-8000-000000000001',validFrom:'2026-01-01T00:00:00Z',validUntil:'2027-01-01T00:00:00Z',reason:'Synthetic scope test'};expect(grantSchema.safeParse({...b,role:'CS',scopeType:'MUNICIPALITY'}).success).toBe(false);expect(grantSchema.safeParse({...b,role:'SYS',scopeType:'COMMITTEE'}).success).toBe(false);expect(grantSchema.safeParse({...b,role:'LS',scopeType:'COMMITTEE'}).success).toBe(false);expect(grantSchema.safeParse({...b,role:'CS',scopeType:'COMMITTEE'}).success).toBe(true);expect(grantSchema.safeParse({...b,role:'LS',scopeType:'MUNICIPALITY',scopeId:'10000000-0000-4000-8000-000000000001'}).success).toBe(true);});
  it('gives LS draft rights and keeps SYS off measures',()=>{expect(rolePermissions.LS).toContain('measure.create');expect(rolePermissions.LS).toContain('committee.view');expect(rolePermissions.LS).toContain('committee.meeting.view');expect(rolePermissions.LS).toContain('session.view');expect(rolePermissions.LS).not.toContain('measure.file');expect(rolePermissions.LS).not.toContain('committee.meeting.manage');expect(rolePermissions.LS).not.toContain('session.manage');expect(rolePermissions.SYS).toContain('person.view');expect(rolePermissions.SYS).not.toContain('measure.create');expect(rolePermissions.SYS).not.toContain('person.manage');expect(rolePermissions.SYS).not.toContain('committee.meeting.view');expect(rolePermissions.SYS).not.toContain('session.view');expect(rolePermissions.CS).toContain('measure.view');expect(rolePermissions.CS).toContain('committee.meeting.manage');expect(rolePermissions.CS).not.toContain('measure.create');expect(rolePermissions.CS).not.toContain('committee.referral.create');expect(rolePermissions.CS).not.toContain('session.manage');expect(rolePermissions.SEC).toContain('measure.file');expect(rolePermissions.SEC).toContain('committee.referral.create');expect(rolePermissions.SEC).toContain('committee.meeting.close');expect(rolePermissions.SEC).toContain('vote.record');expect(rolePermissions.SEC).toContain('library.view');expect(rolePermissions.SEC).toContain('report.view');expect(rolePermissions.AUD).toContain('library.view');expect(rolePermissions.LS).toContain('report.view');expect(rolePermissions.CS).toContain('library.view');expect(rolePermissions.SYS).not.toContain('library.view');expect(rolePermissions.SYS).not.toContain('report.view');});
  it('bounds library search and rejects unknown kinds',()=>{
    expect(libraryQuerySchema.parse({})).toEqual({page:1,limit:25,q:''});
    expect(libraryQuerySchema.safeParse({kind:'HEARING'}).success).toBe(false);
    expect(libraryQuerySchema.safeParse({q:'x'.repeat(121)}).success).toBe(false);
    expect(libraryQuerySchema.safeParse({kind:'MEASURE',q:'ordinance'}).success).toBe(true);
  });
  it('rejects a lead that is also joint or a due date before referral',()=>{
    const lead='10000000-0000-4000-8000-000000000001';
    const joint='20000000-0000-4000-8000-000000000001';
    const base={leadCommitteeId:lead,referredOn:'2026-09-22',expectedRevision:1,reason:'Synthetic referral contract'};
    expect(referralCreateSchema.safeParse({...base,jointCommitteeIds:[lead]}).success).toBe(false);
    expect(referralCreateSchema.safeParse({...base,jointCommitteeIds:[joint,joint]}).success).toBe(false);
    expect(referralCreateSchema.safeParse({...base,dueOn:'2026-09-21'}).success).toBe(false);
    expect(referralCreateSchema.safeParse({...base,jointCommitteeIds:[joint],dueOn:'2026-10-01'}).success).toBe(true);
  });
  it('accepts committee and meeting document owners and rejects unknown owners',()=>{
    const ownerId='10000000-0000-4000-8000-000000000001';
    const base={ownerId,originalFilename:'notes.pdf',declaredMime:'application/pdf' as const,expectedBytes:20,reason:'Synthetic document owner contract'};
    expect(documentIntentSchema.safeParse({...base,ownerType:'COMMITTEE'}).success).toBe(true);
    expect(documentIntentSchema.safeParse({...base,ownerType:'MEETING'}).success).toBe(true);
    expect(documentIntentSchema.safeParse({...base,ownerType:'SESSION'}).success).toBe(true);
    expect(documentIntentSchema.safeParse({...base,ownerType:'HEARING'}).success).toBe(false);
  });
  it('requires a scheduled instant and bounds agenda size',()=>{
    const referral='10000000-0000-4000-8000-000000000001';
    const base={title:'Regular committee meeting',venue:'Session hall',scheduledAt:'2026-09-22T02:00:00.000Z',reason:'Synthetic meeting contract'};
    expect(meetingCreateSchema.safeParse(base).success).toBe(true);
    expect(meetingCreateSchema.safeParse({...base,scheduledAt:'2026-09-22'}).success).toBe(false);
    expect(meetingCreateSchema.safeParse({...base,referralIds:Array.from({length:21},()=>referral)}).success).toBe(false);
  });
  it('requires a session term and rejects a negative tally',()=>{
    const termId='10000000-0000-4000-8000-000000000001';
    const measureId='20000000-0000-4000-8000-000000000001';
    expect(sessionCreateSchema.safeParse({termId,title:'Regular session',venue:'Session hall',kind:'REGULAR',scheduledAt:'2026-09-22T02:00:00.000Z',reason:'Synthetic session contract'}).success).toBe(true);
    expect(sessionCreateSchema.safeParse({termId,title:'Regular session',venue:'Session hall',kind:'EMERGENCY',scheduledAt:'2026-09-22T02:00:00.000Z',reason:'Synthetic session contract'}).success).toBe(false);
    expect(sessionVoteSchema.safeParse({measureId,yesCount:-1,noCount:0,abstainCount:0,expectedRevision:1,reason:'Synthetic vote contract'}).success).toBe(false);
    expect(sessionVoteSchema.safeParse({measureId,yesCount:5,noCount:2,abstainCount:1,expectedRevision:1,reason:'Synthetic vote contract'}).success).toBe(true);
  });
});
