import { z } from 'zod';

export const permissions = [
  'municipality.view', 'settings.manage', 'user.view', 'user.manage', 'role.assign', 'grant.approve',
  'term.view', 'term.manage', 'person.view', 'person.manage',
  'committee.view', 'committee.manage', 'committee.members.manage',
  'audit.view', 'system.monitor',
  'measure.view', 'measure.create', 'measure.edit', 'measure.submit', 'measure.file', 'measure.version.create',
  'document.upload', 'document.view', 'document.download',
  'task.assign', 'task.manage', 'notification.view',
] as const;
export type Permission = typeof permissions[number];
export const roles = ['SYS', 'SEC', 'AUD', 'CS', 'LS'] as const;
export type Role = typeof roles[number];
const staffMeasure: readonly Permission[] = ['municipality.view', 'term.view', 'person.view', 'committee.view', 'measure.view', 'measure.create', 'measure.edit', 'measure.submit', 'measure.version.create', 'document.upload', 'document.view', 'document.download', 'task.assign', 'task.manage', 'notification.view'];
export const rolePermissions: Record<Role, readonly Permission[]> = {
  SYS: ['municipality.view', 'settings.manage', 'user.view', 'user.manage', 'role.assign', 'grant.approve', 'term.view', 'person.view', 'system.monitor'],
  SEC: ['municipality.view', 'settings.manage', 'term.view', 'term.manage', 'person.view', 'person.manage', 'committee.view', 'committee.manage', 'committee.members.manage', 'audit.view', 'measure.view', 'measure.create', 'measure.edit', 'measure.submit', 'measure.file', 'measure.version.create', 'document.upload', 'document.view', 'document.download', 'task.assign', 'task.manage', 'notification.view'],
  AUD: ['municipality.view', 'term.view', 'person.view', 'committee.view', 'audit.view', 'measure.view', 'document.view'],
  CS: ['municipality.view', 'term.view', 'committee.view'],
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
export const personSchema = z.object({ displayName: text(160), reason: reasonSchema }).strict();
export const committeeSchema = z.object({ termId: idSchema, code: z.string().regex(/^[A-Z][A-Z0-9_-]{1,29}$/), name: text(160), reason: reasonSchema }).strict();
export const memberSchema = z.object({ personId: idSchema, role: z.enum(['CHAIR', 'VICE_CHAIR', 'MEMBER', 'STAFF']), startsOn: date, endsOn: date, expectedRevision: revisionSchema, reason: reasonSchema }).strict().refine(v => v.endsOn >= v.startsOn, {message:'End date must follow start date', path:['endsOn']});
export const userSchema = z.object({ subject: text(255), displayName: text(160), reason: reasonSchema }).strict();
export const userStateSchema = z.object({ enabled: z.boolean(), expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const grantSchema = z.object({ userId: idSchema, role: z.enum(roles), scopeType: z.enum(['MUNICIPALITY', 'COMMITTEE']), scopeId: idSchema, validFrom: instant, validUntil: instant, reason: reasonSchema }).strict().refine(v => new Date(v.validUntil) > new Date(v.validFrom), {message:'Grant expiry must follow its start',path:['validUntil']}).refine(v => v.scopeType === 'MUNICIPALITY' || v.role === 'CS', {message:'Only committee staff grants may have committee scope',path:['scopeType']}).refine(v => v.role !== 'CS' || v.scopeType === 'COMMITTEE', {message:'Committee staff require a specific committee',path:['scopeType']});
export const reviewSchema = z.object({ expectedRevision: revisionSchema, reason: reasonSchema }).strict();
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }).strict();
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
  ownerType: z.literal('MEASURE'),
  ownerId: idSchema,
  originalFilename: text(200),
  declaredMime: z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/tiff']),
  expectedBytes: z.number().int().positive().max(25 * 1024 * 1024),
  reason: reasonSchema,
}).strict();
export const taskCompleteSchema = z.object({ expectedRevision: revisionSchema, reason: reasonSchema }).strict();

export interface SessionView { user: { id: string; displayName: string; municipalityId: string }; permissions: Permission[]; csrfToken: string; }
export interface Page<T> { items: T[]; pageInfo: {page: number; limit: number; total: number}; }
export interface Municipality { id: string; name: string; province: string; code: string; timezone: string; revision: number; }
export interface Term {id: string; label: string; startsOn: string; endsOn: string; revision: number;}
export interface Person {id: string; displayName: string;}
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
export interface MeasureStats {proposed:number;}
export interface TimelineEvent {id:string; sequence:number; fromStage:string|null; toStage:string; reason:string; actorId:string; recordedAt:string;}
export interface UploadIntent {id:string; status:string; originalFilename:string; expiresAt:string;}
export interface DocumentRecord {id:string; title:string; classification:string; currentReadyVersionId:string|null; latestState:string;}
export interface WorkTask {id:string; ownerType:string; ownerId:string; title:string; state:string; assigneeId:string|null; revision:number;}
export interface NoticeItem {id:string; summary:string; readAt:string|null; createdAt:string;}
export interface Problem {status:number; code:string; detail:string; correlationId:string; errors?:unknown;}
