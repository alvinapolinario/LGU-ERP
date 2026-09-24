import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Award, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Eye, EyeOff, FileText, Flag, FolderOpen, Home,
  Hourglass, Landmark, Lock, LogIn, LogOut, Maximize2, Minimize2, Plus, Search, Settings, ShieldCheck, Sparkles, User as UserIcon, Users, Vote, X,
} from 'lucide-react';
import type { AuditEvent, CalendarEvent, Committee, CommitteeMeeting, DocumentRecord, Grant, GrantRequest, HistoricalOrdinance, HistoricalOrdinanceDetail, LegislativeSession, LibraryHit, Measure, MeasureStats, Municipality, NoticeItem, Page, Permission, Person, PersonLegislativeProfile, Referral, ReportSnapshot, SessionView, Term, TimelineEvent, User, WorkTask } from '@ltas/contracts';
import { HISTORICAL_SCAN_MAX_BYTES, PERSON_PHOTO_MAX_BYTES, personPositionLabel, personPositions } from '@ltas/contracts';
import { ApiError, downloadDocument, request, uploadBytes } from './api';
import { isPublicPath, PublicPortal, usePublicPath } from './portal';

type View = 'overview' | 'measures' | 'people' | 'committees' | 'sessions' | 'calendar' | 'voting' | 'documents' | 'archive' | 'library' | 'reports' | 'users' | 'settings';
type SettingsTab = 'municipality' | 'terms' | 'people' | 'audit';
type UsersTab = 'accounts' | 'access';
const accents = ['#1d6fd8', '#1f8a4c', '#c47a12', '#6d4ad6', '#c4477a', '#0e7c8b'];
const pipelineKpis = [
  {tone:'blue', icon:FileText, label:'Proposed Measures', hint:'Later phase'},
  {tone:'green', icon:CheckCircle2, label:'Enacted Measures', hint:'Later phase'},
  {tone:'amber', icon:Clock, label:'Pending Committee', hint:'Later phase'},
  {tone:'orange', icon:Hourglass, label:'For Second Reading', hint:'Later phase'},
  {tone:'pink', icon:Flag, label:'Awaiting Mayor Action', hint:'Later phase'},
] as const;
const shortDate = (v:string) => new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'Asia/Manila'}).format(new Date(v));
const dateOnly = (v?:string) => v?.slice(0, 10);
const longDate = (v:string) => new Intl.DateTimeFormat('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric', timeZone:'Asia/Manila'}).format(new Date(v));
function greeting(name:string) {
  const hour = Number(new Intl.DateTimeFormat('en-PH', {hour:'numeric', hourCycle:'h23', timeZone:'Asia/Manila'}).format(new Date()));
  const when = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${when}, ${name.split(' ')[0]}!`;
}
function roleCaption(permissions:Permission[]) {
  if (permissions.includes('role.assign')) return 'System Administrator';
  if (permissions.includes('measure.file')) return 'SB Secretary';
  if (permissions.includes('measure.create')) return 'Legislative Staff';
  if (permissions.includes('committee.manage') && permissions.includes('audit.view')) return 'SB Secretary';
  if (permissions.includes('audit.view')) return 'Auditor';
  if (permissions.includes('committee.view')) return 'Committee Staff';
  return 'Municipal officer';
}
function initials(name:string) {return name.split(' ').map(part => part[0]).slice(0, 2).join('');}
function canAny(permissions:Permission[], needed:Permission[]) {return needed.some(item => permissions.includes(item));}
const positionOptions = personPositions.map(value => ({value, label:personPositionLabel(value)}));
function personOption(person:Person) {return {value:person.id, label:`${person.displayName} · ${personPositionLabel(person.positionCode)}${person.termLabel ? ` · ${person.termLabel}` : ''}`};}
function currentTerm(items:Term[] | undefined) {
  if (!items?.length) return undefined;
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila'}).format(new Date());
  return items.find(item => item.startsOn.slice(0, 10) <= today && item.endsOn.slice(0, 10) >= today) ?? items[0];
}
function termStanding(term?:{startsOn:string; endsOn:string}) {
  if (!term?.startsOn || !term.endsOn) return 'Recorded';
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila'}).format(new Date());
  if (today < term.startsOn.slice(0, 10)) return 'Later term';
  if (today > term.endsOn.slice(0, 10)) return 'Recorded';
  return 'Current term';
}
function activateRow(event:KeyboardEvent<HTMLTableRowElement>, action:()=>void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}
function useDialogKeys(active:boolean, root:{current:HTMLElement | null}, onEscape:()=>void) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const node = root.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => node ? [...node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')] : [];
    focusable()[0]?.focus();
    function onKey(event:globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onEscapeRef.current();
      if (event.key !== 'Tab' || !node) return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [active, root]);
}

function Seal() {
  return (
    <span className="seal">
      <img src="/brand/libungan-seal.png" alt="Seal of the Municipality of Libungan"/>
    </span>
  );
}
function Face({name, person}:{name:string; person?:Pick<Person,'id'|'hasPhoto'|'photoVersion'>}) {
  if (person?.hasPhoto) {
    return <img className="face" alt="" aria-hidden="true" src={`/api/v1/admin/persons/${person.id}/photo?v=${person.photoVersion ?? '1'}`}/>;
  }
  return <span className="face" aria-hidden="true">{initials(name)}</span>;
}

function Notice({error}:{error:unknown}) {
  return <div className="notice error" role="alert">{error instanceof Error ? error.message : 'This request could not be completed.'}{error instanceof ApiError && <small>Reference: {error.problem.correlationId}</small>}</div>;
}
function Empty({children}:{children:ReactNode}) {return <div className="empty"><ClipboardList size={28}/><p>{children}</p></div>;}
function Status({value}:{value:string}) {
  const tone = ['APPROVED','Active','DELIVERED','CHAIR','READY','LEAD','CLOSED','PRESENT','Current term'].includes(value) ? 'green' : value === 'PENDING' || value === 'VICE_CHAIR' || value === 'SUBMITTED' || value === 'QUARANTINED' || value === 'ABSENT' || value === 'Later term' ? 'amber' : value === 'STAFF' || value === 'DRAFT' || value === 'OPEN' || value === 'JOINT' || value === 'SCHEDULED' || value === 'REGULAR' || value === 'SPECIAL' || value === 'RECORDED' || value === 'Recorded' || value === 'EXCUSED' || value === 'SESSION' || value === 'MEETING' || value === 'MEASURE' || value === 'DOCUMENT' || value === 'COMMITTEE' ? 'blue' : '';
  return <span className={`badge ${tone}`}>{value.toLowerCase().replaceAll('_', ' ')}</span>;
}
interface Field {name:string;label:string;type?:string;options?:Array<{value:string;label:string}>;defaultValue?:string;minLength?:number;maxLength?:number;}
function clipReason(value:string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}
function selectedText(form:HTMLFormElement, name:string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLSelectElement)) return '';
  const option = field.selectedOptions[0];
  if (!option?.value || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(option.textContent ?? '')) return '';
  return option.textContent?.trim() ?? '';
}
function reasonForAction(action:string, form:HTMLFormElement | null) {
  const text = (name:string) => form ? String(new FormData(form).get(name) ?? '').trim() : '';
  const type = text('typeCode');
  const title = text('title');
  if (type === 'RESOLUTION' || type === 'ORDINANCE') {
    const word = type === 'RESOLUTION' ? 'Resolution' : 'Ordinance';
    return clipReason(title ? `Creating new ${word} ${title}` : `Creating new ${word}`);
  }
  const known:Record<string, string> = {
    'Update municipality details':'Updating municipality',
    'New council term':'Creating new council term',
    'Edit council term':'Updating council term',
    'New person':'Creating new person',
    'New membership':'Assigning committee member',
    'Schedule committee meeting':'Scheduling committee meeting',
    'Add agenda item':'Adding agenda item',
    'Close meeting':'Closing committee meeting',
    'New committee':'Creating new committee',
    'Link identity':'Linking user account',
    'Access request':'Requesting access grant',
    'Approve grant':'Approving access grant',
    'Reject grant':'Rejecting access grant',
    'Revoke access immediately':'Revoking access grant',
    'Update draft metadata':'Updating draft',
    'Submit draft':'Submitting draft for secretariat review',
    'Return submitted draft':'Returning measure to draft',
    'Withdraw this case file':'Withdrawing case file',
    'New synopsis version':'Adding synopsis version',
    'Complete task':'Completing task',
    'Close referral':'Closing referral',
    'Schedule session':'Scheduling session',
    'Close session':'Closing session',
    'Attendance':'Recording attendance',
    'Record tally':'Recording tally',
    'Create draft':'Creating new draft',
    'Encode ordinance':'Encoding historical ordinance',
    'Edit ordinance':'Updating historical ordinance',
    'Save ordinance text':'Saving ordinance text',
    'Read scan':'Reading text from scan',
    'Attach a case file':'Uploading case file',
  };
  let phrase = known[action] ?? action;
  if (action.startsWith('Edit ')) phrase = `Updating ${action.slice(5)}`;
  if (action.startsWith('Disable ')) phrase = `Disabling account ${action.slice(8)}`;
  if (action.startsWith('Enable ')) phrase = `Enabling account ${action.slice(7)}`;
  if (action.startsWith('Add photograph')) phrase = action;
  if (action.startsWith('Replace photograph')) phrase = action;
  const named = text('name') || text('label') || text('displayName') || title;
  const picked = form ? ['personId', 'measureId', 'referralId', 'userId'].map(name => selectedText(form, name)).find(Boolean) ?? '' : '';
  const file = form ? new FormData(form).get('file') : null;
  const filename = file instanceof File && file.name ? file.name : '';
  const subject = filename || named || picked;
  if (!subject || phrase.toLowerCase().includes(subject.toLowerCase())) return clipReason(phrase);
  return clipReason(`${phrase} ${subject}`);
}
function ReasonField({suggestion}:{suggestion:string}) {
  return <input type="hidden" name="reason" value={suggestion}/>;
}
function CommandForm({title,path,csrf,fields,method='POST',fixed={},transform,onDone,submitLabel='Save change',hideTitle}:{title:string;path:string;csrf:string;fields:Field[];method?:string;fixed?:Record<string,unknown>;transform?:(body:Record<string,unknown>)=>Record<string,unknown>;onDone?:()=>void;submitLabel?:string;hideTitle?:boolean}) {
  const cache = useQueryClient(), form = useRef<HTMLFormElement>(null), retry = useRef<{body:string;key:string}|null>(null);
  const [suggestion, setSuggestion] = useState(() => reasonForAction(title, null));
  const mutation = useMutation({mutationFn:(body:Record<string,unknown>) => {
    const serialized = JSON.stringify(body);
    if (retry.current?.body !== serialized) retry.current = {body:serialized, key:crypto.randomUUID()};
    return request(path, {method, body, csrf, key:retry.current.key});
  }, onSuccess:() => {retry.current = null; form.current?.reset(); setSuggestion(reasonForAction(title, null)); void cache.invalidateQueries(); onDone?.();}});
  useEffect(() => { if (form.current) setSuggestion(reasonForAction(title, form.current)); }, [title]);
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {...Object.fromEntries(new FormData(e.currentTarget)), ...fixed};
    mutation.mutate(transform ? transform(body) : body);
  }
  return (
    <form ref={form} className="command-form" onSubmit={submit} onChange={event => setSuggestion(reasonForAction(title, event.currentTarget))}>
      {!hideTitle && <h3>{title}</h3>}
      <div className="form-grid">{fields.map(field => <label key={field.name}>{field.label}{field.options ? <select required name={field.name} defaultValue={field.defaultValue ?? ''}><option value="" disabled>Select…</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea required name={field.name} defaultValue={field.defaultValue} minLength={field.minLength} maxLength={field.maxLength ?? 8000} rows={5}/> : <input required name={field.name} type={field.type ?? 'text'} defaultValue={field.defaultValue} minLength={field.minLength} maxLength={field.maxLength ?? (field.name === 'reason' ? 500 : 255)}/>}</label>)}</div>
      <ReasonField suggestion={suggestion}/>
      {mutation.isError && <Notice error={mutation.error}/>}
      {mutation.isSuccess && <p className="success" role="status"><Check size={16}/> Change saved and recorded.</p>}
      <button className="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : submitLabel}<ArrowRight size={16}/></button>
    </form>
  );
}
function AddPanel({label,children,variant}:{label:string;children:ReactNode;variant?:'primary'}) {
  const [open, setOpen] = useState(false);
  return <>
    <button className={`${variant === 'primary' ? 'primary' : 'ghost'} add-action`} type="button" onClick={() => setOpen(true)}><Plus size={16}/>{label}</button>
    {open && <Modal open title={label} onClose={() => setOpen(false)}><div className="modal-body">{children}</div></Modal>}
  </>;
}
function Modal({open, title, onClose, children}:{open:boolean; title:string; onClose:()=>void; children:ReactNode}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogKeys(open, panel, onClose);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Listing<T>({path,children}:{path:string;children:(items:T[], total:number)=>ReactNode}) {
  const [page, setPage] = useState(1);
  const query = useQuery({queryKey:[path, page], queryFn:() => request<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=25`)});
  if (query.isPending) return <p role="status">Loading records…</p>;
  if (query.isError) return <Notice error={query.error}/>;
  return <>
    {query.data.items.length ? children(query.data.items, query.data.pageInfo.total) : <Empty>No records to display.</Empty>}
    {query.data.pageInfo.total > 0 && <div className="pagination">
      <span>Showing {query.data.items.length} of {query.data.pageInfo.total} records</span>
      <div>
        <button aria-label="Previous page" disabled={page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16}/></button>
        <button aria-label="Next page" disabled={page * 25 >= query.data.pageInfo.total} onClick={() => setPage(value => value + 1)}><ChevronRight size={16}/></button>
      </div>
    </div>}
  </>;
}

function TownMark() {
  return (
    <div className="sidebar-art" aria-hidden="true">
      <svg viewBox="0 0 236 110" fill="currentColor">
        <path d="M0 110 12 86l18-22 16 10 20-28 14 12 18-24 22 18 16-30 20 16 24-22 28 20 28-18L236 78v32H0z" opacity="0.55"/>
        <rect x="28" y="72" width="14" height="38"/>
        <rect x="48" y="64" width="18" height="46"/>
        <rect x="92" y="48" width="28" height="62"/>
        <polygon points="92,48 106,28 120,48"/>
        <rect x="150" y="68" width="16" height="42"/>
        <rect x="176" y="58" width="22" height="52"/>
        <circle cx="38" cy="68" r="8" opacity="0.45"/>
        <circle cx="168" cy="62" r="10" opacity="0.4"/>
      </svg>
      <p>Transparent<br/>Responsive<br/>People-Centered<br/>Legislation</p>
    </div>
  );
}

type SearchHit = {id:string; group:string; title:string; detail:string; view:View; settingsTab?:SettingsTab; committeeId?:string; measureId?:string};
function WorkspaceSearch({session, onOpen}:{session:SessionView; onOpen:(hit:SearchHit)=>void}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const needle = query.trim().toLowerCase();
  const looking = open && needle.length >= 1;
  const shortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
  const measures = useQuery({queryKey:['/measures','search'], queryFn:() => request<Page<Measure>>('/measures?page=1&limit=100'), enabled:looking && session.permissions.includes('measure.view')});
  const committees = useQuery({queryKey:['/committees','search'], queryFn:() => request<Page<Committee>>('/committees?page=1&limit=100'), enabled:looking && session.permissions.includes('committee.view')});
  const people = useQuery({queryKey:['/admin/persons','search'], queryFn:() => request<Page<Person>>('/admin/persons?page=1&limit=100'), enabled:looking && session.permissions.includes('person.view')});
  const users = useQuery({queryKey:['/admin/users','search'], queryFn:() => request<Page<User>>('/admin/users?page=1&limit=100'), enabled:looking && session.permissions.includes('user.view')});
  const terms = useQuery({queryKey:['/admin/terms','search'], queryFn:() => request<Page<Term>>('/admin/terms?page=1&limit=100'), enabled:looking && session.permissions.includes('term.view')});
  const jumps = useMemo<SearchHit[]>(() => [
    {id:'jump:overview', group:'Jump to', title:'Dashboard', detail:'Workspace home', view:'overview'},
    ...(session.permissions.includes('measure.view') ? [{id:'jump:measures', group:'Jump to', title:'Legislative Measures', detail:'Draft case files', view:'measures' as View}] : []),
    {id:'jump:people', group:'Jump to', title:'People', detail:'Demonstration directory', view:'people' as View},
    {id:'jump:committees', group:'Jump to', title:'Committees', detail:'Standing and special committees', view:'committees' as View},
    ...(session.permissions.includes('session.view') ? [{id:'jump:sessions', group:'Jump to', title:'Sessions', detail:'Secretariat-recorded sittings', view:'sessions' as View}] : []),
    ...(canAny(session.permissions, ['session.view','committee.meeting.view']) ? [{id:'jump:calendar', group:'Jump to', title:'Calendar', detail:'Sessions and committee meetings', view:'calendar' as View}] : []),
    ...(canAny(session.permissions, ['vote.view','attendance.record']) ? [{id:'jump:voting', group:'Jump to', title:'Voting & Attendance', detail:'Secretary-entered roll-call records', view:'voting' as View}] : []),
    ...(session.permissions.includes('document.view') ? [{id:'jump:documents', group:'Jump to', title:'Documents', detail:'Quarantined case files', view:'documents' as View}] : []),
    ...(session.permissions.includes('library.view') ? [{id:'jump:library', group:'Jump to', title:'e-Library', detail:'Permission-filtered case-file index', view:'library' as View}] : []),
    ...(session.permissions.includes('report.view') ? [{id:'jump:reports', group:'Jump to', title:'Reports & Analytics', detail:'Descriptive operational counts', view:'reports' as View}] : []),
    ...(canAny(session.permissions, ['user.view','role.assign']) ? [{id:'jump:users', group:'Jump to', title:'Users & Access', detail:'Accounts and dual-control grants', view:'users' as View}] : []),
    ...(canAny(session.permissions, ['municipality.view','settings.manage','term.view','person.view','audit.view']) ? [{id:'jump:settings', group:'Jump to', title:'System Settings', detail:'Municipality, terms, and people', view:'settings' as View}] : []),
  ], [session.permissions]);
  const hits = useMemo(() => {
    const matches = (value:string) => value.toLowerCase().includes(needle);
    const items:SearchHit[] = [];
    if (!needle) return jumps;
    for (const item of jumps) {
      if (matches(`${item.title} ${item.detail}`)) items.push(item);
    }
    for (const item of measures.data?.items ?? []) {
      if (matches(`${item.title} ${item.subject} ${item.typeCode}`)) items.push({id:`measure:${item.id}`, group:'Measures', title:item.title, detail:item.stage.replaceAll('_',' '), view:'measures', measureId:item.id});
    }
    for (const item of committees.data?.items ?? []) {
      const chair = item.members?.find(member => member.role === 'CHAIR')?.person?.displayName ?? '';
      if (matches(`${item.name} ${item.code} ${chair}`)) items.push({id:`committee:${item.id}`, group:'Committees', title:item.name, detail:item.code, view:'committees', committeeId:item.id});
    }
    for (const item of people.data?.items ?? []) {
      if (matches(`${item.displayName} ${personPositionLabel(item.positionCode)}`)) items.push({id:`person:${item.id}`, group:'People', title:item.displayName, detail:personPositionLabel(item.positionCode), view:'people'});
    }
    for (const item of users.data?.items ?? []) {
      if (matches(`${item.displayName} ${item.subject}`)) items.push({id:`user:${item.id}`, group:'Accounts', title:item.displayName, detail:item.enabled ? 'Linked account' : 'Disabled account', view:'users'});
    }
    for (const item of terms.data?.items ?? []) {
      if (matches(item.label)) items.push({id:`term:${item.id}`, group:'Council terms', title:item.label, detail:`${shortDate(item.startsOn)} – ${shortDate(item.endsOn)}`, view:'settings', settingsTab:'terms'});
    }
    return items.slice(0, 8);
  }, [needle, jumps, measures.data, committees.data, people.data, users.data, terms.data]);
  const groups = [...new Set(hits.map(item => item.group))];
  useEffect(() => setCursor(0), [needle]);
  useEffect(() => {
    function dismiss(event:MouseEvent) {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    }
    function hotspot(event:globalThis.KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      input.current?.focus();
      setOpen(true);
    }
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', hotspot);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', hotspot);
    };
  }, []);
  function choose(hit:SearchHit) {
    setQuery('');
    setOpen(false);
    input.current?.blur();
    window.setTimeout(() => onOpen(hit), 0);
  }
  function onKey(event:KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {setOpen(false); event.currentTarget.blur(); return;}
    if (!hits.length) return;
    if (event.key === 'ArrowDown') {event.preventDefault(); setCursor(value => (value + 1) % hits.length);}
    if (event.key === 'ArrowUp') {event.preventDefault(); setCursor(value => (value - 1 + hits.length) % hits.length);}
    if (event.key === 'Enter') {event.preventDefault(); const hit = hits[cursor]; if (hit) choose(hit);}
  }
  const loading = looking && [measures, committees, people, users, terms].some(queryState => queryState.isFetching);
  const activeId = hits[cursor] ? `search-opt-${hits[cursor].id}` : undefined;
  return (
    <div className="search-wrap" ref={wrap}>
      <div className={`search ${open ? 'open' : ''}`}>
        <span className="search-glyph" aria-hidden="true"><Search size={15}/></span>
        <input
          ref={input}
          role="combobox"
          aria-label="Search workspace"
          aria-expanded={open}
          aria-controls="workspace-search-results"
          aria-autocomplete="list"
          aria-activedescendant={open ? activeId : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={event => {setQuery(event.target.value); setOpen(true);}}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search this workspace…"
        />
        {query ? <button type="button" className="search-action" aria-label="Clear search" onClick={() => {setQuery(''); setOpen(true); input.current?.focus();}}><X size={14}/></button> : <kbd className="search-kbd">{shortcut}</kbd>}
      </div>
      {open && (
        <div className="search-results" id="workspace-search-results" role="listbox">
          {!needle && <p className="search-hint">Type to find live records, or jump to a workspace page.</p>}
          {needle && loading && !hits.length && <p className="search-hint" role="status">Searching records…</p>}
          {needle && !loading && !hits.length && <p className="search-empty">No matching measures, committees, people, or accounts.</p>}
          {groups.map(group => (
            <div key={group}>
              <div className="search-group">{group}</div>
              {hits.filter(item => item.group === group).map(hit => {
                const index = hits.indexOf(hit);
                return (
                  <button id={`search-opt-${hit.id}`} key={hit.id} type="button" role="option" aria-selected={index === cursor} className={`search-hit ${index === cursor ? 'active' : ''}`} onMouseEnter={() => setCursor(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(hit)}>
                    <span className="hit-icon">{hit.view === 'measures' ? <FileText size={16}/> : hit.view === 'committees' ? <ClipboardList size={16}/> : hit.view === 'users' ? <ShieldCheck size={16}/> : hit.view === 'overview' ? <Home size={16}/> : hit.settingsTab === 'terms' ? <Landmark size={16}/> : <Users size={16}/>}</span>
                    <span className="hit-copy"><strong>{hit.title}</strong><small>{hit.detail}</small></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({session, municipality, onOpen}:{session:SessionView; municipality?:Municipality; onOpen:(view:View)=>void}) {
  const canViewCommittees = session.permissions.includes('committee.view');
  const canViewPeople = session.permissions.includes('person.view');
  const terms = useQuery({queryKey:['/admin/terms','dash'], queryFn:() => request<Page<Term>>('/admin/terms?page=1&limit=100'), enabled:canViewPeople && session.permissions.includes('term.view')});
  const dashTerm = currentTerm(terms.data?.items);
  const people = useQuery({queryKey:['/admin/persons','dash', dashTerm?.id], queryFn:() => request<Page<Person>>(`/admin/persons?page=1&limit=5&termId=${dashTerm?.id}`), enabled:canViewPeople && Boolean(dashTerm?.id)});
  const committees = useQuery({queryKey:['/committees','dash'], queryFn:() => request<Page<Committee>>('/committees?page=1&limit=5'), enabled:canViewCommittees});
  const audit = useQuery({queryKey:['/audit','dash'], queryFn:() => request<Page<AuditEvent>>('/audit?page=1&limit=5'), enabled:session.permissions.includes('audit.view')});
  const stats = useQuery({queryKey:['/measures/stats'], queryFn:() => request<{data:MeasureStats}>('/measures/stats'), enabled:session.permissions.includes('measure.view')});
  const tasks = useQuery({queryKey:['/tasks','dash'], queryFn:() => request<Page<WorkTask>>('/tasks?page=1&limit=5'), enabled:session.permissions.includes('task.manage')});
  const place = municipality?.name.replace(' (Fictional)', '') ?? 'your municipality';
  return <>
    <section className="hero">
      <div className="hero-atmosphere" aria-hidden="true">
        <span className="hero-ring hero-ring-a"/>
        <span className="hero-ring hero-ring-b"/>
        <span className="hero-ring hero-ring-c"/>
      </div>
      <div className="hero-copy">
        <p className="eyebrow">{greeting(session.user.displayName).toUpperCase()}</p>
        <h2>Together for a Better {place.replace(/^Municipality of /, '')}</h2>
        <p className="quote">Effective local legislation creates stronger communities.</p>
      </div>
      <span className="date-chip">{longDate(new Date().toISOString())}</span>
    </section>
    <section className="kpis" aria-label="Legislative totals">
      {stats.isError && <Notice error={stats.error}/>}
      {pipelineKpis.map(card => {
        const Icon = card.icon;
        const proposed = card.label === 'Proposed Measures';
        const pending = card.label === 'Pending Committee';
        const live = session.permissions.includes('measure.view') && (proposed || pending);
        const waiting = live && (stats.isPending || stats.isError);
        const value = waiting ? '—' : proposed && live ? stats.data?.data?.proposed ?? 0 : pending && live ? stats.data?.data?.pendingCommittee ?? 0 : 0;
        const hint = waiting ? 'Loading scoped totals' : proposed && live ? 'Draft and submitted case files' : pending && live ? 'Open committee referrals' : 'Later phase';
        return (
          <article key={card.label} className={`kpi ${card.tone}`} title={hint} aria-busy={waiting || undefined}>
            <span className="icon"><Icon size={18}/></span>
            <div>
              <strong>{value}</strong>
              <span>{card.label}</span>
              <small>{hint}</small>
            </div>
          </article>
        );
      })}
    </section>
    <div className="dash-grid">
      <div>
        <div className="panel dash-panel" style={{marginBottom:16}}>
          <div className="section-h"><h2>People directory</h2><button className="linkish" onClick={() => onOpen('people')}>View All</button></div>
          {!canViewPeople ? <Empty>This account cannot list people.</Empty> : people.isPending ? <p role="status">Loading records…</p> : people.isError ? <Notice error={people.error}/> : people.data?.items.length ? (
            <ul className="dash-list">{people.data.items.map(item => (
              <li key={item.id}><Face name={item.displayName} person={item}/><div><strong>{item.displayName}</strong><small>{personPositionLabel(item.positionCode)}</small></div></li>
            ))}</ul>
          ) : <Empty>No people in the demonstration directory yet.</Empty>}
        </div>
        <div className="panel dash-panel">
          <div className="section-h"><h2>Recent committee records</h2><button className="linkish" onClick={() => onOpen('committees')}>View All</button></div>
          {!canViewCommittees ? <Empty>Committee roster is not on this account.</Empty> : committees.isPending ? <p role="status">Loading records…</p> : committees.isError ? <Notice error={committees.error}/> : committees.data?.items.length ? (
            <ul className="dash-list">{committees.data.items.map((item, index) => (
              <li key={item.id}>
                <span className="dash-code" style={{background:accents[index % accents.length]}}>{item.code}</span>
                <div><strong>{item.name}</strong><small>{item.term?.label}</small></div>
              </li>
            ))}</ul>
          ) : <Empty>No committees to display yet.</Empty>}
        </div>
      </div>
      <div>
        <UpcomingPanel session={session} onOpen={onOpen}/>
        <div className="panel dash-panel" style={{marginBottom:16}}>
          <div className="section-h"><h2>Recent activity</h2></div>
          {!session.permissions.includes('audit.view') ? <p className="later">Audit history appears here when you have review access.</p> : audit.isPending ? <p role="status">Loading records…</p> : audit.isError ? <Notice error={audit.error}/> : audit.data?.items.length ? audit.data.items.map(item => (
            <div className="event" key={item.id}><div className="cal"><small>LOG</small><b>#{item.sequence}</b></div><div><strong>{item.action}</strong><small>{item.actorName} · {shortDate(item.recordedAt)}</small></div></div>
          )) : <p className="later">No audit events recorded yet.</p>}
        </div>
        <div className="panel dash-panel" style={{marginBottom:16}}>
          <div className="section-h"><h2>In-app tasks</h2></div>
          {session.permissions.includes('task.manage') ? (tasks.isPending ? <p role="status">Loading records…</p> : tasks.isError ? <Notice error={tasks.error}/> : tasks.data?.items.length ? tasks.data.items.map(item => (
            <div className="event" key={item.id}><div className="cal"><small>TASK</small><b>{item.state}</b></div><div><strong>{item.title}</strong><small>Completing a task does not file a measure.</small></div></div>
          )) : <p className="later">No in-app tasks yet.</p>) : <p className="later">Tasks appear here when you have task access.</p>}
        </div>
        <div className="panel dash-panel">
          <div className="section-h"><h2>Quick actions</h2></div>
          <div className="quick-grid">
            {session.permissions.includes('measure.view') && <button className="quick-card" onClick={() => onOpen('measures')}><span className="quick-icon"><FileText size={18}/></span>Legislative Measures</button>}
            <button className="quick-card" onClick={() => onOpen('people')}><span className="quick-icon"><Users size={18}/></span>People</button>
            <button className="quick-card" onClick={() => onOpen('committees')}><span className="quick-icon"><ClipboardList size={18}/></span>Committees</button>
            {session.permissions.includes('session.view') && <button className="quick-card" onClick={() => onOpen('sessions')}><span className="quick-icon"><Landmark size={18}/></span>Sessions</button>}
            {canAny(session.permissions, ['session.view','committee.meeting.view']) && <button className="quick-card" onClick={() => onOpen('calendar')}><span className="quick-icon"><CalendarDays size={18}/></span>Calendar</button>}
            {session.permissions.includes('library.view') && <button className="quick-card" onClick={() => onOpen('library')}><span className="quick-icon"><BookOpen size={18}/></span>e-Library</button>}
            {session.permissions.includes('report.view') && <button className="quick-card" onClick={() => onOpen('reports')}><span className="quick-icon"><BarChart3 size={18}/></span>Reports &amp; Analytics</button>}
            {canAny(session.permissions, ['user.view','role.assign']) && <button className="quick-card" onClick={() => onOpen('users')}><span className="quick-icon"><Users size={18}/></span>Users &amp; Access</button>}
            {canAny(session.permissions, ['municipality.view','settings.manage']) && <button className="quick-card" onClick={() => onOpen('settings')}><span className="quick-icon"><Settings size={18}/></span>System Settings</button>}
          </div>
        </div>
      </div>
    </div>
  </>;
}

function UpcomingPanel({session, onOpen}:{session:SessionView; onOpen:(view:View)=>void}) {
  const canSee = canAny(session.permissions, ['session.view','committee.meeting.view']);
  const query = useQuery({queryKey:['/calendar','dash'], queryFn:() => request<Page<CalendarEvent>>('/calendar?page=1&limit=5'), enabled:canSee});
  return (
    <div className="panel" style={{marginBottom:16}}>
      <div className="section-h"><h2>Upcoming sessions and meetings</h2>{canSee && <button className="linkish" onClick={() => onOpen('calendar')}>View Calendar</button>}</div>
      {!canSee ? <p className="later">Calendar access is not on this account.</p> : query.isPending ? <p role="status">Loading records…</p> : query.isError ? <Notice error={query.error}/> : query.data?.items.length ? query.data.items.map(item => (
        <div className="event" key={`${item.kind}-${item.id}`}><div className="cal"><small>{item.kind === 'SESSION' ? 'SESS' : 'MTG'}</small><b>{item.reference}</b></div><div><strong>{item.title}</strong><small>{item.venue} · {shortDate(item.scheduledAt)}</small></div></div>
      )) : <p className="later">No sessions or committee meetings recorded yet.</p>}
    </div>
  );
}

function MunicipalityPage({session}:{session:SessionView}) {
  const [editing, setEditing] = useState(false);
  const query = useQuery({queryKey:['/admin/municipality'], queryFn:() => request<{data:Municipality}>('/admin/municipality')});
  if (query.isError) return <Notice error={query.error}/>;
  if (!query.data) return <p>Loading municipality…</p>;
  const municipality = query.data.data;
  const canEdit = session.permissions.includes('settings.manage');
  return <>
    <div className="panel">
      <div className="record-heading" style={{display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap'}}>
        <Seal/>
        <div><h2>{municipality.name}</h2><p className="muted">{municipality.province} · {municipality.timezone}</p></div>
        <Status value={municipality.code}/>
        {canEdit && <button className="ghost" type="button" onClick={() => setEditing(true)}>Edit municipality</button>}
      </div>
      <dl className="facts">
        <div><dt>Installation</dt><dd>Single municipality</dd></div>
        <div><dt>Data</dt><dd>Fictional development records</dd></div>
        <div><dt>Record revision</dt><dd>{municipality.revision}</dd></div>
      </dl>
    </div>
    {editing && canEdit && (
      <Modal open title="Edit municipality" onClose={() => setEditing(false)}>
        <CommandForm hideTitle key={municipality.revision} title="Update municipality details" path="/admin/municipality" method="PATCH" csrf={session.csrfToken} onDone={() => setEditing(false)} fixed={{expectedRevision:municipality.revision}} submitLabel="Save municipality" fields={[{name:'name', label:'Municipality name', defaultValue:municipality.name},{name:'province', label:'Province', defaultValue:municipality.province}]}/>
      </Modal>
    )}
  </>;
}

function TermsPage({session}:{session:SessionView}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);
  const canManage = session.permissions.includes('term.manage');
  return <>
    <div className="section-h section-actions">
      <h2>Council terms</h2>
      {canManage && <button className="primary" type="button" onClick={() => setCreating(true)}><Plus size={16}/>Add council term</button>}
    </div>
    {creating && (
      <Modal open title="New council term" onClose={() => setCreating(false)}>
        <CommandForm hideTitle title="New council term" path="/admin/terms" csrf={session.csrfToken} onDone={() => setCreating(false)} submitLabel="Create council term" fields={[{name:'label', label:'Term label'},{name:'startsOn', label:'Start date', type:'date'},{name:'endsOn', label:'End date', type:'date'}]}/>
      </Modal>
    )}
    {editing && (
      <Modal open title="Edit council term" onClose={() => setEditing(null)}>
        <CommandForm hideTitle key={`${editing.id}-${editing.revision}`} title="Edit council term" path={`/admin/terms/${editing.id}`} method="PATCH" csrf={session.csrfToken} onDone={() => setEditing(null)} fixed={{expectedRevision:editing.revision}} submitLabel="Save council term" fields={[{name:'label', label:'Term label', defaultValue:editing.label},{name:'startsOn', label:'Start date', type:'date', defaultValue:dateOnly(editing.startsOn)},{name:'endsOn', label:'End date', type:'date', defaultValue:dateOnly(editing.endsOn)}]}/>
      </Modal>
    )}
    <div className="panel"><Listing<Term> path="/admin/terms">{items => {
      const selected = items.find(item => item.id === selectedId) ?? currentTerm(items) ?? items[0];
      return <>
        <table><thead><tr><th>Council term</th><th>Starts</th><th>Ends</th><th>People</th><th>Revision</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className={item.id === selected?.id ? 'selected' : ''} tabIndex={0} aria-label={item.label} onClick={() => setSelectedId(item.id)} onKeyDown={event => activateRow(event, () => setSelectedId(item.id))}><td><strong>{item.label}</strong></td><td>{shortDate(item.startsOn)}</td><td>{shortDate(item.endsOn)}</td><td>{item.peopleCount ?? 0}</td><td>{item.revision}</td></tr>)}</tbody></table>
        {selected && <div style={{marginTop:16}}>
          <div className="section-h section-actions"><h3>{selected.label}</h3>{canManage && <button className="ghost" type="button" onClick={() => setEditing(selected)}>Edit council term</button>}</div>
          {selected.peopleCount === 0 && <p className="notice">Every council term needs its people. Encode this term's council before committees, measures, or sessions use it.</p>}
          <PeoplePage session={session} embedded termId={selected.id}/>
        </div>}
      </>;
    }}</Listing></div>
  </>;
}

function PersonPhotoForm({session, person, onDone, hideTitle}:{session:SessionView; person:Person; onDone?:()=>void; hideTitle?:boolean}) {
  const cache = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = (event.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    if (!file) return;
    const jpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
    const png = file.type === 'image/png' || /\.png$/i.test(file.name);
    if (!jpeg && !png) {setError(new Error('Use a JPEG or PNG photograph.')); return;}
    if (file.size > PERSON_PHOTO_MAX_BYTES) {setError(new Error('Each photograph must be 2 MiB or smaller.')); return;}
    setPending(true); setError(null);
    try {
      await uploadBytes(`/admin/persons/${person.id}/photo`, file, session.csrfToken, {'X-Audit-Reason':reason, 'Idempotency-Key':crypto.randomUUID()});
      form.current?.reset();
      await cache.invalidateQueries();
      onDone?.();
    } catch (err) {setError(err);}
    finally {setPending(false);}
  }
  return (
    <form ref={form} className="command-form" onSubmit={submit}>
      {!hideTitle && <h3>{person.hasPhoto ? 'Replace photograph' : 'Add photograph'}</h3>}
      <p className="muted">Directory photograph only. This is not a case-file document and is not scanned.</p>
      <label>Photograph<input required name="file" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png"/></label>
      <ReasonField suggestion={person.hasPhoto ? `Replacing photograph for ${person.displayName}` : `Adding photograph for ${person.displayName}`}/>
      {error != null && <Notice error={error}/>}
      <button className="primary" disabled={pending}>{pending ? 'Uploading…' : person.hasPhoto ? 'Replace photograph' : 'Save photograph'}</button>
    </form>
  );
}

function committeeRoleLabel(role:string) {
  if (role === 'CHAIR') return 'Chairman';
  if (role === 'VICE_CHAIR') return 'Vice Chairman';
  if (role === 'MEMBER') return 'Member';
  if (role === 'STAFF') return 'Staff';
  return role.replaceAll('_', ' ');
}
function PersonRecordDialog({person, onClose}:{person:Person; onClose:()=>void}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const query = useQuery({queryKey:['/admin/persons', person.id, 'profile'], queryFn:() => request<{data:PersonLegislativeProfile}>(`/admin/persons/${person.id}/profile`)});
  const profile = query.data?.data;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    function onKey(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const shown = profile ?? person;
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} className="person-record" role="dialog" aria-modal="true" aria-labelledby="person-record-name">
        <header className="person-record-head">
          <span className="profile-face"><Face name={shown.displayName} person={shown}/></span>
          <div>
            <h2 id="person-record-name">{shown.displayName}</h2>
            <span className="person-record-pill"><Landmark size={12}/> {personPositionLabel(shown.positionCode)}</span>
          </div>
          <button type="button" className="person-record-close" aria-label="Close" onClick={onClose}><X size={18}/></button>
        </header>
        {query.isPending && <p className="person-record-status" role="status">Loading legislative record…</p>}
        {query.isError && <div className="person-record-body"><Notice error={query.error}/></div>}
        {profile && (
          <div className="person-record-body">
            <div className="person-record-stats">
              <article><span className="profile-icon terms"><Award size={16}/></span><strong>{profile.termsListed}</strong><span>Terms listed</span></article>
              <article><span className="profile-icon authored"><FileText size={16}/></span><strong>{profile.authored}</strong><span>Authored</span></article>
              <article><span className="profile-icon shared"><Users size={16}/></span><strong>{profile.coAuthored}</strong><span>Co-authored</span></article>
            </div>
            <h3>Positions listed</h3>
            <p>{profile.note}</p>
            {profile.seats.map((seat, index) => (
              <details key={seat.termId} className="person-seat" open={index === 0}>
                <summary>
                  <span className="profile-icon terms"><Landmark size={14}/></span>
                  <span><strong>{seat.termLabel}</strong><small><CalendarDays size={12}/> {seat.startsOn.slice(0, 4)}–{seat.endsOn.slice(0, 4)}</small></span>
                  <em>{personPositionLabel(seat.positionCode)}</em>
                  <ChevronDown size={16}/>
                </summary>
                <div className="person-seat-body">
                  <div><span>Authored</span><strong>{seat.authored}</strong><small>submitted records</small></div>
                  <div><span>Co-authored</span><strong>{seat.coAuthored}</strong><small>submitted records</small></div>
                  {seat.committees.length ? (
                    <div className="person-committees">
                      <p><span className="live-dot" aria-hidden="true"/> Committee assignments ({seat.committees.length})</p>
                      <ul>
                        {seat.committees.map(item => (
                          <li key={`${item.role}-${item.name}`} className={item.role === 'CHAIR' ? 'chair' : item.role === 'VICE_CHAIR' ? 'vice' : ''}>
                            <span><b>{committeeRoleLabel(item.role)}</b><span aria-hidden="true"> · </span>{item.name.replace(/^committee on\s+/i, '')}</span>
                            {item.active ? <em>Active</em> : <em className="recorded">Recorded</em>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : <p className="person-none">No committee assignments recorded for this term.</p>}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function PeoplePage({session, embedded=false, termId}:{session:SessionView; embedded?:boolean; termId?:string}) {
  const canView = session.permissions.includes('person.view');
  const canManage = session.permissions.includes('person.manage');
  const canSeeTerms = session.permissions.includes('term.view');
  const [chosen, setChosen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [photo, setPhoto] = useState<Person | null>(null);
  const [record, setRecord] = useState<Person | null>(null);
  const terms = useQuery({queryKey:['/admin/terms','people'], queryFn:() => request<Page<Term>>('/admin/terms?page=1&limit=100'), enabled:canView && !termId && canSeeTerms});
  const activeTerm = termId ?? chosen ?? currentTerm(terms.data?.items)?.id ?? '';
  const activeLabel = terms.data?.items.find(item => item.id === activeTerm)?.label;
  const listPath = activeTerm ? `/admin/persons?termId=${encodeURIComponent(activeTerm)}` : '/admin/persons';
  const personFields:Field[] = [...(activeTerm ? [] : [{name:'termId', label:'Council term', options:terms.data?.items.map(item => ({value:item.id, label:item.label})) ?? []}]), {name:'displayName', label:'Full display name'}, {name:'positionCode', label:'Position', options:positionOptions}];
  const create = canManage ? <button className="primary" type="button" onClick={() => setCreating(true)}><Plus size={16}/>Add person</button> : null;
  const dialogs = <>
    {creating && (
      <Modal open title={activeLabel ? `New person · ${activeLabel}` : 'New person'} onClose={() => setCreating(false)}>
        <CommandForm hideTitle title="New person" path="/admin/persons" csrf={session.csrfToken} onDone={() => setCreating(false)} fixed={activeTerm ? {termId:activeTerm} : {}} submitLabel="Add person" fields={personFields}/>
      </Modal>
    )}
    {editing && (
      <Modal open title={`Edit ${editing.displayName}`} onClose={() => setEditing(null)}>
        <CommandForm hideTitle key={`${editing.id}-${editing.revision ?? 1}`} title={`Edit ${editing.displayName}`} path={`/admin/persons/${editing.id}`} method="PATCH" csrf={session.csrfToken} onDone={() => setEditing(null)} fixed={{expectedRevision:editing.revision ?? 1}} submitLabel="Save person" fields={[{name:'displayName', label:'Full display name', defaultValue:editing.displayName},{name:'positionCode', label:'Position', options:positionOptions, defaultValue:editing.positionCode}]}/>
      </Modal>
    )}
    {photo && (
      <Modal open title={photo.hasPhoto ? 'Replace photograph' : 'Add photograph'} onClose={() => setPhoto(null)}>
        <PersonPhotoForm hideTitle session={session} person={photo} onDone={() => setPhoto(null)}/>
      </Modal>
    )}
    {record && <PersonRecordDialog person={record} onClose={() => setRecord(null)}/>}
  </>;
  const body = !canView ? <Empty>This account cannot list people. The directory requires a live SEC or LS grant.</Empty> : (
    <>
      {!termId && canSeeTerms && terms.isPending && <p role="status">Loading council terms…</p>}
      {!termId && canSeeTerms && (terms.data?.items.length ?? 0) > 0 && <label className="term-picker">Council term<select value={activeTerm} onChange={event => setChosen(event.target.value)}>{terms.data?.items.map(item => <option key={item.id} value={item.id}>{item.label}{(item.peopleCount ?? 0) === 0 ? ' · no people yet' : ''}</option>)}</select></label>}
      {(!canSeeTerms || termId || terms.isSuccess) && embedded && <div className="section-h section-actions"><h3>People on this term</h3>{create}</div>}
      {(Boolean(termId) || !canSeeTerms || terms.isSuccess) ? <div className="panel"><Listing<Person> path={listPath}>{items => <table><thead><tr><th>Name</th><th>Position</th>{canManage ? <th>Record</th> : null}</tr></thead><tbody>{items.map(item => <tr key={item.id}><td><button type="button" className="person-open" onClick={() => setRecord(item)} aria-label={`View legislative record for ${item.displayName}`}><Face name={item.displayName} person={item}/><strong>{item.displayName}</strong></button></td><td>{personPositionLabel(item.positionCode)}</td>{canManage ? <td><div className="row-actions"><button className="ghost" type="button" onClick={() => setEditing(item)}>Edit name</button><button className="ghost" type="button" onClick={() => setPhoto(item)}>{item.hasPhoto ? 'Replace photo' : 'Add photo'}</button></div></td> : null}</tr>)}</tbody></table>}</Listing></div> : null}
      {dialogs}
    </>
  );
  if (embedded) return <>
    <p className="muted" style={{marginBottom:12}}>Names on this council term. A person record is not a councilor login or legal seat.</p>
    {body}
  </>;
  return (
    <div>
      <div className="page-heading section-actions">
        <div>
          <h1>People</h1>
          <p>Each council term has its own people. A position is not a legal seat, login, or official membership.</p>
        </div>
        {create}
      </div>
      {body}
    </div>
  );
}

function CommitteeDetail({id, session}:{id:string; session:SessionView}) {
  const [tab, setTab] = useState<'overview' | 'members' | 'referrals' | 'meetings' | 'documents'>('overview');
  const [expanded, setExpanded] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const titleId = useId();
  const query = useQuery({queryKey:['/committees', id], queryFn:() => request<{data:Committee}>(`/committees/${id}`)});
  const canEdit = session.permissions.includes('committee.members.manage');
  const people = useQuery({queryKey:['/admin/persons','options', query.data?.data.termId], queryFn:() => request<Page<Person>>(`/admin/persons?limit=100&termId=${query.data?.data.termId}`), enabled:canEdit && Boolean(query.data?.data.termId)});
  const referrals = useQuery({queryKey:['/committees', id, 'referrals'], queryFn:() => request<Page<Referral>>(`/committees/${id}/referrals?page=1&limit=50`), enabled:(tab === 'referrals' || tab === 'meetings') && session.permissions.includes('committee.referral.view')});
  const meetings = useQuery({queryKey:['/committees', id, 'meetings'], queryFn:() => request<Page<CommitteeMeeting>>(`/committees/${id}/meetings?page=1&limit=50`), enabled:tab === 'meetings' && session.permissions.includes('committee.meeting.view')});
  const meeting = useQuery({queryKey:['/meetings', activeMeeting], queryFn:() => request<{data:CommitteeMeeting}>(`/meetings/${activeMeeting}`), enabled:Boolean(activeMeeting) && session.permissions.includes('committee.meeting.view')});
  const documents = useQuery({queryKey:['/committees', id, 'documents'], queryFn:() => request<{items:DocumentRecord[]}>(`/committees/${id}/documents`), enabled:tab === 'documents' && session.permissions.includes('document.view')});
  const meetingDocs = useQuery({queryKey:['/meetings', activeMeeting, 'documents'], queryFn:() => request<{items:DocumentRecord[]}>(`/meetings/${activeMeeting}/documents`), enabled:Boolean(activeMeeting) && tab === 'meetings' && session.permissions.includes('document.view')});
  const frame = useRef<HTMLDivElement>(null);
  useDialogKeys(expanded, frame, () => setExpanded(false));
  useEffect(() => { setExpanded(false); setScheduling(false); setActiveMeeting(null); }, [id]);
  if (query.isError) return <Notice error={query.error}/>;
  if (!query.data) return <p>Loading committee…</p>;
  const committee = query.data.data;
  const chair = committee.members?.find(member => member.role === 'CHAIR');
  const vice = committee.members?.find(member => member.role === 'VICE_CHAIR');
  const panel = (
    <aside className={`panel detail-panel${expanded ? ' detail-panel-full' : ''}`}>
      <div className="detail-head">
        <div>
          <span className="kicker"><Users size={14}/> Standing committee</span>
          <h2 id={titleId}>{committee.name}</h2>
          <p className="muted">{committee.code} · {committee.term?.label}</p>
        </div>
        <div className="detail-actions">
          <Status value={termStanding(committee.term)}/>
          <button className="ghost" onClick={() => setExpanded(value => !value)}>
            {expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
            {expanded ? 'Exit full screen' : 'View full screen'}
          </button>
        </div>
      </div>
      <div className="stats-row">
        <div className="mini-stat"><strong>{committee.members?.length ?? 0}</strong><span className="muted">Members</span></div>
        <div className="mini-stat"><strong>{committee.revision}</strong><span className="muted">Revision</span></div>
        <div className="mini-stat"><CheckCircle2 size={16}/><span className="muted">{termStanding(committee.term)}</span></div>
      </div>
      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>Members</button>
        {session.permissions.includes('committee.referral.view') && <button className={tab === 'referrals' ? 'active' : ''} onClick={() => setTab('referrals')}>Referrals</button>}
        {session.permissions.includes('committee.meeting.view') && <button className={tab === 'meetings' ? 'active' : ''} onClick={() => setTab('meetings')}>Meetings</button>}
        {session.permissions.includes('document.view') && <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>}
      </div>
      {tab === 'overview' && (
        <div className="detail-split">
          <div>
            <h3>Committee details</h3>
            <dl className="facts">
              <div><dt>Term standing</dt><dd><Status value={termStanding(committee.term)}/></dd></div>
              <div><dt>Code</dt><dd>{committee.code}</dd></div>
              <div><dt>Council term</dt><dd>{committee.term?.label ?? '—'}</dd></div>
              <div><dt>Chairperson</dt><dd>{chair?.person?.displayName ?? 'Not assigned'}</dd></div>
            </dl>
          </div>
          <div className="officer-card">
            <h3>Chairperson</h3>
            {chair?.person ? (
              <div className="cell-person"><Face name={chair.person.displayName} person={chair.person}/><div><strong>{chair.person.displayName}</strong><small>Chairperson</small></div></div>
            ) : <p className="muted">Not assigned</p>}
            {vice?.person && <div className="cell-person" style={{marginTop:12}}><Face name={vice.person.displayName} person={vice.person}/><div><strong>{vice.person.displayName}</strong><small>Vice chairperson</small></div></div>}
          </div>
        </div>
      )}
      {tab === 'members' && (
        <>
          {canEdit && (people.isError ? <Notice error={people.error}/> : <AddPanel label="Assign committee member"><CommandForm key={`${committee.revision}-${committee.term?.endsOn ?? ''}`} title="New membership" path={`/committees/${id}/members`} csrf={session.csrfToken} fixed={{expectedRevision:committee.revision}} fields={[{name:'personId', label:'Person', options:people.data?.items.map(personOption) ?? []},{name:'role', label:'Committee role', options:['CHAIR','VICE_CHAIR','MEMBER','STAFF'].map(value => ({value, label:value.replace('_',' ')}))},{name:'startsOn', label:'Start date', type:'date', defaultValue:dateOnly(committee.term?.startsOn)},{name:'endsOn', label:'End date', type:'date', defaultValue:dateOnly(committee.term?.endsOn)}]}/></AddPanel>)}
          {committee.members?.length ? (
            <table><thead><tr><th>Member</th><th>Role</th><th>From</th></tr></thead><tbody>{committee.members.map(member => (
              <tr key={member.id}><td className="cell-person">{member.person ? <Face name={member.person.displayName} person={member.person}/> : null}<strong>{member.person?.displayName}</strong></td><td><Status value={member.role}/></td><td>{shortDate(member.startsOn)}</td></tr>
            ))}</tbody></table>
          ) : <Empty>No committee members assigned.</Empty>}
        </>
      )}
      {tab === 'referrals' && (session.permissions.includes('committee.referral.view') ? (
        referrals.isError ? <Notice error={referrals.error}/> : referrals.data?.items.length ? (
          <table><thead><tr><th>Measure</th><th>Role</th><th>Due</th><th>Status</th></tr></thead><tbody>{referrals.data.items.map(item => (
            <tr key={item.id}><td><strong>{item.measure?.title ?? item.measureId}</strong><small>Version bound · {item.sourceKind.replaceAll('_',' ').toLowerCase()}</small></td><td><Status value={item.role}/></td><td>{item.dueOn ? shortDate(item.dueOn) : '—'}</td><td><Status value={item.disposition}/></td></tr>
          ))}</tbody></table>
        ) : <Empty>No referrals assigned to this committee yet.</Empty>
      ) : <p className="later">Referral access is not on this account.</p>)}
      {tab === 'meetings' && (
        <>
          <p className="muted">Secretariat-recorded committee meetings. Closing a meeting is not certified minutes.</p>
          {session.permissions.includes('committee.meeting.manage') && <button className="primary" type="button" onClick={() => setScheduling(true)}>Schedule meeting</button>}
          {scheduling && (
            <Modal open title="Schedule committee meeting" onClose={() => setScheduling(false)}>
              <CommandForm hideTitle title="Schedule committee meeting" path={`/committees/${id}/meetings`} csrf={session.csrfToken} onDone={() => setScheduling(false)} transform={body => ({title:body.title, venue:body.venue, scheduledAt:new Date(String(body.scheduledAt)).toISOString(), referralIds:[], reason:body.reason})} fields={[{name:'title', label:'Title', maxLength:240},{name:'venue', label:'Venue', maxLength:160},{name:'scheduledAt', label:'Scheduled at', type:'datetime-local'}]} submitLabel="Schedule meeting"/>
            </Modal>
          )}
          {meetings.isError ? <Notice error={meetings.error}/> : meetings.data?.items.length ? (
            <table><thead><tr><th>Reference</th><th>Title</th><th>When</th><th>Status</th></tr></thead><tbody>{meetings.data.items.map(item => (
              <tr key={item.id} className={item.id === activeMeeting ? 'selected' : ''} tabIndex={0} aria-label={item.title} onClick={() => setActiveMeeting(item.id)} onKeyDown={event => activateRow(event, () => setActiveMeeting(item.id))}>
                <td>{item.reference}</td><td><strong>{item.title}</strong><small>{item.venue}</small></td><td>{shortDate(item.scheduledAt)}</td><td><Status value={item.state}/></td>
              </tr>
            ))}</tbody></table>
          ) : <Empty>No committee meetings recorded yet.</Empty>}
          {activeMeeting && meeting.data && (
            <div className="officer-card" style={{marginTop:16}}>
              <h3>{meeting.data.data.reference} · {meeting.data.data.title}</h3>
              <p className="muted">{meeting.data.data.venue} · {shortDate(meeting.data.data.scheduledAt)}. Closing is not certified minutes.</p>
              {meeting.data.data.agenda?.length ? <table><thead><tr><th>#</th><th>Considered referral</th></tr></thead><tbody>{meeting.data.data.agenda.map(item => <tr key={item.id}><td>{item.sequence}</td><td>{item.referral?.measure?.title ?? item.referralId}</td></tr>)}</tbody></table> : <Empty>No referrals on this agenda.</Empty>}
              {session.permissions.includes('committee.meeting.manage') && meeting.data.data.state === 'SCHEDULED' && (
                <AddPanel label="Add referred measure">
                  <CommandForm key={meeting.data.data.revision} title="Add agenda item" path={`/meetings/${activeMeeting}/referrals`} csrf={session.csrfToken} fields={[{name:'referralId', label:'Referral', options:(referrals.data?.items ?? []).filter(item => !(meeting.data.data.agenda ?? []).some(row => row.referralId === item.id)).map(item => ({value:item.id, label:item.measure?.title ?? item.id}))}]} fixed={{expectedRevision:meeting.data.data.revision}} submitLabel="Add to agenda"/>
                </AddPanel>
              )}
              {session.permissions.includes('committee.meeting.close') && meeting.data.data.state === 'SCHEDULED' && <AddPanel label="Close meeting"><CommandForm title="Close meeting" path={`/meetings/${activeMeeting}/close`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:meeting.data.data.revision}} submitLabel="Close meeting"/></AddPanel>}
              {session.permissions.includes('document.upload') && <AddPanel label="Upload meeting file"><CaseUpload session={session} ownerType="MEETING" ownerId={activeMeeting}/></AddPanel>}
              <DocumentTable items={meetingDocs.data?.items ?? []} session={session}/>
            </div>
          )}
        </>
      )}
      {tab === 'documents' && (
        <>
          {session.permissions.includes('document.upload') && <AddPanel label="Upload committee file"><CaseUpload session={session} ownerType="COMMITTEE" ownerId={id}/></AddPanel>}
          {documents.isError ? <Notice error={documents.error}/> : <DocumentTable items={documents.data?.items ?? []} session={session} empty="No committee documents yet. Uploads remain quarantined."/>}
        </>
      )}
    </aside>
  );
  return (
    <div ref={frame} className={expanded ? 'case-fullscreen' : undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-labelledby={expanded ? titleId : undefined}>
      {panel}
    </div>
  );
}

function CommitteesPage({session, highlightId}:{session:SessionView; highlightId?:string}) {
  const [selected, setSelected] = useState<string | null>(highlightId ?? null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => { setSelected(highlightId ?? null); }, [highlightId]);
  const canView = session.permissions.includes('committee.view');
  const canEdit = session.permissions.includes('committee.manage');
  const terms = useQuery({queryKey:['/admin/terms','options'], queryFn:() => request<Page<Term>>('/admin/terms?limit=100'), enabled:canEdit});
  const list = useQuery({queryKey:['/committees','table'], queryFn:() => request<Page<Committee>>('/committees?page=1&limit=100'), enabled:canView});
  const items = (list.data?.items ?? []).filter(item => {
    const chair = item.members?.find(member => member.role === 'CHAIR')?.person?.displayName ?? '';
    return `${item.name} ${item.code} ${chair}`.toLowerCase().includes(query.toLowerCase());
  });
  const active = selected && items.some(item => item.id === selected) ? selected : items[0]?.id ?? null;
  return (
    <div className="split">
      <div>
        <div className="page-heading">
          <div><h1>Committees</h1><p>Manage standing and special committees of the Sangguniang Bayan.</p></div>
          {canEdit && <button className="primary" onClick={() => setCreating(true)}><Plus size={16}/>Create Committee</button>}
        </div>
        {creating && (
          <Modal open title="New committee" onClose={() => setCreating(false)}>
            <CommandForm hideTitle title="New committee" path="/committees" csrf={session.csrfToken} onDone={() => setCreating(false)} fields={[{name:'name', label:'Committee name'},{name:'code', label:'Code (uppercase letters, numbers, hyphens)'},{name:'termId', label:'Council term', options:terms.data?.items.map(term => ({value:term.id, label:term.label})) ?? []}]} submitLabel="Create committee"/>
          </Modal>
        )}
        <div className="chip-row"><button className="chip active" type="button">All Committees <b>{list.data?.pageInfo.total ?? (list.isPending ? '—' : 0)}</b></button></div>
        <div className="filters"><div className="search-field"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search committee name, chairperson, or keyword…"/><Search size={16}/></div></div>
        {terms.isError && canEdit && <Notice error={terms.error}/>}
        {!canView ? <Empty>This account cannot list committees. The roster requires a live SEC, AUD, or CS grant.</Empty> : list.isPending ? <p role="status">Loading records…</p> : list.isError ? <Notice error={list.error}/> : <div className="panel">{items.length ? (
          <table><thead><tr><th>#</th><th>Committee Name</th><th>Chairperson</th><th>Members</th><th>Term standing</th></tr></thead><tbody>{items.map((item, index) => {
            const chair = item.members?.find(member => member.role === 'CHAIR')?.person;
            return (
            <tr key={item.id} className={item.id === active ? 'selected' : ''} tabIndex={0} aria-label={item.name} onClick={() => setSelected(item.id)} onKeyDown={event => activateRow(event, () => setSelected(item.id))}>
              <td className="idx">{index + 1}</td>
              <td><span className="row-accent" style={{background:accents[index % accents.length], marginRight:8, verticalAlign:'middle'}}/><strong className="name-link">{item.name}</strong><small>{item.code}</small></td>
              <td>{chair ? <span className="cell-person"><Face name={chair.displayName} person={chair}/>{chair.displayName}</span> : <span className="muted">Not assigned</span>}</td>
              <td>{item.members?.length ?? '—'}</td>
              <td><Status value={termStanding(item.term)}/></td>
            </tr>
            );
          })}</tbody></table>
        ) : <Empty>No committees to display.</Empty>}{items.length > 0 && <div className="pagination"><span>Showing {items.length} of {list.data?.pageInfo.total ?? 0} committees</span></div>}</div>}
      </div>
      {canView && active ? <CommitteeDetail id={active} session={session}/> : <aside className="panel"><Empty>{canView ? 'Select a committee to review its roster.' : 'Committee roster is not on this account.'}</Empty></aside>}
    </div>
  );
}

function UsersPage({session}:{session:SessionView}) {
  const [tab, setTab] = useState<UsersTab>(session.permissions.includes('user.view') ? 'accounts' : 'access');
  return <>
    <div className="tabs">
      {session.permissions.includes('user.view') && <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Accounts</button>}
      {session.permissions.includes('role.assign') && <button className={tab === 'access' ? 'active' : ''} onClick={() => setTab('access')}>Access review</button>}
    </div>
    {tab === 'accounts' && session.permissions.includes('user.view') && <Accounts session={session}/>}
    {tab === 'access' && session.permissions.includes('role.assign') && <AccessPage session={session}/>}
  </>;
}

function Accounts({session}:{session:SessionView}) {
  return <>
    <p className="muted" style={{marginBottom:12}}>Link an existing Keycloak identity. Credentials remain with the identity service.</p>
    {session.permissions.includes('user.manage') && <AddPanel label="Link user account"><CommandForm title="Link identity" path="/admin/users" csrf={session.csrfToken} fields={[{name:'displayName', label:'Display name'},{name:'subject', label:'Keycloak user ID (subject)'}]}/></AddPanel>}
    <div className="panel"><Listing<User> path="/admin/users">{items => <table><thead><tr><th>User</th><th>Status</th><th>Access action</th></tr></thead><tbody>{items.map(user => <tr key={user.id}><td><strong>{user.displayName}</strong><small className="mono">{user.subject}</small></td><td><Status value={user.enabled ? 'Active' : 'Disabled'}/></td><td>{user.id !== session.user.id && session.permissions.includes('user.manage') ? <AddPanel label={user.enabled ? 'Disable account' : 'Enable account'}><CommandForm title={`${user.enabled ? 'Disable' : 'Enable'} ${user.displayName}`} path={`/admin/users/${user.id}/state`} method="PATCH" csrf={session.csrfToken} fields={[]} fixed={{enabled:!user.enabled, expectedRevision:user.revision}}/></AddPanel> : <span className="muted">Your account</span>}</td></tr>)}</tbody></table>}</Listing></div>
  </>;
}

function AccessPage({session}:{session:SessionView}) {
  const users = useQuery({queryKey:['/admin/users','options'], queryFn:() => request<Page<User>>('/admin/users?limit=100')});
  const [role, setRole] = useState('SEC');
  const committees = useQuery({queryKey:['/admin/grant-committees'], queryFn:() => request<{items:Array<{id:string; name:string; code:string; termLabel:string}>}>('/admin/grant-committees'), enabled:role === 'CS'});
  return <>
    <div className="notice"><ShieldCheck size={20}/><span>Access grants require two administrators. Requester, reviewer, and recipient must be different people.</span></div>
    <AddPanel label="Request access grant">
      <label className="role-select">Role<select value={role} onChange={event => setRole(event.target.value)}>{['SYS','SEC','AUD','CS','LS'].map(item => <option key={item}>{item}</option>)}</select></label>
      {users.isError ? <Notice error={users.error}/> : committees.isError ? <Notice error={committees.error}/> : <CommandForm key={role} title="Access request" path="/admin/grant-requests" csrf={session.csrfToken} fixed={{role, scopeType:role === 'CS' ? 'COMMITTEE' : 'MUNICIPALITY', ...(role !== 'CS' ? {scopeId:session.user.municipalityId} : {})}} transform={body => ({...body, validFrom:new Date(String(body['validFrom'])).toISOString(), validUntil:new Date(String(body['validUntil'])).toISOString()})} fields={[{name:'userId', label:'Recipient', options:users.data?.items.filter(user => user.enabled && user.id !== session.user.id).map(user => ({value:user.id, label:user.displayName})) ?? []}, ...(role === 'CS' ? [{name:'scopeId', label:'Committee', options:(committees.data?.items ?? []).map(item => ({value:item.id, label:`${item.name} · ${item.termLabel}`}))}] : []), {name:'validFrom', label:'Valid from (your local time)', type:'datetime-local'}, {name:'validUntil', label:'Expires (your local time)', type:'datetime-local'}]}/>}
    </AddPanel>
    <div className="panel" style={{marginBottom:16}}>
      <h2 style={{fontSize:16, marginBottom:12}}>Grant requests</h2>
      <Listing<GrantRequest> path="/admin/grant-requests">{items => <table><thead><tr><th>Recipient / role</th><th>Scope</th><th>Status</th><th>Review</th></tr></thead><tbody>{items.map(grant => <tr key={grant.id}><td><strong>{users.data?.items.find(user => user.id === grant.userId)?.displayName ?? grant.userId}</strong><small>{grant.role} · Until {shortDate(grant.validUntil)}</small></td><td>{grant.scopeType.toLowerCase()}<small className="mono">{grant.scopeId}</small></td><td><Status value={grant.state}/></td><td>{grant.state === 'PENDING' && grant.requestedBy !== session.user.id && grant.userId !== session.user.id ? <><AddPanel label="Approve"><CommandForm title="Approve grant" path={`/admin/grant-requests/${grant.id}/approve`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:grant.revision}}/></AddPanel><AddPanel label="Reject"><CommandForm title="Reject grant" path={`/admin/grant-requests/${grant.id}/reject`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:grant.revision}}/></AddPanel></> : <span className="muted">{grant.state === 'PENDING' ? 'Awaiting independent review' : 'Review complete'}</span>}</td></tr>)}</tbody></table>}</Listing>
    </div>
    <div className="panel">
      <h2 style={{fontSize:16, marginBottom:12}}>Assigned grants</h2>
      <Listing<Grant> path="/admin/grants">{items => <table><thead><tr><th>Recipient</th><th>Role / scope</th><th>Valid until</th><th>Action</th></tr></thead><tbody>{items.map(grant => <tr key={grant.id}><td>{users.data?.items.find(user => user.id === grant.userId)?.displayName ?? grant.userId}</td><td>{grant.role}<small>{grant.scopeType.toLowerCase()}</small></td><td>{shortDate(grant.validUntil)}</td><td>{grant.revokedAt ? <Status value="REVOKED"/> : grant.userId !== session.user.id ? <AddPanel label="Revoke"><CommandForm title="Revoke access immediately" path={`/admin/grants/${grant.id}/revoke`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:grant.revision}}/></AddPanel> : <span className="muted">Your grant</span>}</td></tr>)}</tbody></table>}</Listing>
    </div>
  </>;
}

function AuditPage() {
  return (
    <div className="panel">
      <p className="muted" style={{marginBottom:12}}>Attributable changes, preserved in sequence. Audit records cannot be edited here.</p>
      <Listing<AuditEvent> path="/audit">{items => (
        <ul className="audit-list">
          {items.map(event => (
            <li key={event.id}>
              <div className="audit-row">
                <span className="mono">#{event.sequence}</span>
                <div>
                  <strong>{event.action}</strong>
                  <small>{event.actorName}</small>
                </div>
                <time dateTime={event.recordedAt}>
                  {new Date(event.recordedAt).toLocaleString('en-PH', {timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short'})}
                  <small>Asia/Manila</small>
                </time>
              </div>
              <details>
                <summary>View evidence</summary>
                <pre>{JSON.stringify({entityId:event.entityId, payload:event.payload, hash:event.hash, previousHash:event.previousHash}, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}</Listing>
    </div>
  );
}

function SettingsPage({session, initialTab}:{session:SessionView; initialTab?:SettingsTab}) {
  const tabs:Array<{id:SettingsTab;label:string;permission:Permission}> = [
    {id:'municipality', label:'Municipality', permission:'municipality.view'},
    {id:'terms', label:'Council terms', permission:'term.view'},
    {id:'people', label:'People', permission:'person.view'},
    {id:'audit', label:'Audit trail', permission:'audit.view'},
  ];
  const allowed = tabs.filter(tab => session.permissions.includes(tab.permission));
  const [tab, setTab] = useState<SettingsTab>(initialTab && allowed.some(item => item.id === initialTab) ? initialTab : allowed[0]?.id ?? 'municipality');
  useEffect(() => {
    const next = initialTab && allowed.some(item => item.id === initialTab) ? initialTab : allowed[0]?.id ?? 'municipality';
    setTab(next);
  }, [initialTab]);
  const active = allowed.some(item => item.id === tab) ? tab : allowed[0]?.id;
  return <>
    <div className="tabs">{allowed.map(item => <button key={item.id} className={item.id === active ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {active === 'municipality' && <MunicipalityPage session={session}/>}
    {active === 'terms' && <TermsPage session={session}/>}
    {active === 'people' && <PeoplePage session={session} embedded/>}
    {active === 'audit' && <AuditPage/>}
  </>;
}

function allowedMime(file:File):string | null {
  const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/tiff'];
  if (allowed.includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'image/tiff';
  return null;
}

function DocumentRetrieve({doc, session}:{doc:DocumentRecord; session:SessionView}) {
  const [error, setError] = useState<unknown>(null);
  if (!doc.currentReadyVersionId) return <span className="muted">Held in quarantine. An approved scanner has not marked this file ready (D-13).</span>;
  if (!session.permissions.includes('document.download')) return <span className="muted">Ready. Download is not on this account.</span>;
  return (
    <>
      <button type="button" className="ghost" onClick={() => {setError(null); void downloadDocument(`/documents/${doc.id}/download`, doc.title).catch(setError);}}>Download</button>
      {error != null && <Notice error={error}/>}
    </>
  );
}
function DocumentTable({items, session, empty, owner}:{items:DocumentRecord[]; session:SessionView; empty?:string; owner?:boolean}) {
  if (!items.length) return empty ? <Empty>{empty}</Empty> : null;
  return (
    <table>
      <thead><tr><th>File</th>{owner && <th>Owner</th>}<th>State</th><th>Retrieve</th></tr></thead>
      <tbody>{items.map(doc => (
        <tr key={doc.id}>
          <td><strong>{doc.title}</strong></td>
          {owner && <td><Status value={doc.ownerType ?? 'UNKNOWN'}/></td>}
          <td><Status value={doc.latestState}/></td>
          <td><DocumentRetrieve doc={doc} session={session}/></td>
        </tr>
      ))}</tbody>
    </table>
  );
}
function CaseUpload({session, ownerType, ownerId}:{session:SessionView; ownerType:'MEASURE'|'COMMITTEE'|'MEETING'|'SESSION'; ownerId:string}) {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState('Uploading case file');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0];
    const reason = String(new FormData(form).get('reason') ?? '');
    if (!file) return;
    const declaredMime = allowedMime(file);
    if (!declaredMime) {setError(new Error('Use PDF, DOCX, JPEG, PNG, or TIFF.')); return;}
    setPending(true); setError(null);
    try {
      const intent = await request<{data:{id:string}}>('/documents/intents', {method:'POST', csrf:session.csrfToken, key:crypto.randomUUID(), body:{ownerType, ownerId, originalFilename:file.name, declaredMime, expectedBytes:file.size, reason}});
      await uploadBytes(`/documents/intents/${intent.data.id}/content`, file, session.csrfToken);
      await request(`/documents/intents/${intent.data.id}/finalize`, {method:'POST', csrf:session.csrfToken, key:crypto.randomUUID(), body:{reason}});
      form.reset();
      await cache.invalidateQueries();
    } catch (err) {setError(err);}
    finally {setPending(false);}
  }
  return (
    <form className="command-form" onSubmit={submit} onChange={event => {const file = new FormData(event.currentTarget).get('file'); setSuggestion(file instanceof File && file.name ? `Uploading ${file.name}` : 'Uploading case file');}}>
      <h3>Attach a case file</h3>
      <p className="muted">The file is stored in quarantine. Download appears only after an approved scanner marks it ready (D-13). Proposed cap 25 MiB.</p>
      <label>File<input required name="file" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/jpeg,image/png,image/tiff"/></label>
      <ReasonField suggestion={suggestion}/>
      {error != null && <Notice error={error}/>}
      <button className="primary" disabled={pending}>{pending ? 'Uploading…' : 'Upload to quarantine'}<ArrowRight size={16}/></button>
    </form>
  );
}

function todayManila() {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
}
function ReferForm({session, measureId, revision, termId, onDone}:{session:SessionView; measureId:string; revision:number; termId:string; onDone?:()=>void}) {
  const cache = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const retry = useRef<{body:string;key:string}|null>(null);
  const [lead, setLead] = useState('');
  const [joints, setJoints] = useState<string[]>([]);
  const [referredOn, setReferredOn] = useState(todayManila);
  const [dueOn, setDueOn] = useState('');
  const committees = useQuery({queryKey:['/committees','refer'], queryFn:() => request<Page<Committee>>('/committees?page=1&limit=100')});
  const options = (committees.data?.items ?? []).filter(item => item.termId === termId);
  const mutation = useMutation({mutationFn:(body:Record<string,unknown>) => {
    const serialized = JSON.stringify(body);
    if (retry.current?.body !== serialized) retry.current = {body:serialized, key:crypto.randomUUID()};
    return request(`/measures/${measureId}/referrals`, {method:'POST', body, csrf:session.csrfToken, key:retry.current.key});
  }, onSuccess:() => {retry.current = null; form.current?.reset(); void cache.invalidateQueries(); onDone?.();}});
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({
      leadCommitteeId:lead,
      jointCommitteeIds:joints.filter(item => item !== lead),
      referredOn,
      ...(dueOn ? {dueOn} : {}),
      expectedRevision:revision,
      reason:String(new FormData(event.currentTarget).get('reason') ?? ''),
    });
  }
  return (
    <form ref={form} className="command-form" onSubmit={submit}>
      {committees.isError && <Notice error={committees.error}/>}
      <div className="form-grid">
        <label>Lead committee
          <select required value={lead} onChange={event => {setLead(event.target.value); setJoints(values => values.filter(item => item !== event.target.value));}}>
            <option value="" disabled>Select…</option>
            {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Referred on<input required type="date" value={referredOn} onChange={event => setReferredOn(event.target.value)}/></label>
        <label>Due date<input type="date" value={dueOn} onChange={event => setDueOn(event.target.value)}/></label>
      </div>
      <fieldset className="choice-list">
        <legend>Joint committees</legend>
        {options.filter(item => item.id !== lead).map(item => (
          <label key={item.id}><input type="checkbox" checked={joints.includes(item.id)} onChange={event => setJoints(values => event.target.checked ? [...values, item.id] : values.filter(id => id !== item.id))}/>{item.name}</label>
        ))}
        {!options.filter(item => item.id !== lead).length && <p className="muted">No other committees in this council term.</p>}
      </fieldset>
      <p className="later">This records a secretariat assignment. It is not a session reading or committee report.</p>
      <ReasonField suggestion={options.find(item => item.id === lead) ? `Referring measure to ${options.find(item => item.id === lead)?.name}` : 'Referring measure to a committee'}/>
      {mutation.isError && <Notice error={mutation.error}/>}
      {mutation.isSuccess && <p className="success" role="status"><Check size={16}/> Change saved and recorded.</p>}
      <button className="primary" disabled={mutation.isPending || !lead}>{mutation.isPending ? 'Saving…' : 'Record referral'}<ArrowRight size={16}/></button>
    </form>
  );
}
function MeasureDetail({id, session}:{id:string; session:SessionView}) {
  const [tab, setTab] = useState<'overview' | 'versions' | 'timeline' | 'documents' | 'tasks' | 'referrals'>('overview');
  const [expanded, setExpanded] = useState(false);
  const [referring, setReferring] = useState(false);
  const titleId = useId();
  const query = useQuery({queryKey:['/measures', id], queryFn:() => request<{data:Measure & {versions?:Array<{id:string;sequence:number;synopsis:string;frozenAt:string|null}>;authors?:Array<{personId:string;role:string;displayName:string}>}}>(`/measures/${id}`)});
  const timeline = useQuery({queryKey:['/measures', id, 'timeline'], queryFn:() => request<{items:TimelineEvent[]}>(`/measures/${id}/timeline`), enabled:tab === 'timeline'});
  const documents = useQuery({queryKey:['/measures', id, 'documents'], queryFn:() => request<{items:DocumentRecord[]}>(`/measures/${id}/documents`), enabled:tab === 'documents'});
  const tasks = useQuery({queryKey:['/tasks', id], queryFn:() => request<Page<WorkTask>>('/tasks?page=1&limit=50'), enabled:tab === 'tasks' && session.permissions.includes('task.manage')});
  const referrals = useQuery({queryKey:['/measures', id, 'referrals'], queryFn:() => request<{items:Referral[]}>(`/measures/${id}/referrals`), enabled:(tab === 'referrals' || tab === 'overview') && session.permissions.includes('committee.referral.view')});
  const frame = useRef<HTMLDivElement>(null);
  useDialogKeys(expanded, frame, () => setExpanded(false));
  useEffect(() => { setExpanded(false); setReferring(false); }, [id]);
  if (query.isError) return <Notice error={query.error}/>;
  if (!query.data) return <p>Loading case file…</p>;
  const measure = query.data.data;
  const canDraft = session.permissions.includes('measure.edit') && measure.stage === 'DRAFT';
  const canSubmit = session.permissions.includes('measure.submit') && (measure.stage === 'DRAFT' || measure.stage === 'SUBMITTED');
  const canReturn = session.permissions.includes('measure.edit') && measure.stage === 'SUBMITTED';
  const openReferral = (referrals.data?.items ?? []).some(item => item.disposition === 'OPEN');
  const panel = (
    <aside className={`panel detail-panel${expanded ? ' detail-panel-full' : ''}`} {...(expanded ? {'aria-labelledby': titleId} : {})}>
      <div className="detail-head">
        <div>
          <span className="kicker"><FileText size={14}/> {measure.typeCode.toLowerCase()} case file</span>
          <h2 id={titleId}>{measure.title}</h2>
          <p className="muted">{measure.subject}</p>
        </div>
        <div className="detail-actions">
          <Status value={measure.stage}/>
          <button className="ghost" onClick={() => setExpanded(value => !value)}>
            {expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
            {expanded ? 'Exit full screen' : 'View full screen'}
          </button>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'versions' ? 'active' : ''} onClick={() => setTab('versions')}>Versions</button>
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button>
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
        <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>Tasks</button>
        {session.permissions.includes('committee.referral.view') && <button className={tab === 'referrals' ? 'active' : ''} onClick={() => setTab('referrals')}>Referrals</button>}
        <button disabled title="Readings arrive in a later phase">Readings</button>
      </div>
      {tab === 'overview' && (
        <>
          <dl className="facts">
            <div><dt>Classification</dt><dd>{measure.classification}</dd></div>
            <div><dt>Official number</dt><dd>{measure.officialNumber != null ? `${measure.officialSeries} ${measure.officialYear}-${measure.officialNumber}` : 'Not assigned (D-04)'}</dd></div>
            <div><dt>Revision</dt><dd>{measure.revision}</dd></div>
          </dl>
          <h3>Authors</h3>
          {measure.authors?.length ? <table><thead><tr><th>Person</th><th>Role</th></tr></thead><tbody>{measure.authors.map(author => <tr key={`${author.personId}-${author.role}`}><td>{author.displayName}</td><td><Status value={author.role}/></td></tr>)}</tbody></table> : <Empty>No authors recorded.</Empty>}
          {canDraft && <AddPanel label="Edit title and subject"><CommandForm key={measure.revision} title="Update draft metadata" path={`/measures/${id}`} method="PATCH" csrf={session.csrfToken} fixed={{expectedRevision:measure.revision}} fields={[{name:'title', label:'Title', defaultValue:measure.title, maxLength:240},{name:'subject', label:'Subject', defaultValue:measure.subject, maxLength:500}]}/></AddPanel>}
          {measure.stage === 'DRAFT' && session.permissions.includes('measure.submit') && <AddPanel label="Submit for secretariat review"><CommandForm title="Submit draft" path={`/measures/${id}/submit`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:measure.revision}} submitLabel="Submit draft"/></AddPanel>}
          {canReturn && <AddPanel label="Return to draft"><CommandForm title="Return submitted draft" path={`/measures/${id}/return`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:measure.revision}} submitLabel="Return to draft"/></AddPanel>}
          {canSubmit && openReferral && <p className="later">Close every open referral before withdrawing this case file.</p>}
          {canSubmit && !openReferral && <AddPanel label="Withdraw"><CommandForm title="Withdraw this case file" path={`/measures/${id}/withdraw`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:measure.revision}} submitLabel="Withdraw"/></AddPanel>}
          <p className="later">Official numbering and certification stay closed until D-04 and designated officers (Q7) are recorded.</p>
        </>
      )}
      {tab === 'versions' && (
        <>
          {session.permissions.includes('measure.version.create') && measure.stage !== 'WITHDRAWN' && <AddPanel label="Add text version"><CommandForm key={measure.revision} title="New synopsis version" path={`/measures/${id}/versions`} csrf={session.csrfToken} fixed={{expectedRevision:measure.revision}} fields={[{name:'synopsis', label:'Synopsis', type:'textarea', maxLength:8000}]}/></AddPanel>}
          {measure.versions?.length ? <table><thead><tr><th>#</th><th>Synopsis</th><th>Frozen</th></tr></thead><tbody>{measure.versions.map(version => <tr key={version.id}><td>{version.sequence}</td><td>{version.synopsis}</td><td>{version.frozenAt ? shortDate(version.frozenAt) : 'Open'}</td></tr>)}</tbody></table> : <Empty>No versions.</Empty>}
        </>
      )}
      {tab === 'timeline' && (timeline.isError ? <Notice error={timeline.error}/> : timeline.data?.items.length ? <table><thead><tr><th>#</th><th>Change</th><th>Reason</th></tr></thead><tbody>{timeline.data.items.map(item => <tr key={item.id}><td>{item.sequence}</td><td>{item.fromStage ?? '—'} → {item.toStage}<small>{shortDate(item.recordedAt)}</small></td><td>{item.reason}</td></tr>)}</tbody></table> : <Empty>No timeline events.</Empty>)}
      {tab === 'documents' && (
        <>
          {session.permissions.includes('document.upload') && <AddPanel label="Upload supporting file"><CaseUpload session={session} ownerType="MEASURE" ownerId={id}/></AddPanel>}
          {documents.isError ? <Notice error={documents.error}/> : <DocumentTable items={documents.data?.items ?? []} session={session} empty="No case documents yet. Uploads remain quarantined."/>}
        </>
      )}
      {tab === 'tasks' && (session.permissions.includes('task.manage') ? (
        tasks.isError ? <Notice error={tasks.error}/> : (tasks.data?.items.filter(item => item.ownerId === id || item.measureId === id).length ? <table><thead><tr><th>Task</th><th>State</th><th>Action</th></tr></thead><tbody>{tasks.data.items.filter(item => item.ownerId === id || item.measureId === id).map(task => <tr key={task.id}><td>{task.title}<small>Completing this does not file the measure.</small></td><td><Status value={task.state}/></td><td>{task.state === 'OPEN' ? <AddPanel label="Complete"><CommandForm title="Complete task" path={`/tasks/${task.id}/complete`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:task.revision}}/></AddPanel> : <span className="muted">Done</span>}</td></tr>)}</tbody></table> : <Empty>No tasks for this case file.</Empty>)
      ) : <p className="later">Task access is not on this account.</p>)}
      {tab === 'referrals' && (
        <>
          {session.permissions.includes('committee.referral.create') && measure.stage !== 'WITHDRAWN' && <button className="primary" type="button" onClick={() => setReferring(true)}>Record referral</button>}
          {referring && (
            <Modal open title="Record committee referral" onClose={() => setReferring(false)}>
              <ReferForm session={session} measureId={id} revision={measure.revision} termId={measure.termId} onDone={() => setReferring(false)}/>
            </Modal>
          )}
          {referrals.isError ? <Notice error={referrals.error}/> : referrals.data?.items.length ? (
            <table><thead><tr><th>Committee</th><th>Role</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{referrals.data.items.map(item => (
              <tr key={item.id}>
                <td><strong>{item.committee?.name ?? item.committeeId}</strong><small>Bound to the version current at referral</small></td>
                <td><Status value={item.role}/></td>
                <td>{item.dueOn ? shortDate(item.dueOn) : '—'}</td>
                <td><Status value={item.disposition}/></td>
                <td>{session.permissions.includes('committee.referral.close') && item.disposition === 'OPEN' ? <AddPanel label="Close"><CommandForm title="Close referral" path={`/referrals/${item.id}/close`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:item.revision}} submitLabel="Close referral"/></AddPanel> : <span className="muted">{item.disposition === 'CLOSED' ? 'Closed' : '—'}</span>}</td>
              </tr>
            ))}</tbody></table>
          ) : <Empty>No committee referrals recorded. This is not a session reading.</Empty>}
        </>
      )}
    </aside>
  );
  return (
    <div ref={frame} className={expanded ? 'case-fullscreen' : undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-labelledby={expanded ? titleId : undefined}>
      {panel}
    </div>
  );
}

function DraftMeasureForm({session, onDone}:{session:SessionView; onDone:()=>void}) {
  const cache = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const retry = useRef<{body:string; key:string}|null>(null);
  const [termId, setTermId] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState('Creating new draft');
  const terms = useQuery({queryKey:['/admin/terms','draft'], queryFn:() => request<Page<Term>>('/admin/terms?limit=100'), enabled:session.permissions.includes('term.view')});
  const people = useQuery({queryKey:['/admin/persons','draft', termId], queryFn:() => request<Page<Person>>(`/admin/persons?limit=100&termId=${termId}`), enabled:Boolean(termId) && session.permissions.includes('person.view')});
  const roster = people.data?.items ?? [];
  const mutation = useMutation({mutationFn:(body:Record<string,unknown>) => {
    const serialized = JSON.stringify(body);
    if (retry.current?.body !== serialized) retry.current = {body:serialized, key:crypto.randomUUID()};
    return request('/measures', {method:'POST', body, csrf:session.csrfToken, key:retry.current.key});
  }, onSuccess:() => {retry.current = null; void cache.invalidateQueries(); onDone();}});
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const authorId = String(data.get('authorId') ?? '');
    const coauthors = extras.map(id => ({personId:String(data.get(`person-${id}`) ?? ''), role:String(data.get(`role-${id}`) ?? 'CO_AUTHOR')}));
    const ids = [authorId, ...coauthors.map(row => row.personId)];
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
      setFormError('Each person can be listed once. Choose a different co-author.');
      return;
    }
    setFormError(null);
    mutation.mutate({
      typeCode:data.get('typeCode'), termId, title:data.get('title'), subject:data.get('subject'), synopsis:data.get('synopsis'), reason:data.get('reason'),
      authors:[{personId:authorId, role:'AUTHOR', ordering:0}, ...coauthors.map((row, index) => ({personId:row.personId, role:row.role, ordering:index + 1}))],
    });
  }
  return (
    <form ref={form} className="command-form" onSubmit={submit} onChange={event => setSuggestion(reasonForAction('Create draft', event.currentTarget))}>
      <div className="form-grid">
        <label>Type<select required name="typeCode" defaultValue=""><option value="" disabled>Select…</option><option value="ORDINANCE">Ordinance</option><option value="RESOLUTION">Resolution</option></select></label>
        <label>Council term<select required name="termId" value={termId} onChange={event => {setTermId(event.target.value); setExtras([]); setFormError(null);}}><option value="" disabled>Select…</option>{terms.data?.items.map(term => <option key={term.id} value={term.id}>{term.label}</option>)}</select></label>
        <label>Title<input required name="title" maxLength={240}/></label>
        <label>Subject<input required name="subject" maxLength={500}/></label>
      </div>
      <label>Author<select required name="authorId" key={termId} defaultValue="" disabled={!termId}><option value="" disabled>{termId ? 'Select a council member…' : 'Select a council term first'}</option>{roster.map(person => <option key={person.id} value={person.id}>{person.displayName} · {personPositionLabel(person.positionCode)}</option>)}</select></label>
      <div className="section-h"><h3>Co-authors</h3><button type="button" className="ghost" disabled={!termId || extras.length >= 29} onClick={() => setExtras(rows => [...rows, crypto.randomUUID()])}><Plus size={16}/>Add co-author</button></div>
      <p className="muted">Add other members of this council term. Each person is listed once.</p>
      {extras.map((id, index) => (
        <div className="author-row" key={id}>
          <label>Co-author {index + 1}<select required name={`person-${id}`} defaultValue=""><option value="" disabled>Select a council member…</option>{roster.map(person => <option key={person.id} value={person.id}>{person.displayName} · {personPositionLabel(person.positionCode)}</option>)}</select></label>
          <label>Role<select name={`role-${id}`} defaultValue="CO_AUTHOR"><option value="CO_AUTHOR">Co-author</option><option value="SPONSOR">Sponsor</option></select></label>
          <button type="button" className="icon-button" aria-label={`Remove co-author ${index + 1}`} onClick={() => setExtras(rows => rows.filter(row => row !== id))}><X size={16}/></button>
        </div>
      ))}
      <label>Synopsis<textarea required name="synopsis" maxLength={8000} rows={5}/></label>
      <ReasonField suggestion={suggestion}/>
      {formError && <Notice error={new Error(formError)}/>}
      {mutation.isError && <Notice error={mutation.error}/>}
      {people.isError && <Notice error={people.error}/>}
      <button className="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Create draft'}<ArrowRight size={16}/></button>
    </form>
  );
}

function MeasuresPage({session, highlightId}:{session:SessionView; highlightId?:string}) {
  const [selected, setSelected] = useState<string | null>(highlightId ?? null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => { setSelected(highlightId ?? null); }, [highlightId]);
  const canView = session.permissions.includes('measure.view');
  const canCreate = session.permissions.includes('measure.create');
  const list = useQuery({queryKey:['/measures','table'], queryFn:() => request<Page<Measure>>('/measures?page=1&limit=100'), enabled:canView});
  const items = (list.data?.items ?? []).filter(item => `${item.title} ${item.subject} ${item.typeCode}`.toLowerCase().includes(query.toLowerCase()));
  const active = selected && items.some(item => item.id === selected) ? selected : items[0]?.id ?? null;
  return (
    <div className="split">
      <div>
        <div className="page-heading">
          <div><h1>Legislative Measures</h1><p>{canCreate ? 'Draft case files for ordinances and resolutions. Official numbering is not configured.' : 'Measures referred to your assigned committee. Unreferred drafts stay with the secretariat.'}</p></div>
          {canCreate && <button className="primary" onClick={() => setCreating(true)}><Plus size={16}/>Create draft</button>}
        </div>
        {creating && (
          <Modal open title="New draft measure" onClose={() => setCreating(false)}>
            <DraftMeasureForm session={session} onDone={() => setCreating(false)}/>
          </Modal>
        )}
        <div className="filters"><div className="search-field"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title or subject…"/><Search size={16}/></div></div>
        {!canView ? <Empty>This account cannot list legislative measures. Draft case files require a live LS, SEC, or AUD grant.</Empty> : list.isPending ? <p role="status">Loading records…</p> : list.isError ? <Notice error={list.error}/> : <div className="panel">{items.length ? (
          <table><thead><tr><th>#</th><th>Title</th><th>Type</th><th>Stage</th></tr></thead><tbody>{items.map((item, index) => (
            <tr key={item.id} className={item.id === active ? 'selected' : ''} tabIndex={0} aria-label={item.title} onClick={() => setSelected(item.id)} onKeyDown={event => activateRow(event, () => setSelected(item.id))}>
              <td className="idx">{index + 1}</td>
              <td><strong className="name-link">{item.title}</strong><small>{item.subject}</small></td>
              <td>{item.typeCode.toLowerCase()}</td>
              <td><Status value={item.stage}/></td>
            </tr>
          ))}</tbody></table>
        ) : <Empty>{canCreate ? 'No draft measures yet. Seed does not invent ordinances.' : 'No measures have been referred to this committee yet.'}</Empty>}</div>}
      </div>
      {active ? <MeasureDetail id={active} session={session}/> : <aside className="panel"><Empty>Select a case file to review it.</Empty></aside>}
    </div>
  );
}

function NoticesBell({session}:{session:SessionView}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const query = useQuery({queryKey:['/notifications'], queryFn:() => request<{items:NoticeItem[]}>('/notifications'), enabled:open && session.permissions.includes('notification.view')});
  useEffect(() => {
    if (!open) return;
    function onPointer(event:MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);
  if (!session.permissions.includes('notification.view')) return <button className="icon-button" aria-label="Notifications" disabled title="Notifications are not on this account"><Bell size={18}/></button>;
  return (
    <div className="search-wrap" ref={panel}>
      <button className="icon-button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen(value => !value)}><Bell size={18}/></button>
      {open && (
        <div className="search-results" role="region" aria-label="In-app notifications">
          {query.isPending ? <p className="search-hint">Loading notices…</p> : query.isError ? <Notice error={query.error}/> : query.data?.items.length ? query.data.items.map(item => (
            <div className="search-hit" key={item.id}><span className="hit-copy"><strong>{item.summary}</strong><small>{shortDate(item.createdAt)}</small></span></div>
          )) : <p className="search-empty">No in-app notifications.</p>}
        </div>
      )}
    </div>
  );
}

function SessionsPage({session}:{session:SessionView}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const canView = session.permissions.includes('session.view');
  const list = useQuery({queryKey:['/sessions'], queryFn:() => request<Page<LegislativeSession>>('/sessions?page=1&limit=50'), enabled:canView});
  const detail = useQuery({queryKey:['/sessions', selected], queryFn:() => request<{data:LegislativeSession}>(`/sessions/${selected}`), enabled:Boolean(selected) && canView});
  const terms = useQuery({queryKey:['/admin/terms','session'], queryFn:() => request<Page<Term>>('/admin/terms?limit=100'), enabled:session.permissions.includes('session.manage')});
  const measures = useQuery({queryKey:['/measures','session-agenda'], queryFn:() => request<Page<Measure>>('/measures?page=1&limit=100'), enabled:Boolean(selected) && session.permissions.includes('session.manage') && session.permissions.includes('measure.view')});
  const docs = useQuery({queryKey:['/sessions', selected, 'documents'], queryFn:() => request<{items:DocumentRecord[]}>(`/sessions/${selected}/documents`), enabled:Boolean(selected) && session.permissions.includes('document.view')});
  if (!canView) return <Empty>Session access is not on this account.</Empty>;
  const current = detail.data?.data;
  return (
    <div className="split">
      <div className="panel">
        <div className="page-heading">
          <div><h1>Sessions</h1><p>Secretariat-recorded sittings. Closing a session is not certified minutes.</p></div>
          {session.permissions.includes('session.manage') && <button className="primary" type="button" onClick={() => setScheduling(true)}>Schedule session</button>}
        </div>
        {scheduling && (
          <Modal open title="Schedule session" onClose={() => setScheduling(false)}>
            <CommandForm hideTitle title="Schedule session" path="/sessions" csrf={session.csrfToken} onDone={() => setScheduling(false)} transform={body => ({termId:body.termId, title:body.title, venue:body.venue, kind:body.kind, scheduledAt:new Date(String(body.scheduledAt)).toISOString(), measureIds:[], reason:body.reason})} fields={[{name:'termId', label:'Council term', options:terms.data?.items.map(term => ({value:term.id, label:term.label})) ?? []},{name:'title', label:'Title', maxLength:240},{name:'venue', label:'Venue', maxLength:160},{name:'kind', label:'Kind', options:[{value:'REGULAR', label:'Regular'},{value:'SPECIAL', label:'Special'}]},{name:'scheduledAt', label:'Scheduled at', type:'datetime-local'}]} submitLabel="Schedule session"/>
          </Modal>
        )}
        {list.isPending ? <p role="status">Loading records…</p> : list.isError ? <Notice error={list.error}/> : list.data?.items.length ? (
          <table><thead><tr><th>Reference</th><th>Title</th><th>When</th><th>Status</th></tr></thead><tbody>{list.data.items.map(item => (
            <tr key={item.id} className={item.id === selected ? 'selected' : ''} tabIndex={0} aria-label={item.title} onClick={() => setSelected(item.id)} onKeyDown={event => activateRow(event, () => setSelected(item.id))}>
              <td>{item.reference}</td><td><strong>{item.title}</strong><small>{item.venue}</small></td><td>{shortDate(item.scheduledAt)}</td><td><Status value={item.state}/></td>
            </tr>
          ))}</tbody></table>
        ) : <Empty>No sessions recorded yet.</Empty>}
      </div>
      {current && (
        <aside className="panel detail-panel">
          <h2>{current.reference} · {current.title}</h2>
          <p className="muted">{current.venue} · {shortDate(current.scheduledAt)}. Readings, quorum, and certified minutes are not in this slice.</p>
          <div className="tabs"><span className="badge blue">{current.kind.toLowerCase()}</span><Status value={current.state}/></div>
          {current.agenda?.length ? <table><thead><tr><th>#</th><th>Agenda measure</th></tr></thead><tbody>{current.agenda.map(item => <tr key={item.id}><td>{item.sequence}</td><td>{item.measure?.title ?? item.measureId}</td></tr>)}</tbody></table> : <Empty>No measures on this agenda.</Empty>}
          {session.permissions.includes('session.manage') && current.state === 'SCHEDULED' && (
            <AddPanel label="Add measure to agenda">
              <CommandForm key={current.revision} title="Add agenda item" path={`/sessions/${current.id}/agenda`} csrf={session.csrfToken} fields={[{name:'measureId', label:'Measure', options:(measures.data?.items ?? []).filter(item => !(current.agenda ?? []).some(row => row.measureId === item.id)).map(item => ({value:item.id, label:item.title}))}]} fixed={{expectedRevision:current.revision}} submitLabel="Add to agenda"/>
            </AddPanel>
          )}
          {session.permissions.includes('session.close') && current.state === 'SCHEDULED' && <AddPanel label="Close session"><CommandForm title="Close session" path={`/sessions/${current.id}/close`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:current.revision}} submitLabel="Close session"/></AddPanel>}
          {session.permissions.includes('document.upload') && <AddPanel label="Upload session file"><CaseUpload session={session} ownerType="SESSION" ownerId={current.id}/></AddPanel>}
          <DocumentTable items={docs.data?.items ?? []} session={session}/>
        </aside>
      )}
    </div>
  );
}

const CAL_WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function manilaNoon(year:number, month:number, day:number) { return new Date(Date.UTC(year, month - 1, day, 4, 0, 0)); }
function manilaYmd(value:string | Date) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(value)); }
function manilaDayKey(year:number, month:number, day:number) { return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }
function manilaWeekday(year:number, month:number, day:number) { return CAL_WEEKDAYS.indexOf(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Manila', weekday:'short'}).format(manilaNoon(year, month, day))); }
function daysInMonth(year:number, month:number) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function shiftMonth(year:number, month:number, delta:number) { const date = new Date(Date.UTC(year, month - 1 + delta, 1)); return {year:date.getUTCFullYear(), month:date.getUTCMonth() + 1}; }
function monthCells(year:number, month:number) {
  const lead = manilaWeekday(year, month, 1);
  const count = daysInMonth(year, month);
  const previous = shiftMonth(year, month, -1);
  const previousDays = daysInMonth(previous.year, previous.month);
  const cells:{year:number; month:number; day:number; key:string; outside:boolean}[] = [];
  for (let index = 0; index < lead; index += 1) {
    const day = previousDays - lead + index + 1;
    cells.push({...previous, day, key:manilaDayKey(previous.year, previous.month, day), outside:true});
  }
  for (let day = 1; day <= count; day += 1) cells.push({year, month, day, key:manilaDayKey(year, month, day), outside:false});
  const next = shiftMonth(year, month, 1);
  let day = 1;
  while (cells.length < 42) { cells.push({...next, day, key:manilaDayKey(next.year, next.month, day), outside:true}); day += 1; }
  return cells;
}
function CalendarPage({session}:{session:SessionView}) {
  const canSee = canAny(session.permissions, ['session.view','committee.meeting.view']);
  const today = manilaYmd(new Date());
  const [cursor, setCursor] = useState(() => { const [year, month] = today.split('-').map(Number); return {year:year!, month:month!}; });
  const [selected, setSelected] = useState(today);
  const query = useQuery({queryKey:['/calendar','month'], queryFn:async () => {
    const first = await request<Page<CalendarEvent>>('/calendar?page=1&limit=100');
    const items = [...first.items];
    const pages = Math.ceil(first.pageInfo.total / 100);
    for (let page = 2; page <= pages && page <= 10; page += 1) items.push(...(await request<Page<CalendarEvent>>(`/calendar?page=${page}&limit=100`)).items);
    return items;
  }, enabled:canSee});
  if (!canSee) return <Empty>Calendar access is not on this account.</Empty>;
  const cells = monthCells(cursor.year, cursor.month);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const item of query.data ?? []) {
    const key = manilaYmd(item.scheduledAt);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }
  for (const items of byDay.values()) items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
  const monthLabel = new Intl.DateTimeFormat('en-US', {month:'long', year:'numeric', timeZone:'Asia/Manila'}).format(manilaNoon(cursor.year, cursor.month, 1));
  const selectedLabel = new Intl.DateTimeFormat('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric', timeZone:'Asia/Manila'}).format(manilaNoon(...selected.split('-').map(Number) as [number, number, number]));
  const selectedEvents = byDay.get(selected) ?? [];
  function moveMonth(delta:number) {
    const next = shiftMonth(cursor.year, cursor.month, delta);
    setCursor(next);
    if (!monthCells(next.year, next.month).some(cell => cell.key === selected)) setSelected(manilaDayKey(next.year, next.month, 1));
  }
  function openDay(cell:{year:number; month:number; key:string}) { setCursor({year:cell.year, month:cell.month}); setSelected(cell.key); }
  return (
    <div className="panel">
      <p className="muted">Sessions and committee meetings on the Asia/Manila calendar. This is not an official calendar of hearings.</p>
      <div className="cal-toolbar">
        <h2>{monthLabel}</h2>
        <div className="cal-nav">
          <button className="ghost" type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={16}/></button>
          <button className="ghost" type="button" onClick={() => { const [year, month] = today.split('-').map(Number); setCursor({year:year!, month:month!}); setSelected(today); }}>Today</button>
          <button className="ghost" type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={16}/></button>
        </div>
      </div>
      {query.isError ? <Notice error={query.error}/> : <>
        <div className="cal-weekdays" aria-hidden="true">{CAL_WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
        <div className="cal-grid" role="grid" aria-label={monthLabel}>
          {cells.map(cell => {
            const events = byDay.get(cell.key) ?? [];
            return (
              <button key={cell.key} type="button" role="gridcell" className={`cal-day${cell.outside ? ' outside' : ''}${cell.key === today ? ' today' : ''}${cell.key === selected ? ' selected' : ''}${events.length ? ' has-events' : ''}`} aria-pressed={cell.key === selected} aria-label={`${cell.key}, ${events.length} scheduled`} onClick={() => openDay(cell)}>
                <span className="cal-num">{cell.day}</span>
                {events.slice(0, 2).map(item => <span key={`${item.kind}-${item.id}`} className={`cal-chip ${item.kind === 'SESSION' ? 'session' : 'meeting'}`}>{item.title}</span>)}
                {events.length > 2 && <span className="cal-more">+{events.length - 2} more</span>}
              </button>
            );
          })}
        </div>
        <section className="cal-agenda">
          <h3>{selectedLabel}</h3>
          {query.isPending ? <p role="status">Loading records…</p> : selectedEvents.length ? (
            <ul>{selectedEvents.map(item => (
              <li key={`${item.kind}-${item.id}`}>
                <span className={`cal-chip ${item.kind === 'SESSION' ? 'session' : 'meeting'}`}>{item.kind === 'SESSION' ? 'Session' : 'Meeting'}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{new Intl.DateTimeFormat('en-US', {hour:'numeric', minute:'2-digit', timeZone:'Asia/Manila'}).format(new Date(item.scheduledAt))} · {item.venue} · {item.ownerLabel}</small>
                </div>
                <Status value={item.state}/>
              </li>
            ))}</ul>
          ) : <p className="muted">Nothing is scheduled on this day.</p>}
        </section>
      </>}
    </div>
  );
}

function VotingPage({session}:{session:SessionView}) {
  const canView = canAny(session.permissions, ['session.view','vote.view']);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({queryKey:['/sessions','voting'], queryFn:() => request<Page<LegislativeSession>>('/sessions?page=1&limit=50'), enabled:canView});
  const detail = useQuery({queryKey:['/sessions', selected, 'voting'], queryFn:() => request<{data:LegislativeSession}>(`/sessions/${selected}`), enabled:Boolean(selected) && canView});
  const people = useQuery({queryKey:['/admin/persons','attendance', detail.data?.data.termId], queryFn:() => request<Page<Person>>(`/admin/persons?limit=100&termId=${detail.data?.data.termId}`), enabled:session.permissions.includes('attendance.record') && Boolean(detail.data?.data.termId)});
  if (!canView) return <Empty>Voting and attendance access is not on this account.</Empty>;
  const current = detail.data?.data;
  return (
    <div className="split">
      <div className="panel">
        <p className="muted">Secretary-entered roll-call records. Counts are not a certified result and do not pass or fail a measure. Attendance is not a quorum declaration.</p>
        {list.isPending ? <p role="status">Loading records…</p> : list.isError ? <Notice error={list.error}/> : list.data?.items.length ? (
          <table><thead><tr><th>Session</th><th>When</th><th>Status</th></tr></thead><tbody>{list.data.items.map(item => (
            <tr key={item.id} className={item.id === selected ? 'selected' : ''} tabIndex={0} aria-label={item.title} onClick={() => setSelected(item.id)} onKeyDown={event => activateRow(event, () => setSelected(item.id))}><td><strong>{item.reference}</strong><small>{item.title}</small></td><td>{shortDate(item.scheduledAt)}</td><td><Status value={item.state}/></td></tr>
          ))}</tbody></table>
        ) : <Empty>Schedule a session before recording attendance or a tally.</Empty>}
      </div>
      {current && (
        <aside className="panel detail-panel">
          <h2>{current.reference}</h2>
          <h3>Attendance</h3>
          {current.attendance?.length ? <table><thead><tr><th>Person</th><th>Disposition</th></tr></thead><tbody>{current.attendance.map(row => <tr key={row.id}><td>{row.person?.displayName ?? row.personId}</td><td><Status value={row.disposition}/></td></tr>)}</tbody></table> : <Empty>No attendance recorded.</Empty>}
          {session.permissions.includes('attendance.record') && current.state === 'SCHEDULED' && (
            <AddPanel label="Record attendance">
              <CommandForm key={`att-${current.revision}`} title="Attendance" path={`/sessions/${current.id}/attendance`} csrf={session.csrfToken} fields={[{name:'personId', label:'Person', options:people.data?.items.map(personOption) ?? []},{name:'disposition', label:'Disposition', options:[{value:'PRESENT', label:'Present'},{value:'ABSENT', label:'Absent'},{value:'EXCUSED', label:'Excused'}]}]} fixed={{expectedRevision:current.revision}} submitLabel="Save attendance"/>
            </AddPanel>
          )}
          <h3>Recorded tallies</h3>
          {current.votes?.length ? <table><thead><tr><th>Measure</th><th>Yes</th><th>No</th><th>Abstain</th><th>Result</th></tr></thead><tbody>{current.votes.map(row => <tr key={row.id}><td>{row.measure?.title ?? row.measureId}</td><td>{row.yesCount}</td><td>{row.noCount}</td><td>{row.abstainCount}</td><td><Status value={row.result}/></td></tr>)}</tbody></table> : <Empty>No tallies recorded.</Empty>}
          {session.permissions.includes('vote.record') && current.state === 'SCHEDULED' && (
            <AddPanel label="Record tally">
              <CommandForm key={`vote-${current.revision}`} title="Record tally" path={`/sessions/${current.id}/votes`} csrf={session.csrfToken} fields={[{name:'measureId', label:'Agenda measure', options:(current.agenda ?? []).map(item => ({value:item.measureId, label:item.measure?.title ?? item.measureId}))},{name:'yesCount', label:'Yes', type:'number'},{name:'noCount', label:'No', type:'number'},{name:'abstainCount', label:'Abstain', type:'number'}]} transform={body => ({...body, yesCount:Number(body.yesCount), noCount:Number(body.noCount), abstainCount:Number(body.abstainCount)})} fixed={{expectedRevision:current.revision}} submitLabel="Save tally"/>
            </AddPanel>
          )}
        </aside>
      )}
    </div>
  );
}

function DocumentsPage({session}:{session:SessionView}) {
  const canView = session.permissions.includes('document.view');
  const query = useQuery({queryKey:['/documents'], queryFn:() => request<Page<DocumentRecord>>('/documents?page=1&limit=100'), enabled:canView});
  if (!canView) return <Empty>Document access is not on this account.</Empty>;
  return (
    <div className="panel">
      <p className="muted">Files already attached to measures, committees, meetings, or sessions. Download appears only after an approved scanner marks a file ready (D-13). This is not the e-Library.</p>
      {query.isPending ? <p role="status">Loading records…</p> : query.isError ? <Notice error={query.error}/> : <DocumentTable items={query.data?.items ?? []} session={session} owner empty="No documents uploaded yet. Attach files from a measure, committee, meeting, or session."/>}
    </div>
  );
}

function ArchivePage({session}:{session:SessionView}) {
  const canView = session.permissions.includes('archive.view');
  const canEncode = session.permissions.includes('archive.encode');
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const terms = useQuery({queryKey:['/admin/terms','archive'], queryFn:() => request<Page<Term>>('/admin/terms?page=1&limit=100'), enabled:canView && session.permissions.includes('term.view')});
  const list = useQuery({queryKey:['/archives/ordinances', applied], queryFn:() => request<Page<HistoricalOrdinance> & {note:string}>(`/archives/ordinances?page=1&limit=50${applied ? `&q=${encodeURIComponent(applied)}` : ''}`), enabled:canView});
  const detail = useQuery({queryKey:['/archives/ordinances', selected], queryFn:() => request<{data:HistoricalOrdinanceDetail}>(`/archives/ordinances/${selected}`), enabled:canView && Boolean(selected)});
  if (!canView) return <Empty>Ordinance archive access is not on this account.</Empty>;
  const current = detail.data?.data;
  return (
    <div>
      <div className="page-heading section-actions">
        <div>
          <h1>Ordinance archive</h1>
          <p>Encode an ordinance from an earlier council term directly. This does not open a legislative measure, assign an official number, or certify the scan.</p>
        </div>
        {canEncode && <button className="primary" type="button" onClick={() => setCreating(true)}><Plus size={16}/>Encode ordinance</button>}
      </div>
      <form className="command-form" onSubmit={event => {event.preventDefault(); setApplied(q.trim());}}>
        <label>Search title, number, source, or ordinance text<input value={q} onChange={event => setQ(event.target.value)} placeholder="Keyword from the scan"/></label>
        <button className="primary" type="submit">Search archive<ArrowRight size={16}/></button>
      </form>
      <div className="split">
        <div className="panel">
          {list.isPending ? <p role="status">Loading records…</p> : list.isError ? <Notice error={list.error}/> : list.data?.items.length ? (
            <table><thead><tr><th>Ordinance</th><th>Term</th><th>Scan text</th></tr></thead><tbody>{list.data.items.map(item => (
              <tr key={item.id} className={item.id === selected ? 'selected' : ''} tabIndex={0} aria-label={item.title} onClick={() => setSelected(item.id)} onKeyDown={event => activateRow(event, () => setSelected(item.id))}>
                <td><strong>{item.title}</strong><small>{item.officialYear ?? 'Year not recorded'}{item.officialNumber ? ` · No. ${item.officialNumber}` : ''}</small>{item.snippet && <small>{item.snippet}</small>}</td>
                <td>{item.termLabel}</td>
                <td><Status value={item.extractState === 'NONE' ? 'NO SCAN' : item.extractState}/></td>
              </tr>
            ))}</tbody></table>
          ) : <Empty>{applied ? 'No encoded ordinance matches that keyword.' : 'No historical ordinances have been encoded.'}</Empty>}
        </div>
        {current && (
          <aside className="panel detail-panel">
            <h2>{current.title}</h2>
            <p className="muted">{current.termLabel}{current.officialYear ? ` · ${current.officialYear}` : ''}{current.officialNumber ? ` · No. ${current.officialNumber}` : ''}</p>
            <p>{current.sourceNote}</p>
            <div className="row-actions">
              {canEncode && <button className="ghost" type="button" onClick={() => setEditing(true)}>Edit record</button>}
              {canEncode && <button className="ghost" type="button" onClick={() => setScanning(true)}>{current.hasScan ? 'Replace scan' : 'Read scan'}</button>}
            </div>
            {current.hasScan && current.scanMime?.startsWith('image/') && <img className="scan-preview" alt="" src={`/api/v1/archives/ordinances/${current.id}/scan?v=${current.revision}`}/>}
            {current.hasScan && current.scanMime === 'application/pdf' && <p><a href={`/api/v1/archives/ordinances/${current.id}/scan`} target="_blank" rel="noreferrer">Open PDF</a></p>}
            <OrdinanceTextForm session={session} ordinance={current} canEncode={canEncode}/>
          </aside>
        )}
      </div>
      {creating && <Modal open title="Encode ordinance" onClose={() => setCreating(false)}><OrdinanceForm session={session} terms={terms.data?.items ?? []} submitLabel="Save ordinance" onDone={id => {setCreating(false); setSelected(id);}}/></Modal>}
      {editing && current && <Modal open title="Edit ordinance" onClose={() => setEditing(false)}><OrdinanceForm session={session} terms={terms.data?.items ?? []} record={current} submitLabel="Save ordinance" onDone={() => setEditing(false)}/></Modal>}
      {scanning && current && <Modal open title={current.hasScan ? 'Replace scan' : 'Read scan'} onClose={() => setScanning(false)}><OrdinanceScanForm session={session} ordinance={current} onDone={() => setScanning(false)}/></Modal>}
    </div>
  );
}
function OrdinanceForm({session, terms, record, submitLabel, onDone}:{session:SessionView; terms:Term[]; record?:HistoricalOrdinanceDetail; submitLabel:string; onDone:(id?:string)=>void}) {
  const cache = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const action = record ? 'Edit ordinance' : 'Encode ordinance';
  const [suggestion, setSuggestion] = useState(() => reasonForAction(action, null));
  useEffect(() => { if (form.current) setSuggestion(reasonForAction(action, form.current)); }, [action]);
  const mutation = useMutation({mutationFn:async (body:Record<string,unknown>) => {
    const path = record ? `/archives/ordinances/${record.id}` : '/archives/ordinances';
    return request<{data:HistoricalOrdinance}>(path, {method:record ? 'PATCH' : 'POST', body, csrf:session.csrfToken, key:crypto.randomUUID()});
  }, onSuccess:result => {void cache.invalidateQueries(); onDone(result.data.id);}});
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const year = String(raw['officialYear'] ?? '').trim();
    const number = String(raw['officialNumber'] ?? '').trim();
    mutation.mutate({
      ...(record ? {expectedRevision:record.revision} : {termId:raw['termId']}),
      title:raw['title'],
      officialYear:year ? Number(year) : null,
      officialNumber:number || null,
      sourceNote:raw['sourceNote'],
      reason:raw['reason'],
    });
  }
  return (
    <form ref={form} className="command-form" onSubmit={submit} onChange={event => setSuggestion(reasonForAction(action, event.currentTarget))}>
      <p className="muted">Record only what the paper shows. Leave the year or number blank when it is not on the copy. This does not create a draft measure.</p>
      <div className="form-grid">
        {!record && <label>Council term<select required name="termId" defaultValue=""><option value="" disabled>Select…</option>{terms.map(term => <option key={term.id} value={term.id}>{term.label}</option>)}</select></label>}
        <label>Title<input required name="title" maxLength={240} defaultValue={record?.title}/></label>
        <label>Year on the ordinance<input name="officialYear" inputMode="numeric" maxLength={4} defaultValue={record?.officialYear ?? ''}/></label>
        <label>Number on the ordinance<input name="officialNumber" maxLength={40} defaultValue={record?.officialNumber ?? ''}/></label>
        <label>Where this copy came from<textarea required name="sourceNote" minLength={1} maxLength={500} defaultValue={record?.sourceNote} placeholder="Bound volume, office file, or the person who provided the copy."/></label>
      </div>
      <ReasonField suggestion={suggestion}/>
      {mutation.isError && <Notice error={mutation.error}/>}
      <button className="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : submitLabel}<ArrowRight size={16}/></button>
    </form>
  );
}
function OrdinanceTextForm({session, ordinance, canEncode}:{session:SessionView; ordinance:HistoricalOrdinanceDetail; canEncode:boolean}) {
  const cache = useQueryClient();
  const mutation = useMutation({mutationFn:(body:Record<string,unknown>) => request(`/archives/ordinances/${ordinance.id}/text`, {method:'PATCH', body, csrf:session.csrfToken, key:crypto.randomUUID()}), onSuccess:() => {void cache.invalidateQueries();}});
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    mutation.mutate({extractedText:raw['extractedText'], expectedRevision:ordinance.revision, reason:raw['reason']});
  }
  return (
    <form className="command-form" onSubmit={submit}>
      <h3>Ordinance text</h3>
      <p className="muted">{ordinance.extractNote ?? 'Choose a JPEG, PNG, or PDF. The words read from that file are placed in this field. Search uses this text. It is not a certified copy.'}</p>
      <label>Text read from the scan<textarea key={`${ordinance.id}-${ordinance.revision}`} name="extractedText" rows={8} maxLength={200000} defaultValue={ordinance.extractedText ?? ''} readOnly={!canEncode}/></label>
      {canEncode && <ReasonField suggestion={`Saving ordinance text for ${ordinance.title}`}/>}
      {mutation.isError && <Notice error={mutation.error}/>}
      {mutation.isSuccess && <p className="success" role="status"><Check size={16}/> Ordinance text saved. Keyword search uses this field.</p>}
      {canEncode && <button className="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save ordinance text'}<ArrowRight size={16}/></button>}
    </form>
  );
}
function OrdinanceScanForm({session, ordinance, onDone}:{session:SessionView; ordinance:HistoricalOrdinanceDetail; onDone:()=>void}) {
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [suggestion, setSuggestion] = useState('Reading text from scan');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file');
    const reason = String(data.get('reason') ?? '');
    if (!(file instanceof File) || file.size === 0) {setError(new Error('Choose a JPEG, PNG, or PDF scan.')); return;}
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || /\.(jpe?g|png|pdf)$/i.test(file.name);
    if (!allowed) {setError(new Error('Use a JPEG, PNG, or PDF file.')); return;}
    if (file.size > HISTORICAL_SCAN_MAX_BYTES) {setError(new Error('Each scan must be 12 MiB or smaller.')); return;}
    setPending(true); setError(null);
    try {
      await uploadBytes(`/archives/ordinances/${ordinance.id}/scan`, file, session.csrfToken, {'X-Audit-Reason':reason, 'X-Original-Filename':file.name, 'Idempotency-Key':crypto.randomUUID()});
      await cache.invalidateQueries();
      onDone();
    } catch (err) {setError(err);}
    finally {setPending(false);}
  }
  return (
    <form className="command-form" onSubmit={submit} onChange={event => setSuggestion(reasonForAction('Read scan', event.currentTarget))}>
      <p className="muted">Choose a JPEG, PNG, or PDF. The words are written into the ordinance text field. Correct that field if a word is misread. The reading is not a certified copy.</p>
      <label>Scan<input required name="file" type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"/></label>
      <ReasonField suggestion={suggestion}/>
      {error != null && <Notice error={error}/>}
      <button className="primary" disabled={pending}>{pending ? 'Reading scan…' : 'Read text from scan'}<ArrowRight size={16}/></button>
    </form>
  );
}
function LibraryPage({session}:{session:SessionView}) {
  const canSee = session.permissions.includes('library.view');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [applied, setApplied] = useState({q:'', kind:''});
  const query = useQuery({
    queryKey:['/library', applied],
    queryFn:() => request<Page<LibraryHit>>(`/library?page=1&limit=100${applied.q ? `&q=${encodeURIComponent(applied.q)}` : ''}${applied.kind ? `&kind=${applied.kind}` : ''}`),
    enabled:canSee,
  });
  if (!canSee) return <Empty>e-Library access is not on this account.</Empty>;
  return (
    <div className="panel">
      <p className="muted">Permission-filtered index of case files the caller can already see. This is not an official archive, public portal, or codification.</p>
      <form className="command-form" onSubmit={event => {event.preventDefault(); setApplied({q:q.trim(), kind});}}>
        <div className="form-grid">
          <label>Keyword<input value={q} onChange={event => setQ(event.target.value)} maxLength={120} placeholder="Title, subject, or reference"/></label>
          <label>Kind
            <select value={kind} onChange={event => setKind(event.target.value)}>
              <option value="">All visible records</option>
              <option value="MEASURE">Measures</option>
              <option value="DOCUMENT">Documents</option>
              <option value="SESSION">Sessions</option>
              <option value="MEETING">Meetings</option>
              <option value="COMMITTEE">Committees</option>
            </select>
          </label>
        </div>
        <button className="primary" type="submit">Search library<ArrowRight size={16}/></button>
      </form>
      {query.isError ? <Notice error={query.error}/> : query.isPending ? <p role="status">Loading records…</p> : query.data?.items.length ? (
        <table><thead><tr><th>Kind</th><th>Title</th><th>Status</th></tr></thead><tbody>{query.data.items.map(item => (
          <tr key={`${item.kind}-${item.id}`}><td><Status value={item.kind}/></td><td><strong>{item.title}</strong><small>{item.detail}</small></td><td><Status value={item.state}/></td></tr>
        ))}</tbody></table>
      ) : <Empty>No matching records in the records you can already see.</Empty>}
    </div>
  );
}

function csvCell(value:string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"','""')}"`;
}
function ReportsPage({session}:{session:SessionView}) {
  const canSee = session.permissions.includes('report.view');
  const query = useQuery({queryKey:['/reports'], queryFn:() => request<{data:ReportSnapshot}>('/reports'), enabled:canSee});
  if (!canSee) return <Empty>Reports access is not on this account.</Empty>;
  const snapshot = query.data?.data;
  function download() {
    if (!snapshot) return;
    const lines = [
      ['definitionVersion', snapshot.definitionVersion].map(csvCell).join(','),
      ['asOf', snapshot.asOf].map(csvCell).join(','),
      ['timezone', snapshot.timezone].map(csvCell).join(','),
      ['warnings', snapshot.warnings.join(' ')].map(csvCell).join(','),
      '',
      ['key','label','value','definition'].map(csvCell).join(','),
      ...snapshot.metrics.map(item => [item.key, item.label, String(item.value), item.definition].map(csvCell).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ltas-report-${snapshot.definitionVersion}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="panel">
      <p className="muted">Descriptive counts of records the caller can already see. Totals use published engineering definitions. This is not political scoring, processing-time analytics, or an official municipal report.</p>
      {query.isError ? <Notice error={query.error}/> : query.isPending ? <p role="status">Loading records…</p> : snapshot ? (
        <>
          <p className="muted">{snapshot.definitionVersion} · as of {shortDate(snapshot.asOf)} · {snapshot.timezone}</p>
          <ul className="muted">{snapshot.warnings.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="page-heading" style={{marginTop:12}}><div/><button className="primary" type="button" onClick={download}>Download CSV</button></div>
          <table><thead><tr><th>Metric</th><th>Count</th><th>Definition</th></tr></thead><tbody>{snapshot.metrics.map(item => (
            <tr key={item.key}><td><strong>{item.label}</strong><small>{item.key}</small></td><td>{item.value}</td><td><small>{item.definition}</small></td></tr>
          ))}</tbody></table>
        </>
      ) : <Empty>No report snapshot is available.</Empty>}
    </div>
  );
}

const loginFeatures = [
  {icon:BookOpen, title:'Digital e-Library', copy:'Browse recorded ordinances, resolutions, and documents already stored in this workspace.'},
  {icon:FolderOpen, title:'Document Tracking', copy:'Follow a case file from draft through committee referral and the secretariat-recorded stage.'},
  {icon:Users, title:'Municipal Council Directory', copy:'See directory names, photographs, and committee assignments from this installation.'},
  {icon:ShieldCheck, title:'Role-Based Access', copy:'Sign in with an assigned municipal account. Each grant shows only its own tools.'},
];
function LoginPage({sessionExpired, error}:{sessionExpired:boolean; error?:unknown}) {
  const showError = Boolean(error) && !(error instanceof ApiError && error.status === 401);
  const [username, setUsername] = useState(() => {
    try { return window.localStorage?.getItem('ltas.login.username') ?? ''; }
    catch { return ''; }
  });
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  function rememberName() {
    try {
      if (remember && username.trim()) window.localStorage.setItem('ltas.login.username', username.trim());
      else window.localStorage.removeItem('ltas.login.username');
    } catch { /* The browser can refuse storage; sign-in still continues. */ }
  }
  function continueToIdentity() {
    rememberName();
    window.location.assign('/api/v1/auth/login');
  }
  return (
    <div className="login-page">
      <a className="skip-link" href="#login-action">Skip to sign in</a>
      <aside className="login-story">
        <div className="login-atmosphere" aria-hidden="true">
          <span className="login-glow login-glow-a"/>
          <span className="login-glow login-glow-b"/>
          <span className="login-dots"/>
        </div>
        <div className="login-story-inner">
          <div className="login-panel-brand">
            <img className="login-wordmark" src="/ltas-logo.png" alt="LTAS"/>
            <img src="/brand/libungan-seal.png" alt="Seal of the Municipality of Libungan"/>
            <div>
              <strong>Libungan LTAS</strong>
              <span>Sangguniang Bayan</span>
            </div>
          </div>
          <div className="login-story-copy">
            <p className="login-kicker"><Sparkles size={14}/> Sign in to continue</p>
            <h1>The unified home for your <span>legislative knowledge base.</span></h1>
            <p className="login-tagline">Ordinances, resolutions, council proceedings, and committee records — searchable from this legislative workspace.</p>
            <ul className="login-features">
              {loginFeatures.map(item => (
                <li key={item.title}>
                  <span aria-hidden="true"><item.icon size={18}/></span>
                  <div><strong>{item.title}</strong><p>{item.copy}</p></div>
                </li>
              ))}
            </ul>
          </div>
          <p className="login-story-foot">“Transparent governance starts with accessible records — an archive every citizen and legislator can trust.”</p>
        </div>
      </aside>
      <main className="login-card">
        <form className="login-box" onSubmit={event => { event.preventDefault(); continueToIdentity(); }} onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); continueToIdentity(); } }}>
          <div className="login-box-marks">
            <img className="login-wordmark" src="/ltas-logo.png" alt="LTAS"/>
            <img src="/brand/libungan-seal.png" alt="Seal of the Municipality of Libungan"/>
          </div>
          <h2>Welcome Back <span aria-hidden="true">👋</span></h2>
          <p>Sign in to access the Sangguniang Bayan workspace.</p>
          {showError && <Notice error={error}/>}
          {sessionExpired && <p className="login-session" role="status">Your session ended. Sign in again to continue.</p>}
          <label className="login-field">Username
            <span><UserIcon size={16}/><input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="Enter your username"/></span>
          </label>
          <label className="login-field">Password
            <span>
              <Lock size={16}/>
              <input type={showPassword ? 'text' : 'password'} autoComplete="off" placeholder="Enter your password" aria-describedby="login-identity-note"/>
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(open => !open)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
            </span>
          </label>
          <p id="login-identity-note" className="login-identity-note">Sign in continues on the municipal identity service. This page does not keep the password.</p>
          <label className="login-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)}/> Remember my username</label>
          <a id="login-action" className="login-cta" href="/api/v1/auth/login" onClick={continueToIdentity}><LogIn size={16}/> Sign In</a>
          <div className="login-links">
            <a href="/home"><ArrowLeft size={14}/> Back to home</a>
            <a href="/contact"><ShieldCheck size={14}/> Need access? Contact the SB Secretariat</a>
          </div>
        </form>
        <p className="login-copy">© {new Date().getFullYear()} Libungan LTAS · Sangguniang Bayan</p>
      </main>
    </div>
  );
}

export function App() {
  const {path, navigate} = usePublicPath();
  if (isPublicPath(path)) return <PublicPortal path={path} navigate={navigate}/>;
  return <WorkspaceApp/>;
}

function WorkspaceApp() {
  const cache = useQueryClient();
  const [view, setView] = useState<View>('overview');
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const [measureId, setMeasureId] = useState<string | undefined>();
  const [settingsTab, setSettingsTab] = useState<SettingsTab | undefined>();
  const [navAt, setNavAt] = useState(0);
  const [legal, setLegal] = useState<null | 'privacy' | 'terms' | 'help'>(null);
  function go(next:View, extras?:{highlightId?:string; measureId?:string; settingsTab?:SettingsTab}) {
    setView(next);
    setHighlightId(extras?.highlightId);
    setMeasureId(extras?.measureId);
    setSettingsTab(extras?.settingsTab);
    setNavAt(value => value + 1);
  }
  const session = useQuery({queryKey:['session'], queryFn:() => request<{data:SessionView}>('/auth/session'), refetchInterval:60000});
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => cache.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.query.queryKey[0] !== 'session' && event.query.state.error instanceof ApiError && event.query.state.error.status === 401) setSessionExpired(true);
  }), [cache]);
  const municipality = useQuery({queryKey:['/admin/municipality'], queryFn:() => request<{data:Municipality}>('/admin/municipality'), enabled:Boolean(session.data?.data.permissions.includes('municipality.view'))});
  const logout = useMutation({mutationFn:() => request<{data:{logoutUrl:string}}>('/auth/logout', {method:'POST', csrf:session.data?.data.csrfToken}), onSuccess:result => {cache.clear(); window.location.assign(result.data.logoutUrl);}});
  if (session.isPending) return <div className="boot" role="status"><Landmark size={34}/><p>Opening your workspace…</p></div>;
  if (session.isError || !session.data || sessionExpired) {
    return <LoginPage sessionExpired={sessionExpired} error={session.isError ? session.error : undefined}/>;
  }
  const current = session.data.data;
  const showUsers = canAny(current.permissions, ['user.view', 'role.assign']);
  const showSettings = canAny(current.permissions, ['municipality.view', 'term.view', 'person.view', 'audit.view']);
  const showSessions = current.permissions.includes('session.view');
  const showCalendar = canAny(current.permissions, ['session.view', 'committee.meeting.view']);
  const showVoting = canAny(current.permissions, ['vote.view', 'attendance.record', 'session.view']);
  const showDocuments = current.permissions.includes('document.view');
  const showLibrary = current.permissions.includes('library.view');
  const showArchive = current.permissions.includes('archive.view');
  const showReports = current.permissions.includes('report.view');
  const allowed:View[] = ['overview', 'measures', 'people', 'committees', ...(showSessions ? ['sessions' as const] : []), ...(showCalendar ? ['calendar' as const] : []), ...(showVoting ? ['voting' as const] : []), ...(showDocuments ? ['documents' as const] : []), ...(showArchive ? ['archive' as const] : []), ...(showLibrary ? ['library' as const] : []), ...(showReports ? ['reports' as const] : []), ...(showUsers ? ['users' as const] : []), ...(showSettings ? ['settings' as const] : [])];
  const active = allowed.includes(view) ? view : 'overview';
  const titles:Record<View, {title:string; lead:string}> = {
    overview:{title:'Dashboard', lead:'Track. Analyze. Legislate for a Better Municipality.'},
    measures:{title:'Legislative Measures', lead:'Draft case files. Official numbering is not configured.'},
    people:{title:'People', lead:'Demonstration directory used for committee assignments and measure authors.'},
    committees:{title:'Committees', lead:'Standing and special committees of the Sangguniang Bayan. Not an elected-office catalog.'},
    sessions:{title:'Sessions', lead:'Secretariat-recorded sittings. Not certified minutes or readings.'},
    calendar:{title:'Calendar', lead:'Sessions and committee meetings. Not an official hearing calendar.'},
    voting:{title:'Voting & Attendance', lead:'Secretary-entered roll-call records. Not a certified vote or quorum.'},
    documents:{title:'Documents', lead:'Quarantined files attached to case records. Not the e-Library.'},
    archive:{title:'Ordinance archive', lead:'Direct encoding of earlier ordinances. Not a legislative measure or a certified copy.'},
    library:{title:'e-Library', lead:'Permission-filtered case-file index. Not an official archive or public portal.'},
    reports:{title:'Reports & Analytics', lead:'Descriptive operational counts. Not political scoring or official metrics.'},
    users:{title:'Users & Access', lead:'Link identities and review scoped grants.'},
    settings:{title:'System Settings', lead:'Municipality profile, terms, people, and the audit trail.'},
  };
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar">
        <div className="brand">
          <Seal/>
          <div>
            <h1>{municipality.data?.data?.name.replace(' (Fictional)', '') ?? 'Municipal Government'}</h1>
            <p>SANGGUNIANG BAYAN</p>
            <small>People • Policy • Progress</small>
          </div>
        </div>
        <div className="nav-group">LEGISLATIVE WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button aria-current={active === 'overview' ? 'page' : undefined} className={active === 'overview' ? 'active' : ''} onClick={() => go('overview')}><Home size={16}/>Dashboard</button>
          <button aria-current={active === 'measures' ? 'page' : undefined} className={active === 'measures' ? 'active' : ''} onClick={() => go('measures')}><FileText size={16}/>Legislative Measures</button>
          <button aria-current={active === 'people' ? 'page' : undefined} className={active === 'people' ? 'active' : ''} onClick={() => go('people')}><Users size={16}/>People</button>
          <button aria-current={active === 'committees' ? 'page' : undefined} className={active === 'committees' ? 'active' : ''} onClick={() => go('committees')}><ClipboardList size={16}/>Committees</button>
          {showSessions && <button aria-current={active === 'sessions' ? 'page' : undefined} className={active === 'sessions' ? 'active' : ''} onClick={() => go('sessions')}><Landmark size={16}/>Sessions</button>}
          {showCalendar && <button aria-current={active === 'calendar' ? 'page' : undefined} className={active === 'calendar' ? 'active' : ''} onClick={() => go('calendar')}><CalendarDays size={16}/>Calendar</button>}
          {showVoting && <button aria-current={active === 'voting' ? 'page' : undefined} className={active === 'voting' ? 'active' : ''} onClick={() => go('voting')}><Vote size={16}/>Voting &amp; Attendance</button>}
          {showDocuments && <button aria-current={active === 'documents' ? 'page' : undefined} className={active === 'documents' ? 'active' : ''} onClick={() => go('documents')}><FolderOpen size={16}/>Documents</button>}
          {showArchive && <button aria-current={active === 'archive' ? 'page' : undefined} className={active === 'archive' ? 'active' : ''} onClick={() => go('archive')}><BookOpen size={16}/>Ordinance archive</button>}
          {showLibrary && <button aria-current={active === 'library' ? 'page' : undefined} className={active === 'library' ? 'active' : ''} onClick={() => go('library')}><BookOpen size={16}/>e-Library</button>}
          {showReports && <button aria-current={active === 'reports' ? 'page' : undefined} className={active === 'reports' ? 'active' : ''} onClick={() => go('reports')}><BarChart3 size={16}/>Reports &amp; Analytics</button>}
          <div className="nav-group">ADMINISTRATION</div>
          {showUsers && <button aria-current={active === 'users' ? 'page' : undefined} className={active === 'users' ? 'active' : ''} onClick={() => go('users')}><Users size={16}/>Users &amp; Access</button>}
          {showSettings && <button aria-current={active === 'settings' ? 'page' : undefined} className={active === 'settings' ? 'active' : ''} onClick={() => go('settings')}><Settings size={16}/>System Settings</button>}
        </nav>
        <TownMark/>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="product-title">
            <h1>
              <span className="title-full">Legislative Tracking &amp; Analysis System (LTAS)</span>
              <span className="title-short" aria-hidden="true">LTAS</span>
            </h1>
            <p>Track. Analyze. Legislate for a Better Municipality.</p>
          </div>
          <WorkspaceSearch session={current} onOpen={hit => go(hit.view, {highlightId:hit.committeeId, measureId:hit.measureId, settingsTab:hit.settingsTab})}/>
          <div className="account">
            <NoticesBell session={current}/>
            <span className="avatar">{initials(current.user.displayName)}</span>
            <span className="who"><strong>{current.user.displayName}</strong><small>{roleCaption(current.permissions)}</small></span>
            <button className="icon-button" aria-label="Sign out" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={18}/></button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {active !== 'overview' && active !== 'committees' && active !== 'measures' && active !== 'people' && active !== 'sessions' && active !== 'archive' && (
            <div className="page-heading">
              <div><h1>{titles[active].title}</h1><p>{titles[active].lead}</p></div>
            </div>
          )}
          {logout.isError && <Notice error={logout.error}/>}
          <section aria-label={titles[active].title}>
            {active === 'overview' && <Dashboard session={current} municipality={municipality.data?.data} onOpen={go}/>}
            {active === 'measures' && <MeasuresPage key={`measures-${measureId ?? 'list'}-${navAt}`} session={current} highlightId={measureId}/>}
            {active === 'people' && <PeoplePage session={current}/>}
            {active === 'committees' && <CommitteesPage key={`committees-${highlightId ?? 'list'}-${navAt}`} session={current} highlightId={highlightId}/>}
            {active === 'sessions' && <SessionsPage session={current}/>}
            {active === 'calendar' && <CalendarPage session={current}/>}
            {active === 'voting' && <VotingPage session={current}/>}
            {active === 'documents' && <DocumentsPage session={current}/>}
            {active === 'archive' && <ArchivePage session={current}/>}
            {active === 'library' && <LibraryPage session={current}/>}
            {active === 'reports' && <ReportsPage session={current}/>}
            {active === 'users' && <UsersPage session={current}/>}
            {active === 'settings' && <SettingsPage key={`settings-${settingsTab ?? 'default'}-${navAt}`} session={current} initialTab={settingsTab}/>}
          </section>
          <footer className="page-footer">
            <span>© {new Date().getFullYear()} {municipality.data?.data.name.replace(' (Fictional)', '') ?? 'Municipal Government'} — Sangguniang Bayan. Fictional development records.</span>
            <span>
              <button type="button" className="linkish" onClick={() => setLegal('privacy')}>Privacy Policy</button>
              {' · '}
              <button type="button" className="linkish" onClick={() => setLegal('terms')}>Terms of Use</button>
              {' · '}
              <button type="button" className="linkish" onClick={() => setLegal('help')}>Help</button>
              {' · v1.0.0'}
            </span>
          </footer>
          {legal && <Modal open title={legal === 'privacy' ? 'Privacy Policy' : legal === 'terms' ? 'Terms of Use' : 'Help'} onClose={() => setLegal(null)}>
            <div className="modal-body">
              {legal === 'privacy' && <p>This workspace stores legislative records for signed-in staff. The demonstration catalog shows submitted measure titles and the council directory. It does not publish the Municipality of Libungan privacy notice.</p>}
              {legal === 'terms' && <p>Use follows the grant on the signed-in account. A software grant is not authority to sign, convene, or vote.</p>}
              {legal === 'help' && <p>Sign-in uses the identity service. Municipal records stay with the secretariat. The official website remains libungan.gov.ph.</p>}
            </div>
          </Modal>}
        </main>
      </div>
    </div>
  );
}
