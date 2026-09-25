import { Inject, Injectable } from '@nestjs/common';
import { libraryQuerySchema, REPORT_DEFINITION, type LibraryHit, type Permission, type ReportMetric } from '@ltas/contracts';
import { CONTEXT, type AppContext } from './context.js';
import { assignedCommitteeIds, canMunicipality, measureVisibility } from './access.js';
import { fail, type AuthRequest } from './http.js';
import { DocumentsService } from './documents.service.js';

const warnings=[
  'These counts are an engineering catalog (P-REPORT-INTERIM-1). D-11 metric definitions are unsigned.',
  'Draft and submitted case files are not filed, enacted, or officially numbered.',
  'Attendance rows are not a quorum declaration.',
  'Recorded tallies are not certified votes and do not pass or fail a measure.',
  'This catalog does not score political performance or rank officials.',
] as const;

@Injectable()
export class LibraryService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(DocumentsService) private readonly documents:DocumentsService) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  private gate(r:AuthRequest,permission:Permission) {
    if(canMunicipality(r.principal,permission) || assignedCommitteeIds(r.principal,permission).length) return;
    fail(403,'ACCESS_DENIED','You do not have access to this action.');
  }
  private measureWhere(r:AuthRequest) {return measureVisibility(r.principal);}
  private meetingWhere(r:AuthRequest) {
    if(canMunicipality(r.principal,'committee.meeting.view')) return this.scope(r);
    const committeeIds=assignedCommitteeIds(r.principal,'committee.meeting.view');
    return committeeIds.length?{...this.scope(r),committeeId:{in:committeeIds}}:null;
  }
  private committeeWhere(r:AuthRequest) {
    if(canMunicipality(r.principal,'committee.view')) return this.scope(r);
    const committeeIds=assignedCommitteeIds(r.principal,'committee.view');
    return committeeIds.length?{...this.scope(r),id:{in:committeeIds}}:null;
  }
  private text(needle:string, fields:string[]) {
    if(!needle) return {};
    return {OR:fields.map(field=>({[field]:{contains:needle}}))};
  }
  private async slice<T>(count:number, cursor:{skip:number;need:number}, load:(skip:number,take:number)=>Promise<T[]>):Promise<T[]> {
    if(cursor.need===0 || count===0 || cursor.skip>=count) {cursor.skip=Math.max(0,cursor.skip-count);return [];}
    const skip=cursor.skip;
    const take=Math.min(cursor.need,count-skip);
    cursor.skip=0;
    cursor.need-=take;
    return load(skip,take);
  }
  async search(r:AuthRequest,q:unknown) {
    this.gate(r,'library.view');
    const {page,limit,q:raw,kind}=libraryQuerySchema.parse(q);
    const needle=raw.trim();
    const include=(wanted:string)=>!kind || kind===wanted;
    const cursor={skip:(page-1)*limit,need:limit};
    const hits:LibraryHit[]=[];
    let total=0;
    const measureWhere=this.measureWhere(r);
    if(include('MEASURE') && measureWhere) {
      const where={AND:[measureWhere,this.text(needle,['title','subject','typeCode','stage'])]};
      const count=await this.ctx.db.legislativeMeasure.count({where});
      total+=count;
      const rows=await this.slice(count,cursor,(skip,take)=>this.ctx.db.legislativeMeasure.findMany({where,orderBy:{createdAt:'desc'},skip,take}));
      for(const row of rows) hits.push({id:row.id,kind:'MEASURE',title:row.title,detail:row.subject,state:row.stage});
    }
    if(include('DOCUMENT') && (canMunicipality(r.principal,'document.view') || assignedCommitteeIds(r.principal,'document.view').length)) {
      const pageRows=await this.documents.pageVisible(r,needle,0,1);
      total+=pageRows.total;
      const rows=await this.slice(pageRows.total,cursor,(skip,take)=>this.documents.pageVisible(r,needle,skip,take).then(result=>result.rows));
      for(const row of rows) hits.push({id:row.id,kind:'DOCUMENT',title:row.title,detail:row.ownerType,state:row.versions[0]?.validationState??'UNKNOWN'});
    }
    if(include('SESSION') && canMunicipality(r.principal,'session.view')) {
      const where={AND:[this.scope(r),this.text(needle,['reference','title','venue','kind'])]};
      const count=await this.ctx.db.legislativeSession.count({where});
      total+=count;
      const rows=await this.slice(count,cursor,(skip,take)=>this.ctx.db.legislativeSession.findMany({where,orderBy:{scheduledAt:'desc'},skip,take}));
      for(const row of rows) hits.push({id:row.id,kind:'SESSION',title:`${row.reference} · ${row.title}`,detail:row.venue,state:row.state});
    }
    if(include('MEETING')) {
      const base=this.meetingWhere(r);
      if(base) {
        const where={AND:[base,needle?{OR:[{reference:{contains:needle}},{title:{contains:needle}},{venue:{contains:needle}},{committee:{name:{contains:needle}}}]}:{}]};
        const count=await this.ctx.db.committeeMeeting.count({where});
        total+=count;
        const rows=await this.slice(count,cursor,(skip,take)=>this.ctx.db.committeeMeeting.findMany({where,include:{committee:{select:{name:true}}},orderBy:{scheduledAt:'desc'},skip,take}));
        for(const row of rows) hits.push({id:row.id,kind:'MEETING',title:`${row.reference} · ${row.title}`,detail:row.committee.name,state:row.state});
      }
    }
    if(include('COMMITTEE')) {
      const base=this.committeeWhere(r);
      if(base) {
        const where={AND:[base,this.text(needle,['code','name'])]};
        const count=await this.ctx.db.committee.count({where});
        total+=count;
        const rows=await this.slice(count,cursor,(skip,take)=>this.ctx.db.committee.findMany({where,orderBy:{name:'asc'},skip,take}));
        for(const row of rows) hits.push({id:row.id,kind:'COMMITTEE',title:row.name,detail:row.code,state:'ACTIVE'});
      }
    }
    if(include('ORDINANCE') && canMunicipality(r.principal,'archive.view')) {
      const where={AND:[this.scope(r),this.text(needle,['title','sourceNote','officialNumber','extractedText'])]};
      const count=await this.ctx.db.historicalOrdinance.count({where});
      total+=count;
      const rows=await this.slice(count,cursor,(skip,take)=>this.ctx.db.historicalOrdinance.findMany({where,orderBy:[{officialYear:'desc'},{title:'asc'}],skip,take,select:{id:true,title:true,sourceNote:true,extractState:true}}));
      for(const row of rows) hits.push({id:row.id,kind:'ORDINANCE',title:row.title,detail:row.sourceNote,state:row.extractState});
    }
    return {items:hits,pageInfo:{page,limit,total}};
  }
  async reports(r:AuthRequest) {
    this.gate(r,'report.view');
    const measureWhere=this.measureWhere(r);
    const meetingWhere=this.meetingWhere(r);
    const [proposed,pending,draft,submitted,ordinance,resolution,sessionsScheduled,sessionsClosed,meetingsScheduled,meetingsClosed,present,absent,excused,votes,documents,register]=await Promise.all([
      measureWhere?this.ctx.db.legislativeMeasure.count({where:{...measureWhere,stage:{in:['DRAFT','SUBMITTED']}}}):0,
      measureWhere?this.ctx.db.legislativeMeasure.count({where:{...measureWhere,referrals:{some:{disposition:'OPEN'}}}}):0,
      measureWhere?this.ctx.db.legislativeMeasure.count({where:{...measureWhere,stage:'DRAFT'}}):0,
      measureWhere?this.ctx.db.legislativeMeasure.count({where:{...measureWhere,stage:'SUBMITTED'}}):0,
      measureWhere?this.ctx.db.legislativeMeasure.count({where:{...measureWhere,typeCode:'ORDINANCE'}}):0,
      measureWhere?this.ctx.db.legislativeMeasure.count({where:{...measureWhere,typeCode:'RESOLUTION'}}):0,
      canMunicipality(r.principal,'session.view')?this.ctx.db.legislativeSession.count({where:{...this.scope(r),state:'SCHEDULED'}}):0,
      canMunicipality(r.principal,'session.view')?this.ctx.db.legislativeSession.count({where:{...this.scope(r),state:'CLOSED'}}):0,
      meetingWhere?this.ctx.db.committeeMeeting.count({where:{...meetingWhere,state:'SCHEDULED'}}):0,
      meetingWhere?this.ctx.db.committeeMeeting.count({where:{...meetingWhere,state:'CLOSED'}}):0,
      canMunicipality(r.principal,'session.view')?this.ctx.db.sessionAttendance.count({where:{...this.scope(r),disposition:'PRESENT'}}):0,
      canMunicipality(r.principal,'session.view')?this.ctx.db.sessionAttendance.count({where:{...this.scope(r),disposition:'ABSENT'}}):0,
      canMunicipality(r.principal,'session.view')?this.ctx.db.sessionAttendance.count({where:{...this.scope(r),disposition:'EXCUSED'}}):0,
      canMunicipality(r.principal,'vote.view')?this.ctx.db.sessionVote.count({where:this.scope(r)}):0,
      (canMunicipality(r.principal,'document.view') || assignedCommitteeIds(r.principal,'document.view').length)?(await this.documents.pageVisible(r,'',0,1)).total:0,
      canMunicipality(r.principal,'archive.view')?this.ctx.db.historicalOrdinance.count({where:this.scope(r)}):0,
    ]);
    const metrics:ReportMetric[]=[
      {key:'measures.proposed',label:'Proposed measures',value:proposed,definition:'Distinct visible measures in DRAFT or SUBMITTED. Same definition as the dashboard Proposed Measures KPI.'},
      {key:'referrals.pendingMeasures',label:'Pending committee',value:pending,definition:'Distinct visible measures with at least one OPEN referral. Same definition as the dashboard Pending Committee KPI. Joint referrals do not double-count the case.'},
      {key:'measures.draft',label:'Draft measures',value:draft,definition:'Distinct visible measures currently in DRAFT.'},
      {key:'measures.submitted',label:'Submitted measures',value:submitted,definition:'Distinct visible measures currently in SUBMITTED. Not a filing or official number.'},
      {key:'measures.ordinance',label:'Ordinance records',value:ordinance,definition:'Distinct visible measures whose typeCode is ORDINANCE. Not enacted legislation.'},
      {key:'measures.resolution',label:'Resolution records',value:resolution,definition:'Distinct visible measures whose typeCode is RESOLUTION.'},
      {key:'sessions.scheduled',label:'Scheduled sessions',value:sessionsScheduled,definition:'Secretariat-recorded sittings in SCHEDULED. Not an official session series.'},
      {key:'sessions.closed',label:'Closed sessions',value:sessionsClosed,definition:'Secretariat-recorded sittings in CLOSED. Closing is not certified minutes.'},
      {key:'meetings.scheduled',label:'Scheduled committee meetings',value:meetingsScheduled,definition:'Committee meetings in SCHEDULED that the caller can already see.'},
      {key:'meetings.closed',label:'Closed committee meetings',value:meetingsClosed,definition:'Committee meetings in CLOSED. Closing is not certified minutes or a report.'},
      {key:'attendance.present',label:'Recorded present rows',value:present,definition:'Session attendance rows marked PRESENT. Not a quorum snapshot or membership roster.'},
      {key:'attendance.absent',label:'Recorded absent rows',value:absent,definition:'Session attendance rows marked ABSENT.'},
      {key:'attendance.excused',label:'Recorded excused rows',value:excused,definition:'Session attendance rows marked EXCUSED.'},
      {key:'votes.recorded',label:'Recorded tallies',value:votes,definition:'Secretary-entered session tallies. Result is always RECORDED and does not pass or fail a measure.'},
      {key:'documents.quarantined',label:'Quarantined documents',value:documents,definition:'Case files the caller can already see. Uploads stay quarantined (D-13). Not the official archive.'},
      {key:'ordinances.register',label:'Historical ordinance rows',value:register,definition:'Rows in the historical ordinance register the caller can view. A typed number is not an official series, and a scan is not a certified copy.'},
    ];
    return {data:{definitionVersion:REPORT_DEFINITION,asOf:new Date().toISOString(),timezone:'Asia/Manila',warnings:[...warnings],metrics}};
  }
}
