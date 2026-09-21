import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { readConfig } from './config.js';
import { createDatabase } from './database.js';
import { exportEvent } from './domain/export.js';

const config=readConfig();
if(!process.env['WORKER_DATABASE_URL']) throw new Error('WORKER_DATABASE_URL is required; do not reuse the API identity.');
const db=createDatabase(process.env['WORKER_DATABASE_URL']);
let stopping=false;
process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
async function run():Promise<void> {
  await db.$connect();
  while(!stopping) {
    const event=await db.$transaction(async tx=>{
      const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM outbox_events WHERE state IN ('PENDING','PROCESSING') AND availableAt <= UTC_TIMESTAMP(3) ORDER BY createdAt,id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if(!rows[0]) return null;
      return tx.outboxEvent.update({where:{id:rows[0].id},data:{state:'PROCESSING',attempts:{increment:1},availableAt:new Date(Date.now()+60000)}});
    });
    if(!event) {await delay(1000);continue;}
    try {
      if(event.type!=='audit.recorded') throw new Error('No consumer registered');
      await exportEvent(config.AUDIT_EXPORT_DIR,event.id,event.payload);
      await db.$transaction(async tx=>{
        await tx.consumerReceipt.upsert({where:{consumer_eventId:{consumer:'audit-export-v1',eventId:event.id}},create:{id:randomUUID(),consumer:'audit-export-v1',eventId:event.id},update:{}});
        await tx.outboxEvent.update({where:{id:event.id},data:{state:'DELIVERED'}});
      });
    } catch {
      await db.outboxEvent.updateMany({where:{id:event.id,state:'PROCESSING',attempts:event.attempts},data:{state:event.attempts>=5?'DEAD':'PENDING',availableAt:new Date(Date.now()+Math.min(300000,1000*2**event.attempts))}});
      console.error(JSON.stringify({code:'OUTBOX_DELIVERY_FAILED',eventId:event.id,attempt:event.attempts}));
    }
  }
}
run().catch(()=>{console.error('Worker stopped after an infrastructure failure.');process.exitCode=1;}).finally(()=>db.$disconnect());
