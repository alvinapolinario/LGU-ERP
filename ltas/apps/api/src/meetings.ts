import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from './access.js';
import type { AuthRequest } from './http.js';
import { MeetingsService } from './meetings.service.js';
import { DocumentsService } from './documents.service.js';

@Controller() @UseGuards(SessionGuard)
export class MeetingsController {
  constructor(@Inject(MeetingsService) private readonly meetings:MeetingsService, @Inject(DocumentsService) private readonly documents:DocumentsService) {}
  @Get('committees/:id/meetings')
  list(@Req() r:AuthRequest,@Param('id') id:string,@Query() q:unknown) {return this.meetings.list(r,id,q);}
  @Post('committees/:id/meetings')
  create(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.meetings.create(r,id,body);}
  @Get('meetings/:id')
  get(@Req() r:AuthRequest,@Param('id') id:string) {return this.meetings.get(r,id);}
  @Patch('meetings/:id')
  edit(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.meetings.edit(r,id,body);}
  @Post('meetings/:id/close')
  close(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.meetings.close(r,id,body);}
  @Post('meetings/:id/referrals')
  agenda(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.meetings.addReferral(r,id,body);}
  @Get('committees/:id/documents')
  committeeDocs(@Req() r:AuthRequest,@Param('id') id:string) {return this.documents.forOwner(r,'COMMITTEE',id);}
  @Get('meetings/:id/documents')
  meetingDocs(@Req() r:AuthRequest,@Param('id') id:string) {return this.documents.forOwner(r,'MEETING',id);}
}
