import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2,
  ChevronLeft, ChevronRight, ClipboardList, Clock, FileText, Flag, FolderOpen, Home,
  Hourglass, Landmark, LogOut, Plus, Search, Settings, ShieldCheck, Users, Vote, X,
} from 'lucide-react';
import type { AuditEvent, Committee, DocumentRecord, Grant, GrantRequest, Measure, MeasureStats, Municipality, NoticeItem, Page, Permission, Person, SessionView, Term, TimelineEvent, User, WorkTask } from '@ltas/contracts';
import { ApiError, request, uploadBytes } from './api';

type View = 'overview' | 'measures' | 'people' | 'committees' | 'users' | 'settings';
type SettingsTab = 'municipality' | 'terms' | 'people' | 'audit';
type UsersTab = 'accounts' | 'access';
const later = [
  {id:'sessions', label:'Sessions', icon:Landmark},
  {id:'calendar', label:'Calendar', icon:CalendarDays},
  {id:'voting', label:'Voting & Attendance', icon:Vote},
  {id:'documents', label:'Documents', icon:FolderOpen},
  {id:'library', label:'e-Library', icon:BookOpen},
  {id:'reports', label:'Reports & Analytics', icon:BarChart3},
] as const;
const accents = ['#1d6fd8', '#1f8a4c', '#c47a12', '#6d4ad6', '#c4477a', '#0e7c8b'];
const pipelineKpis = [
  {tone:'blue', icon:FileText, label:'Proposed Measures', hint:'Later phase'},
  {tone:'green', icon:CheckCircle2, label:'Enacted Measures', hint:'Later phase'},
  {tone:'amber', icon:Clock, label:'Pending Committee', hint:'Later phase'},
  {tone:'orange', icon:Hourglass, label:'For Second Reading', hint:'Later phase'},
  {tone:'pink', icon:Flag, label:'Awaiting Mayor Action', hint:'Later phase'},
] as const;
const shortDate = (v:string) => new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'Asia/Manila'}).format(new Date(v));
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
  const tone = ['APPROVED','Active','DELIVERED','CHAIR','READY'].includes(value) ? 'green' : value === 'PENDING' || value === 'VICE_CHAIR' || value === 'SUBMITTED' || value === 'QUARANTINED' ? 'amber' : value === 'STAFF' || value === 'DRAFT' || value === 'OPEN' ? 'blue' : '';
  return <span className={`badge ${tone}`}>{value.toLowerCase().replaceAll('_', ' ')}</span>;
}
interface Field {name:string;label:string;type?:string;options?:Array<{value:string;label:string}>;defaultValue?:string;minLength?:number;maxLength?:number;}
function CommandForm({title,path,csrf,fields,method='POST',fixed={},transform,onDone,submitLabel='Save change'}:{title:string;path:string;csrf:string;fields:Field[];method?:string;fixed?:Record<string,unknown>;transform?:(body:Record<string,unknown>)=>Record<string,unknown>;onDone?:()=>void;submitLabel?:string}) {
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
      <h3>{title}</h3>
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
          {!needle && <p className="search-hint">Type to find live records, or jump to a workspace page. Sessions and the document library arrive later.</p>}
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
      <span className="date-chip">{longDate(new Date().toISOString())}</span>
      <svg className="hero-art" viewBox="0 0 520 180" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9fd4ee"/>
            <stop offset="1" stopColor="#6eb4d6"/>
          </linearGradient>
        </defs>
        <rect width="520" height="180" fill="url(#sky)"/>
        <ellipse cx="430" cy="38" rx="28" ry="10" fill="#fff" opacity="0.55"/>
        <ellipse cx="390" cy="28" rx="18" ry="7" fill="#fff" opacity="0.4"/>
        <path fill="#6fae73" d="M180 110 260 48l70 42 50-38 80 48v80H180z"/>
        <path fill="#2f6a44" d="M240 120 330 58l60 40 70-36 60 42v76H240z"/>
        <path fill="#7ec7e6" d="M0 128c60-18 120 6 180-10 70-18 120 8 180-6 70-16 120 4 160 14v54H0z"/>
        <rect x="70" y="118" width="18" height="28" fill="#f3efe2"/>
        <rect x="96" y="108" width="26" height="38" fill="#efe6cf"/>
        <polygon points="96,108 109,90 122,108" fill="#d9c48a"/>
        <rect x="300" y="112" width="22" height="30" fill="#f7f1dc"/>
        <polygon points="300,112 311,96 322,112" fill="#e4d7a8"/>
        <path d="M40 150c8-22 4-34 14-48 2 16 10 22 8 40z" fill="#1f6b3a"/>
        <path d="M430 150c10-26 6-40 18-56 4 18 12 26 8 48z" fill="#245c34"/>
      </svg>
      <div className="hero-copy">
        <p className="eyebrow">{greeting(session.user.displayName).toUpperCase()}</p>
        <h2>Together for a Better {place.replace(/^Municipality of /, '')}</h2>
        <p className="quote">Effective local legislation creates stronger communities.</p>
      </div>
    </section>
    <section className="kpis" aria-label="Legislative totals">
      {stats.isError && <Notice error={stats.error}/>}
      {pipelineKpis.map(card => {
        const Icon = card.icon;
        const proposed = card.label === 'Proposed Measures';
        const value = proposed && session.permissions.includes('measure.view') ? stats.data?.data.proposed ?? 0 : 0;
        const hint = proposed && session.permissions.includes('measure.view') ? 'Draft and submitted case files' : 'Later phase';
        return (
          <article key={card.label} className={`kpi ${card.tone}`} title={hint}>
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
        <div className="panel" style={{marginBottom:16}}>
          <div className="section-h"><h2>People directory</h2><button className="linkish" onClick={() => onOpen('people')}>View All</button></div>
          {!canViewPeople ? <Empty>This account cannot list people.</Empty> : people.isError ? <Notice error={people.error}/> : people.data?.items.length ? (
            <table><thead><tr><th>Name</th></tr></thead><tbody>{people.data.items.map((item, index) => (
              <tr key={item.id}><td><span className="row-accent" style={{background:accents[index % accents.length]}}/> <strong>{item.displayName}</strong></td></tr>
            ))}</tbody></table>
          ) : <Empty>No people in the demonstration directory yet.</Empty>}
        </div>
        <div className="panel">
          <div className="section-h"><h2>Recent committee records</h2><button className="linkish" onClick={() => onOpen('committees')}>View All</button></div>
          {!canViewCommittees ? <Empty>Committee roster is not on this account.</Empty> : committees.isError ? <Notice error={committees.error}/> : committees.data?.items.length ? (
            <table><thead><tr><th>Code</th><th>Committee</th><th>Term</th></tr></thead><tbody>{committees.data.items.map((item, index) => (
              <tr key={item.id}><td><span className="row-accent" style={{background:accents[index % accents.length]}}/> {item.code}</td><td><strong>{item.name}</strong></td><td>{item.term?.label}</td></tr>
            ))}</tbody></table>
          ) : <Empty>No committees to display yet.</Empty>}
        </div>
      </div>
      <div>
        <div className="panel" style={{marginBottom:16}}>
          <div className="section-h"><h2>Upcoming sessions</h2><span className="muted">View Calendar</span></div>
          <p className="later">Session scheduling arrives in a later phase. No session records exist yet.</p>
        </div>
        <div className="panel" style={{marginBottom:16}}>
          <div className="section-h"><h2>Recent activity</h2></div>
          {audit.isError ? <Notice error={audit.error}/> : audit.data?.items.length ? audit.data.items.map(item => (
            <div className="event" key={item.id}><div className="cal"><small>LOG</small><b>#{item.sequence}</b></div><div><strong>{item.action}</strong><small>{item.actorName} · {shortDate(item.recordedAt)}</small></div></div>
          )) : <p className="later">Audit history appears here when you have review access.</p>}
        </div>
        <div className="panel" style={{marginBottom:16}}>
          <div className="section-h"><h2>In-app tasks</h2></div>
          {session.permissions.includes('task.manage') ? (tasks.isError ? <Notice error={tasks.error}/> : tasks.data?.items.length ? tasks.data.items.map(item => (
            <div className="event" key={item.id}><div className="cal"><small>TASK</small><b>{item.state}</b></div><div><strong>{item.title}</strong><small>Completing a task does not file a measure.</small></div></div>
          )) : <p className="later">No in-app tasks yet.</p>) : <p className="later">Tasks appear here when you have task access.</p>}
        </div>
        <div className="panel">
          <div className="section-h"><h2>Quick actions</h2></div>
          <div className="quick-grid">
            {session.permissions.includes('measure.view') && <button className="quick-card" onClick={() => onOpen('measures')}><FileText size={18}/>Legislative Measures</button>}
            <button className="quick-card" onClick={() => onOpen('people')}><Users size={18}/>People</button>
            <button className="quick-card" onClick={() => onOpen('committees')}><ClipboardList size={18}/>Committees</button>
            {canAny(session.permissions, ['user.view','role.assign']) && <button className="quick-card" onClick={() => onOpen('users')}><Users size={18}/>Users &amp; Access</button>}
            {canAny(session.permissions, ['municipality.view','settings.manage']) && <button className="quick-card" onClick={() => onOpen('settings')}><Settings size={18}/>System Settings</button>}
          </div>
        </div>
      </div>
    </div>
  </>;
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
  const [tab, setTab] = useState<'overview' | 'members'>('overview');
  const query = useQuery({queryKey:['/committees', id], queryFn:() => request<{data:Committee}>(`/committees/${id}`)});
  const canEdit = session.permissions.includes('committee.members.manage');
  const people = useQuery({queryKey:['/admin/persons','options'], queryFn:() => request<Page<Person>>('/admin/persons?limit=100'), enabled:canEdit});
  if (query.isError) return <Notice error={query.error}/>;
  if (!query.data) return <p>Loading committee…</p>;
  const committee = query.data.data;
  const chair = committee.members?.find(member => member.role === 'CHAIR');
  const vice = committee.members?.find(member => member.role === 'VICE_CHAIR');
  return (
    <aside className="panel detail-panel">
      <div className="detail-head">
        <div>
          <span className="kicker"><Users size={14}/> Standing committee</span>
          <h2>{committee.name}</h2>
          <p className="muted">{committee.code} · {committee.term?.label}</p>
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
        <button disabled title="Available in a later phase">Meetings</button>
        <button disabled title="Available in a later phase">Measures</button>
        <button disabled title="Available in a later phase">Documents</button>
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
          {canEdit && (people.isError ? <Notice error={people.error}/> : <AddPanel label="Assign committee member"><CommandForm key={committee.revision} title="New membership" path={`/committees/${id}/members`} csrf={session.csrfToken} fixed={{expectedRevision:committee.revision}} fields={[{name:'personId', label:'Person', options:people.data?.items.map(person => ({value:person.id, label:person.displayName})) ?? []},{name:'role', label:'Committee role', options:['CHAIR','VICE_CHAIR','MEMBER','STAFF'].map(value => ({value, label:value.replace('_',' ')}))},{name:'startsOn', label:'Start date', type:'date'},{name:'endsOn', label:'End date', type:'date'}]}/></AddPanel>)}
          {committee.members?.length ? (
            <table><thead><tr><th>Member</th><th>Role</th><th>From</th></tr></thead><tbody>{committee.members.map(member => (
              <tr key={member.id}><td className="cell-person">{member.person ? <Face name={member.person.displayName}/> : null}<strong>{member.person?.displayName}</strong></td><td><Status value={member.role}/></td><td>{shortDate(member.startsOn)}</td></tr>
            ))}</tbody></table>
          ) : <Empty>No committee members assigned.</Empty>}
        </>
      )}
    </aside>
  );
}

function CommitteesPage({session, highlightId}:{session:SessionView; highlightId?:string}) {
  const [selected, setSelected] = useState<string | null>(highlightId ?? null);
  const [query, setQuery] = useState('');
  useEffect(() => { if (highlightId) setSelected(highlightId); }, [highlightId]);
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
          {canEdit && <AddPanel variant="primary" label="Create Committee"><CommandForm title="New committee" path="/committees" csrf={session.csrfToken} fields={[{name:'name', label:'Committee name'},{name:'code', label:'Code (uppercase letters, numbers, hyphens)'},{name:'termId', label:'Council term', options:terms.data?.items.map(term => ({value:term.id, label:term.label})) ?? []}]} submitLabel="Create committee"/></AddPanel>}
        </div>
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
    if (initialTab && tabs.some(item => item.id === initialTab && session.permissions.includes(item.permission))) setTab(initialTab);
  }, [initialTab, session.permissions]);
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

function CaseUpload({session, measureId}:{session:SessionView; measureId:string}) {
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
      const intent = await request<{data:{id:string}}>('/documents/intents', {method:'POST', csrf:session.csrfToken, key:crypto.randomUUID(), body:{ownerType:'MEASURE', ownerId:measureId, originalFilename:file.name, declaredMime, expectedBytes:file.size, reason}});
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

function MeasureDetail({id, session}:{id:string; session:SessionView}) {
  const [tab, setTab] = useState<'overview' | 'versions' | 'timeline' | 'documents' | 'tasks'>('overview');
  const query = useQuery({queryKey:['/measures', id], queryFn:() => request<{data:Measure & {versions?:Array<{id:string;sequence:number;synopsis:string;frozenAt:string|null}>;authors?:Array<{personId:string;role:string;displayName:string}>}}>(`/measures/${id}`)});
  const timeline = useQuery({queryKey:['/measures', id, 'timeline'], queryFn:() => request<{items:TimelineEvent[]}>(`/measures/${id}/timeline`), enabled:tab === 'timeline'});
  const documents = useQuery({queryKey:['/measures', id, 'documents'], queryFn:() => request<{items:DocumentRecord[]}>(`/measures/${id}/documents`), enabled:tab === 'documents'});
  const tasks = useQuery({queryKey:['/tasks', id], queryFn:() => request<Page<WorkTask>>('/tasks?page=1&limit=50'), enabled:tab === 'tasks' && session.permissions.includes('task.manage')});
  if (query.isError) return <Notice error={query.error}/>;
  if (!query.data) return <p>Loading case file…</p>;
  const measure = query.data.data;
  const canDraft = session.permissions.includes('measure.edit') && measure.stage === 'DRAFT';
  const canSubmit = session.permissions.includes('measure.submit') && (measure.stage === 'DRAFT' || measure.stage === 'SUBMITTED');
  const canReturn = session.permissions.includes('measure.edit') && measure.stage === 'SUBMITTED';
  return (
    <aside className="panel detail-panel">
      <div className="detail-head">
        <div>
          <span className="kicker"><FileText size={14}/> {measure.typeCode.toLowerCase()} case file</span>
          <h2>{measure.title}</h2>
          <p className="muted">{measure.subject}</p>
        </div>
        <Status value={measure.stage}/>
      </div>
      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'versions' ? 'active' : ''} onClick={() => setTab('versions')}>Versions</button>
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button>
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
        <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>Tasks</button>
        <button disabled title="Readings arrive in a later phase">Readings</button>
        <button disabled title="Referrals arrive in a later phase">Referrals</button>
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
          {canSubmit && <AddPanel label="Withdraw"><CommandForm title="Withdraw this case file" path={`/measures/${id}/withdraw`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:measure.revision}} submitLabel="Withdraw"/></AddPanel>}
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
          {session.permissions.includes('document.upload') && <AddPanel label="Upload supporting file"><CaseUpload session={session} measureId={id}/></AddPanel>}
          {documents.isError ? <Notice error={documents.error}/> : documents.data?.items.length ? <table><thead><tr><th>File</th><th>State</th></tr></thead><tbody>{documents.data.items.map(doc => <tr key={doc.id}><td>{doc.title}</td><td><Status value={doc.latestState}/></td></tr>)}</tbody></table> : <Empty>No case documents yet. Uploads remain quarantined.</Empty>}
        </>
      )}
      {tab === 'tasks' && (session.permissions.includes('task.manage') ? (
        tasks.isError ? <Notice error={tasks.error}/> : (tasks.data?.items.filter(item => item.ownerId === id).length ? <table><thead><tr><th>Task</th><th>State</th><th>Action</th></tr></thead><tbody>{tasks.data.items.filter(item => item.ownerId === id).map(task => <tr key={task.id}><td>{task.title}<small>Completing this does not file the measure.</small></td><td><Status value={task.state}/></td><td>{task.state === 'OPEN' ? <AddPanel label="Complete"><CommandForm title="Complete task" path={`/tasks/${task.id}/complete`} csrf={session.csrfToken} fields={[]} fixed={{expectedRevision:task.revision}}/></AddPanel> : <span className="muted">Done</span>}</td></tr>)}</tbody></table> : <Empty>No tasks for this case file.</Empty>)
      ) : <p className="later">Task access is not on this account.</p>)}
    </aside>
  );
}

function MeasuresPage({session, highlightId}:{session:SessionView; highlightId?:string}) {
  const [selected, setSelected] = useState<string | null>(highlightId ?? null);
  const [query, setQuery] = useState('');
  useEffect(() => { if (highlightId) setSelected(highlightId); }, [highlightId]);
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
          <div><h1>Legislative Measures</h1><p>Draft case files for ordinances and resolutions. Official numbering is not configured.</p></div>
          {canCreate && <AddPanel variant="primary" label="Create draft"><CommandForm title="New draft measure" path="/measures" csrf={session.csrfToken} transform={body => ({typeCode:body.typeCode, termId:body.termId, title:body.title, subject:body.subject, synopsis:body.synopsis, reason:body.reason, authors:[{personId:String(body.personId), role:String(body.authorRole), ordering:0}]})} fields={[{name:'typeCode', label:'Type', options:[{value:'ORDINANCE', label:'Ordinance'},{value:'RESOLUTION', label:'Resolution'}]},{name:'termId', label:'Council term', options:terms.data?.items.map(term => ({value:term.id, label:term.label})) ?? []},{name:'title', label:'Title', maxLength:240},{name:'subject', label:'Subject', maxLength:500},{name:'personId', label:'Author', options:people.data?.items.map(person => ({value:person.id, label:person.displayName})) ?? []},{name:'authorRole', label:'Author role', options:[{value:'AUTHOR', label:'Author'},{value:'CO_AUTHOR', label:'Co-author'},{value:'SPONSOR', label:'Sponsor'}], defaultValue:'AUTHOR'},{name:'synopsis', label:'Synopsis', type:'textarea', maxLength:8000}]} submitLabel="Create draft"/></AddPanel>}
        </div>
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
        ) : <Empty>No draft measures yet. Seed does not invent ordinances.</Empty>}</div>}
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

export function App() {
  const cache = useQueryClient();
  const [view, setView] = useState<View>('overview');
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const [measureId, setMeasureId] = useState<string | undefined>();
  const [settingsTab, setSettingsTab] = useState<SettingsTab | undefined>();
  const session = useQuery({queryKey:['session'], queryFn:() => request<{data:SessionView}>('/auth/session'), refetchInterval:60000});
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => cache.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.query.queryKey[0] !== 'session' && event.query.state.error instanceof ApiError && event.query.state.error.status === 401) setSessionExpired(true);
  }), [cache]);
  const municipality = useQuery({queryKey:['/admin/municipality'], queryFn:() => request<{data:Municipality}>('/admin/municipality'), enabled:Boolean(session.data?.data.permissions.includes('municipality.view'))});
  const logout = useMutation({mutationFn:() => request<{data:{logoutUrl:string}}>('/auth/logout', {method:'POST', csrf:session.data?.data.csrfToken}), onSuccess:result => {cache.clear(); window.location.assign(result.data.logoutUrl);}});
  if (session.isPending) return <div className="boot" role="status"><Landmark size={34}/><p>Opening your workspace…</p></div>;
  if (session.isError || !session.data || sessionExpired) {
    return (
      <div className="login-page">
        <aside className="login-story">
          <div className="brand"><Seal/><div><h1>Municipality of San Isidro</h1><p>SANGGUNIANG BAYAN</p><small>People • Policy • Progress</small></div></div>
          <h2>Legislative Tracking &amp; Analysis System</h2>
          <p>Track. Analyze. Legislate for a Better Municipality.</p>
          <TownMark/>
        </aside>
        <main className="login-card">
          <div className="login-box">
            <h2>Welcome to your workspace</h2>
            <p>Sign in with your assigned municipal account to continue.</p>
            {session.isError && !(session.error instanceof ApiError && session.error.status === 401) && <Notice error={session.error}/>}
            {sessionExpired && <p role="status">Your session ended. Sign in again to continue.</p>}
            <a className="primary" href="/api/v1/auth/login">Sign in securely <ArrowRight size={18}/></a>
            <p className="muted" style={{marginTop:18}}>Need access? Your administrator can link your identity and request the appropriate role.</p>
          </div>
        </main>
      </div>
    );
  }
  const current = session.data.data;
  const showUsers = canAny(current.permissions, ['user.view', 'role.assign']);
  const showSettings = canAny(current.permissions, ['municipality.view', 'term.view', 'person.view', 'audit.view']);
  const allowed:View[] = ['overview', 'measures', 'people', 'committees', ...(showUsers ? ['users' as const] : []), ...(showSettings ? ['settings' as const] : [])];
  const active = allowed.includes(view) ? view : 'overview';
  const titles:Record<View, {title:string; lead:string}> = {
    overview:{title:'Dashboard', lead:'Track. Analyze. Legislate for a Better Municipality.'},
    measures:{title:'Legislative Measures', lead:'Draft case files. Official numbering is not configured.'},
    people:{title:'People', lead:'Demonstration directory used for committee assignments and measure authors.'},
    committees:{title:'Committees', lead:'Standing and special committees of the Sangguniang Bayan. Not an elected-office catalog.'},
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
            <h1>{municipality.data?.data.name.replace(' (Fictional)', '') ?? 'Municipal Government'}</h1>
            <p>SANGGUNIANG BAYAN</p>
            <small>People • Policy • Progress</small>
          </div>
        </div>
        <div className="nav-group">LEGISLATIVE WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button aria-current={active === 'overview' ? 'page' : undefined} className={active === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><Home size={16}/>Dashboard</button>
          <button aria-current={active === 'measures' ? 'page' : undefined} className={active === 'measures' ? 'active' : ''} onClick={() => setView('measures')}><FileText size={16}/>Legislative Measures</button>
          <button aria-current={active === 'people' ? 'page' : undefined} className={active === 'people' ? 'active' : ''} onClick={() => setView('people')}><Users size={16}/>People</button>
          <button aria-current={active === 'committees' ? 'page' : undefined} className={active === 'committees' ? 'active' : ''} onClick={() => setView('committees')}><ClipboardList size={16}/>Committees</button>
          <button disabled title="Available in a later phase"><Landmark size={16}/>Sessions</button>
          {later.slice(1).map(item => <button key={item.id} disabled title="Available in a later phase"><item.icon size={16}/>{item.label}</button>)}
          <div className="nav-group">ADMINISTRATION</div>
          {showUsers && <button aria-current={active === 'users' ? 'page' : undefined} className={active === 'users' ? 'active' : ''} onClick={() => setView('users')}><Users size={16}/>Users &amp; Access</button>}
          {showSettings && <button aria-current={active === 'settings' ? 'page' : undefined} className={active === 'settings' ? 'active' : ''} onClick={() => setView('settings')}><Settings size={16}/>System Settings</button>}
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
          <WorkspaceSearch session={current} onOpen={hit => {setView(hit.view); setHighlightId(hit.committeeId); setMeasureId(hit.measureId); setSettingsTab(hit.settingsTab);}}/>
          <div className="account">
            <NoticesBell session={current}/>
            <span className="avatar">{initials(current.user.displayName)}</span>
            <span className="who"><strong>{current.user.displayName}</strong><small>{roleCaption(current.permissions)}</small></span>
            <button className="icon-button" aria-label="Sign out" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={18}/></button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {active !== 'overview' && active !== 'committees' && active !== 'measures' && active !== 'people' && (
            <div className="page-heading">
              <div><h1>{titles[active].title}</h1><p>{titles[active].lead}</p></div>
            </div>
          )}
          {logout.isError && <Notice error={logout.error}/>}
          <section aria-label={titles[active].title}>
            {active === 'overview' && <Dashboard session={current} municipality={municipality.data?.data} onOpen={setView}/>}
            {active === 'measures' && <MeasuresPage session={current} highlightId={measureId}/>}
            {active === 'people' && <PeoplePage session={current}/>}
            {active === 'committees' && <CommitteesPage session={current} highlightId={highlightId}/>}
            {active === 'users' && <UsersPage session={current}/>}
            {active === 'settings' && <SettingsPage session={current} initialTab={settingsTab}/>}
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
