import { describe, expect, it } from 'vitest';
import { readyVersionId, scanBytes, validationStateFor } from './scanner.js';
describe('scanner adapter',()=>{
  it('returns UNKNOWN so uploads stay quarantined until D-13',()=>expect(scanBytes(Buffer.from('%PDF-1.4'))).toBe('UNKNOWN'));
  it('never marks unknown or fail scans ready',()=>{
    expect(validationStateFor('UNKNOWN')).toBe('QUARANTINED');
    expect(validationStateFor('FAIL')).toBe('QUARANTINED');
    expect(validationStateFor('CLEAN')).toBe('READY');
  });
  it('points at the version only after a clean scan',()=>{
    expect(readyVersionId('CLEAN','version-1')).toBe('version-1');
    expect(readyVersionId('UNKNOWN','version-1')).toBeNull();
    expect(readyVersionId('FAIL','version-1')).toBeNull();
  });
});
