import { z } from 'zod';

export const permissions = [
  'municipality.view', 'settings.manage', 'user.view', 'user.manage', 'role.assign', 'grant.approve',
  'term.view', 'term.manage', 'person.view', 'person.manage',
  'committee.view', 'committee.manage', 'committee.members.manage',
  'committee.referral.view', 'committee.referral.create', 'committee.referral.close',
  'committee.meeting.view', 'committee.meeting.manage', 'committee.meeting.close',
  'session.view', 'session.manage', 'session.close',
  'attendance.record', 'vote.view', 'vote.record',
  'audit.view', 'system.monitor',
  'measure.view', 'measure.create', 'measure.edit', 'measure.submit', 'measure.file', 'measure.version.create',
  'document.upload', 'document.view', 'document.download',
  'library.view', 'report.view',
  'archive.view', 'archive.encode',
  'task.assign', 'task.manage', 'notification.view',
] as const;
export type Permission = typeof permissions[number];
export const roles = ['SYS', 'SEC', 'AUD', 'CS', 'LS'] as const;
export type Role = typeof roles[number];
const staffMeasure: readonly Permission[] = ['municipality.view', 'term.view', 'person.view', 'committee.view', 'committee.referral.view', 'committee.meeting.view', 'session.view', 'attendance.record', 'vote.view', 'measure.view', 'measure.create', 'measure.edit', 'measure.submit', 'measure.version.create', 'document.upload', 'document.view', 'document.download', 'library.view', 'report.view', 'archive.view', 'task.assign', 'task.manage', 'notification.view'];
const committeeStaff: readonly Permission[] = ['municipality.view', 'term.view', 'committee.view', 'committee.referral.view', 'committee.meeting.view', 'committee.meeting.manage', 'committee.meeting.close', 'measure.view', 'document.upload', 'document.view', 'document.download', 'library.view', 'report.view', 'task.assign', 'task.manage', 'notification.view'];
export const rolePermissions: Record<Role, readonly Permission[]> = {
  SYS: ['municipality.view', 'settings.manage', 'user.view', 'user.manage', 'role.assign', 'grant.approve', 'term.view', 'person.view', 'system.monitor'],
  SEC: ['municipality.view', 'settings.manage', 'term.view', 'term.manage', 'person.view', 'person.manage', 'committee.view', 'committee.manage', 'committee.members.manage', 'committee.referral.view', 'committee.referral.create', 'committee.referral.close', 'committee.meeting.view', 'committee.meeting.manage', 'committee.meeting.close', 'session.view', 'session.manage', 'session.close', 'attendance.record', 'vote.view', 'vote.record', 'audit.view', 'measure.view', 'measure.create', 'measure.edit', 'measure.submit', 'measure.file', 'measure.version.create', 'document.upload', 'document.view', 'document.download', 'library.view', 'report.view', 'archive.view', 'archive.encode', 'task.assign', 'task.manage', 'notification.view'],
  AUD: ['municipality.view', 'term.view', 'person.view', 'committee.view', 'committee.referral.view', 'committee.meeting.view', 'session.view', 'vote.view', 'audit.view', 'measure.view', 'document.view', 'library.view', 'report.view', 'archive.view'],
  CS: committeeStaff,
  LS: staffMeasure,
};
export const idSchema = z.uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
export const reasonSchema = z.string().trim().min(8).max(500);
const date = z.iso.date();
const instant = z.iso.datetime({ offset: true });
export const revisionSchema = z.number().int().positive();
export const municipalitySchema = z.object({ name: text(160), province: text(100), expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const termSchema = z.object({ label: text(80), startsOn: date, endsOn: date, reason: reasonSchema }).strict().refine(v => v.endsOn >= v.startsOn, {message:'End date must follow start date', path:['endsOn']});
export const termUpdateSchema = z.object({ label: text(80), startsOn: date, endsOn: date, expectedRevision: revisionSchema, reason: reasonSchema }).strict().refine(v => v.endsOn >= v.startsOn, {message:'End date must follow start date', path:['endsOn']});
export const personPositions = ['MAYOR', 'VICE_MAYOR', 'COUNCILOR', 'LIGA_PRESIDENT', 'SK_PRESIDENT', 'SB_SECRETARY', 'SB_STAFF', 'OTHER'] as const;
export type PersonPosition = typeof personPositions[number];
export const personPositionLabels: Record<PersonPosition, string> = {
  MAYOR: 'Mayor',
  VICE_MAYOR: 'Vice Mayor',
  COUNCILOR: 'Councilor',
  LIGA_PRESIDENT: 'Liga ng mga Barangay President',
  SK_PRESIDENT: 'SK Federation President',
  SB_SECRETARY: 'SB Secretary',
  SB_STAFF: 'SB Staff',
  OTHER: 'Other',
};
export function personPositionLabel(code:string) {
  return personPositionLabels[code as PersonPosition] ?? personPositionLabels.OTHER;
}
export function personPositionRank(code:string) {
  const index = personPositions.indexOf(code as PersonPosition);
  return index === -1 ? personPositions.length : index;
}
export function comparePeopleByPosition(left:{positionCode:string; displayName:string; id?:string}, right:{positionCode:string; displayName:string; id?:string}) {
  const rank = personPositionRank(left.positionCode) - personPositionRank(right.positionCode);
  if (rank !== 0) return rank;
  const name = left.displayName.localeCompare(right.displayName, 'en');
  if (name !== 0) return name;
  return (left.id ?? '').localeCompare(right.id ?? '');
}
export const personSchema = z.object({ displayName: text(160), positionCode: z.enum(personPositions), termId: idSchema, reason: reasonSchema }).strict();
export const personUpdateSchema = z.object({ displayName: text(160), positionCode: z.enum(personPositions), expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const personListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), termId: idSchema.optional() }).strict();
export const personPhotoSchema = z.object({ reason: reasonSchema }).strict();
export const PERSON_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const committeeSchema = z.object({ termId: idSchema, code: z.string().regex(/^[A-Z][A-Z0-9_-]{1,29}$/), name: text(160), reason: reasonSchema }).strict();
export const memberSchema = z.object({ personId: idSchema, role: z.enum(['CHAIR', 'VICE_CHAIR', 'MEMBER', 'STAFF']), startsOn: date, endsOn: date, expectedRevision: revisionSchema, reason: reasonSchema }).strict().refine(v => v.endsOn >= v.startsOn, {message:'End date must follow start date', path:['endsOn']});
export const userSchema = z.object({ subject: text(255), displayName: text(160), reason: reasonSchema }).strict();
export const userStateSchema = z.object({ enabled: z.boolean(), expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const grantSchema = z.object({ userId: idSchema, role: z.enum(roles), scopeType: z.enum(['MUNICIPALITY', 'COMMITTEE']), scopeId: idSchema, validFrom: instant, validUntil: instant, acting: z.boolean().optional(), reason: reasonSchema }).strict().refine(v => new Date(v.validUntil) > new Date(v.validFrom), {message:'Grant expiry must follow its start',path:['validUntil']}).refine(v => !v.acting || new Date(v.validUntil).getTime() - new Date(v.validFrom).getTime() <= 24 * 60 * 60 * 1000, {message:'An acting or emergency grant cannot last longer than 24 hours',path:['validUntil']}).refine(v => v.scopeType === 'MUNICIPALITY' || v.role === 'CS', {message:'Only committee staff grants may have committee scope',path:['scopeType']}).refine(v => v.role !== 'CS' || v.scopeType === 'COMMITTEE', {message:'Committee staff require a specific committee',path:['scopeType']});
export const reviewSchema = z.object({ expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }).strict();
export const taskQuerySchema = paginationSchema.extend({ ownerId: idSchema.optional(), measureId: idSchema.optional() }).strict();
export const calendarQuerySchema = paginationSchema.extend({ from: z.iso.datetime().optional(), to: z.iso.datetime().optional() }).strict();
export const publicCouncilQuerySchema = z.object({ termId: idSchema.optional() }).strict();
export const publicMeasureQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional().default(''),
  typeCode: z.enum(['ORDINANCE', 'RESOLUTION']).optional(),
}).strict();
export const PUBLIC_CATALOG_NOTE = 'Demonstration public catalog of records already stored in this LTAS installation. Not an official publication, approved release, or Phase 9 portal.';
export const contributionRole = z.enum(['AUTHOR', 'CO_AUTHOR', 'SPONSOR']);
export const measureCreateSchema = z.object({
  typeCode: z.enum(['ORDINANCE', 'RESOLUTION']),
  termId: idSchema,
  title: text(240),
  subject: text(500),
  authors: z.array(z.object({ personId: idSchema, role: contributionRole, ordering: z.number().int().min(0).max(99) }).strict()).min(1).max(30),
  synopsis: text(8000),
  reason: reasonSchema,
}).strict();
export const measureEditSchema = z.object({ title: text(240), subject: text(500), expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const measureVersionSchema = z.object({ synopsis: text(8000), expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const documentIntentSchema = z.object({
  ownerType: z.enum(['MEASURE', 'COMMITTEE', 'MEETING', 'SESSION']),
  ownerId: idSchema,
  originalFilename: text(200),
  declaredMime: z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/tiff']),
  expectedBytes: z.number().int().positive().max(25 * 1024 * 1024),
  reason: reasonSchema,
}).strict();
export const taskCompleteSchema = z.object({ expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const referralRole = z.enum(['LEAD', 'JOINT']);
export const referralCreateSchema = z.object({
  leadCommitteeId: idSchema,
  jointCommitteeIds: z.array(idSchema).max(10).default([]),
  referredOn: date,
  dueOn: date.optional(),
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict().refine(v => !v.jointCommitteeIds.includes(v.leadCommitteeId), {message:'The lead committee cannot also be listed as joint', path:['jointCommitteeIds']}).refine(v => new Set(v.jointCommitteeIds).size === v.jointCommitteeIds.length, {message:'Joint committees must be unique', path:['jointCommitteeIds']}).refine(v => !v.dueOn || v.dueOn >= v.referredOn, {message:'Due date must follow the referral date', path:['dueOn']});
export const referralCloseSchema = z.object({ expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const meetingCreateSchema = z.object({
  title: text(240),
  venue: text(160),
  scheduledAt: instant,
  referralIds: z.array(idSchema).max(20).default([]),
  reason: reasonSchema,
}).strict();
export const meetingEditSchema = z.object({
  title: text(240),
  venue: text(160),
  scheduledAt: instant,
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const meetingAgendaSchema = z.object({
  referralId: idSchema,
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const sessionCreateSchema = z.object({
  termId: idSchema,
  title: text(240),
  venue: text(160),
  kind: z.enum(['REGULAR', 'SPECIAL']),
  scheduledAt: instant,
  measureIds: z.array(idSchema).max(30).default([]),
  reason: reasonSchema,
}).strict();
export const sessionEditSchema = z.object({
  title: text(240),
  venue: text(160),
  kind: z.enum(['REGULAR', 'SPECIAL']),
  scheduledAt: instant,
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const sessionAgendaSchema = z.object({
  measureId: idSchema,
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const attendanceSchema = z.object({
  personId: idSchema,
  disposition: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const sessionVoteSchema = z.object({
  measureId: idSchema,
  yesCount: z.number().int().min(0).max(200),
  noCount: z.number().int().min(0).max(200),
  abstainCount: z.number().int().min(0).max(200),
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const HISTORICAL_SCAN_MAX_BYTES = 12 * 1024 * 1024;
const optionalYear = z.number().int().min(1900).max(2100).nullable().optional();
const optionalNumber = z.string().trim().min(1).max(40).nullable().optional();
export const historicalOrdinanceSchema = z.object({
  termId: idSchema,
  title: text(240),
  officialYear: optionalYear,
  officialNumber: optionalNumber,
  sourceNote: text(500),
  reason: reasonSchema,
}).strict();
export const historicalOrdinanceUpdateSchema = z.object({
  title: text(240),
  officialYear: optionalYear,
  officialNumber: optionalNumber,
  sourceNote: text(500),
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const historicalOrdinanceTextSchema = z.object({
  extractedText: z.string().max(200_000),
  expectedRevision: revisionSchema,
  reason: reasonSchema,
}).strict();
export const historicalOrdinanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).default(''),
  termId: idSchema.optional(),
}).strict();
export interface HistoricalOrdinance {
  id:string; termId:string; termLabel:string; title:string;
  officialYear:number|null; officialNumber:string|null; sourceNote:string;
  hasScan:boolean; extractState:'NONE'|'EXTRACTED'|'UNREADABLE'; revision:number;
  snippet?:string|null;
}
export interface HistoricalOrdinanceDetail extends HistoricalOrdinance {
  extractedText:string|null; extractNote:string|null; scanMime:string|null;
}
export const libraryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional().default(''),
  kind: z.enum(['MEASURE', 'DOCUMENT', 'SESSION', 'MEETING', 'COMMITTEE', 'ORDINANCE']).optional(),
}).strict();
export const REPORT_DEFINITION = 'P-REPORT-INTERIM-1';
export interface CommitteeMeeting {
  id:string; committeeId:string; reference:string; title:string; venue:string;
  scheduledAt:string; state:string; revision:number;
  agenda?:MeetingAgendaItem[];
}
export interface MeetingAgendaItem {
  id:string; sequence:number; referralId:string; measureVersionId:string;
  referral?:Referral;
}
export interface LegislativeSession {
  id:string; termId:string; reference:string; title:string; venue:string; kind:string;
  scheduledAt:string; state:string; revision:number;
  agenda?:SessionAgendaItem[];
  attendance?:SessionAttendanceRow[];
  votes?:SessionVoteRow[];
}
export interface SessionAgendaItem {
  id:string; sequence:number; measureId:string; measureVersionId:string;
  measure?:{id:string; title:string; typeCode:string; stage:string};
}
export interface SessionAttendanceRow {
  id:string; personId:string; disposition:string; person?:Person;
}
export interface SessionVoteRow {
  id:string; measureId:string; measureVersionId:string; yesCount:number; noCount:number; abstainCount:number; result:string;
  measure?:{id:string; title:string; typeCode:string; stage:string};
}
export interface CalendarEvent {
  id:string; kind:string; reference:string; title:string; venue:string; scheduledAt:string; state:string; ownerLabel:string;
}
export interface LibraryHit {
  id:string; kind:string; title:string; detail:string; state:string;
}
export interface ReportMetric {
  key:string; label:string; value:number; definition:string;
}
export interface ReportSnapshot {
  definitionVersion:string; asOf:string; timezone:string; warnings:string[]; metrics:ReportMetric[];
}

export interface SessionView { user: { id: string; displayName: string; municipalityId: string }; permissions: Permission[]; csrfToken: string; }
export interface Page<T> { items: T[]; pageInfo: {page: number; limit: number; total: number}; }
export interface Municipality { id: string; name: string; province: string; code: string; timezone: string; revision: number; }
export interface Term {id: string; label: string; startsOn: string; endsOn: string; revision: number; peopleCount?: number;}
export interface Person {id: string; displayName: string; positionCode: string; hasPhoto: boolean; photoVersion?:string|null; termId?: string; termLabel?: string; revision?: number;}
export interface PersonLegislativeSeat {
  termId:string; termLabel:string; startsOn:string; endsOn:string; positionCode:string;
  authored:number; coAuthored:number;
  committees:Array<{name:string; role:string; active:boolean}>;
}
export interface PersonLegislativeProfile {
  id:string; displayName:string; positionCode:string; hasPhoto:boolean; photoVersion?:string|null;
  termsListed:number; authored:number; coAuthored:number;
  seats:PersonLegislativeSeat[];
  note:string;
}
export interface Committee {id:string; code:string; name:string; termId:string; revision:number; term?:Term; members?:CommitteeMember[];}
export interface CommitteeMember {id:string; personId:string; role:string; startsOn:string; endsOn:string; person?:Person;}
export interface User {id:string; displayName:string; subject:string; enabled:boolean; revision:number;}
export interface GrantRequest {id:string; userId:string; role:Role; scopeType:string; scopeId:string; validFrom:string; validUntil:string; requestedBy:string; state:string; revision:number; reason:string;}
export interface Grant {id:string; userId:string; role:Role; scopeType:string; scopeId:string; validFrom:string; validUntil:string; revokedAt:string|null; revision:number;}
export interface AuditEvent {id:string; sequence:string; actorId:string; actorName:string; action:string; entityId:string; recordedAt:string; hash:string; previousHash:string; payload:unknown;}
export interface MeasureAuthor {personId:string; role:string; ordering:number; displayName:string;}
export interface MeasureVersion {id:string; sequence:number; synopsis:string; frozenAt:string|null;}
export interface Measure {
  id:string; typeCode:string; termId:string; title:string; subject:string; stage:string; classification:string;
  officialSeries:string|null; officialYear:number|null; officialNumber:number|null;
  currentVersionId:string|null; revision:number; authors?:MeasureAuthor[]; currentVersion?:MeasureVersion|null;
}
export interface MeasureStats {proposed:number; pendingCommittee:number;}
export interface Referral {
  id:string; measureId:string; measureVersionId:string; committeeId:string; groupId:string;
  referralSequence:number; role:string; sourceKind:string; referredOn:string; dueOn:string|null;
  disposition:string; revision:number;
  committee?:{id:string; code:string; name:string};
  measure?:{id:string; title:string; typeCode:string; stage:string};
}
export interface TimelineEvent {id:string; sequence:number; fromStage:string|null; toStage:string; reason:string; actorId:string; recordedAt:string;}
export interface UploadIntent {id:string; status:string; originalFilename:string; expiresAt:string;}
export interface DocumentRecord {id:string; title:string; classification:string; currentReadyVersionId:string|null; latestState:string; ownerType?:string; ownerId?:string;}
export interface WorkTask {id:string; ownerType:string; ownerId:string; measureId?:string|null; title:string; state:string; assigneeId:string|null; revision:number;}
export interface NoticeItem {id:string; summary:string; readAt:string|null; createdAt:string;}
export interface Problem {status:number; code:string; detail:string; correlationId:string; errors?:unknown;}
export interface PublicMunicipality {name:string; province:string; code:string;}
export interface PublicTerm {id?:string; label:string; startsOn:string; endsOn:string;}
export interface PublicPerson {
  id:string; displayName:string; positionCode:string; hasPhoto:boolean; photoVersion?:string|null;
  assignments?:Array<{committeeName:string; role:string}>;
}
export interface PublicMeasure {
  id:string; typeCode:string; title:string;
  officialSeries:string|null; officialYear:number|null; officialNumber:number|null;
  createdAt:string;
}
export interface PublicHome {
  municipality:PublicMunicipality;
  term:PublicTerm|null;
  stats:{measures:number; people:number; committees:number};
  recentMeasures:PublicMeasure[];
  officers:{mayor:PublicPerson|null; viceMayor:PublicPerson|null; secretary:PublicPerson|null};
  note:string;
}
export interface PublicCouncilSeat {
  termId:string; termLabel:string; startsOn:string; endsOn:string; positionCode:string;
  authored:number; coAuthored:number;
  committees:Array<{name:string; role:string}>;
}
export interface PublicPersonProfile {
  id:string; displayName:string; positionCode:string; hasPhoto:boolean; photoVersion?:string|null;
  termsListed:number; authored:number; coAuthored:number;
  seats:PublicCouncilSeat[];
  note:string;
}
export interface PublicCouncil {
  municipality:PublicMunicipality;
  terms:Array<PublicTerm & {id:string}>;
  term:(PublicTerm & {id:string})|null;
  mayor:PublicPerson|null;
  presiding:PublicPerson|null;
  members:PublicPerson[];
  liga:PublicPerson|null;
  sk:PublicPerson|null;
  secretary:PublicPerson|null;
  staff:PublicPerson[];
  other:PublicPerson[];
  committees:Array<{id:string; code:string; name:string; members:Array<{role:string; person:PublicPerson}>}>;
  note:string;
}
