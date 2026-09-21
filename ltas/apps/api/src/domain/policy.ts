import { rolePermissions, type Permission, type Role } from '@ltas/contracts';

export interface Scope {municipalityId:string; committeeId?:string;}
export interface RoleGrant {role:string; scopeType:string; scopeId:string; validFrom:Date; validUntil:Date; revokedAt:Date|null;}
export interface Principal {id:string; municipalityId:string; displayName:string; enabled:boolean; grants:RoleGrant[];}
export function can(principal:Principal, permission:Permission, scope:Scope, now = new Date()):boolean {
  if (!principal.enabled || principal.municipalityId !== scope.municipalityId) return false;
  return principal.grants.some(g => {
    if (g.revokedAt || g.validFrom > now || g.validUntil <= now) return false;
    if (!Object.hasOwn(rolePermissions,g.role) || !rolePermissions[g.role as Role].includes(permission)) return false;
    return (g.scopeType === 'MUNICIPALITY' && g.scopeId === scope.municipalityId) ||
      (g.scopeType === 'COMMITTEE' && scope.committeeId !== undefined && g.scopeId === scope.committeeId);
  });
}
export function independentApproval(requester:string, reviewer:string, target:string):boolean {
  return requester !== reviewer && requester !== target && reviewer !== target;
}
export function overlaps(aStart:Date,aEnd:Date,bStart:Date,bEnd:Date):boolean {return aStart <= bEnd && bStart <= aEnd;}
/** Grant validity uses a half-open window: validUntil is exclusive, matching `can()`. */
export function grantWindowsConflict(aStart:Date,aEnd:Date,bStart:Date,bEnd:Date):boolean {return aStart < bEnd && bStart < aEnd;}
export function conflictingGrant(existing:RoleGrant, proposed:{role:string;scopeType:string;scopeId:string;validFrom:Date;validUntil:Date}):boolean {
  if (existing.revokedAt || existing.role !== proposed.role || existing.scopeType !== proposed.scopeType || existing.scopeId !== proposed.scopeId) return false;
  return grantWindowsConflict(existing.validFrom, existing.validUntil, proposed.validFrom, proposed.validUntil);
}
