export type ScanVerdict = 'UNKNOWN' | 'FAIL' | 'CLEAN';
export function scanBytes(_body:Buffer):ScanVerdict {
  return 'UNKNOWN';
}
export function validationStateFor(verdict:ScanVerdict):'READY'|'QUARANTINED' {
  return verdict==='CLEAN'?'READY':'QUARANTINED';
}
