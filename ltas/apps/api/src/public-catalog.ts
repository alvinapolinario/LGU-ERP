import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { PublicCatalogService } from './public-catalog.service.js';

@Controller('public')
export class PublicCatalogController {
  constructor(@Inject(PublicCatalogService) private readonly service:PublicCatalogService) {}
  @Get('home')
  home() {return this.service.home();}
  @Get('measures')
  measures(@Query() q:unknown) {return this.service.measures(q);}
  @Get('measures/:id')
  measure(@Param('id') id:string) {return this.service.measure(id);}
  @Get('council')
  council(@Query() q:unknown) {return this.service.council(q);}
  @Get('persons/:id')
  person(@Param('id') id:string) {return this.service.person(id);}
  @Get('persons/:id/photo')
  photo(@Param('id') id:string) {return this.service.photo(id);}
}
