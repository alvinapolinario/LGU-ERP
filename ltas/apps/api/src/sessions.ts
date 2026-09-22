import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from './access.js';
import type { AuthRequest } from './http.js';
import { SessionsService } from './sessions.service.js';
import { DocumentsService } from './documents.service.js';

@Controller() @UseGuards(SessionGuard)
export class SessionsController {
  constructor(@Inject(SessionsService) private readonly sessions:SessionsService, @Inject(DocumentsService) private readonly documents:DocumentsService) {}
  @Get('sessions')
  list(@Req() r:AuthRequest,@Query() q:unknown) {return this.sessions.list(r,q);}
  @Post('sessions')
  create(@Req() r:AuthRequest,@Body() body:unknown) {return this.sessions.create(r,body);}
  @Get('calendar')
  calendar(@Req() r:AuthRequest,@Query() q:unknown) {return this.sessions.calendar(r,q);}
  @Get('sessions/:id')
  get(@Req() r:AuthRequest,@Param('id') id:string) {return this.sessions.get(r,id);}
  @Patch('sessions/:id')
  edit(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.sessions.edit(r,id,body);}
  @Post('sessions/:id/close')
  close(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.sessions.close(r,id,body);}
  @Post('sessions/:id/agenda')
  agenda(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.sessions.addMeasure(r,id,body);}
  @Post('sessions/:id/attendance')
  attendance(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.sessions.recordAttendance(r,id,body);}
  @Post('sessions/:id/votes')
  votes(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.sessions.recordVote(r,id,body);}
  @Get('sessions/:id/documents')
  docs(@Req() r:AuthRequest,@Param('id') id:string) {return this.documents.forOwner(r,'SESSION',id);}
}
