import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from './generated/prisma/client.js';
import type { Principal } from './domain/policy.js';

export interface Identity {issuer:string; subject:string; expiresAt:number; authenticatedAt:number;}
declare module 'express-session' {
  interface SessionData {identity?:Identity; csrfToken?:string; oidc?:{state:string;nonce:string;verifier:string;createdAt:number};}
}
export interface AuthRequest extends Request {principal:Principal; correlationId:string;}
export function fail(status:number,code:string,detail:string):never {throw new HttpException({code,detail},status);}
@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost):void {
    const response=host.switchToHttp().getResponse<Response>();
    const request=host.switchToHttp().getRequest<AuthRequest>();
    let status=500, code='INTERNAL_ERROR', detail='The request could not be completed.';
    let errors:unknown;
    if (error instanceof ZodError) {status=400;code='INVALID_INPUT';detail='Check the supplied fields.';errors=error.issues.map(i=>({path:i.path,message:i.message}));}
    else if (error instanceof HttpException) {status=error.getStatus();const body=error.getResponse();if (typeof body === 'object') {const b=body as Record<string,unknown>;code=String(b['code'] ?? 'REQUEST_FAILED');detail=String(b['detail'] ?? b['message'] ?? detail);}}
    else if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) {status=409;code='CONFLICT';detail='This record changed or already exists. Reload before retrying.';}
    else if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError) {status=503;code='DATABASE_UNAVAILABLE';detail='The database operation could not be completed.';}
    if(status>=500) console.error(JSON.stringify({level:'error',correlationId:request.correlationId,code,errorType:error instanceof Error ? error.name : 'Unknown'}));
    response.status(status).type('application/problem+json').json({type:`urn:ltas:problem:${code}`,title:code,status,detail,code,instance:request.path,correlationId:request.correlationId, ...(errors ? {errors}: {})});
  }
}
