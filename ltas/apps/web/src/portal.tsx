import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChevronDown, Clock, FileText, Info, Landmark, Mail, MapPin, Menu, Search, User, Users, X } from 'lucide-react';
import type { Page, PublicCouncil, PublicHome, PublicMeasure, PublicMunicipality, PublicPerson, PublicPersonProfile } from '@ltas/contracts';
import { personPositionLabel } from '@ltas/contracts';
import { request } from './api';
import './portal.css';

function initials(name:string) {return name.split(' ').map(part => part[0]).slice(0, 2).join('');}
function Face({person, size='md'}:{person:Pick<PublicPerson,'id'|'displayName'|'hasPhoto'|'photoVersion'>; size?:'md'|'lg'}) {
  if (person.hasPhoto) return <img className={`portal-face ${size}`} alt="" src={`/api/v1/public/persons/${person.id}/photo?v=${person.photoVersion ?? '1'}`}/>;
  return <span className={`portal-face ${size}`} aria-hidden="true">{initials(person.displayName)}</span>;
}
function typeLabel(code:string) {return code === 'ORDINANCE' ? 'Ordinance' : code === 'RESOLUTION' ? 'Resolution' : code;}
function displayMunicipality(name:string) {return name.replace(' (Fictional)', '');}

const MUNICIPAL_SEAL = '/brand/libungan-seal.png';
const TRANSPARENCY_SEAL = '/brand/philippine_transparency_seal.png';
const FOI_LOGO = '/brand/foi.png';
const BAGONG_PILIPINAS = '/brand/bagong_pilipinas.png';
function PhilippineTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const text = new Intl.DateTimeFormat('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', second:'2-digit', hour12:true, timeZone:'Asia/Manila'}).format(now);
  return <p className="gwt-pst">Philippine Standard Time:<strong>{text}</strong></p>;
}

type PortalPage = 'home' | 'track' | 'measure' | 'council' | 'contact' | 'about';
function readRoute(path:string):{page:PortalPage; id?:string; type?:'ORDINANCE'|'RESOLUTION'|''} {
  if (path === '/council') return {page:'council'};
  if (path === '/contact') return {page:'contact'};
  if (path === '/about') return {page:'about'};
  if (path.startsWith('/track/')) return {page:'measure', id:path.slice('/track/'.length)};
  if (path === '/ordinances') return {page:'track', type:'ORDINANCE'};
  if (path === '/resolutions') return {page:'track', type:'RESOLUTION'};
  if (path === '/track') return {page:'track', type:''};
  return {page:'home'};
}

export function PublicPortal({path, navigate}:{path:string; navigate:(next:string)=>void}) {
  const route = readRoute(path);
  const [menuOpen, setMenuOpen] = useState(false);
  const home = useQuery({queryKey:['/public/home'], queryFn:() => request<{data:PublicHome}>('/public/home')});
  const municipality = home.data?.data.municipality;
  useEffect(() => {
    const titles:Record<PortalPage,string> = {
      home:'Home | Municipal Government of Libungan',
      track:'Ordinances and Resolutions | LTAS',
      measure:'Legislative record | LTAS',
      council:'Sangguniang Bayan | LTAS',
      contact:'Contact Us | LTAS',
      about:'About Us | LTAS',
    };
    document.title = titles[route.page];
  }, [route.page]);
  return (
    <div className="gwt">
      <a className="skip-link" href="#portal-main">Skip to Main Content</a>
      <header className="gwt-top" id="main-nav">
        <a className="gwt-govph" href="https://www.gov.ph/" rel="noreferrer">GOVPH</a>
        <nav aria-label="Public catalog">
          <TopLink label="Home" active={route.page === 'home'} onClick={() => navigate('/home')}/>
          <TopMenu label="About Us" active={route.page === 'about'} items={[{label:'About this catalog', href:'/about'}]} navigate={navigate}/>
          <TopMenu label="Government" active={route.page === 'council'} items={[{label:'Sangguniang Bayan', href:'/council'}, {label:'LGU Officials', href:'/council'}]} navigate={navigate}/>
          <TopMenu label="Transparency" active={route.page === 'track' || route.page === 'measure'} items={[{label:'Ordinances and Resolutions', href:'/track'}, {label:'Ordinances', href:'/ordinances'}, {label:'Resolutions', href:'/resolutions'}]} navigate={navigate}/>
          <TopLink label="Contact Us" active={route.page === 'contact'} onClick={() => navigate('/contact')}/>
        </nav>
        <a className="gwt-signin" href="/">Sign in</a>
        <button className="gwt-burger" type="button" aria-label="Menu" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={18}/> : <Menu size={18}/>}</button>
      </header>
      {menuOpen && (
        <div className="gwt-drawer">
          {([['Home','/home'],['Track','/track'],['Ordinances','/ordinances'],['Resolutions','/resolutions'],['Municipal Council','/council'],['About this catalog','/about'],['Contact Us','/contact']] as Array<[string, string]>).map(([label, href]) => (
            <button key={href} type="button" onClick={() => {navigate(href); setMenuOpen(false);}}>{label}</button>
          ))}
        </div>
      )}
      <div className="gwt-masthead">
        <button className="gwt-agency" type="button" onClick={() => navigate('/home')}>
          <img className="gwt-ph-seal" src={MUNICIPAL_SEAL} alt=""/>
          <span>
            <small id="agency-heading">Republic of the Philippines</small>
            <strong id="agency-name">{displayMunicipality(municipality?.name ?? 'Municipality of Libungan')}</strong>
            <small id="agency-tagline">{municipality?.province ?? 'Province of Cotabato'}</small>
          </span>
        </button>
        <div className="gwt-brand-side">
          <p className="gwt-amping">Amping <span>Libungan</span></p>
          <PhilippineTime/>
        </div>
      </div>
      <div className="gwt-ears">
        <img className="gwt-ear-mark" src={TRANSPARENCY_SEAL} alt="Philippine Transparency Seal"/>
        <img className="gwt-ear-mark" src={FOI_LOGO} alt="Freedom of Information"/>
        <img className="gwt-ear-mark" src={BAGONG_PILIPINAS} alt="Bagong Pilipinas"/>
      </div>
      {route.page === 'home' && (
        <section className="gwt-banner" aria-label="Banner">
          <p>SANGGUNIANG BAYAN</p>
          <h1>Legislative Tracking &amp; Analysis System</h1>
          <p>Recorded ordinances, resolutions, and the Sanggunian directory from this LTAS installation.</p>
        </section>
      )}
      <p className="gwt-notice">This is an LTAS demonstration catalog using the Philippine Government Website Template. It is not the official <a href="https://www.libungan.gov.ph/" rel="noreferrer">libungan.gov.ph</a> website and not an approved public release.</p>
      <div className={`gwt-shell${route.page === 'council' ? ' gwt-shell-wide' : ''}`}>
        <main id="portal-main">
          {route.page !== 'council' && <nav className="gwt-crumbs" aria-label="You are here:">
            <button type="button" onClick={() => navigate('/home')}>Home</button>
            {route.page !== 'home' && <span>{route.page === 'measure' ? 'Legislative record' : route.page === 'track' ? 'Ordinances and Resolutions' : route.page === 'contact' ? 'Contact Us' : 'About Us'}</span>}
          </nav>}
          {route.page === 'home' && <HomePage navigate={navigate} home={home}/>}
          {route.page === 'track' && <TrackPage navigate={navigate} initialType={route.type ?? ''}/>}
          {route.page === 'measure' && route.id && <MeasurePage id={route.id} navigate={navigate}/>}
          {route.page === 'council' && <CouncilPage/>}
          {route.page === 'contact' && <ContactPage municipality={municipality}/>}
          {route.page === 'about' && <AboutPage/>}
        </main>
        {route.page !== 'council' && <aside className="gwt-side">
          <SideBox title="Legislative Tracking" action="Open catalog" onClick={() => navigate('/track')}><BookOpen size={16}/> Search recorded ordinances and resolutions from LTAS.</SideBox>
          <SideBox title="Sangguniang Bayan" action="View council" onClick={() => navigate('/council')}><Users size={16}/> Directory names, photographs, and committee assignments.</SideBox>
          <SideBox title="Official website" href="https://www.libungan.gov.ph/"><Landmark size={16}/> Municipal Government of Libungan on GOV.PH.</SideBox>
        </aside>}
      </div>
      <footer id="footer" className="gwt-foot">
        <div>
          <h4>GOVPH</h4>
          <p>A Philippine Government Website Template (GWT 26) layout for this LTAS catalog.</p>
          <p><a href="https://www.gov.ph/" rel="noreferrer">GOV.PH</a> · <a href="https://www.libungan.gov.ph/" rel="noreferrer">Official municipal website</a></p>
        </div>
        <div>
          <h4>Government Links</h4>
          <p><a href="https://www.officialgazette.gov.ph/" rel="noreferrer">Official Gazette</a></p>
          <p><a href="https://data.gov.ph/" rel="noreferrer">Open Data Portal</a></p>
          <p><a href="https://www.foi.gov.ph/" rel="noreferrer">Freedom of Information</a></p>
        </div>
        <div>
          <h4>Contact Us</h4>
          <p>Municipal Hall Bldg., Brgy. Poblacion, Libungan, Cotabato 9411</p>
          <p>Published contact on the official site: info@libungan.gov.ph</p>
          <p>Office hours Monday–Friday, 8:00 AM–5:00 PM</p>
        </div>
      </footer>
    </div>
  );
}

function TopLink({label, active, onClick}:{label:string; active:boolean; onClick:()=>void}) {
  return <button type="button" className={active ? 'active' : ''} onClick={onClick}>{label}</button>;
}
function TopMenu({label, active, items, navigate}:{label:string; active:boolean; items:Array<{label:string; href:string}>; navigate:(href:string)=>void}) {
  return (
    <details className={`gwt-drop ${active ? 'active' : ''}`}>
      <summary>{label}</summary>
      <div>{items.map(item => <button key={item.label} type="button" onClick={() => navigate(item.href)}>{item.label}</button>)}</div>
    </details>
  );
}
function SideBox({title, children, action, onClick, href}:{title:string; children:ReactNode; action?:string; onClick?:()=>void; href?:string}) {
  return (
    <article className="gwt-infobox">
      <h3>{title}</h3>
      <p>{children}</p>
      {href ? <a href={href} rel="noreferrer">{title}</a> : action && onClick ? <button type="button" onClick={onClick}>{action} <ArrowRight size={14}/></button> : null}
    </article>
  );
}

function HomePage({navigate, home}:{navigate:(next:string)=>void; home:ReturnType<typeof useQuery<{data:PublicHome}>>}) {
  if (home.isPending) return <p className="portal-status" role="status">Loading the public catalog…</p>;
  if (home.isError) return <p className="portal-status" role="alert">{home.error.message}</p>;
  const data = home.data.data;
  return (
    <>
      <ul className="portal-stats">
        <li><FileText size={18}/><strong>{data.stats.measures}</strong><span>Submitted measures</span></li>
        <li><Users size={18}/><strong>{data.stats.people}</strong><span>Directory names</span></li>
        <li><Landmark size={18}/><strong>{data.stats.committees}</strong><span>Committees</span></li>
        <li><Clock size={18}/><strong>{data.stats.sessions}</strong><span>Recorded sessions</span></li>
      </ul>
      <div className="portal-head"><h2>Recent documents</h2><button className="portal-text" type="button" onClick={() => navigate('/track')}>View all</button></div>
      {data.recentMeasures.length ? (
        <div className="portal-cards">{data.recentMeasures.map(item => <MeasureCard key={item.id} item={item} onOpen={() => navigate(`/track/${item.id}`)}/>)}</div>
      ) : <p className="portal-empty">No submitted measures are in this catalog yet. Draft case files stay in the staff workspace.</p>}
      <div className="portal-split">
        <article className="portal-panel">
          <h2>Catalog notice</h2>
          <p>{data.note}</p>
          <p>The official municipal website’s Ordinances page is empty as of this review. LTAS supplies the recorded case list below. An absence here is not proof that legislation does not exist.</p>
        </article>
        <article className="portal-panel">
          <h2>Presiding officer</h2>
          {data.officers.viceMayor ? (
            <div className="portal-officer">
              <Face person={data.officers.viceMayor} size="lg"/>
              <div>
                <strong>{data.officers.viceMayor.displayName}</strong>
                <small>{personPositionLabel(data.officers.viceMayor.positionCode)}</small>
                <p>Directory name from LTAS. A public message is not on file.</p>
              </div>
            </div>
          ) : <p>No vice mayor is recorded in the directory.</p>}
        </article>
      </div>
    </>
  );
}

function TrackPage({navigate, initialType}:{navigate:(next:string)=>void; initialType:'ORDINANCE'|'RESOLUTION'|''}) {
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [typeCode, setTypeCode] = useState<'ORDINANCE'|'RESOLUTION'|''>(initialType);
  useEffect(() => { setTypeCode(initialType); }, [initialType]);
  const query = useQuery({
    queryKey:['/public/measures', q, typeCode],
    queryFn:() => request<Page<PublicMeasure> & {note:string}>(`/public/measures?page=1&limit=50&q=${encodeURIComponent(q)}${typeCode ? `&typeCode=${typeCode}` : ''}`),
  });
  function submit(event:FormEvent) {
    event.preventDefault();
    setQ(draft.trim());
  }
  return (
    <section>
      <h1>Ordinances and Resolutions</h1>
      <p>Search titles the secretariat has submitted. Draft and withdrawn case files stay in the staff workspace. A listing here is not an official ordinance or resolution.</p>
      <form className="portal-search" onSubmit={submit}>
        <label className="portal-search-field"><Search size={16}/><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Search title…"/></label>
        <button className="portal-primary" type="submit">Search</button>
      </form>
      <div className="portal-chips">
        {[{value:'', label:'All'}, {value:'ORDINANCE', label:'Ordinance'}, {value:'RESOLUTION', label:'Resolution'}].map(option => (
          <button key={option.label} type="button" className={typeCode === option.value ? 'active' : ''} onClick={() => setTypeCode(option.value as typeof typeCode)}>{option.label}</button>
        ))}
      </div>
      {query.isPending ? <p className="portal-status" role="status">Loading measures…</p> : query.isError ? <p className="portal-status" role="alert">{query.error.message}</p> : query.data.items.length ? (
        <div className="portal-cards">{query.data.items.map(item => <MeasureCard key={item.id} item={item} onOpen={() => navigate(`/track/${item.id}`)}/>)}</div>
      ) : <p className="portal-empty">No submitted measures match this search.</p>}
    </section>
  );
}

function MeasurePage({id, navigate}:{id:string; navigate:(next:string)=>void}) {
  const query = useQuery({queryKey:['/public/measures', id], queryFn:() => request<{data:PublicMeasure}>('/public/measures/' + id)});
  if (query.isPending) return <p className="portal-status" role="status">Loading measure…</p>;
  if (query.isError) return <p className="portal-status" role="alert">{query.error.message}</p>;
  const item = query.data.data;
  return (
    <article>
      <button className="portal-text" type="button" onClick={() => navigate('/track')}>Back to tracking</button>
      <p className="portal-kicker">{typeLabel(item.typeCode)}</p>
      <h1>{item.title}</h1>
      <dl className="portal-facts">
        <div><dt>Type</dt><dd>{typeLabel(item.typeCode)}</dd></div>
        <div><dt>Official number</dt><dd>{item.officialNumber != null ? `${item.officialSeries ?? ''} ${item.officialYear ?? ''} ${item.officialNumber}` : 'Not assigned'}</dd></div>
        <div><dt>Submitted record</dt><dd>{new Intl.DateTimeFormat('en-US', {dateStyle:'medium', timeZone:'Asia/Manila'}).format(new Date(item.createdAt))}</dd></div>
      </dl>
      <p className="portal-note">This page lists metadata already stored in LTAS. It is not a certified copy, official ordinance text, or approved public release.</p>
    </article>
  );
}

function seatCaption(code:string) {
  if (code === 'VICE_MAYOR') return 'Vice Mayor · Presiding officer of the Sangguniang Bayan';
  if (code === 'COUNCILOR') return 'Regular member';
  if (code === 'LIGA_PRESIDENT') return 'Liga ng mga Barangay President';
  if (code === 'SK_PRESIDENT') return 'SK Federation President';
  return personPositionLabel(code);
}
function committeeRole(role:string) {
  if (role === 'CHAIR') return 'Chairman';
  if (role === 'VICE_CHAIR') return 'Vice Chairman';
  if (role === 'MEMBER') return 'Member';
  if (role === 'STAFF') return 'Staff';
  return role.replaceAll('_', ' ');
}
function CouncilPhoto({person, frame}:{person:PublicPerson; frame:'hero'|'card'|'modal'}) {
  if (person.hasPhoto) return <img className={`council-photo ${frame}`} alt="" src={`/api/v1/public/persons/${person.id}/photo?v=${person.photoVersion ?? '1'}`}/>;
  return <span className={`council-photo ${frame} fallback`} aria-hidden="true">{initials(person.displayName)}</span>;
}
function CouncilPage() {
  const [termId, setTermId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useQuery({queryKey:['/public/council', termId], queryFn:() => request<{data:PublicCouncil}>(`/public/council${termId ? `?termId=${termId}` : ''}`), placeholderData:keepPreviousData});
  const profile = useQuery({queryKey:['/public/persons', openId], queryFn:() => request<{data:PublicPersonProfile}>(`/public/persons/${openId}`), enabled:Boolean(openId)});
  if (query.isPending) return <p className="portal-status" role="status">Loading the municipal council…</p>;
  if (query.isError) return <p className="portal-status" role="alert">{query.error.message}</p>;
  const council = query.data.data;
  const exOfficio = [council.liga, council.sk].filter((person):person is PublicPerson => Boolean(person));
  return (
    <section className="council-page">
      <header className="council-intro">
        <h1>Municipal Council</h1>
        <p>The Sangguniang Bayan — directory names for the selected council term.</p>
      </header>
      <div className="council-termbar">
        <label>
          <span><Users size={16}/> Select Council Term:</span>
          <select value={termId || council.term?.id || ''} onChange={event => setTermId(event.target.value)}>
            {council.terms.map(term => <option key={term.id} value={term.id}>{term.label}</option>)}
          </select>
        </label>
      </div>
      <p className="council-disclaimer">A position label is not a legal seat, election result, or official membership. Authored counts are submitted records in this catalog.</p>
      {council.presiding && (
        <section className="council-block">
          <h2><span className="council-mark">★</span> Presiding Officer</h2>
          <p>Vice Mayor — Presiding Officer of the Sangguniang Bayan</p>
          <article className="council-hero">
            <CouncilPhoto person={council.presiding} frame="hero"/>
            <div>
              <span className="council-pill amber">Presiding officer</span>
              <h3>{council.presiding.displayName}</h3>
              <p>{seatCaption(council.presiding.positionCode)}</p>
              <button type="button" className="council-details" onClick={() => setOpenId(council.presiding!.id)}>View Details</button>
            </div>
          </article>
        </section>
      )}
      <MemberGrid title="Sangguniang Bayan Members" lead="The elected Municipal Councilors — your representatives." people={council.members} onOpen={setOpenId} roster/>
      {exOfficio.length > 0 && <MemberGrid title="Ex officio members" lead="Liga ng mga Barangay President and SK Federation President." people={exOfficio} onOpen={setOpenId}/>}
      {openId && <PersonDialog personId={openId} profile={profile.data?.data} pending={profile.isPending} error={profile.error} onClose={() => setOpenId(null)}/>}
    </section>
  );
}
function committeeShort(name:string) {
  return name.replace(/^committee on\s+/i, '');
}
function MemberGrid({title, lead, people, onOpen, roster=false}:{title:string; lead:string; people:PublicPerson[]; onOpen:(id:string)=>void; roster?:boolean}) {
  return (
    <section className="council-block">
      <h2 className={roster ? 'council-plain' : undefined}><span className="council-heading-icon">{roster ? <Landmark size={14}/> : <Users size={14}/>}</span> {title} <span className="council-count">{people.length}</span></h2>
      <p>{lead}</p>
      {people.length ? (
        <div className="council-grid">
          {people.map(person => {
            const assignments = person.assignments ?? [];
            const shown = assignments.slice(0, 3);
            const extra = assignments.length - shown.length;
            return (
              <button key={person.id} type="button" className={roster ? 'council-card council-card-roster' : 'council-card'} onClick={() => onOpen(person.id)} aria-label={`View details for ${person.displayName}`}>
                <span className="council-info" aria-hidden="true"><Info size={14}/></span>
                <CouncilPhoto person={person} frame="card"/>
                {roster ? (
                  <>
                    <span className="council-role"><User size={13}/> SB Member</span>
                    <strong>{person.displayName}</strong>
                    <ul className="council-assignments">
                      {shown.length ? shown.map(item => (
                        <li key={`${item.role}-${item.committeeName}`}><b>{committeeRole(item.role)}</b><span aria-hidden="true">·</span><span className="council-committee">{committeeShort(item.committeeName)}</span></li>
                      )) : <li className="council-assignment-empty">No committee assignments recorded for this term.</li>}
                    </ul>
                    {extra > 0 && <span className="council-more">+ {extra} more assignment{extra === 1 ? '' : 's'}</span>}
                  </>
                ) : (
                  <>
                    <strong>{person.displayName}</strong>
                    <small>{seatCaption(person.positionCode)}</small>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ) : <p className="portal-empty">No people are encoded for this seat in the selected term.</p>}
    </section>
  );
}
function PersonDialog({personId, profile, pending, error, onClose}:{personId:string; profile?:PublicPersonProfile; pending:boolean; error:unknown; onClose:()=>void}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function onKey(event:KeyboardEvent) { if (event.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, []);
  const person = profile ?? {id:personId, displayName:'', positionCode:'', hasPhoto:false};
  return (
    <div className="council-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="council-dialog" role="dialog" aria-modal="true" aria-labelledby="council-person-name">
        <header className="council-dialog-head">
          <CouncilPhoto person={person} frame="modal"/>
          <div>
            <h2 id="council-person-name">{profile?.displayName ?? 'Council directory'}</h2>
            {profile && <span className="council-pill light">{seatCaption(profile.positionCode)}</span>}
          </div>
          <button type="button" className="council-close" aria-label="Close" onClick={onClose}><X size={18}/></button>
        </header>
        {pending && <p className="portal-status" role="status">Loading directory details…</p>}
        {error instanceof Error && <p className="portal-status" role="alert">{error.message}</p>}
        {profile && (
          <div className="council-dialog-body">
            <div className="council-stats">
              <article><span>Terms listed</span><strong>{profile.termsListed}</strong></article>
              <article><FileText size={16}/><span>Authored</span><strong>{profile.authored}</strong></article>
              <article><Users size={16}/><span>Co-authored</span><strong>{profile.coAuthored}</strong></article>
            </div>
            <h3>Positions listed</h3>
            <p>Directory rows with this display name. This is not a certified service history. Counts are submitted records only.</p>
            {profile.seats.map((seat, index) => (
              <details key={seat.termId} className="council-seat" open={index === 0}>
                <summary>
                  <span><strong>{seat.termLabel}</strong><small>{seat.startsOn.slice(0, 4)}–{seat.endsOn.slice(0, 4)}</small></span>
                  <em>{seatCaption(seat.positionCode)}</em>
                  <ChevronDown size={16}/>
                </summary>
                <div className="council-seat-body">
                  <div><span>Authored</span><strong>{seat.authored}</strong><small>submitted records</small></div>
                  <div><span>Co-authored</span><strong>{seat.coAuthored}</strong><small>submitted records</small></div>
                  {seat.committees.length ? (
                    <ul>{seat.committees.map(item => <li key={`${item.name}-${item.role}`} className={item.role === 'CHAIR' ? 'chair' : item.role === 'VICE_CHAIR' ? 'vice' : ''}><b>{committeeRole(item.role)}</b> · {item.name}</li>)}</ul>
                  ) : <p>No committee assignments recorded for this term.</p>}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactPage({municipality}:{municipality?:PublicMunicipality}) {
  return (
    <section>
      <h1>Contact Us</h1>
      <p>Contact details below are those published on the official municipal website. This LTAS catalog does not replace that site.</p>
      <p><MapPin size={16}/> Municipal Hall Bldg., Brgy. Poblacion, Libungan, Cotabato 9411</p>
      <p><Mail size={16}/> info@libungan.gov.ph</p>
      <p><Clock size={16}/> Monday–Friday, 8:00 AM–5:00 PM</p>
      {municipality && <p>LTAS installation: {displayMunicipality(municipality.name)}, {municipality.province}.</p>}
    </section>
  );
}
function AboutPage() {
  return (
    <section>
      <h1>About this catalog</h1>
      <p>This page uses the Philippine Government Website Template (GWT) so the legislative catalog can sit in a familiar municipal layout. History, hymn, citizen’s charter, and other official About pages remain on <a href="https://www.libungan.gov.ph/" rel="noreferrer">libungan.gov.ph</a>.</p>
      <p>Measures, people, photographs, committees, and sessions shown here are live LTAS records. They are not official publications.</p>
    </section>
  );
}

function MeasureCard({item, onOpen}:{item:PublicMeasure; onOpen:()=>void}) {
  return (
    <button className="portal-measure" type="button" onClick={onOpen}>
      <span className={`portal-type ${item.typeCode.toLowerCase()}`}>{typeLabel(item.typeCode)}</span>
      <strong>{item.title}</strong>
      <span className="portal-meta">{item.officialNumber != null ? `${item.officialSeries ?? ''} ${item.officialYear ?? ''}-${item.officialNumber}` : 'Official number not assigned'}</span>
    </button>
  );
}
export function isPublicPath(path:string) {
  return path === '/home' || path === '/track' || path.startsWith('/track/') || path === '/council' || path === '/ordinances' || path === '/resolutions' || path === '/contact' || path === '/about';
}

export function usePublicPath() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useMemo(() => (next:string) => {
    window.history.pushState({}, '', next);
    setPath(next);
  }, []);
  return {path, navigate};
}
