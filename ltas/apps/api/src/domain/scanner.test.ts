import { describe, expect, it } from 'vitest';
import { scanBytes, validationStateFor } from './scanner.js';
describe('scanner adapter',()=>{
  it('returns UNKNOWN so uploads stay quarantined until D-13',()=>expect(scanBytes(Buffer.from('%PDF-1.4'))).toBe('UNKNOWN'));
  it('never marks unknown or fail scans ready',()=>{
    expect(validationStateFor('UNKNOWN')).toBe('QUARANTINED');
    expect(validationStateFor('FAIL')).toBe('QUARANTINED');
    expect(validationStateFor('CLEAN')).toBe('READY');
  });
});
