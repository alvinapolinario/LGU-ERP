import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(), REDIS_URL: z.string().url(),
  APP_ORIGIN: z.string().url(), OIDC_ISSUER: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1), OIDC_CLIENT_SECRET: z.string().min(16),
  SESSION_SECRET: z.string().min(32),
  AUDIT_EXPORT_DIR: z.string().min(1),
  AUDIT_MAX_LAG_SECONDS: z.coerce.number().int().min(60).default(3600),
  AUDIT_ENFORCE_EXPORT_LAG: z.enum(['yes','no']).default('yes'),
  MINIO_ENDPOINT: z.string().url().optional(),
  MINIO_ACCESS_KEY: z.string().min(3).optional(),
  MINIO_SECRET_KEY: z.string().min(8).optional(),
  MINIO_BUCKET_QUARANTINE: z.string().min(3).default('ltas-quarantine'),
});
export type Config = z.infer<typeof schema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = schema.parse(env);
  for (const value of [c.APP_ORIGIN,c.OIDC_ISSUER]) {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) throw new Error('Invalid application/issuer URL');
    const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(c.NODE_ENV !== 'production' && local && url.protocol === 'http:')) throw new Error('HTTPS is required outside local development');
  }
  if (new URL(c.APP_ORIGIN).pathname !== '/') throw new Error('APP_ORIGIN must not contain a path');
  if (new URL(c.DATABASE_URL).protocol !== 'mysql:') throw new Error('MySQL is required');
  if (new URL(c.DATABASE_URL).username === 'root') throw new Error('The application must not use the database root account');
  if (c.NODE_ENV === 'production' && c.AUDIT_ENFORCE_EXPORT_LAG === 'no') throw new Error('Independent audit export lag cannot be bypassed in production');
  return c;
}

export function isPrivateLanHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [first, second] = parts;
  return first === 10 || (first === 172 && (second ?? 0) >= 16 && (second ?? 0) <= 31) || (first === 192 && second === 168);
}

export function publicOrigins(appOrigin: string): string[] {
  const url = new URL(appOrigin);
  const origins = [url.origin];
  const port = url.port ? `:${url.port}` : '';
  if (url.protocol === 'http:' && url.hostname === 'localhost') origins.push(`http://127.0.0.1${port}`);
  if (url.protocol === 'http:' && url.hostname === '127.0.0.1') origins.push(`http://localhost${port}`);
  return origins;
}

function developmentLanOrigin(candidate: string, appOrigin: string): string | undefined {
  const app = new URL(appOrigin);
  if (app.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) return undefined;
  let url: URL;
  try { url = new URL(candidate); } catch { return undefined; }
  if (url.protocol !== 'http:' || url.port !== app.port || !isPrivateLanHostname(url.hostname)) return undefined;
  return url.origin;
}

export function originFromRequest(hostHeader: string | undefined, appOrigin: string): string {
  const allowed = publicOrigins(appOrigin);
  if (hostHeader) {
    const candidate = `${new URL(appOrigin).protocol}//${hostHeader.split(',')[0]!.trim()}`;
    if (allowed.includes(candidate)) return candidate;
    return developmentLanOrigin(candidate, appOrigin) ?? new URL(appOrigin).origin;
  }
  return new URL(appOrigin).origin;
}

export function isAllowedOrigin(originHeader: string | undefined, appOrigin: string): boolean {
  return Boolean(originHeader && (publicOrigins(appOrigin).includes(originHeader) || developmentLanOrigin(originHeader, appOrigin)));
}

export function rewriteIdentityUrl(identityUrl: URL, requestOrigin: string, issuer: string): URL {
  const request = new URL(requestOrigin);
  const configured = new URL(issuer);
  if (request.hostname === configured.hostname || !isPrivateLanHostname(request.hostname)) return identityUrl;
  const next = new URL(identityUrl.href);
  next.hostname = request.hostname;
  next.port = configured.port;
  return next;
}

export function identityIssuer(requestOrigin: string, configuredIssuer: string): string {
  return rewriteIdentityUrl(new URL(configuredIssuer), requestOrigin, configuredIssuer).href;
}
