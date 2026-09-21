// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function mount() {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);}
describe('workspace boundaries',()=>{
  it('offers Keycloak login when unauthenticated, without a demo bypass',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>({status:401,detail:'Sign in',code:'LOGIN_REQUIRED'})}));mount();expect(await screen.findByRole('link',{name:/Sign in securely/})).toHaveAttribute('href','/api/v1/auth/login');expect(screen.queryByRole('navigation')).not.toBeInTheDocument();});
  it('does not show administrative pages to a scoped committee user',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{user:{id:'u',displayName:'Casey Santos',municipalityId:'m'},permissions:['committee.view'],csrfToken:'test'}})}));mount();expect(await screen.findByRole('navigation')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'User accounts'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Access review'})).not.toBeInTheDocument();expect(screen.getAllByRole('button',{name:/Committees/}).length).toBeGreaterThan(0);});
  it('shows service failures instead of invented dashboard data',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Service unavailable')));mount();expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');});
});
