import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from './access.js';
import type { AuthRequest } from './http.js';
import { LibraryService } from './library.service.js';

@Controller() @UseGuards(SessionGuard)
export class LibraryController {
  constructor(@Inject(LibraryService) private readonly library:LibraryService) {}
  @Get('library')
  search(@Req() r:AuthRequest,@Query() q:unknown) {return this.library.search(r,q);}
  @Get('reports')
  reports(@Req() r:AuthRequest) {return this.library.reports(r);}
}
