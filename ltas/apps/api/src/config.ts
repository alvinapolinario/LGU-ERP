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
  return c;
}
