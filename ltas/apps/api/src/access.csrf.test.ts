import { describe, expect, it } from 'vitest';
import { SessionGuard } from './access.js';
import type { AppContext } from './context.js';
import type { AuthRequest } from './http.js';

function guard() {
  return new SessionGuard({
    config: {APP_ORIGIN: 'http://localhost:5173'},
    db: {user: {findUnique: async () => ({id: 'user', displayName: 'Reviewer', municipalityId: 'municipality', enabled: true, grants: []})}},
  } as unknown as AppContext);
}

function context(headers: Record<string, string>, csrfToken = 'csrf-token-value') {
  const request = {
    method: 'POST',
    session: {identity: {issuer: 'issuer', subject: 'subject', expiresAt: Date.now() + 60_000, authenticatedAt: Date.now()}, csrfToken},
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as AuthRequest;
  return {switchToHttp: () => ({getRequest: () => request})} as never;
}

describe('session guard on a mutating route', () => {
  it('rejects a post that omits the session CSRF token', async () => {
    await expect(guard().canActivate(context({origin: 'http://localhost:5173'}))).rejects.toMatchObject({status: 403, response: {code: 'CSRF_REJECTED'}});
  });

  it('accepts the same token on an allowed origin', async () => {
    await expect(guard().canActivate(context({origin: 'http://localhost:5173', 'x-csrf-token': 'csrf-token-value'}))).resolves.toBe(true);
  });
});
