import { describe, expect, it, vi } from 'vitest';

vi.mock('openid-client', () => ({
  allowInsecureRequests: Symbol('allow-insecure'),
  discovery: vi.fn(async () => ({issuer: 'test'})),
  randomPKCECodeVerifier: () => 'verifier',
  randomState: () => 'state',
  randomNonce: () => 'nonce',
  calculatePKCECodeChallenge: async () => 'challenge',
  buildAuthorizationUrl: () => new URL('http://localhost:8081/realms/ltas-development/protocol/openid-connect/auth?state=state'),
}));

import { AuthController } from './auth.js';
import { rewriteIdentityUrl } from './config.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';

const issuer = 'http://localhost:8081/realms/ltas-development';

describe('login redirect', () => {
  it('sends a LAN browser to the identity host on that same LAN', async () => {
    const controller = new AuthController({
      config: {NODE_ENV: 'development', APP_ORIGIN: 'http://localhost:5173', OIDC_ISSUER: issuer, OIDC_CLIENT_ID: 'ltas-web', OIDC_CLIENT_SECRET: 'secret'},
    } as AppContext);
    const session: {oidc?: unknown; regenerate: (done: (error?: Error) => void) => void; save: (done: (error?: Error) => void) => void} = {
      regenerate: done => done(),
      save: done => done(),
    };
    const request = {get: (name: string) => name === 'host' ? '192.168.1.20:5173' : undefined, session} as unknown as AuthRequest;
    const redirect = vi.fn();
    await controller.login(request, {redirect} as never);
    expect(redirect).toHaveBeenCalledWith('http://192.168.1.20:8081/realms/ltas-development/protocol/openid-connect/auth?state=state');
    expect(session.oidc).toMatchObject({verifier: 'verifier', redirectOrigin: 'http://192.168.1.20:5173'});
  });

  it('rewrites the live Keycloak authorization endpoint for a LAN browser', async () => {
    let endpoint = '';
    try {
      const response = await fetch(`${issuer}/.well-known/openid-configuration`);
      if (response.ok) endpoint = String((await response.json() as {authorization_endpoint?: string}).authorization_endpoint ?? '');
    } catch {
      endpoint = '';
    }
    if (!endpoint) return;
    const rewritten = rewriteIdentityUrl(new URL(endpoint), 'http://192.168.1.20:5173', issuer);
    expect(rewritten.origin).toBe('http://192.168.1.20:8081');
    expect(rewritten.pathname).toContain('/protocol/openid-connect/auth');
  });
});
