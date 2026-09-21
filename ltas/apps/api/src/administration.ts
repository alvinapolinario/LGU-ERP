import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from './access.js';
import type { AuthRequest } from './http.js';
import { AdministrationService } from './administration.service.js';

@Controller() @UseGuards(SessionGuard)
export class AdministrationController {
  constructor(@Inject(AdministrationService) private readonly service:AdministrationService) {}
  @Get('admin/municipality')
  municipality(@Req() r:AuthRequest) {return this.service.municipality(r);}
  @Patch('admin/municipality')
  editMunicipality(@Req() r:AuthRequest,@Body() body:unknown) {return this.service.editMunicipality(r, body);}
  @Get('admin/roles')
  roles(@Req() r:AuthRequest) {return this.service.roles(r);}
  @Get('admin/users')
  users(@Req() r:AuthRequest,@Query() q:unknown) {return this.service.users(r, q);}
  @Post('admin/users')
  createUser(@Req() r:AuthRequest,@Body() body:unknown) {return this.service.createUser(r, body);}
  @Patch('admin/users/:id/state')
  userState(@Req() r:AuthRequest,@Param('id') rawId:string,@Body() body:unknown) {return this.service.userState(r, rawId, body);}
  @Get('admin/grant-requests')
  requests(@Req() r:AuthRequest,@Query() q:unknown) {return this.service.requests(r, q);}
  @Post('admin/grant-requests')
  requestGrant(@Req() r:AuthRequest,@Body() body:unknown) {return this.service.requestGrant(r, body);}
  @Post('admin/grant-requests/:id/:decision')
  reviewGrant(@Req() r:AuthRequest,@Param('id') rawId:string,@Param('decision') decision:string,@Body() body:unknown) {return this.service.reviewGrant(r, rawId, decision, body);}
  @Get('admin/grants')
  grants(@Req() r:AuthRequest,@Query() q:unknown) {return this.service.grants(r, q);}
  @Post('admin/grants/:id/revoke')
  revoke(@Req() r:AuthRequest,@Param('id') rawId:string,@Body() body:unknown) {return this.service.revoke(r, rawId, body);}
  @Get('admin/terms')
  terms(@Req() r:AuthRequest,@Query() q:unknown) {return this.service.terms(r, q);}
  @Post('admin/terms')
  createTerm(@Req() r:AuthRequest,@Body() body:unknown) {return this.service.createTerm(r, body);}
  @Get('admin/persons')
  persons(@Req() r:AuthRequest,@Query() q:unknown) {return this.service.persons(r, q);}
  @Post('admin/persons')
  createPerson(@Req() r:AuthRequest,@Body() body:unknown) {return this.service.createPerson(r, body);}
  @Get('committees')
  committees(@Req() r:AuthRequest,@Query() q:unknown) {return this.service.committees(r, q);}
  @Get('committees/:id')
  committee(@Req() r:AuthRequest,@Param('id') rawId:string) {return this.service.committee(r, rawId);}
  @Post('committees')
  createCommittee(@Req() r:AuthRequest,@Body() body:unknown) {return this.service.createCommittee(r, body);}
  @Post('committees/:id/members')
  addMember(@Req() r:AuthRequest,@Param('id') rawId:string,@Body() body:unknown) {return this.service.addMember(r, rawId, body);}
  @Get('audit')
  audit(@Req() r:AuthRequest,@Query() q:unknown) {return this.service.audit(r, q);}
}
