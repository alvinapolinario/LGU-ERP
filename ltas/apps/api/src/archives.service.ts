import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { HISTORICAL_SCAN_MAX_BYTES, historicalOrdinanceQuerySchema, historicalOrdinanceSchema, historicalOrdinanceTextSchema, historicalOrdinanceUpdateSchema, idSchema, reasonSchema, type HistoricalOrdinance, type HistoricalOrdinanceDetail } from '@ltas/contracts';
import { scanBytes } from './domain/scanner.js';
import { CONTEXT, type AppContext } from './context.js';
import { Commands } from './commands.js';
import { requirePermission } from './access.js';
import { fail, type AuthRequest } from './http.js';
import { detectMime } from './domain/mime.js';
import { classifyExtracted, extractOrdinanceText } from './domain/extract-text.js';

function snippet(text:string|null, needle:string):string|null {
  if (!text || !needle) return null;
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return null;
  const start = Math.max(0, at - 48);
  const end = Math.min(text.length, at + needle.length + 48);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
function view(row:{id:string;termId:string;title:string;officialYear:number|null;officialNumber:string|null;sourceNote:string;scanSha256:string|null;extractState:string;revision:number;term:{label:string}}, needle:string, text?:string|null):HistoricalOrdinance {
  const extractState = row.extractState === 'EXTRACTED' || row.extractState === 'UNREADABLE' ? row.extractState : 'NONE';
  return {
    id:row.id, termId:row.termId, termLabel:row.term.label, title:row.title,
    officialYear:row.officialYear, officialNumber:row.officialNumber, sourceNote:row.sourceNote,
    hasScan:Boolean(row.scanSha256), extractState, revision:row.revision,
    ...(needle ? {snippet:snippet(text ?? null, needle)} : {}),
  };
}

@Injectable()
export class ArchivesService {
  constructor(@Inject(CONTEXT) private readonly ctx:AppContext, @Inject(Commands) private readonly commands:Commands) {}
  private scope(r:AuthRequest) {return {municipalityId:r.principal.municipalityId};}
  async list(r:AuthRequest, q:unknown) {
    requirePermission(r.principal, 'archive.view', this.scope(r));
    const {page, limit, q:raw, termId} = historicalOrdinanceQuerySchema.parse(q);
    const needle = raw.trim();
    const where = {
      ...this.scope(r),
      ...(termId ? {termId} : {}),
      ...(needle ? {OR:[
        {title:{contains:needle}},
        {officialNumber:{contains:needle}},
        {sourceNote:{contains:needle}},
        {extractedText:{contains:needle}},
      ]} : {}),
    };
    const [rows, total] = await this.ctx.db.$transaction([
      this.ctx.db.historicalOrdinance.findMany({where, skip:(page - 1) * limit, take:limit, orderBy:[{officialYear:'desc'}, {title:'asc'}, {id:'asc'}], select:{id:true, termId:true, title:true, officialYear:true, officialNumber:true, sourceNote:true, scanSha256:true, extractState:true, revision:true, extractedText:true, term:{select:{label:true}}}}),
      this.ctx.db.historicalOrdinance.count({where}),
    ]);
    return {items:rows.map(row => view(row, needle, row.extractedText)), pageInfo:{page, limit, total}, note:'Historical ordinance register. A typed number is not an official series, and recognized scan text is not a certified copy.'};
  }
  async get(r:AuthRequest, rawId:string) {
    requirePermission(r.principal, 'archive.view', this.scope(r));
    const id = idSchema.parse(rawId);
    const row = await this.ctx.db.historicalOrdinance.findFirst({where:{id, ...this.scope(r)}, include:{term:{select:{label:true}}}});
    if (!row) fail(404, 'NOT_FOUND', 'Ordinance record not found.');
    const data:HistoricalOrdinanceDetail = {...view(row, ''), extractedText:row.extractedText, extractNote:row.extractNote, scanMime:row.scanMime};
    return {data};
  }
  async create(r:AuthRequest, body:unknown) {
    const input = historicalOrdinanceSchema.parse(body);
    return {data:await this.commands.execute(r, 'archive.encode', 'ordinance.encoded', input, async tx => {
      const term = await tx.councilTerm.findFirst({where:{id:input.termId, ...this.scope(r)}});
      if (!term) fail(404, 'NOT_FOUND', 'Council term not found.');
      const result = await tx.historicalOrdinance.create({data:{
        id:randomUUID(), municipalityId:r.principal.municipalityId, termId:input.termId, title:input.title,
        officialYear:input.officialYear ?? null, officialNumber:input.officialNumber ?? null, sourceNote:input.sourceNote,
      }, include:{term:{select:{label:true}}}});
      return {entityId:result.id, result:view(result, ''), changes:{termId:input.termId, title:input.title, officialYear:input.officialYear ?? null, officialNumber:input.officialNumber ?? null, sourceNote:input.sourceNote, reason:input.reason}};
    })};
  }
  async update(r:AuthRequest, rawId:string, body:unknown) {
    const id = idSchema.parse(rawId);
    const input = historicalOrdinanceUpdateSchema.parse(body);
    return {data:await this.commands.execute(r, 'archive.encode', 'ordinance.updated', {id, ...input}, async tx => {
      const old = await tx.historicalOrdinance.findFirst({where:{id, ...this.scope(r)}});
      if (!old) fail(404, 'NOT_FOUND', 'Ordinance record not found.');
      if (old.revision !== input.expectedRevision) fail(409, 'STALE_REVISION', 'Reload this ordinance before editing.');
      const result = await tx.historicalOrdinance.update({where:{id}, data:{title:input.title, officialYear:input.officialYear ?? null, officialNumber:input.officialNumber ?? null, sourceNote:input.sourceNote, revision:{increment:1}}, include:{term:{select:{label:true}}}});
      return {entityId:id, result:view(result, ''), changes:{title:input.title, officialYear:input.officialYear ?? null, officialNumber:input.officialNumber ?? null, sourceNote:input.sourceNote, reason:input.reason}};
    })};
  }
  async saveText(r:AuthRequest, rawId:string, body:unknown) {
    const id = idSchema.parse(rawId);
    const input = historicalOrdinanceTextSchema.parse(body);
    const cleaned = input.extractedText.replace(/\s+/g, ' ').trim();
    const reading = cleaned ? classifyExtracted(cleaned, 'image/jpeg') : {extractState:'UNREADABLE' as const, extractedText:null, extractNote:'No ordinance text is saved for keyword search.'};
    const extractNote = reading.extractState === 'EXTRACTED' ? 'Staff saved this text from the page image. It is not a certified copy.' : reading.extractNote;
    return {data:await this.commands.execute(r, 'archive.encode', 'ordinance.text-saved', {id, textLength:cleaned.length, expectedRevision:input.expectedRevision, reason:input.reason}, async tx => {
      const old = await tx.historicalOrdinance.findFirst({where:{id, ...this.scope(r)}});
      if (!old) fail(404, 'NOT_FOUND', 'Ordinance record not found.');
      if (old.revision !== input.expectedRevision) fail(409, 'STALE_REVISION', 'Reload this ordinance before editing the text.');
      const result = await tx.historicalOrdinance.update({where:{id}, data:{extractedText:reading.extractedText, extractState:reading.extractState, extractNote, revision:{increment:1}}, include:{term:{select:{label:true}}}});
      return {entityId:id, result:{...view(result, ''), extractedText:result.extractedText, extractNote:result.extractNote, scanMime:result.scanMime}, changes:{textLength:cleaned.length, extractState:reading.extractState, reason:input.reason}};
    })};
  }
  async setScan(r:AuthRequest, rawId:string, body:Buffer) {
    requirePermission(r.principal, 'archive.encode', this.scope(r));
    const id = idSchema.parse(rawId);
    const reason = reasonSchema.parse(r.get('x-audit-reason'));
    if (!Buffer.isBuffer(body) || body.length === 0) fail(422, 'FILE_REQUIRED', 'Attach a JPEG, PNG, or PDF scan.');
    if (body.length > HISTORICAL_SCAN_MAX_BYTES) fail(422, 'FILE_TOO_LARGE', 'Each scan must be 12 MiB or smaller.');
    const expectedRevision = Number(r.get('x-expected-revision'));
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) fail(400, 'REVISION_REQUIRED', 'Send the ordinance revision with the scan.');
    const existing = await this.ctx.db.historicalOrdinance.findFirst({where:{id, ...this.scope(r)}, select:{id:true, revision:true}});
    if (!existing) fail(404, 'NOT_FOUND', 'Ordinance record not found.');
    if (existing.revision !== expectedRevision) fail(409, 'STALE_REVISION', 'Reload this ordinance before replacing the scan.');
    const mime = detectMime(body, 'application/pdf');
    if (mime !== 'application/pdf' && mime !== 'image/jpeg' && mime !== 'image/png') fail(422, 'UNSUPPORTED_TYPE', 'Use a JPEG, PNG, or PDF scan.');
    const reading = await extractOrdinanceText(body, mime);
    const sha256 = createHash('sha256').update(body).digest('hex');
    const verdict = scanBytes(body);
    const filename = (r.get('x-original-filename') ?? 'scan').replace(/[/\\]/g, '_').slice(0, 200);
    return {data:await this.commands.execute(r, 'archive.encode', 'ordinance.scan-stored', {id, mime, sha256, bytes:body.length, extractState:reading.extractState, scanVerdict:verdict, expectedRevision, reason}, async tx => {
      const current = await tx.historicalOrdinance.findFirst({where:{id, ...this.scope(r)}});
      if (!current) fail(404, 'NOT_FOUND', 'Ordinance record not found.');
      if (current.revision !== expectedRevision) fail(409, 'STALE_REVISION', 'Reload this ordinance before replacing the scan.');
      const result = await tx.historicalOrdinance.update({where:{id}, data:{scanMime:mime, scanSha256:sha256, scanFilename:filename, scanBytes:Uint8Array.from(body), extractedText:reading.extractedText, extractState:reading.extractState, extractNote:reading.extractNote, revision:{increment:1}}, include:{term:{select:{label:true}}}});
      return {entityId:id, result:{...view(result, ''), extractNote:reading.extractNote}, changes:{scanSha256:sha256, mime, bytes:body.length, extractState:reading.extractState, extractNote:reading.extractNote, scanVerdict:verdict, storage:'The page image stays on the ordinance row. No approved scanner has marked it clean (D-13).', reason}};
    })};
  }
  async scan(r:AuthRequest, rawId:string) {
    requirePermission(r.principal, 'archive.view', this.scope(r));
    const id = idSchema.parse(rawId);
    const row = await this.ctx.db.historicalOrdinance.findFirst({where:{id, ...this.scope(r)}, select:{scanBytes:true, scanMime:true, scanFilename:true}});
    if (!row?.scanBytes || !row.scanMime) fail(404, 'NOT_FOUND', 'No scan is on file for this ordinance.');
    return new StreamableFile(Buffer.from(row.scanBytes), {type:row.scanMime, disposition:`inline; filename="${row.scanFilename ?? 'scan'}"`});
  }
}
