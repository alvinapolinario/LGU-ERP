import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { detectMime, detectPhotoMime } from './mime.js';
describe('upload signatures',()=>{
  it('accepts PDF magic',()=>expect(detectMime(Buffer.from('%PDF-1.4 sample'),'application/pdf')).toBe('application/pdf'));
  it('rejects mismatched types',()=>expect(()=>detectMime(Buffer.from('not a pdf'),'application/pdf')).toThrow(HttpException));
  it('accepts JPEG and PNG photographs',()=>{
    expect(detectPhotoMime(Buffer.from([0xff,0xd8,0xff,0xe0]))).toBe('image/jpeg');
    expect(detectPhotoMime(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe('image/png');
  });
  it('rejects a PDF as a directory photograph',()=>{
    expect(()=>detectPhotoMime(Buffer.from('%PDF-1.4 sample'))).toThrow(HttpException);
  });
});
