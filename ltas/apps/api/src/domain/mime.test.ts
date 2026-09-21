import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { detectMime } from './mime.js';
describe('upload signatures',()=>{
  it('accepts PDF magic',()=>expect(detectMime(Buffer.from('%PDF-1.4 sample'),'application/pdf')).toBe('application/pdf'));
  it('rejects mismatched types',()=>expect(()=>detectMime(Buffer.from('not a pdf'),'application/pdf')).toThrow(HttpException));
});
