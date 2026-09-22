import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2,
  ChevronLeft, ChevronRight, ClipboardList, Clock, FileText, Flag, FolderOpen, Home,
  Hourglass, Landmark, LogOut, Maximize2, Minimize2, Plus, Search, Settings, ShieldCheck, Users, Vote, X,
} from 'lucide-react';
import type { AuditEvent, CalendarEvent, Committee, CommitteeMeeting, DocumentRecord, Grant, GrantRequest, LegislativeSession, LibraryHit, Measure, MeasureStats, Municipality, NoticeItem, Page, Permission, Person, Referral, ReportSnapshot, SessionView, Term, TimelineEvent, User, WorkTask } from '@ltas/contracts';
import { ApiError, request, uploadBytes } from './api';

type View = 'overview' | 'measures' | 'people' | 'committees' | 'sessions' | 'calendar' | 'voting' | 'documents' | 'library' | 'reports' | 'users' | 'settings';
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

function Seal() {
  return (
    <span className="seal" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="31" fill="#1f6b3a"/>
        <circle cx="32" cy="32" r="26" fill="#e8c45a"/>
        <circle cx="32" cy="32" r="22" fill="#7ec4e6"/>
        <circle cx="42" cy="20" r="6" fill="#f7e27c"/>
        <path d="M10 40 24 26l8 8 10-14 12 12 6 8H10z" fill="#2f6a3c"/>
        <path d="M10 42c8 6 36 6 44 0v10H10z" fill="#2f7fb3"/>
        <path d="M18 48h6v6h-6zm22-8h7v14h-7z" fill="#f4efe0"/>
        <path d="M22 48l3-4 3 4zm22-8 3.5-5 3.5 5" fill="#d7c48a"/>
      </svg>
    </span>
  );
}
function Face({name}:{name:string}) {
  return <span className="face" aria-hidden="true">{initials(name)}</span>;
}

function Notice({error}:{error:unknown}) {
  return <div className="notice error" role="alert">{error instanceof Error ? error.message : 'This request could not be completed.'}{error instanceof ApiError && <small>Reference: {error.problem.correlationId}</small>}</div>;
}
function Empty({children}:{children:ReactNode}) {return <div className="empty"><ClipboardList size={28}/><p>{children}</p></div>;}
function Status({value}:{value:string}) {
  const tone = ['APPROVED','Active','DELIVERED','CHAIR','READY','LEAD','CLOSED','PRESENT'].includes(value) ? 'green' : value === 'PENDING' || value === 'VICE_CHAIR' || value === 'SUBMITTED' || value === 'QUARANTINED' || value === 'ABSENT' ? 'amber' : value === 'STAFF' || value === 'DRAFT' || value === 'OPEN' || value === 'JOINT' || value === 'SCHEDULED' || value === 'REGULAR' || value === 'SPECIAL' || value === 'RECORDED' || value === 'EXCUSED' || value === 'SESSION' || value === 'MEETING' || value === 'MEASURE' || value === 'DOCUMENT' || value === 'COMMITTEE' ? 'blue' : '';
  return <span className={`badge ${tone}`}>{value.toLowerCase().replaceAll('_', ' ')}</span>;
}
interface Field {name:string;label:string;type?:string;options?:Array<{value:string;label:string}>;defaultValue?:string;minLength?:number;maxLength?:number;}
function CommandForm({title,path,csrf,fields,method='POST',fixed={},transform,onDone,submitLabel='Save change',hideTitle}:{title:string;path:string;csrf:string;fields:Field[];method?:string;fixed?:Record<string,unknown>;transform?:(body:Record<string,unknown>)=>Record<string,unknown>;onDone?:()=>void;submitLabel?:string;hideTitle?:boolean}) {
  const cache = useQueryClient(), form = useRef<HTMLFormElement>(null), retry = useRef<{body:string;key:string}|null>(null);
  const mutation = useMutation({mutationFn:(body:Record<string,unknown>) => {
    const serialized = JSON.stringify(body);
    if (retry.current?.body !== serialized) retry.current = {body:serialized, key:crypto.randomUUID()};
    return request(path, {method, body, csrf, key:retry.current.key});
  }, onSuccess:() => {retry.current = null; form.current?.reset(); void cache.invalidateQueries(); onDone?.();}});
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {...Object.fromEntries(new FormData(e.currentTarget)), ...fixed};
    mutation.mutate(transform ? transform(body) : body);
  }
  return (
    <form ref={form} className="command-form" onSubmit={submit}>
      {!hideTitle && <h3>{title}</h3>}
      <div className="form-grid">{fields.map(field => <label key={field.name}>{field.label}{field.options ? <select required name={field.name} defaultValue={field.defaultValue ?? ''}><option value="" disabled>Select…</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea required name={field.name} defaultValue={field.defaultValue} minLength={field.minLength} maxLength={field.maxLength ?? 8000} rows={5}/> : <input required name={field.name} type={field.type ?? 'text'} defaultValue={field.defaultValue} minLength={field.minLength} maxLength={field.maxLength ?? (field.name === 'reason' ? 500 : 255)}/>}</label>)}</div>
      <label>Reason for this change<textarea required name="reason" minLength={8} maxLength={500} placeholder="Explain the change for the audit record."/></label>
      {mutation.isError && <Notice error={mutation.error}/>}
      {mutation.isSuccess && <p className="success" role="status"><Check size={16}/> Change saved and recorded.</p>}
      <button className="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : submitLabel}<ArrowRight size={16}/></button>
    </form>
  );
}
function AddPanel({label,children,variant}:{label:string;children:ReactNode;variant?:'primary'}) {
  return <details className={`add-panel ${variant ?? ''}`}><summary><Plus size={16}/>{label}</summary>{children}</details>;
}
function Modal({open, title, onClose, children}:{open:boolean; title:string; onClose:()=>void; children:ReactNode}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
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
  const query = useQuery({queryKey:[path, page], queryFn:() => request<Page<T>>(`${path}?page=${page}&limit=25`)});
  if (query.isPending) return <p role="status">Loading records…</p>;
  if (query.isError) return <Notice error={query.error}/>;
  return <>
    {query.data.items.length ? children(query.data.items, query.data.pageInfo.total) : <Empty>No records to display.</Empty>}
    <div className="pagination">
      <span>Showing {query.data.items.length} of {query.data.pageInfo.total} records</span>
      <div>
        <button aria-label="Previous page" disabled={page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16}/></button>
        <button aria-label="Next page" disabled={page * 25 >= query.data.pageInfo.total} onClick={() => setPage(value => value + 1)}><ChevronRight size={16}/></button>
      </div>
    </div>
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
      if (matches(item.displayName)) items.push({id:`person:${item.id}`, group:'People', title:item.displayName, detail:'Demonstration directory', view:'people'});
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
  const people = useQuery({queryKey:['/admin/persons','dash'], queryFn:() => request<Page<Person>>('/admin/persons?page=1&limit=5'), enabled:canViewPeople});
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
              <li key={item.id}><Face name={item.displayName}/><strong>{item.displayName}</strong></li>
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
      <div className="section-h"><h2>Upcoming sessions</h2>{canSee && <button className="linkish" onClick={() => onOpen('calendar')}>View Calendar</button>}</div>
      {!canSee ? <p className="later">Calendar access is not on this account.</p> : query.isPending ? <p role="status">Loading records…</p> : query.isError ? <Notice error={query.error}/> : query.data?.items.length ? query.data.items.map(item => (
        <div className="event" key={`${item.kind}-${item.id}`}><div className="cal"><small>{item.kind === 'SESSION' ? 'SESS' : 'MTG'}</small><b>{item.reference}</b></div><div><strong>{item.title}</strong><small>{item.venue} · {shortDate(item.scheduledAt)}</small></div></div>
      )) : <p className="later">No sessions or committee meetings recorded yet.</p>}
    </div>
  );
}

function MunicipalityPage({session}:{session:SessionView}) {
  const query = useQuery({queryKey:['/admin/municipality'], queryFn:() => request<{data:Municipality}>('/admin/municipality')});
  if (query.isError) return <Notice error={query.error}/>;
  if (!query.data) return <p>Loading municipality…</p>;
  const municipality = query.data.data;
  return <>
    <div className="panel">
      <div className="record-heading" style={{display:'flex', gap:12, alignItems:'center', marginBottom:16}}>
        <Seal/>
        <div><h2>{municipality.name}</h2><p className="muted">{municipality.province} · {municipality.timezone}</p></div>
        <Status value={municipality.code}/>
      </div>
      <dl className="facts">
        <div><dt>Installation</dt><dd>Single municipality</dd></div>
        <div><dt>Data</dt><dd>Fictional development records</dd></div>
        <div><dt>Record revision</dt><dd>{municipality.revision}</dd></div>
      </dl>
    </div>
    {session.permissions.includes('settings.manage') && <div className="panel" style={{marginTop:16}}><CommandForm key={municipality.revision} title="Update municipality details" path="/admin/municipality" method="PATCH" csrf={session.csrfToken} fixed={{expectedRevision:municipality.revision}} fields={[{name:'name', label:'Municipality name', defaultValue:municipality.name},{name:'province', label:'Province', defaultValue:municipality.province}]}/></div>}
  </>;
}

function TermsPage({session}:{session:SessionView}) {
  return <>
    {session.permissions.includes('term.manage') && <AddPanel label="Add council term"><CommandForm title="New council term" path="/admin/terms" csrf={session.csrfToken} fields={[{name:'label', label:'Term label'},{name:'startsOn', label:'Start date', type:'date'},{name:'endsOn', label:'End date', type:'date'}]}/></AddPanel>}
    <div className="panel"><Listing<Term> path="/admin/terms">{items => <table><thead><tr><th>Council term</th><th>Starts</th><th>Ends</th><th>Revision</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.label}</strong></td><td>{shortDate(item.startsOn)}</td><td>{shortDate(item.endsOn)}</td><td>{item.revision}</td></tr>)}</tbody></table>}</Listing></div>
  </>;
}

function PeoplePage({session, embedded=false}:{session:SessionView; embedded?:boolean}) {
  const canView = session.permissions.includes('person.view');
  const canManage = session.permissions.includes('person.manage');
  const create = canManage ? <AddPanel variant={embedded ? undefined : 'primary'} label="Add person"><CommandForm title="New person" path="/admin/persons" csrf={session.csrfToken} fields={[{name:'displayName', label:'Full display name'}]}/></AddPanel> : null;
  const body = !canView ? <Empty>This account cannot list people. The directory requires a live SEC or LS grant.</Empty> : (
    <>
      {embedded && create}
      <div className="panel"><Listing<Person> path="/admin/persons">{items => <table><thead><tr><th>Name</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td className="cell-person"><Face name={item.displayName}/><strong>{item.displayName}</strong></td></tr>)}</tbody></table>}</Listing></div>
    </>
  );
  if (embedded) return <>
    <p className="muted" style={{marginBottom:12}}>Fictional demonstration names only. A person record is not a councilor login or legal seat.</p>
    {body}
  </>;
  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>People</h1>
          <p>Demonstration Sanggunian member names for committee assignment and measure authors. Not elected-office records.</p>
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
  const people = useQuery({queryKey:['/admin/persons','options'], queryFn:() => request<Page<Person>>('/admin/persons?limit=100'), enabled:canEdit});
  const referrals = useQuery({queryKey:['/committees', id, 'referrals'], queryFn:() => request<Page<Referral>>(`/committees/${id}/referrals?page=1&limit=50`), enabled:(tab === 'referrals' || tab === 'meetings') && session.permissions.includes('committee.referral.view')});
  const meetings = useQuery({queryKey:['/committees', id, 'meetings'], queryFn:() => request<Page<CommitteeMeeting>>(`/committees/${id}/meetings?page=1&limit=50`), enabled:tab === 'meetings' && session.permissions.includes('committee.meeting.view')});
  const meeting = useQuery({queryKey:['/meetings', activeMeeting], queryFn:() => request<{data:CommitteeMeeting}>(`/meetings/${activeMeeting}`), enabled:Boolean(activeMeeting) && session.permissions.includes('committee.meeting.view')});
  const documents = useQuery({queryKey:['/committees', id, 'documents'], queryFn:() => request<{items:DocumentRecord[]}>(`/committees/${id}/documents`), enabled:tab === 'documents' && session.permissions.includes('document.view')});
  const meetingDocs = useQuery({queryKey:['/meetings', activeMeeting, 'documents'], queryFn:() => request<{items:DocumentRecord[]}>(`/meetings/${activeMeeting}/documents`), enabled:Boolean(activeMeeting) && tab === 'meetings' && session.permissions.includes('document.view')});
  useEffect(() => { setExpanded(false); setScheduling(false); setActiveMeeting(null); }, [id]);
  useEffect(() => {
    if (!expanded) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setExpanded(false);
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [expanded]);
  if (query.isError) return <Notice error={query.error}/>;
  if (!query.data) return <p>Loading committee…</p>;
  const committee = query.data.data;
  const chair = committee.members?.find(member => member.role === 'CHAIR');
  const vice = committee.members?.find(member => member.role === 'VICE_CHAIR');
  const panel = (
    <aside className={`panel detail-panel${expanded ? ' detail-panel-full' : ''}`} {...(expanded ? {'aria-labelledby': titleId} : {})}>
      <div className="detail-head">
        <div>
          <span className="kicker"><Users size={14}/> Standing committee</span>
          <h2 id={titleId}>{committee.name}</h2>
          <p className="muted">{committee.code} · {committee.term?.label}</p>
        </div>
        <div className="detail-actions">
          <Status value="Active"/>
          <button className="ghost" onClick={() => setExpanded(value => !value)}>
            {expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
            {expanded ? 'Exit full screen' : 'View full screen'}
          </button>
        </div>
      </div>
      <div className="stats-row">
        <div className="mini-stat"><strong>{committee.members?.length ?? 0}</strong><span className="muted">Members</span></div>
        <div className="mini-stat"><strong>{committee.revision}</strong><span className="muted">Revision</span></div>
        <div className="mini-stat"><CheckCircle2 size={16}/><span className="muted">Active</span></div>
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
              <div><dt>Status</dt><dd><Status value="Active"/></dd></div>
              <div><dt>Code</dt><dd>{committee.code}</dd></div>
              <div><dt>Council term</dt><dd>{committee.term?.label ?? '—'}</dd></div>
              <div><dt>Chairperson</dt><dd>{chair?.person?.displayName ?? 'Not assigned'}</dd></div>
            </dl>
          </div>
          <div className="officer-card">
            <h3>Chairperson</h3>
            {chair?.person ? (
              <div className="cell-person"><Face name={chair.person.displayName}/><div><strong>{chair.person.displayName}</strong><small>Chairperson</small></div></div>
            ) : <p className="muted">Not assigned</p>}
            {vice?.person && <div className="cell-person" style={{marginTop:12}}><Face name={vice.person.displayName}/><div><strong>{vice.person.displayName}</strong><small>Vice chairperson</small></div></div>}
          </div>
        </div>
      )}
      {tab === 'members' && (
        <>
          {canEdit && (people.isError ? <Notice error={people.error}/> : <AddPanel label="Assign committee member"><CommandForm key={`${committee.revision}-${committee.term?.endsOn ?? ''}`} title="New membership" path={`/committees/${id}/members`} csrf={session.csrfToken} fixed={{expectedRevision:committee.revision}} fields={[{name:'personId', label:'Person', options:people.data?.items.map(person => ({value:person.id, label:person.displayName})) ?? []},{name:'role', label:'Committee role', options:['CHAIR','VICE_CHAIR','MEMBER','STAFF'].map(value => ({value, label:value.replace('_',' ')}))},{name:'startsOn', label:'Start date', type:'date', defaultValue:dateOnly(committee.term?.startsOn)},{name:'endsOn', label:'End date', type:'date', defaultValue:dateOnly(committee.term?.endsOn)}]}/></AddPanel>)}
          {committee.members?.length ? (
            <table><thead><tr><th>Member</th><th>Role</th><th>From</th></tr></thead><tbody>{committee.members.map(member => (
              <tr key={member.id}><td className="cell-person">{member.person ? <Face name={member.person.displayName}/> : null}<strong>{member.person?.displayName}</strong></td><td><Status value={member.role}/></td><td>{shortDate(member.startsOn)}</td></tr>
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
              <tr key={item.id} className={item.id === activeMeeting ? 'selected' : ''} onClick={() => setActiveMeeting(item.id)}>
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
              {meetingDocs.data?.items.length ? <table><thead><tr><th>File</th><th>State</th></tr></thead><tbody>{meetingDocs.data.items.map(doc => <tr key={doc.id}><td>{doc.title}</td><td><Status value={doc.latestState}/></td></tr>)}</tbody></table> : null}
            </div>
          )}
        </>
      )}
      {tab === 'documents' && (
        <>
          {session.permissions.includes('document.upload') && <AddPanel label="Upload committee file"><CaseUpload session={session} ownerType="COMMITTEE" ownerId={id}/></AddPanel>}
          {documents.isError ? <Notice error={documents.error}/> : documents.data?.items.length ? <table><thead><tr><th>File</th><th>State</th></tr></thead><tbody>{documents.data.items.map(doc => <tr key={doc.id}><td>{doc.title}</td><td><Status value={doc.latestState}/></td></tr>)}</tbody></table> : <Empty>No committee documents yet. Uploads remain quarantined.</Empty>}
        </>
      )}
    </aside>
  );
  return (
    <div className={expanded ? 'case-fullscreen' : undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-labelledby={expanded ? titleId : undefined}>
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
          <table><thead><tr><th>#</th><th>Committee Name</th><th>Chairperson</th><th>Members</th><th>Status</th></tr></thead><tbody>{items.map((item, index) => {
            const chair = item.members?.find(member => member.role === 'CHAIR')?.person;
            return (
            <tr key={item.id} className={item.id === active ? 'selected' : ''} onClick={() => setSelected(item.id)}>
              <td className="idx">{index + 1}</td>
              <td><span className="row-accent" style={{background:accents[index % accents.length], marginRight:8, verticalAlign:'middle'}}/><strong className="name-link">{item.name}</strong><small>{item.code}</small></td>
              <td>{chair ? <span className="cell-person"><Face name={chair.displayName}/>{chair.displayName}</span> : <span className="muted">Not assigned</span>}</td>
              <td>{item.members?.length ?? '—'}</td>
              <td><Status value="Active"/></td>
            </tr>
            );
          })}</tbody></table>
        ) : <Empty>No committees to display.</Empty>}<div className="pagination"><span>Showing {items.length} of {list.data?.pageInfo.total ?? 0} committees</span></div></div>}
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
  return <>
    <div className="notice"><ShieldCheck size={20}/><span>Access grants require two administrators. Requester, reviewer, and recipient must be different people.</span></div>
    <AddPanel label="Request access grant">
      <label className="role-select">Role<select value={role} onChange={event => setRole(event.target.value)}>{['SYS','SEC','AUD','CS','LS'].map(item => <option key={item}>{item}</option>)}</select></label>
      {users.isError ? <Notice error={users.error}/> : <CommandForm key={role} title="Access request" path="/admin/grant-requests" csrf={session.csrfToken} fixed={{role, scopeType:role === 'CS' ? 'COMMITTEE' : 'MUNICIPALITY', ...(role !== 'CS' ? {scopeId:session.user.municipalityId} : {})}} transform={body => ({...body, validFrom:new Date(String(body['validFrom'])).toISOString(), validUntil:new Date(String(body['validUntil'])).toISOString()})} fields={[{name:'userId', label:'Recipient', options:users.data?.items.filter(user => user.enabled && user.id !== session.user.id).map(user => ({value:user.id, label:user.displayName})) ?? []}, ...(role === 'CS' ? [{name:'scopeId', label:'Committee ID'}] : []), {name:'validFrom', label:'Valid from (your local time)', type:'datetime-local'}, {name:'validUntil', label:'Expires (your local time)', type:'datetime-local'}]}/>}
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
  return <div className="panel"><p className="muted" style={{marginBottom:12}}>Attributable changes, preserved in sequence. Audit records cannot be edited here.</p><Listing<AuditEvent> path="/audit">{items => <table><thead><tr><th>Sequence</th><th>Action / actor</th><th>Recorded</th><th>Evidence</th></tr></thead><tbody>{items.map(event => <tr key={event.id}><td className="mono">#{event.sequence}</td><td><strong>{event.action}</strong><small>{event.actorName}</small></td><td>{new Date(event.recordedAt).toLocaleString('en-PH', {timeZone:'Asia/Manila'})}<small>Asia/Manila</small></td><td><details><summary>View evidence</summary><pre>{JSON.stringify({entityId:event.entityId, payload:event.payload, hash:event.hash, previousHash:event.previousHash}, null, 2)}</pre></details></td></tr>)}</tbody></table>}</Listing></div>;
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

function CaseUpload({session, ownerType, ownerId}:{session:SessionView; ownerType:'MEASURE'|'COMMITTEE'|'MEETING'|'SESSION'; ownerId:string}) {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
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
    <form className="command-form" onSubmit={submit}>
      <h3>Attach a case file</h3>
      <p className="muted">Uploads stay quarantined until an approved scanner exists (D-13). Proposed cap 25 MiB.</p>
      <label>File<input required name="file" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/jpeg,image/png,image/tiff"/></label>
      <label>Reason for this change<textarea required name="reason" minLength={8} maxLength={500} placeholder="Explain the upload for the audit record."/></label>
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
      <label>Reason for this change<textarea required name="reason" minLength={8} maxLength={500} placeholder="Explain the change for the audit record."/></label>
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
  useEffect(() => { setExpanded(false); setReferring(false); }, [id]);
  useEffect(() => {
    if (!expanded) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setExpanded(false);
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [expanded]);
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
          {documents.isError ? <Notice error={documents.error}/> : documents.data?.items.length ? <table><thead><tr><th>File</th><th>State</th></tr></thead><tbody>{documents.data.items.map(doc => <tr key={doc.id}><td>{doc.title}</td><td><Status value={doc.latestState}/></td></tr>)}</tbody></table> : <Empty>No case documents yet. Uploads remain quarantined.</Empty>}
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
    <div className={expanded ? 'case-fullscreen' : undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-labelledby={expanded ? titleId : undefined}>
      {panel}
    </div>
  );
}

function MeasuresPage({session, highlightId}:{session:SessionView; highlightId?:string}) {
  const [selected, setSelected] = useState<string | null>(highlightId ?? null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => { setSelected(highlightId ?? null); }, [highlightId]);
  const canView = session.permissions.includes('measure.view');
  const canCreate = session.permissions.includes('measure.create');
  const terms = useQuery({queryKey:['/admin/terms','measure-options'], queryFn:() => request<Page<Term>>('/admin/terms?limit=100'), enabled:canCreate && session.permissions.includes('term.view')});
  const people = useQuery({queryKey:['/admin/persons','measure-options'], queryFn:() => request<Page<Person>>('/admin/persons?limit=100'), enabled:canCreate && session.permissions.includes('person.view')});
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
            <CommandForm hideTitle title="New draft measure" path="/measures" csrf={session.csrfToken} onDone={() => setCreating(false)} transform={body => ({typeCode:body.typeCode, termId:body.termId, title:body.title, subject:body.subject, synopsis:body.synopsis, reason:body.reason, authors:[{personId:String(body.personId), role:String(body.authorRole), ordering:0}]})} fields={[{name:'typeCode', label:'Type', options:[{value:'ORDINANCE', label:'Ordinance'},{value:'RESOLUTION', label:'Resolution'}]},{name:'termId', label:'Council term', options:terms.data?.items.map(term => ({value:term.id, label:term.label})) ?? []},{name:'title', label:'Title', maxLength:240},{name:'subject', label:'Subject', maxLength:500},{name:'personId', label:'Author', options:people.data?.items.map(person => ({value:person.id, label:person.displayName})) ?? []},{name:'authorRole', label:'Author role', options:[{value:'AUTHOR', label:'Author'},{value:'CO_AUTHOR', label:'Co-author'},{value:'SPONSOR', label:'Sponsor'}], defaultValue:'AUTHOR'},{name:'synopsis', label:'Synopsis', type:'textarea', maxLength:8000}]} submitLabel="Create draft"/>
          </Modal>
        )}
        <div className="filters"><div className="search-field"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title or subject…"/><Search size={16}/></div></div>
        {!canView ? <Empty>This account cannot list legislative measures. Draft case files require a live LS, SEC, or AUD grant.</Empty> : list.isPending ? <p role="status">Loading records…</p> : list.isError ? <Notice error={list.error}/> : <div className="panel">{items.length ? (
          <table><thead><tr><th>#</th><th>Title</th><th>Type</th><th>Stage</th></tr></thead><tbody>{items.map((item, index) => (
            <tr key={item.id} className={item.id === active ? 'selected' : ''} onClick={() => setSelected(item.id)}>
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
  const query = useQuery({queryKey:['/notifications'], queryFn:() => request<{items:NoticeItem[]}>('/notifications'), enabled:open && session.permissions.includes('notification.view')});
  if (!session.permissions.includes('notification.view')) return <button className="icon-button" aria-label="Notifications" disabled title="Notifications are not on this account"><Bell size={18}/></button>;
  return (
    <div className="search-wrap">
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
            <tr key={item.id} className={item.id === selected ? 'selected' : ''} onClick={() => setSelected(item.id)}>
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
          {docs.data?.items.length ? <table><thead><tr><th>File</th><th>State</th></tr></thead><tbody>{docs.data.items.map(doc => <tr key={doc.id}><td>{doc.title}</td><td><Status value={doc.latestState}/></td></tr>)}</tbody></table> : null}
        </aside>
      )}
    </div>
  );
}

function CalendarPage({session}:{session:SessionView}) {
  const canSee = canAny(session.permissions, ['session.view','committee.meeting.view']);
  const query = useQuery({queryKey:['/calendar'], queryFn:() => request<Page<CalendarEvent>>('/calendar?page=1&limit=100'), enabled:canSee});
  if (!canSee) return <Empty>Calendar access is not on this account.</Empty>;
  return (
    <div className="panel">
      <p className="muted">Combined secretariat sessions and committee meetings. This is not an official calendar of hearings.</p>
      {query.isPending ? <p role="status">Loading records…</p> : query.isError ? <Notice error={query.error}/> : query.data?.items.length ? (
        <table><thead><tr><th>When</th><th>Kind</th><th>Reference</th><th>Title</th><th>Status</th></tr></thead><tbody>{query.data.items.map(item => (
          <tr key={`${item.kind}-${item.id}`}><td>{shortDate(item.scheduledAt)}</td><td><Status value={item.kind}/></td><td>{item.reference}</td><td><strong>{item.title}</strong><small>{item.venue} · {item.ownerLabel}</small></td><td><Status value={item.state}/></td></tr>
        ))}</tbody></table>
      ) : <Empty>No calendar events recorded yet.</Empty>}
    </div>
  );
}

function VotingPage({session}:{session:SessionView}) {
  const canView = canAny(session.permissions, ['session.view','vote.view']);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({queryKey:['/sessions','voting'], queryFn:() => request<Page<LegislativeSession>>('/sessions?page=1&limit=50'), enabled:canView});
  const detail = useQuery({queryKey:['/sessions', selected, 'voting'], queryFn:() => request<{data:LegislativeSession}>(`/sessions/${selected}`), enabled:Boolean(selected) && canView});
  const people = useQuery({queryKey:['/admin/persons','attendance'], queryFn:() => request<Page<Person>>('/admin/persons?limit=100'), enabled:session.permissions.includes('attendance.record')});
  if (!canView) return <Empty>Voting and attendance access is not on this account.</Empty>;
  const current = detail.data?.data;
  return (
    <div className="split">
      <div className="panel">
        <p className="muted">Secretary-entered roll-call records. Counts are not a certified result and do not pass or fail a measure. Attendance is not a quorum declaration.</p>
        {list.isPending ? <p role="status">Loading records…</p> : list.isError ? <Notice error={list.error}/> : list.data?.items.length ? (
          <table><thead><tr><th>Session</th><th>When</th><th>Status</th></tr></thead><tbody>{list.data.items.map(item => (
            <tr key={item.id} className={item.id === selected ? 'selected' : ''} onClick={() => setSelected(item.id)}><td><strong>{item.reference}</strong><small>{item.title}</small></td><td>{shortDate(item.scheduledAt)}</td><td><Status value={item.state}/></td></tr>
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
              <CommandForm key={`att-${current.revision}`} title="Attendance" path={`/sessions/${current.id}/attendance`} csrf={session.csrfToken} fields={[{name:'personId', label:'Person', options:people.data?.items.map(person => ({value:person.id, label:person.displayName})) ?? []},{name:'disposition', label:'Disposition', options:[{value:'PRESENT', label:'Present'},{value:'ABSENT', label:'Absent'},{value:'EXCUSED', label:'Excused'}]}]} fixed={{expectedRevision:current.revision}} submitLabel="Save attendance"/>
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
      <p className="muted">Files already attached to measures, committees, meetings, or sessions. Uploads stay quarantined (D-13). This is not the e-Library.</p>
      {query.isPending ? <p role="status">Loading records…</p> : query.isError ? <Notice error={query.error}/> : query.data?.items.length ? (
        <table><thead><tr><th>File</th><th>Owner</th><th>State</th></tr></thead><tbody>{query.data.items.map(item => (
          <tr key={item.id}><td><strong>{item.title}</strong></td><td><Status value={item.ownerType ?? 'UNKNOWN'}/></td><td><Status value={item.latestState}/></td></tr>
        ))}</tbody></table>
      ) : <Empty>No documents uploaded yet. Attach files from a measure, committee, meeting, or session.</Empty>}
    </div>
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

function LoginPage({sessionExpired, error}:{sessionExpired:boolean; error?:unknown}) {
  const showError = Boolean(error) && !(error instanceof ApiError && error.status === 401);
  return (
    <div className="login-page">
      <a className="skip-link" href="#login-action">Skip to sign in</a>
      <aside className="login-story">
        <div className="login-atmosphere" aria-hidden="true">
          <span className="login-ring login-ring-a"/>
          <span className="login-ring login-ring-b"/>
          <span className="login-ring login-ring-c"/>
        </div>
        <div className="login-story-inner">
          <div className="brand login-brand">
            <Seal/>
            <div>
              <h1>Municipality of San Isidro</h1>
              <p>Sangguniang Bayan</p>
            </div>
          </div>
          <div className="login-story-copy">
            <h2>Legislative Tracking &amp; Analysis System</h2>
            <p className="login-tagline">Track. Analyze. Legislate for a Better Municipality.</p>
            <ul className="login-checks">
              <li><span className="login-check" aria-hidden="true"><Check size={14} strokeWidth={3}/></span>Transparent records</li>
              <li><span className="login-check" aria-hidden="true"><Check size={14} strokeWidth={3}/></span>Assigned-account access</li>
              <li><span className="login-check" aria-hidden="true"><Check size={14} strokeWidth={3}/></span>People-centered legislation</li>
            </ul>
          </div>
          <p className="login-story-foot">© {new Date().getFullYear()} Municipality of San Isidro — Sangguniang Bayan. Fictional development records.</p>
        </div>
      </aside>
      <main className="login-card">
        <div className="login-mobile-brand">
          <Seal/>
          <strong>LTAS</strong>
          <span>Legislative Tracking &amp; Analysis System</span>
        </div>
        <p className="login-eyebrow">People • Policy • Progress</p>
        <div className="login-box">
          <h2>Welcome to your workspace</h2>
          <p>Sign in with your assigned municipal account to continue.</p>
          {showError && <Notice error={error}/>}
          {sessionExpired && <p className="login-session" role="status">Your session ended. Sign in again to continue.</p>}
          <a id="login-action" className="login-cta" href="/api/v1/auth/login">Sign in securely <ArrowRight size={18}/></a>
          <p className="login-help">Need access? Your administrator can link your identity and request the appropriate role.</p>
        </div>
        <p className="login-secure"><ShieldCheck size={16}/> Identity is verified through the municipal sign-in service. There is no guest or demo bypass.</p>
      </main>
    </div>
  );
}

export function App() {
  const cache = useQueryClient();
  const [view, setView] = useState<View>('overview');
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const [measureId, setMeasureId] = useState<string | undefined>();
  const [settingsTab, setSettingsTab] = useState<SettingsTab | undefined>();
  const [navAt, setNavAt] = useState(0);
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
  const showReports = current.permissions.includes('report.view');
  const allowed:View[] = ['overview', 'measures', 'people', 'committees', ...(showSessions ? ['sessions' as const] : []), ...(showCalendar ? ['calendar' as const] : []), ...(showVoting ? ['voting' as const] : []), ...(showDocuments ? ['documents' as const] : []), ...(showLibrary ? ['library' as const] : []), ...(showReports ? ['reports' as const] : []), ...(showUsers ? ['users' as const] : []), ...(showSettings ? ['settings' as const] : [])];
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
          {active !== 'overview' && active !== 'committees' && active !== 'measures' && active !== 'people' && active !== 'sessions' && (
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
            {active === 'library' && <LibraryPage session={current}/>}
            {active === 'reports' && <ReportsPage session={current}/>}
            {active === 'users' && <UsersPage session={current}/>}
            {active === 'settings' && <SettingsPage key={`settings-${settingsTab ?? 'default'}-${navAt}`} session={current} initialTab={settingsTab}/>}
          </section>
          <footer className="page-footer">
            <span>© {new Date().getFullYear()} {municipality.data?.data.name.replace(' (Fictional)', '') ?? 'Municipal Government'} — Sangguniang Bayan. Fictional development records.</span>
            <span>Privacy Policy · Terms of Use · Help · v1.0.0</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
