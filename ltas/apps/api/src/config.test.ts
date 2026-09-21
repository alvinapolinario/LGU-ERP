import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';
const env={NODE_ENV:'development',DATABASE_URL:'mysql://ltas_app:synthetic@localhost:3307/ltas',REDIS_URL:'redis://localhost:6380',APP_ORIGIN:'http://localhost:5173',OIDC_ISSUER:'http://localhost:8081/realms/test',OIDC_CLIENT_ID:'ltas-web',OIDC_CLIENT_SECRET:'test-only-client-secret',SESSION_SECRET:'test-only-session-key-not-for-real-use',AUDIT_EXPORT_DIR:'.local/test'};
describe('startup configuration',()=>{
  it('accepts loopback-only development origins',()=>expect(readConfig(env).PORT).toBe(3000));
  it('refuses insecure production origins',()=>expect(()=>readConfig({...env,NODE_ENV:'production'})).toThrow('HTTPS'));
  it('refuses nonloopback HTTP even in development',()=>expect(()=>readConfig({...env,APP_ORIGIN:'http://example.invalid'})).toThrow('HTTPS'));
  it('refuses database root and other engines',()=>{expect(()=>readConfig({...env,DATABASE_URL:'mysql://root:synthetic@localhost/ltas'})).toThrow('root');expect(()=>readConfig({...env,DATABASE_URL:'postgres://app:synthetic@localhost/ltas'})).toThrow('MySQL');});
  it('refuses absent credentials',()=>expect(()=>readConfig({...env,SESSION_SECRET:''})).toThrow());
});
