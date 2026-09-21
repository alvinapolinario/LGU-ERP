import { describe, expect, it } from 'vitest';
import { probeDependencies } from './health.js';
import type { AppContext } from './context.js';

describe('unauthenticated health probes', () => {
  it('succeeds when MySQL and Redis answer', async () => {
    const ctx = {
      db: { $queryRaw: async () => [1] },
      redis: { ping: async () => 'PONG' },
    } as unknown as AppContext;
    await expect(probeDependencies(ctx)).resolves.toBeUndefined();
  });

  it('fails closed when a foundation dependency is down', async () => {
    const ctx = {
      db: { $queryRaw: async () => [1] },
      redis: { ping: async () => { throw new Error('closed'); } },
    } as unknown as AppContext;
    await expect(probeDependencies(ctx)).rejects.toMatchObject({ status: 503 });
  });
});
