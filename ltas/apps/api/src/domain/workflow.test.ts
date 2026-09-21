import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { resolveTransition } from './workflow.js';
describe('P2 draft interim profile',()=>{
  it('allows submit, return and withdraw only',()=>{
    expect(resolveTransition('DRAFT','submit').toStage).toBe('SUBMITTED');
    expect(resolveTransition('SUBMITTED','return').toStage).toBe('DRAFT');
    expect(resolveTransition('SUBMITTED','withdraw').toStage).toBe('WITHDRAWN');
  });
  it('denies filing and readings as profile transitions',()=>{
    expect(()=>resolveTransition('DRAFT','file')).toThrow(HttpException);
    expect(()=>resolveTransition('SUBMITTED','first-reading')).toThrow(HttpException);
  });
});
