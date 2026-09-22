// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
function json(body:unknown, status = 200) {
  return {ok:status < 400, status, json:async() => body};
}
function mount() {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);
}
describe('workspace boundaries', () => {
  it('offers Keycloak login when unauthenticated, without a demo bypass', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({status:401, detail:'Sign in', code:'LOGIN_REQUIRED'}, 401)));
    mount();
    expect(await screen.findByRole('link', {name:/Sign in securely/})).toHaveAttribute('href', '/api/v1/auth/login');
    expect(screen.getByRole('heading', {name:'Welcome to your workspace'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name:'Municipality of San Isidro'})).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name:/demo/i})).not.toBeInTheDocument();
  });
  it('does not show administrative pages to a scoped committee user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Casey Santos', municipalityId:'m'}, permissions:['committee.view'], csrfToken:'test'}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Users & Access'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Access review'})).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name:/Committees/}).length).toBeGreaterThan(0);
  });
  it('renders prototype workspace chrome without inventing later-phase records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Maria Santos', municipalityId:'m'}, permissions:['committee.view','municipality.view','user.view','role.assign','audit.view'], csrfToken:'test'}});
      if (String(url).includes('/admin/municipality')) return json({data:{id:'m', name:'Municipality of San Isidro (Fictional)', province:'Demo', code:'SAN-ISIDRO', timezone:'Asia/Manila', revision:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    expect(await screen.findByRole('heading', {name:/Legislative Tracking & Analysis System/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Dashboard'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', {name:'Legislative Measures'})).not.toBeDisabled();
    const peopleButtons = screen.getAllByRole('button', {name:'People'});
    for (const button of peopleButtons) expect(button).not.toBeDisabled();
    const committeeButtons = screen.getAllByRole('button', {name:'Committees'});
    for (const button of committeeButtons) expect(button).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name:'Legislative Measures'}));
    expect(await screen.findByRole('heading', {name:'Legislative Measures'})).toBeInTheDocument();
    expect(screen.getByText(/This account cannot list legislative measures/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Dashboard'}));
    expect(await screen.findByText(/Together for a Better/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Sessions'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'e-Library'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Reports & Analytics'})).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name:'Users & Access'}).length).toBeGreaterThan(0);
    expect(screen.getByText(/Calendar access is not on this account/)).toBeInTheDocument();
    expect(screen.getByText('Proposed Measures')).toBeInTheDocument();
    expect(screen.getByText('Enacted Measures')).toBeInTheDocument();
    expect(screen.getByText('Pending Committee')).toBeInTheDocument();
    expect(screen.getByText('For Second Reading')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Mayor Action')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(5);
    expect(screen.queryByText('126')).not.toBeInTheDocument();
    expect(screen.queryByText('89')).not.toBeInTheDocument();
  });
  it('lets legislative staff open measures and keeps official filing hidden', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Riley Flores', municipalityId:'m'}, permissions:['measure.view','measure.create','measure.edit','measure.submit','measure.version.create','document.upload','document.view','task.manage','notification.view','person.view','term.view','committee.view','committee.referral.view'], csrfToken:'test'}});
      if (String(url).includes('/measures/stats')) return json({data:{proposed:2, pendingCommittee:0}});
      if (String(url).includes('/referrals')) return json({items:[], pageInfo:{page:1, limit:50, total:0}});
      if (String(url).includes('/measures/m1')) return json({data:{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:null, revision:1, authors:[{personId:'p1', role:'AUTHOR', ordering:0, displayName:'Taylor Mendoza'}], versions:[{id:'v1', sequence:1, synopsis:'First synopsis', frozenAt:null}]}});
      if (String(url).includes('/measures')) return json({items:[{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:null, revision:1}], pageInfo:{page:1, limit:100, total:1}});
      if (String(url).includes('/admin/terms')) return json({items:[{id:'t', label:'2025–2028 demonstration term', startsOn:'2025-07-01', endsOn:'2028-06-30', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      if (String(url).includes('/admin/persons')) return json({items:[{id:'p1', displayName:'Taylor Mendoza'}], pageInfo:{page:1, limit:100, total:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    const measureButtons = await screen.findAllByRole('button', {name:'Legislative Measures'});
    expect(measureButtons.length).toBeGreaterThan(0);
    for (const button of measureButtons) expect(button).not.toBeDisabled();
    fireEvent.click(measureButtons[0]!);
    expect(await screen.findByRole('heading', {name:'Legislative Measures'})).toBeInTheDocument();
    expect(screen.getByText(/Official numbering is not configured/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:/File official/i})).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', {name:'An Ordinance Establishing a Draft Record'})).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', {name:'Referrals'}));
    expect(await screen.findByText(/No committee referrals recorded/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Record referral'})).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Create draft'}));
    expect(screen.getByRole('dialog', {name:'New draft measure'})).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Synopsis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Close'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', {name:'View full screen'}));
    expect(screen.getByRole('dialog', {name:'An Ordinance Establishing a Draft Record'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Exit full screen'}));
    expect(screen.queryByRole('dialog', {name:'An Ordinance Establishing a Draft Record'})).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name:'People'})[0]!);
    expect(await screen.findByRole('heading', {name:'People'})).toBeInTheDocument();
    expect(await screen.findByText('Taylor Mendoza')).toBeInTheDocument();
    expect(screen.getByText(/Not elected-office records/)).toBeInTheDocument();
  });
  it('lets committee staff open referred measures without creating drafts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Casey Santos', municipalityId:'m'}, permissions:['municipality.view','term.view','committee.view','committee.referral.view','measure.view','document.view','task.manage','notification.view'], csrfToken:'test'}});
      if (String(url).includes('/admin/municipality')) return json({data:{id:'m', name:'Municipality of San Isidro (Fictional)', province:'Demo', code:'SAN-ISIDRO', timezone:'Asia/Manila', revision:1}});
      if (String(url).includes('/measures/stats')) return json({data:{proposed:0, pendingCommittee:1}});
      if (String(url).includes('/referrals')) return json({items:[{id:'r1', measureId:'m1', measureVersionId:'v1', committeeId:'c1', groupId:'g1', referralSequence:1, role:'LEAD', sourceKind:'SECRETARIAT_RECORDED', referredOn:'2026-09-22', dueOn:null, disposition:'OPEN', revision:1, committee:{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance'}}], pageInfo:{page:1, limit:50, total:1}});
      if (String(url).includes('/measures/m1')) return json({data:{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:'v1', revision:1, authors:[], versions:[]}});
      if (String(url).includes('/measures')) return json({items:[{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:'v1', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    fireEvent.click((await screen.findAllByRole('button', {name:'Legislative Measures'}))[0]!);
    expect(await screen.findByRole('heading', {name:'Legislative Measures'})).toBeInTheDocument();
    expect(screen.getByText(/referred to your assigned committee/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Create draft'})).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', {name:'An Ordinance Establishing a Draft Record'})).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', {name:'Referrals'}));
    expect(await screen.findByText('Committee on Good Governance')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Record referral'})).not.toBeInTheDocument();
  });
  it('lets the secretary record a referral from the case file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Jamie Cruz', municipalityId:'m'}, permissions:['measure.view','measure.create','committee.view','committee.referral.view','committee.referral.create','committee.referral.close','term.view','person.view'], csrfToken:'test'}});
      if (String(url).includes('/admin/municipality')) return json({data:{id:'m', name:'Municipality of San Isidro (Fictional)', province:'Demo', code:'SAN-ISIDRO', timezone:'Asia/Manila', revision:1}});
      if (String(url).includes('/referrals')) return json({items:[], pageInfo:{page:1, limit:50, total:0}});
      if (String(url).includes('/measures/m1')) return json({data:{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:'v1', revision:1, authors:[], versions:[]}});
      if (String(url).includes('/measures')) return json({items:[{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:'v1', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      if (String(url).includes('/committees')) return json({items:[{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    fireEvent.click((await screen.findAllByRole('button', {name:'Legislative Measures'}))[0]!);
    fireEvent.click(await screen.findByRole('button', {name:'Referrals'}));
    fireEvent.click(await screen.findByRole('button', {name:'Record referral'}));
    expect(screen.getByRole('dialog', {name:'Record committee referral'})).toBeInTheDocument();
    expect(screen.getByLabelText('Lead committee')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Close'}));
    expect(screen.queryByRole('dialog', {name:'Record committee referral'})).not.toBeInTheDocument();
  });
  it('lets the secretary open sessions, calendar, voting, and documents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Jamie Cruz', municipalityId:'m'}, permissions:['session.view','session.manage','session.close','attendance.record','vote.view','vote.record','committee.meeting.view','document.view','document.upload','term.view','measure.view'], csrfToken:'test'}});
      if (String(url).includes('/admin/municipality')) return json({data:{id:'m', name:'Municipality of San Isidro (Fictional)', province:'Demo', code:'SAN-ISIDRO', timezone:'Asia/Manila', revision:1}});
      if (String(url).includes('/measures/stats')) return json({data:{proposed:0, pendingCommittee:0}});
      if (String(url).includes('/admin/terms')) return json({items:[{id:'t', label:'2025–2028 demonstration term', startsOn:'2025-07-01', endsOn:'2028-06-30', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    fireEvent.click((await screen.findAllByRole('button', {name:'Sessions'}))[0]!);
    expect(await screen.findByRole('heading', {name:'Sessions'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Schedule session'}));
    expect(screen.getByRole('dialog', {name:'Schedule session'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Close'}));
    fireEvent.click(screen.getByRole('button', {name:'Calendar'}));
    expect(await screen.findByRole('heading', {name:'Calendar'})).toBeInTheDocument();
    expect(screen.getByText(/Not an official hearing calendar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Voting & Attendance'}));
    expect(await screen.findByRole('heading', {name:'Voting & Attendance'})).toBeInTheDocument();
    expect(screen.getByText(/not a certified vote or quorum/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Documents'}));
    expect(await screen.findByRole('heading', {name:'Documents'})).toBeInTheDocument();
    expect(screen.getByText(/Not the e-Library/)).toBeInTheDocument();
  });
  it('lets the secretary open the e-library and reports catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Jamie Cruz', municipalityId:'m'}, permissions:['library.view','report.view','measure.view'], csrfToken:'test'}});
      if (String(url).includes('/admin/municipality')) return json({data:{id:'m', name:'Municipality of San Isidro (Fictional)', province:'Demo', code:'SAN-ISIDRO', timezone:'Asia/Manila', revision:1}});
      if (String(url).includes('/measures/stats')) return json({data:{proposed:2, pendingCommittee:1}});
      if (String(url).includes('/library')) return json({items:[{id:'m1', kind:'MEASURE', title:'An Ordinance Establishing a Draft Record', detail:'Synthetic', state:'DRAFT'}], pageInfo:{page:1, limit:100, total:1}});
      if (String(url).includes('/reports')) return json({data:{definitionVersion:'P-REPORT-INTERIM-1', asOf:'2026-09-22T00:00:00.000Z', timezone:'Asia/Manila', warnings:['These counts are an engineering catalog (P-REPORT-INTERIM-1). D-11 metric definitions are unsigned.'], metrics:[{key:'measures.proposed', label:'Proposed measures', value:2, definition:'Distinct visible measures in DRAFT or SUBMITTED. Same definition as the dashboard Proposed Measures KPI.'},{key:'referrals.pendingMeasures', label:'Pending committee', value:1, definition:'Distinct visible measures with at least one OPEN referral.'}]}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    fireEvent.click((await screen.findAllByRole('button', {name:'e-Library'}))[0]!);
    expect(await screen.findByRole('heading', {name:'e-Library'})).toBeInTheDocument();
    expect(screen.getByText(/Not an official archive/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Search library'}));
    expect(await screen.findByText('An Ordinance Establishing a Draft Record')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Reports & Analytics'}));
    expect(await screen.findByRole('heading', {name:'Reports & Analytics'})).toBeInTheDocument();
    expect(screen.getByText(/Not political scoring/)).toBeInTheDocument();
    expect((await screen.findAllByText(/P-REPORT-INTERIM-1/)).length).toBeGreaterThan(0);
    expect(screen.getByText('Proposed measures')).toBeInTheDocument();
    expect(screen.getByText('Pending committee')).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Download CSV'})).toBeInTheDocument();
  });
  it('lets the secretary schedule a committee meeting and open committee documents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Jamie Cruz', municipalityId:'m'}, permissions:['committee.view','committee.meeting.view','committee.meeting.manage','committee.meeting.close','document.view','document.upload','term.view'], csrfToken:'test'}});
      if (String(url).includes('/committees/c1/meetings')) return json({items:[], pageInfo:{page:1, limit:50, total:0}});
      if (String(url).includes('/committees/c1/documents')) return json({items:[]});
      if (String(url).includes('/committees/c1')) return json({data:{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1, term:{id:'t', label:'2025–2028 demonstration term', startsOn:'2025-07-01', endsOn:'2028-06-30', revision:1}, members:[]}});
      if (String(url).includes('/committees')) return json({items:[{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    fireEvent.click((await screen.findAllByRole('button', {name:'Committees'}))[0]!);
    expect(await screen.findByRole('heading', {name:'Committee on Good Governance'})).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', {name:'Meetings'}));
    fireEvent.click(await screen.findByRole('button', {name:'Schedule meeting'}));
    expect(screen.getByRole('dialog', {name:'Schedule committee meeting'})).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Scheduled at')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Close'}));
    expect(screen.queryByRole('dialog', {name:'Schedule committee meeting'})).not.toBeInTheDocument();
    expect(screen.getByText(/No committee meetings recorded/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name:'Documents'}).at(-1)!);
    expect(await screen.findByText(/No committee documents yet/)).toBeInTheDocument();
    expect(screen.getByText('Upload committee file')).toBeInTheDocument();
  });
  it('searches live committee records from the top bar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Jamie Cruz', municipalityId:'m'}, permissions:['committee.view','committee.manage','committee.members.manage','person.view','term.view'], csrfToken:'test'}});
      if (String(url).includes('/committees/c1')) return json({data:{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1, term:{id:'t', label:'2025–2028 demonstration term', startsOn:'2025-07-01', endsOn:'2028-06-30', revision:1}, members:[]}});
      if (String(url).includes('/committees')) return json({items:[{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      if (String(url).includes('/admin/terms')) return json({items:[{id:'t', label:'2025–2028 demonstration term', startsOn:'2025-07-01', endsOn:'2028-06-30', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    const box = await screen.findByRole('combobox', {name:'Search workspace'});
    fireEvent.focus(box);
    expect(await screen.findByRole('option', {name:/Dashboard/})).toBeInTheDocument();
    fireEvent.change(box, {target:{value:'Good'}});
    expect(await screen.findByRole('option', {name:/Committee on Good Governance/})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', {name:/Committee on Good Governance/}));
    expect(await screen.findByRole('heading', {name:'Committees'})).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', {name:'View full screen'}));
    expect(screen.getByRole('dialog', {name:'Committee on Good Governance'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Exit full screen'}));
    expect(screen.queryByRole('dialog', {name:'Committee on Good Governance'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Create Committee'}));
    expect(screen.getByRole('dialog', {name:'New committee'})).toBeInTheDocument();
    expect(screen.getByLabelText('Committee name')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Close'}));
    expect(screen.queryByRole('dialog', {name:'New committee'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Members'}));
    fireEvent.click(screen.getByText('Assign committee member'));
    expect(screen.getByLabelText('End date')).toHaveValue('2028-06-30');
    expect(screen.getByLabelText('Start date')).toHaveValue('2025-07-01');
  });
  it('shows service failures instead of invented dashboard data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Service unavailable')));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  });
  it('does not invent live KPI zeros while stats are loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Riley Flores', municipalityId:'m'}, permissions:['measure.view','municipality.view'], csrfToken:'test'}});
      if (String(url).includes('/admin/municipality')) return json({data:{id:'m', name:'Municipality of San Isidro (Fictional)', province:'Demo', code:'SAN-ISIDRO', timezone:'Asia/Manila', revision:1}});
      if (String(url).includes('/measures/stats')) return new Promise(() => undefined);
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    expect(await screen.findByText(/Together for a Better/)).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getAllByText('Loading scoped totals')).toHaveLength(2);
    expect(screen.queryByText('126')).not.toBeInTheDocument();
  });
  it('clears a search selection when the sidebar page changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Jamie Cruz', municipalityId:'m'}, permissions:['committee.view','committee.manage','person.view','term.view'], csrfToken:'test'}});
      if (String(url).includes('/committees/c2')) return json({data:{id:'c2', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1, term:{id:'t', label:'2025–2028 demonstration term', startsOn:'2025-07-01', endsOn:'2028-06-30', revision:1}, members:[]}});
      if (String(url).includes('/committees/c1')) return json({data:{id:'c1', code:'AGRI', name:'Committee on Agriculture', termId:'t', revision:1, term:{id:'t', label:'2025–2028 demonstration term', startsOn:'2025-07-01', endsOn:'2028-06-30', revision:1}, members:[]}});
      if (String(url).includes('/committees')) return json({items:[{id:'c1', code:'AGRI', name:'Committee on Agriculture', termId:'t', revision:1},{id:'c2', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1}], pageInfo:{page:1, limit:100, total:2}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    const box = await screen.findByRole('combobox', {name:'Search workspace'});
    fireEvent.focus(box);
    fireEvent.change(box, {target:{value:'Good'}});
    fireEvent.click(await screen.findByRole('option', {name:/Committee on Good Governance/}));
    expect(await screen.findByRole('heading', {name:'Committee on Good Governance'})).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name:'Committees'})[0]!);
    expect(await screen.findByRole('heading', {name:'Committee on Agriculture'})).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', {name:'Committee on Good Governance'})).not.toBeInTheDocument());
  });
  it('clears a searched measure when Legislative Measures is opened from the sidebar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Riley Flores', municipalityId:'m'}, permissions:['measure.view','measure.create'], csrfToken:'test'}});
      if (String(url).includes('/measures/m2')) return json({data:{id:'m2', typeCode:'RESOLUTION', termId:'t', title:'A Resolution On Market Hours', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:null, revision:1, authors:[], versions:[]}});
      if (String(url).includes('/measures/m1')) return json({data:{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:null, revision:1, authors:[], versions:[]}});
      if (String(url).includes('/measures')) return json({items:[{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:null, revision:1},{id:'m2', typeCode:'RESOLUTION', termId:'t', title:'A Resolution On Market Hours', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:null, revision:1}], pageInfo:{page:1, limit:100, total:2}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    const box = await screen.findByRole('combobox', {name:'Search workspace'});
    fireEvent.focus(box);
    fireEvent.change(box, {target:{value:'Market'}});
    fireEvent.click(await screen.findByRole('option', {name:/A Resolution On Market Hours/}));
    expect(await screen.findByRole('heading', {name:'A Resolution On Market Hours'})).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name:'Legislative Measures'})[0]!);
    expect(await screen.findByRole('heading', {name:'An Ordinance Establishing a Draft Record'})).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', {name:'A Resolution On Market Hours'})).not.toBeInTheDocument());
  });
  it('shows live KPI totals after stats load instead of placeholder dashes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Riley Flores', municipalityId:'m'}, permissions:['measure.view','municipality.view'], csrfToken:'test'}});
      if (String(url).includes('/admin/municipality')) return json({data:{id:'m', name:'Municipality of San Isidro (Fictional)', province:'Demo', code:'SAN-ISIDRO', timezone:'Asia/Manila', revision:1}});
      if (String(url).includes('/measures/stats')) return json({data:{proposed:2, pendingCommittee:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    expect(await screen.findByText(/Together for a Better/)).toBeInTheDocument();
    expect(await screen.findByText('Draft and submitted case files')).toBeInTheDocument();
    expect(screen.getByText('Open committee referrals')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('126')).not.toBeInTheDocument();
  });
  it('hides withdraw while a committee referral is open', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Riley Flores', municipalityId:'m'}, permissions:['measure.view','measure.submit','committee.referral.view'], csrfToken:'test'}});
      if (String(url).includes('/referrals')) return json({items:[{id:'r1', measureId:'m1', measureVersionId:'v1', committeeId:'c1', groupId:'g1', referralSequence:1, role:'LEAD', sourceKind:'SECRETARIAT_RECORDED', referredOn:'2026-09-22', dueOn:null, disposition:'OPEN', revision:1, committee:{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance'}}], pageInfo:{page:1, limit:50, total:1}});
      if (String(url).includes('/measures/m1')) return json({data:{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:'v1', revision:1, authors:[], versions:[]}});
      if (String(url).includes('/measures')) return json({items:[{id:'m1', typeCode:'ORDINANCE', termId:'t', title:'An Ordinance Establishing a Draft Record', subject:'Synthetic', stage:'DRAFT', classification:'INTERNAL', officialSeries:null, officialYear:null, officialNumber:null, currentVersionId:'v1', revision:1}], pageInfo:{page:1, limit:100, total:1}});
      return json({items:[], pageInfo:{page:1, limit:25, total:0}});
    }));
    mount();
    fireEvent.click((await screen.findAllByRole('button', {name:'Legislative Measures'}))[0]!);
    expect(await screen.findByRole('heading', {name:'An Ordinance Establishing a Draft Record'})).toBeInTheDocument();
    expect(await screen.findByText(/Close every open referral before withdrawing/)).toBeInTheDocument();
    expect(screen.queryByText('Withdraw')).not.toBeInTheDocument();
  });
});
