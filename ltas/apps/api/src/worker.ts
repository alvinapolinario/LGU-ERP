import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { readConfig } from './config.js';
import { createDatabase } from './database.js';
import { exportEvent } from './domain/export.js';
import { Prisma } from './generated/prisma/client.js';
import { describeFailure, RECLAIM_STATES, retryPlan } from './domain/outbox-relay.js';

const config = readConfig();
if (!process.env['WORKER_DATABASE_URL']) throw new Error('WORKER_DATABASE_URL is required; do not reuse the API identity.');
const once = process.env['LTAS_WORKER_ONCE'] === 'yes';
const exportDir = resolve(process.cwd(), config.AUDIT_EXPORT_DIR);
const db = createDatabase(process.env['WORKER_DATABASE_URL']);
let stopping = false;
process.once('SIGINT', () => { stopping = true; });
process.once('SIGTERM', () => { stopping = true; });

function log(entry: Record<string, unknown>) {
  console.error(JSON.stringify(entry));
}

async function claim() {
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM outbox_events WHERE state IN (${Prisma.join(RECLAIM_STATES)}) AND availableAt <= UTC_TIMESTAMP(3) ORDER BY createdAt, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!rows[0]) return null;
    return tx.outboxEvent.update({ where: { id: rows[0].id }, data: { state: 'PROCESSING', attempts: { increment: 1 }, availableAt: new Date(Date.now() + 60_000) } });
  });
}

async function deliver(event: { id: string; type: string; payload: unknown }) {
  if (event.type !== 'audit.recorded') throw new Error('No consumer registered');
  await exportEvent(exportDir, event.id, event.payload);
  await db.$transaction(async tx => {
    await tx.consumerReceipt.upsert({
      where: { consumer_eventId: { consumer: 'audit-export-v1', eventId: event.id } },
      create: { id: randomUUID(), consumer: 'audit-export-v1', eventId: event.id },
      update: {},
    });
    await tx.outboxEvent.update({ where: { id: event.id }, data: { state: 'DELIVERED' } });
  });
}

async function tick(): Promise<'idle' | 'stop'> {
  const event = await claim();
  if (!event) {
    if (once || stopping) return 'stop';
    await delay(1000);
    return 'idle';
  }
  try {
    await deliver(event);
  } catch (error) {
    const detail = describeFailure(error);
    const plan = retryPlan(event.attempts);
    log({ code: 'OUTBOX_DELIVERY_FAILED', eventId: event.id, attempt: event.attempts, state: plan.state, error: detail.name, message: detail.message });
    await db.outboxEvent.updateMany({
      where: { id: event.id, state: 'PROCESSING', attempts: event.attempts },
      data: { state: plan.state, availableAt: new Date(Date.now() + plan.delayMs) },
    });
  }
  return 'idle';
}

async function run(): Promise<void> {
  log({ code: 'WORKER_STARTED', once, exportDir });
  await db.$connect();
  while (!stopping) {
    try {
      if (await tick() === 'stop') break;
    } catch (error) {
      const detail = describeFailure(error);
      log({ code: 'WORKER_INFRASTRUCTURE', error: detail.name, message: detail.message });
      if (once) throw error;
      await delay(5000);
    }
  }
}

run().catch(error => {
  const detail = describeFailure(error);
  log({ code: 'WORKER_STOPPED', error: detail.name, message: detail.message });
  process.exitCode = 1;
}).finally(() => db.$disconnect());
