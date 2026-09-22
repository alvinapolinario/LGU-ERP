import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from './access.js';
import type { AuthRequest } from './http.js';
import { ReferralsService } from './referrals.service.js';

@Controller() @UseGuards(SessionGuard)
export class ReferralsController {
  constructor(@Inject(ReferralsService) private readonly referrals:ReferralsService) {}
  @Get('measures/:id/referrals')
  forMeasure(@Req() r:AuthRequest,@Param('id') id:string) {return this.referrals.forMeasure(r,id);}
  @Post('measures/:id/referrals')
  create(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.referrals.create(r,id,body);}
  @Get('committees/:id/referrals')
  forCommittee(@Req() r:AuthRequest,@Param('id') id:string,@Query() q:unknown) {return this.referrals.forCommittee(r,id,q);}
  @Post('referrals/:id/close')
  close(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown) {return this.referrals.close(r,id,body);}
}
