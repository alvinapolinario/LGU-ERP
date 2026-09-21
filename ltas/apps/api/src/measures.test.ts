import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { takeOfficialNumber } from './domain/numbering.js';

describe('T-FR-MEASURE-001 official numbering',()=>{
  it('fails closed without a D-04 series and writes no allocation',()=>{
    expect(()=>takeOfficialNumber(null,null)).toThrow(HttpException);
    try {takeOfficialNumber(null,null);} catch(error) {expect(error).toMatchObject({status:422});}
  });
  it('refuses a second allocation for an already numbered case',()=>{
    try {takeOfficialNumber(1,{series:'SYN-TEST',year:2026,nextValue:2});} catch(error) {expect(error).toMatchObject({status:409}); return;}
    throw new Error('expected ALREADY_FILED');
  });
  it('returns the next fictional-series value when a test series exists',()=>{
    expect(takeOfficialNumber(null,{series:'SYN-TEST',year:2026,nextValue:4})).toEqual({officialSeries:'SYN-TEST',officialYear:2026,officialNumber:4});
  });
});
