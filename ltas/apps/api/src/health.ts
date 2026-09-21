import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { CONTEXT, type AppContext } from './context.js';
import { requirePermission, SessionGuard } from './access.js';
import { fail, type AuthRequest } from './http.js';

export async function probeDependencies(ctx: Pick<AppContext, 'db' | 'redis'>): Promise<void> {
  try {
    await ctx.db.$queryRaw`SELECT 1`;
    await ctx.redis.ping();
  } catch {
    fail(503, 'DEPENDENCY_UNAVAILABLE', 'A foundation dependency is unavailable.');
  }
}

@Controller('health')
export class HealthController {
  constructor(@Inject(CONTEXT) private readonly ctx: AppContext) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    await probeDependencies(this.ctx);
    return { status: 'ok' };
  }

  @Get('operations')
  @UseGuards(SessionGuard)
  async operations(@Req() request: AuthRequest) {
    requirePermission(request.principal, 'system.monitor', { municipalityId: request.principal.municipalityId });
    await probeDependencies(this.ctx);
    const pendingOutbox = await this.ctx.db.outboxEvent.count({ where: { state: { not: 'DELIVERED' } } });
    return { status: 'ok', pendingOutbox };
  }
}
