import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Permission } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import type { Prisma } from './database.js';
import { loadPrincipal, requirePermission } from './access.js';
import { digest } from './domain/integrity.js';
import { fail, type AuthRequest } from './http.js';

export const jsonValue = (value:unknown):Prisma.InputJsonValue => JSON.parse(JSON.stringify(value,(_k,v:unknown)=>typeof v==='bigint'?v.toString():v)) as Prisma.InputJsonValue;
@Injectable()
export class Commands {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext) {}
  async execute<T>(request:AuthRequest,permission:Permission,action:string,input:unknown,work:(tx:Prisma.TransactionClient)=>Promise<{entityId:string;result:T;changes:unknown}>,committeeId?:string):Promise<T> {
    const key=request.get('idempotency-key');
    if(!key || !/^[A-Za-z0-9_-]{16,100}$/.test(key)) fail(400,'IDEMPOTENCY_KEY_REQUIRED','Provide an Idempotency-Key of 16–100 letters, digits, underscores or hyphens.');
    const municipalityId=request.principal.municipalityId,actorId=request.principal.id;
    const requestHash=digest(input);
    return this.ctx.db.$transaction(async tx=>{
      // All municipal administrative writes share this lock, including revocation.
      // Authorization is reloaded after it, so queued commands cannot use stale grants.
      await tx.$queryRaw`SELECT id FROM municipalities WHERE id = ${municipalityId} FOR UPDATE`;
      const principal=await loadPrincipal(tx,actorId);
      requirePermission(principal,permission,{municipalityId,committeeId});
      const prior=await tx.idempotencyRecord.findUnique({where:{actorId_action_key:{actorId,action,key}}});
      if(prior) {
        if(prior.requestHash !== requestHash) fail(409,'IDEMPOTENCY_MISMATCH','This retry key was already used with different input.');
        return prior.result as T;
      }
      if(this.ctx.config.NODE_ENV === 'production' || this.ctx.config.AUDIT_ENFORCE_EXPORT_LAG !== 'no') {
        const overdue=await tx.outboxEvent.findFirst({where:{municipalityId,type:'audit.recorded',state:{not:'DELIVERED'},createdAt:{lt:new Date(Date.now()-this.ctx.config.AUDIT_MAX_LAG_SECONDS*1000)}}});
        if(overdue) fail(503,'AUDIT_EXPORT_OVERDUE','Independent audit export is overdue. Ask the operator to restore the worker.');
      }
      const {entityId,result,changes}=await work(tx);
      const cursor=await tx.auditCursor.findUniqueOrThrow({where:{municipalityId}});
      const content={id:randomUUID(),municipalityId,sequence:(cursor.sequence+1n).toString(),actorId,actorName:principal.displayName,action,entityId,correlationId:request.correlationId,payload:jsonValue(changes),previousHash:cursor.hash,recordedAt:new Date().toISOString()};
      const hash=digest(content);
      await tx.auditLog.create({data:{...content,sequence:BigInt(content.sequence),recordedAt:new Date(content.recordedAt),hash}});
      await tx.auditCursor.update({where:{municipalityId},data:{sequence:BigInt(content.sequence),hash}});
      await tx.outboxEvent.create({data:{id:randomUUID(),municipalityId,type:'audit.recorded',payload:jsonValue({...content,hash})}});
      await tx.idempotencyRecord.create({data:{id:randomUUID(),actorId,action,key,requestHash,result:jsonValue(result)}});
      return result;
    },{isolationLevel:'ReadCommitted',maxWait:5000,timeout:10000});
  }
}
