import { describe, expect, it } from 'vitest';
import { identityIssuer, isAllowedOrigin, originFromRequest, publicOrigins, readConfig, rewriteIdentityUrl } from './config.js';
const env={NODE_ENV:'development',DATABASE_URL:'mysql://ltas_app:synthetic@localhost:3307/ltas',REDIS_URL:'redis://localhost:6380',APP_ORIGIN:'http://localhost:5173',OIDC_ISSUER:'http://localhost:8081/realms/test',OIDC_CLIENT_ID:'ltas-web',OIDC_CLIENT_SECRET:'test-only-client-secret',SESSION_SECRET:'test-only-session-key-not-for-real-use',AUDIT_EXPORT_DIR:'.local/test'};
describe('startup configuration',()=>{
  it('accepts loopback-only development origins',()=>expect(readConfig(env).PORT).toBe(3000));
  it('pairs localhost and 127.0.0.1 for local HTTP origins',()=>{
    expect(publicOrigins('http://localhost:5173')).toEqual(['http://localhost:5173','http://127.0.0.1:5173']);
    expect(originFromRequest('127.0.0.1:5173','http://localhost:5173')).toBe('http://127.0.0.1:5173');
    expect(isAllowedOrigin('http://127.0.0.1:5173','http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://example.invalid','http://localhost:5173')).toBe(false);
    expect(originFromRequest('192.168.1.20:5173','http://localhost:5173')).toBe('http://192.168.1.20:5173');
    expect(isAllowedOrigin('http://10.0.0.8:5173','http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://8.8.8.8:5173','http://localhost:5173')).toBe(false);
    expect(rewriteIdentityUrl(new URL('http://localhost:8081/realms/ltas-development/protocol/openid-connect/auth'),'http://192.168.1.20:5173','http://localhost:8081/realms/ltas-development').origin).toBe('http://192.168.1.20:8081');
    expect(identityIssuer('http://10.0.0.8:5173','http://localhost:8081/realms/ltas-development')).toBe('http://10.0.0.8:8081/realms/ltas-development');
    expect(identityIssuer('http://localhost:5173','http://localhost:8081/realms/ltas-development')).toBe('http://localhost:8081/realms/ltas-development');
  });
  it('refuses insecure production origins',()=>expect(()=>readConfig({...env,NODE_ENV:'production'})).toThrow('HTTPS'));
  it('refuses nonloopback HTTP even in development',()=>expect(()=>readConfig({...env,APP_ORIGIN:'http://example.invalid'})).toThrow('HTTPS'));
  it('refuses database root and other engines',()=>{expect(()=>readConfig({...env,DATABASE_URL:'mysql://root:synthetic@localhost/ltas'})).toThrow('root');expect(()=>readConfig({...env,DATABASE_URL:'postgres://app:synthetic@localhost/ltas'})).toThrow('MySQL');});
  it('refuses absent credentials',()=>expect(()=>readConfig({...env,SESSION_SECRET:''})).toThrow());
  it('allows a development-only audit export lag bypass',()=>expect(readConfig({...env,AUDIT_ENFORCE_EXPORT_LAG:'no'}).AUDIT_ENFORCE_EXPORT_LAG).toBe('no'));
  it('refuses the audit export lag bypass in production',()=>expect(()=>readConfig({...env,NODE_ENV:'production',APP_ORIGIN:'https://ltas.example',OIDC_ISSUER:'https://id.example/realms/ltas',AUDIT_ENFORCE_EXPORT_LAG:'no'})).toThrow('bypass'));
});
