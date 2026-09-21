import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Controller, Get, Inject, Module, Req, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import helmet from 'helmet';
import { readConfig } from './config.js';
import { createDatabase } from './database.js';
import { CONTEXT, type AppContext } from './context.js';
import { AuthController } from './auth.js';
import { AdministrationController } from './administration.js';
import { AdministrationService } from './administration.service.js';
import { Commands } from './commands.js';
import { ProblemFilter, fail, type AuthRequest } from './http.js';
import { requirePermission, SessionGuard } from './access.js';

@Controller('health')
class HealthController {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext) {}
  @Get('live') live() {return {status:'ok'};}
  @Get('ready') @UseGuards(SessionGuard)
  async ready(@Req() r:AuthRequest) {
    requirePermission(r.principal,'system.monitor',{municipalityId:r.principal.municipalityId});
    try {await this.ctx.db.$queryRaw`SELECT 1`;await this.ctx.redis.ping();} catch {fail(503,'DEPENDENCY_UNAVAILABLE','A foundation dependency is unavailable.');}
    const pending=await this.ctx.db.outboxEvent.count({where:{state:{not:'DELIVERED'}}});
    return {status:'ok',pendingOutbox:pending};
  }
}
export async function bootstrap():Promise<void> {
  const config=readConfig();
  const db=createDatabase(config.DATABASE_URL),redis=createClient({url:config.REDIS_URL});
  redis.on('error',()=>console.error(JSON.stringify({level:'error',code:'REDIS_CONNECTION_ERROR'})));
  await Promise.all([db.$connect(),redis.connect()]);
  const ctx:AppContext={db,redis,config};
  @Module({controllers:[AuthController,AdministrationController,HealthController],providers:[{provide:CONTEXT,useValue:ctx},Commands,AdministrationService,SessionGuard]})
  class AppModule {}
  const app=await NestFactory.create<NestExpressApplication>(AppModule,{logger:['error','warn','log'],bodyParser:true});
  app.set('trust proxy',config.NODE_ENV==='production'?1:false);
  app.use(helmet());
  app.use((req:AuthRequest,res:import('express').Response,next:()=>void)=>{req.correlationId=randomUUID();res.setHeader('X-Correlation-Id',req.correlationId);res.setHeader('Cache-Control','no-store');next();});
  app.use(session({name:'ltas.sid',secret:config.SESSION_SECRET,store:new RedisStore({client:redis,prefix:'ltas:session:'}),resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,secure:config.APP_ORIGIN.startsWith('https:'),sameSite:'lax',maxAge:30*60*1000,path:'/'}}));
  app.setGlobalPrefix('api/v1');app.useGlobalFilters(new ProblemFilter());app.enableShutdownHooks();
  const shutdown=async()=>{await app.close();await db.$disconnect();await redis.quit();};
  process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());
  await app.listen(config.PORT,'127.0.0.1');
}
bootstrap().catch((error:unknown)=>{console.error('LTAS startup failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;});
