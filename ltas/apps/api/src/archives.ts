import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from './access.js';
import type { AuthRequest } from './http.js';
import { ArchivesService } from './archives.service.js';

@Controller() @UseGuards(SessionGuard)
export class ArchivesController {
  constructor(@Inject(ArchivesService) private readonly archives:ArchivesService) {}
  @Get('archives/ordinances')
  list(@Req() r:AuthRequest, @Query() q:unknown) {return this.archives.list(r, q);}
  @Post('archives/ordinances')
  create(@Req() r:AuthRequest, @Body() body:unknown) {return this.archives.create(r, body);}
  @Get('archives/ordinances/:id')
  get(@Req() r:AuthRequest, @Param('id') id:string) {return this.archives.get(r, id);}
  @Patch('archives/ordinances/:id')
  update(@Req() r:AuthRequest, @Param('id') id:string, @Body() body:unknown) {return this.archives.update(r, id, body);}
  @Patch('archives/ordinances/:id/text')
  saveText(@Req() r:AuthRequest, @Param('id') id:string, @Body() body:unknown) {return this.archives.saveText(r, id, body);}
  @Put('archives/ordinances/:id/scan')
  setScan(@Req() r:AuthRequest, @Param('id') id:string) {
    const raw = r.body;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === 'string' ? raw : '');
    return this.archives.setScan(r, id, buffer);
  }
  @Get('archives/ordinances/:id/scan')
  scan(@Req() r:AuthRequest, @Param('id') id:string) {return this.archives.scan(r, id);}
}
