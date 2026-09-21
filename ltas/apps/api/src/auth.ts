import { Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import * as oidc from 'openid-client';
import { permissions } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { fail, type AuthRequest } from './http.js';
import { SessionGuard } from './access.js';
import { can } from './domain/policy.js';

@Controller('auth')
export class AuthController {
  private discovery?:Promise<oidc.Configuration>;
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext) {}
  private client():Promise<oidc.Configuration> {
    this.discovery ??= oidc.discovery(new URL(this.ctx.config.OIDC_ISSUER),this.ctx.config.OIDC_CLIENT_ID,this.ctx.config.OIDC_CLIENT_SECRET,undefined,
      this.ctx.config.NODE_ENV !== 'production' && this.ctx.config.OIDC_ISSUER.startsWith('http:') ? {execute:[oidc.allowInsecureRequests]} : undefined).catch(()=>{this.discovery=undefined;return fail(503,'IDENTITY_UNAVAILABLE','The identity service is unavailable. Try again later.');});
    return this.discovery;
  }
  @Get('login')
  async login(@Req() request:AuthRequest,@Res() response:Response):Promise<void> {
    const config=await this.client();
    await new Promise<void>((resolve,reject)=>request.session.regenerate(e=>e?reject(e):resolve()));
    const verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();
    request.session.oidc={verifier,state,nonce,createdAt:Date.now()};
    const url=oidc.buildAuthorizationUrl(config,{redirect_uri:`${this.ctx.config.APP_ORIGIN}/api/v1/auth/callback`,scope:'openid profile',code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',state,nonce});
    await new Promise<void>((resolve,reject)=>request.session.save(e=>e?reject(e):resolve()));
    response.redirect(url.href);
  }
  @Get('callback')
  async callback(@Req() request:AuthRequest,@Res() response:Response):Promise<void> {
    const pending=request.session.oidc;
    delete request.session.oidc;
    await new Promise<void>((resolve,reject)=>request.session.save(e=>e?reject(e):resolve()));
    if(!pending || Date.now()-pending.createdAt>5*60*1000) fail(401,'LOGIN_EXPIRED','The login attempt expired. Start again.');
    let claims:oidc.IDToken;
    try {
      const tokens=await oidc.authorizationCodeGrant(await this.client(),new URL(request.originalUrl,this.ctx.config.APP_ORIGIN),{pkceCodeVerifier:pending.verifier,expectedState:pending.state,expectedNonce:pending.nonce,idTokenExpected:true});
      const result=tokens.claims();
      if(!result) return fail(401,'INVALID_IDENTITY','The identity response is invalid.');
      claims=result;
    } catch {return fail(401,'INVALID_IDENTITY','The login could not be verified. Start again.');}
    const user=await this.ctx.db.user.findUnique({where:{issuer_subject:{issuer:this.ctx.config.OIDC_ISSUER,subject:claims.sub}}});
    if(!user?.enabled) fail(403,'ACCOUNT_NOT_LINKED','An administrator must link and enable your LTAS account.');
    await new Promise<void>((resolve,reject)=>request.session.regenerate(e=>e?reject(e):resolve()));
    request.session.identity={issuer:this.ctx.config.OIDC_ISSUER,subject:claims.sub,expiresAt:Math.min(claims.exp*1000,Date.now()+8*60*60*1000),authenticatedAt:Date.now()};
    request.session.csrfToken=randomBytes(32).toString('hex');
    await new Promise<void>((resolve,reject)=>request.session.save(e=>e?reject(e):resolve()));
    response.redirect('/');
  }
  @Get('session') @UseGuards(SessionGuard)
  session(@Req() request:AuthRequest) {
    const p=request.principal;
    return {data:{user:{id:p.id,displayName:p.displayName,municipalityId:p.municipalityId},permissions:permissions.filter(permission=>can(p,permission,{municipalityId:p.municipalityId}) || p.grants.some(g=>can(p,permission,{municipalityId:p.municipalityId,committeeId:g.scopeType==='COMMITTEE'?g.scopeId:undefined}))),csrfToken:request.session.csrfToken}};
  }
  @Post('logout') @UseGuards(SessionGuard)
  async logout(@Req() request:AuthRequest,@Res() response:Response):Promise<void> {
    const client=await this.client();
    const logoutUrl=oidc.buildEndSessionUrl(client,{client_id:this.ctx.config.OIDC_CLIENT_ID,post_logout_redirect_uri:this.ctx.config.APP_ORIGIN});
    await new Promise<void>((resolve,reject)=>request.session.destroy(e=>e?reject(e):resolve()));
    response.clearCookie('ltas.sid',{path:'/'}).json({data:{logoutUrl:logoutUrl.href}});
  }
}
