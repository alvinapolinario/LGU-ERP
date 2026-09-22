import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from './access.js';
import type { AuthRequest } from './http.js';
import { MeasuresService } from './measures.service.js';
import { DocumentsService } from './documents.service.js';

@Controller() @UseGuards(SessionGuard)
export class MeasuresController {
  constructor(@Inject(MeasuresService) private readonly measures:MeasuresService, @Inject(DocumentsService) private readonly documents:DocumentsService) {}
  @Get('measures/stats')
  stats(@Req() r:AuthRequest) {return this.measures.stats(r);}
  @Get('measures')
  list(@Req() r:AuthRequest,@Query() q:unknown) {return this.measures.list(r,q);}
  @Post('measures')
  create(@Req() r:AuthRequest,@Body() body:unknown) {return this.measures.create(r,body);}
  @Get('measures/:id')
  get(@Req() r:AuthRequest,@Param('id') id:string) {return this.measures.get(r,id);}
  @Patch('measures/:id')
  edit(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.measures.edit(r,id,body);}
  @Get('measures/:id/timeline')
  timeline(@Req() r:AuthRequest,@Param('id') id:string) {return this.measures.timeline(r,id);}
  @Post('measures/:id/versions')
  version(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.measures.addVersion(r,id,body);}
  @Post('measures/:id/submit')
  submit(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.measures.transition(r,id,'submit',body);}
  @Post('measures/:id/return')
  returnDraft(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.measures.transition(r,id,'return',body);}
  @Post('measures/:id/withdraw')
  withdraw(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.measures.transition(r,id,'withdraw',body);}
  @Post('measures/:id/file')
  file(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.measures.file(r,id,body);}
  @Get('measures/:id/documents')
  docs(@Req() r:AuthRequest,@Param('id') id:string) {return this.documents.forMeasure(r,id);}
  @Get('tasks')
  tasks(@Req() r:AuthRequest,@Query() q:unknown) {return this.measures.tasks(r,q);}
  @Post('tasks/:id/complete')
  complete(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.measures.completeTask(r,id,body);}
  @Get('notifications')
  notices(@Req() r:AuthRequest) {return this.measures.notifications(r);}
}

@Controller() @UseGuards(SessionGuard)
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents:DocumentsService) {}
  @Get('documents')
  list(@Req() r:AuthRequest,@Query() q:unknown) {return this.documents.list(r,q);}
  @Post('documents/intents')
  intent(@Req() r:AuthRequest,@Body() body:unknown) {return this.documents.createIntent(r,body);}
  @Put('documents/intents/:id/content')
  async content(@Req() r:AuthRequest,@Param('id') id:string) {
    const raw=r.body;
    const buffer=Buffer.isBuffer(raw)?raw:Buffer.from(typeof raw==='string'?raw:JSON.stringify(raw??''));
    return this.documents.storeContent(r,id,buffer);
  }
  @Post('documents/intents/:id/finalize')
  finalize(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.documents.finalize(r,id,body);}
  @Get('documents/:id')
  get(@Req() r:AuthRequest,@Param('id') id:string) {return this.documents.get(r,id);}
  @Get('documents/:id/download')
  download(@Req() r:AuthRequest,@Param('id') id:string) {return this.documents.download(r,id);}
  @Post('documents/:id/certify')
  certify(@Req() r:AuthRequest,@Param('id') id:string) {return this.documents.certify(r,id);}
}
