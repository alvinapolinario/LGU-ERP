import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { CONTEXT, type AppContext } from './context.js';
import { fail, type AuthRequest } from './http.js';
import { isAllowedOrigin } from './config.js';
import { can, type Principal, type Scope } from './domain/policy.js';
import type { Permission } from '@ltas/contracts';
import type { Prisma } from './database.js';

export async function loadPrincipal(db:AppContext['db']|Prisma.TransactionClient,userId:string):Promise<Principal> {
  const user=await db.user.findUnique({where:{id:userId},include:{grants:true}});
  if(!user?.enabled) fail(401,'ACCOUNT_DISABLED','Your account is unavailable. Contact your administrator.');
  return user;
}
export function requirePermission(principal:Principal,permission:Permission,scope:Scope):void {
  if(!can(principal,permission,scope)) fail(403,'ACCESS_DENIED','You do not have access to this action.');
}
export function assignedCommitteeIds(principal:Principal,permission:Permission,now=new Date()):string[] {
  return [...new Set(principal.grants.filter(g=>g.scopeType==='COMMITTEE' && can(principal,permission,{municipalityId:principal.municipalityId,committeeId:g.scopeId},now)).map(g=>g.scopeId))];
}
export function canMunicipality(principal:Principal,permission:Permission):boolean {
  return can(principal,permission,{municipalityId:principal.municipalityId});
}
export function requireCommitteePermission(principal:Principal,permission:Permission,committeeId:string):void {
  if(canMunicipality(principal,permission)) return;
  requirePermission(principal,permission,{municipalityId:principal.municipalityId,committeeId});
}
export function measureVisibility(principal:Principal,permission:Permission='measure.view'):{municipalityId:string;referrals?:{some:{committeeId:{in:string[]}}}} | null {
  const municipalityId=principal.municipalityId;
  if(canMunicipality(principal,permission)) return {municipalityId};
  const committeeIds=assignedCommitteeIds(principal,permission);
  if(!committeeIds.length) return null;
  return {municipalityId,referrals:{some:{committeeId:{in:committeeIds}}}};
}
export function csrfMatches(expected:string|undefined,actual:string|undefined):boolean {
  if(!expected || !actual) return false;
  const a=Buffer.from(expected),b=Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a,b);
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext) {}
  async canActivate(context:ExecutionContext):Promise<boolean> {
    const request=context.switchToHttp().getRequest<AuthRequest>();
    const identity=request.session.identity;
    if(!identity || identity.expiresAt<=Date.now() || identity.authenticatedAt+8*60*60*1000<=Date.now()) fail(401,'LOGIN_REQUIRED','Please sign in to continue.');
    const user=await this.ctx.db.user.findUnique({where:{issuer_subject:{issuer:identity.issuer,subject:identity.subject}},include:{grants:true}});
    if(!user?.enabled) fail(401,'ACCOUNT_DISABLED','Your account is unavailable. Contact your administrator.');
    request.principal=user;
    if(!['GET','HEAD','OPTIONS'].includes(request.method)) {
      if(!isAllowedOrigin(request.get('origin'), this.ctx.config.APP_ORIGIN) || !csrfMatches(request.session.csrfToken,request.get('x-csrf-token'))) fail(403,'CSRF_REJECTED','Reload the page before submitting this action.');
    }
    return true;
  }
}
