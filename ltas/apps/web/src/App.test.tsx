// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', {name:'Sessions'})).toBeDisabled();
    expect(screen.getAllByRole('button', {name:'Users & Access'}).length).toBeGreaterThan(0);
    expect(screen.getByText(/Session scheduling arrives in a later phase/)).toBeInTheDocument();
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
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Riley Flores', municipalityId:'m'}, permissions:['measure.view','measure.create','measure.edit','measure.submit','measure.version.create','document.upload','document.view','task.manage','notification.view','person.view','term.view','committee.view'], csrfToken:'test'}});
      if (String(url).includes('/measures/stats')) return json({data:{proposed:2}});
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
    fireEvent.click(screen.getAllByRole('button', {name:'People'})[0]!);
    expect(await screen.findByRole('heading', {name:'People'})).toBeInTheDocument();
    expect(await screen.findByText('Taylor Mendoza')).toBeInTheDocument();
    expect(screen.getByText(/Not elected-office records/)).toBeInTheDocument();
  });
  it('searches live committee records from the top bar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string) => {
      if (String(url).includes('/auth/session')) return json({data:{user:{id:'u', displayName:'Jamie Cruz', municipalityId:'m'}, permissions:['committee.view'], csrfToken:'test'}});
      if (String(url).includes('/committees')) return json({items:[{id:'c1', code:'GOOD-GOV', name:'Committee on Good Governance', termId:'t', revision:1}], pageInfo:{page:1, limit:100, total:1}});
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
  });
  it('shows service failures instead of invented dashboard data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Service unavailable')));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  });
});
