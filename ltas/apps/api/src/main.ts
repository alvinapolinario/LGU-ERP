import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { setDefaultResultOrder } from 'node:dns';
import express from 'express';
import { Module } from '@nestjs/common';
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
import { ProblemFilter, type AuthRequest } from './http.js';
import { SessionGuard } from './access.js';
import { HealthController } from './health.js';
import { createObjectStore } from './domain/storage.js';
import { MeasuresController, DocumentsController } from './measures.js';
import { MeasuresService } from './measures.service.js';
import { DocumentsService } from './documents.service.js';
import { ReferralsController } from './referrals.js';
import { ReferralsService } from './referrals.service.js';
import { MeetingsController } from './meetings.js';
import { MeetingsService } from './meetings.service.js';
import { SessionsController } from './sessions.js';
import { SessionsService } from './sessions.service.js';
import { LibraryController } from './library.js';
import { LibraryService } from './library.service.js';
import { PublicCatalogController } from './public-catalog.js';
import { PublicCatalogService } from './public-catalog.service.js';
import { ArchivesController } from './archives.js';
import { ArchivesService } from './archives.service.js';

export async function bootstrap():Promise<void> {
  const config=readConfig();
  if(config.NODE_ENV!=='production') setDefaultResultOrder('ipv4first');
  const db=createDatabase(config.DATABASE_URL),redis=createClient({url:config.REDIS_URL});
  redis.on('error',()=>console.error(JSON.stringify({level:'error',code:'REDIS_CONNECTION_ERROR'})));
  const store=await createObjectStore(config);
  await Promise.all([db.$connect(),redis.connect()]);
  const ctx:AppContext={db,redis,config,store};
  @Module({controllers:[AuthController,AdministrationController,HealthController,MeasuresController,DocumentsController,ReferralsController,MeetingsController,SessionsController,LibraryController,PublicCatalogController,ArchivesController],providers:[{provide:CONTEXT,useValue:ctx},Commands,AdministrationService,MeasuresService,DocumentsService,ReferralsService,MeetingsService,SessionsService,LibraryService,PublicCatalogService,ArchivesService,SessionGuard]})
  class AppModule {}
  const app=await NestFactory.create<NestExpressApplication>(AppModule,{logger:['error','warn','log'],bodyParser:false});
  app.set('trust proxy',config.NODE_ENV==='production'?1:false);
  app.use(helmet());
  app.use((req:AuthRequest,res:import('express').Response,next:()=>void)=>{req.correlationId=randomUUID();res.setHeader('X-Correlation-Id',req.correlationId);res.setHeader('Cache-Control','no-store');next();});
  app.use((req:express.Request,res:express.Response,next:express.NextFunction)=>{
    const path=(req.originalUrl??req.url).split('?')[0]??'';
    if(!path.startsWith('/api/v1/public')) return next();
    const ip=req.ip||'local';
    const key=`ltas:public-rate:${ip}`;
    void redis.incr(key).then(async count=>{
      if(count===1) await redis.expire(key,60);
      if(count>120) {
        res.status(429).type('application/problem+json').json({type:'urn:ltas:problem:RATE_LIMITED',title:'RATE_LIMITED',status:429,detail:'The public catalog is receiving too many requests from this network. Wait a minute and try again.',code:'RATE_LIMITED',instance:path});
        return;
      }
      next();
    }).catch(()=>next());
  });
  app.use((req:express.Request,res:express.Response,next:express.NextFunction)=>{
    const path=(req.originalUrl??req.url).split('?')[0]??'';
    if(req.method==='PUT' && /\/api\/v1\/documents\/intents\/[^/]+\/content$/.test(path)) {
      return express.raw({type:()=>true,limit:26*1024*1024})(req,res,next);
    }
    if(req.method==='PUT' && /\/api\/v1\/admin\/persons\/[^/]+\/photo$/.test(path)) {
      return express.raw({type:()=>true,limit:3*1024*1024})(req,res,next);
    }
    if(req.method==='PUT' && /\/api\/v1\/archives\/ordinances\/[^/]+\/scan$/.test(path)) {
      return express.raw({type:()=>true,limit:13*1024*1024})(req,res,next);
    }
    return express.json({limit:'1mb'})(req,res,next);
  });
  app.use(session({name:'ltas.sid',secret:config.SESSION_SECRET,store:new RedisStore({client:redis,prefix:'ltas:session:'}),resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,secure:config.APP_ORIGIN.startsWith('https:'),sameSite:'lax',maxAge:30*60*1000,path:'/'}}));
  app.setGlobalPrefix('api/v1');app.useGlobalFilters(new ProblemFilter());app.enableShutdownHooks();
  const shutdown=async()=>{await app.close();await db.$disconnect();await redis.quit();};
  process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());
  await app.listen(config.PORT,'127.0.0.1');
}
bootstrap().catch((error:unknown)=>{console.error('LTAS startup failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;});
