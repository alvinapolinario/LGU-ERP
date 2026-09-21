import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportEvent } from './export.js';
const paths:string[]=[];
afterEach(async()=>{for(const path of paths.splice(0))await rm(path,{recursive:true,force:true});});
describe('independent evidence retries',()=>{
  it('writes once and accepts identical retry',async()=>{const path=await mkdtemp(join(tmpdir(),'ltas-test-'));paths.push(path);const id='10000000-0000-4000-8000-000000000001';expect(await exportEvent(path,id,{sequence:1})).toBe(await exportEvent(path,id,{sequence:1}));expect(await readFile(join(path,`${id}.json`),'utf8')).toBe('{"sequence":1}');});
  it('refuses to overwrite different evidence under the same event ID',async()=>{const path=await mkdtemp(join(tmpdir(),'ltas-test-'));paths.push(path);const id='10000000-0000-4000-8000-000000000001';await exportEvent(path,id,{sequence:1});await expect(exportEvent(path,id,{sequence:2})).rejects.toThrow('mismatch');});
  it('rejects path traversal in event identifiers',async()=>{await expect(exportEvent(tmpdir(),'../../escape',{})).rejects.toThrow('identifier');});
});
