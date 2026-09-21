import { describe, expect, it } from 'vitest';
import { Commands } from './commands.js';
import { genesisHash, verifyChain } from './domain/integrity.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';

// Transaction-port tests exercise command orchestration, not MySQL isolation semantics.
function harness() {
  let state={count:0,logs:[] as Record<string,unknown>[],outbox:[] as unknown[],receipts:[] as Array<{requestHash:string;result:unknown}>,cursor:{sequence:0n,hash:genesisHash}};
  let failAudit=false,enabled=true;
  const db={$transaction:async(work:(tx:unknown)=>Promise<unknown>)=>{
    const draft=structuredClone(state);
    const tx={
      $queryRaw:async()=>[],
      user:{findUnique:async()=>({id:'user',municipalityId:'municipality',displayName:'Test admin',enabled,grants:[{role:'SYS',scopeType:'MUNICIPALITY',scopeId:'municipality',validFrom:new Date('2025-01-01'),validUntil:new Date('2099-01-01'),revokedAt:null}]})},
      idempotencyRecord:{findUnique:async()=>draft.receipts[0]??null,create:async({data}:{data:{requestHash:string;result:unknown}})=>{draft.receipts.push(data);}},
      outboxEvent:{findFirst:async()=>null,create:async({data}:{data:unknown})=>{draft.outbox.push(data);}},
      auditCursor:{findUniqueOrThrow:async()=>draft.cursor,update:async({data}:{data:typeof draft.cursor})=>{draft.cursor=data;}},
      auditLog:{create:async({data}:{data:Record<string,unknown>})=>{if(failAudit)throw new Error('Audit insertion failed');draft.logs.push(data);}},
      municipality:{update:async()=>({id:'municipality',count:++draft.count})},
    };
    const result=await work(tx);state=draft;return result;
  }};
  const commands=new Commands({db,config:{AUDIT_MAX_LAG_SECONDS:3600}} as unknown as AppContext);
  const req={principal:{id:'user',municipalityId:'municipality'},correlationId:'correlation',get:(header:string)=>header==='idempotency-key'?'synthetic-request-0001':undefined} as unknown as AuthRequest;
  const run=(input:unknown={name:'new'})=>commands.execute(req,'settings.manage','municipality.updated',input,async tx=>{const result=await tx.municipality.update({where:{id:'municipality'},data:{name:'new'}});return {entityId:'municipality',result,changes:input};});
  return {run,state:()=>state,failAudit:()=>{failAudit=true;},disable:()=>{enabled=false;}};
}
describe('atomic commands and retry behavior',()=>{
  it('commits business state, audit, outbox and retry result together',async()=>{const h=harness();await h.run();expect(h.state().count).toBe(1);expect(h.state().logs).toHaveLength(1);expect(h.state().outbox).toHaveLength(1);expect(h.state().receipts).toHaveLength(1);const serialized=JSON.parse(JSON.stringify(h.state().logs,(_k,v:unknown)=>typeof v==='bigint'?v.toString():v));expect(verifyChain(serialized)).toBe(true);});
  it('rolls back the business write when audit insertion fails',async()=>{const h=harness();h.failAudit();await expect(h.run()).rejects.toThrow('Audit insertion');expect(h.state().count).toBe(0);expect(h.state().logs).toHaveLength(0);expect(h.state().outbox).toHaveLength(0);expect(h.state().receipts).toHaveLength(0);});
  it('replays identical requests without duplicate effects',async()=>{const h=harness();expect(await h.run()).toEqual(await h.run());expect(h.state().count).toBe(1);expect(h.state().logs).toHaveLength(1);});
  it('rejects a reused retry key with changed input',async()=>{const h=harness();await h.run();await expect(h.run({name:'different'})).rejects.toMatchObject({status:409});expect(h.state().count).toBe(1);});
  it('does not replay a formerly authorized result after disablement',async()=>{const h=harness();await h.run();h.disable();await expect(h.run()).rejects.toMatchObject({status:401});});
});
