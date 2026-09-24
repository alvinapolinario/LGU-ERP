import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { comparePeopleByPosition, idSchema, PUBLIC_CATALOG_NOTE, publicCouncilQuerySchema, publicMeasureQuerySchema } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { fail } from './http.js';

const personPublic = {id:true, displayName:true, positionCode:true, photoSha256:true} as const;
const publicPhotoPositions = ['MAYOR', 'VICE_MAYOR', 'COUNCILOR', 'LIGA_PRESIDENT', 'SK_PRESIDENT', 'SB_SECRETARY', 'SB_STAFF'];
function viewPerson(row:{id:string;displayName:string;positionCode:string;photoSha256:string|null}, assignments?:Array<{committeeName:string; role:string}>) {
  const hasPhoto=Boolean(row.photoSha256) && publicPhotoPositions.includes(row.positionCode);
  return {id:row.id, displayName:row.displayName, positionCode:row.positionCode, hasPhoto, photoVersion:hasPhoto?row.photoSha256:null, ...(assignments?{assignments}:{})};
}
function viewMeasure(row:{
  id:string; typeCode:string; title:string;
  officialSeries:string|null; officialYear:number|null; officialNumber:number|null; createdAt:Date;
}) {
  return {
    id:row.id, typeCode:row.typeCode, title:row.title,
    officialSeries:row.officialSeries, officialYear:row.officialYear, officialNumber:row.officialNumber,
    createdAt:row.createdAt.toISOString(),
  };
}

@Injectable()
export class PublicCatalogService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext) {}
  private async installation() {
    const municipality=await this.ctx.db.municipality.findFirst({orderBy:{createdAt:'asc'}});
    if(!municipality) fail(404,'NOT_FOUND','Municipality not found.');
    const terms=await this.ctx.db.councilTerm.findMany({where:{municipalityId:municipality.id},orderBy:[{startsOn:'desc'},{id:'asc'}]});
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
    const term=terms.find(item=>item.startsOn.toISOString().slice(0,10)<=today && item.endsOn.toISOString().slice(0,10)>=today) ?? terms[0] ?? null;
    const scope={municipalityId:municipality.id};
    return {municipality, term, scope, roster:term?{...scope,termId:term.id}:scope};
  }
  async home() {
    const {municipality,term,scope,roster}=await this.installation();
    const released={...scope,stage:'SUBMITTED' as const};
    const [measures,people,committees,sessions,recent,officers]=await Promise.all([
      this.ctx.db.legislativeMeasure.count({where:released}),
      this.ctx.db.person.count({where:roster}),
      this.ctx.db.committee.count({where:roster}),
      this.ctx.db.legislativeSession.count({where:scope}),
      this.ctx.db.legislativeMeasure.findMany({where:released,orderBy:{createdAt:'desc'},take:6}),
      this.ctx.db.person.findMany({where:{...roster,positionCode:{in:['MAYOR','VICE_MAYOR','SB_SECRETARY']}},select:personPublic}),
    ]);
    const byPosition=new Map(officers.map(row=>[row.positionCode,viewPerson(row)]));
    return {data:{
      municipality:{name:municipality.name,province:municipality.province,code:municipality.code},
      term:term?{label:term.label,startsOn:term.startsOn.toISOString(),endsOn:term.endsOn.toISOString()}:null,
      stats:{measures,people,committees,sessions},
      recentMeasures:recent.map(row=>viewMeasure(row)),
      officers:{mayor:byPosition.get('MAYOR')??null, viceMayor:byPosition.get('VICE_MAYOR')??null, secretary:byPosition.get('SB_SECRETARY')??null},
      note:PUBLIC_CATALOG_NOTE,
    }};
  }
  async measures(q:unknown) {
    const {municipality,scope}=await this.installation();
    const {page,limit,q:raw,typeCode}=publicMeasureQuerySchema.parse(q);
    const needle=raw.trim();
    const where={
      ...scope,
      stage:'SUBMITTED' as const,
      ...(typeCode?{typeCode}:{}),
      ...(needle?{title:{contains:needle}}:{}),
    };
    const [items,total]=await this.ctx.db.$transaction([
      this.ctx.db.legislativeMeasure.findMany({where,skip:(page-1)*limit,take:limit,orderBy:[{createdAt:'desc'},{id:'desc'}]}),
      this.ctx.db.legislativeMeasure.count({where}),
    ]);
    return {items:items.map(row=>viewMeasure(row)),pageInfo:{page,limit,total},municipality:{name:municipality.name,province:municipality.province,code:municipality.code},note:PUBLIC_CATALOG_NOTE};
  }
  async measure(rawId:string) {
    const {scope}=await this.installation();
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.legislativeMeasure.findFirst({where:{id,...scope,stage:'SUBMITTED'}});
    if(!row) fail(404,'NOT_FOUND','Measure not found.');
    return {data:viewMeasure(row),note:PUBLIC_CATALOG_NOTE};
  }
  async council(q:unknown={}) {
    const {municipality,scope}=await this.installation();
    const {termId}=publicCouncilQuerySchema.parse(q??{});
    const terms=await this.ctx.db.councilTerm.findMany({where:scope,orderBy:[{startsOn:'desc'},{id:'asc'}]});
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
    const selected=termId?terms.find(item=>item.id===termId):terms.find(item=>item.startsOn.toISOString().slice(0,10)<=today && item.endsOn.toISOString().slice(0,10)>=today)??terms[0];
    if(termId && !selected) fail(404,'NOT_FOUND','Council term not found.');
    const roster=selected?{...scope,termId:selected.id}:scope;
    const viewTerm=(item:{id:string;label:string;startsOn:Date;endsOn:Date})=>({id:item.id,label:item.label,startsOn:item.startsOn.toISOString(),endsOn:item.endsOn.toISOString()});
    const [people,committees]=await Promise.all([
      this.ctx.db.person.findMany({
        where:roster,
        select:{...personPublic,members:{select:{role:true,committee:{select:{name:true}}},orderBy:[{startsOn:'desc'},{id:'asc'}]}},
        orderBy:[{displayName:'asc'},{id:'asc'}],
      }),
      this.ctx.db.committee.findMany({
        where:roster,
        include:{members:{include:{person:{select:personPublic}},orderBy:[{startsOn:'desc'},{id:'asc'}]}},
        orderBy:[{name:'asc'},{id:'asc'}],
      }),
    ]);
    const view=people.map(row=>viewPerson(row,row.members.map(member=>({committeeName:member.committee.name,role:member.role})))).sort(comparePeopleByPosition);
    const pick=(code:string)=>view.filter(item=>item.positionCode===code);
    return {data:{
      municipality:{name:municipality.name,province:municipality.province,code:municipality.code},
      terms:terms.map(viewTerm),
      term:selected?viewTerm(selected):null,
      mayor:pick('MAYOR')[0]??null,
      presiding:pick('VICE_MAYOR')[0]??null,
      members:pick('COUNCILOR'),
      liga:pick('LIGA_PRESIDENT')[0]??null,
      sk:pick('SK_PRESIDENT')[0]??null,
      secretary:pick('SB_SECRETARY')[0]??null,
      staff:pick('SB_STAFF'),
      other:pick('OTHER'),
      committees:committees.map(item=>({
        id:item.id, code:item.code, name:item.name,
        members:item.members.map(member=>({role:member.role, person:viewPerson(member.person)})),
      })),
      note:PUBLIC_CATALOG_NOTE,
    }};
  }
  async person(rawId:string) {
    const {scope}=await this.installation();
    const id=idSchema.parse(rawId);
    const person=await this.ctx.db.person.findFirst({where:{id,...scope,positionCode:{in:publicPhotoPositions}},select:{...personPublic,displayName:true}});
    if(!person) fail(404,'NOT_FOUND','Person not found.');
    const seats=await this.ctx.db.person.findMany({
      where:{...scope,displayName:person.displayName,positionCode:{in:publicPhotoPositions}},
      select:{...personPublic,term:{select:{id:true,label:true,startsOn:true,endsOn:true}},members:{select:{role:true,committee:{select:{name:true}}}}},
      orderBy:{term:{startsOn:'desc'}},
    });
    const authoredRows=await this.ctx.db.measureAuthor.findMany({
      where:{personId:{in:seats.map(item=>item.id)},role:{in:['AUTHOR','CO_AUTHOR']},measure:{municipalityId:scope.municipalityId,stage:'SUBMITTED'}},
      select:{personId:true,role:true},
    });
    const tally=(personId:string)=>{
      const rows=authoredRows.filter(item=>item.personId===personId);
      return {authored:rows.filter(item=>item.role==='AUTHOR').length,coAuthored:rows.filter(item=>item.role==='CO_AUTHOR').length};
    };
    const listed=seats.map(item=>({...tally(item.id),termId:item.term.id,termLabel:item.term.label,startsOn:item.term.startsOn.toISOString(),endsOn:item.term.endsOn.toISOString(),positionCode:item.positionCode,committees:item.members.map(member=>({name:member.committee.name,role:member.role}))}));
    const authored=listed.reduce((sum,item)=>sum+item.authored,0);
    const coAuthored=listed.reduce((sum,item)=>sum+item.coAuthored,0);
    return {data:{...viewPerson(person),termsListed:listed.length,authored,coAuthored,seats:listed,note:PUBLIC_CATALOG_NOTE}};
  }
  async photo(rawId:string) {
    const {scope}=await this.installation();
    const id=idSchema.parse(rawId);
    const row=await this.ctx.db.person.findFirst({where:{id,...scope,positionCode:{in:publicPhotoPositions}},select:{photoBytes:true,photoMime:true}});
    if(!row) fail(404,'NOT_FOUND','Person not found.');
    if(!row.photoBytes || !row.photoMime) fail(404,'NOT_FOUND','No photograph is on file for this person.');
    return new StreamableFile(Buffer.from(row.photoBytes),{type:row.photoMime,disposition:'inline'});
  }
}
