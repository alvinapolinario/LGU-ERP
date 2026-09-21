import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,access,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setDefaultResultOrder} from 'node:dns';
setDefaultResultOrder('ipv4first');
const env=process.env;
if(env.NODE_ENV==='production'||env.ALLOW_SYNTHETIC_SEED!=='yes')throw new Error('Development-only provisioning requires ALLOW_SYNTHETIC_SEED=yes.');
if(env.OIDC_ISSUER!=='http://localhost:8081/realms/ltas-development')throw new Error('Provisioning is restricted to the documented loopback development realm.');
for(const key of ['KEYCLOAK_ADMIN','KEYCLOAK_ADMIN_PASSWORD','OIDC_CLIENT_SECRET','OIDC_CLIENT_ID','APP_ORIGIN'])if(!env[key])throw new Error(`Missing ${key}`);
const base='http://localhost:8081';
const tokenResponse=await fetch(`${base}/realms/master/protocol/openid-connect/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:env.KEYCLOAK_ADMIN,password:env.KEYCLOAK_ADMIN_PASSWORD}),signal:AbortSignal.timeout(15000)});
if(!tokenResponse.ok)throw new Error(`Keycloak bootstrap login failed (${tokenResponse.status}).`);
const token=(await tokenResponse.json()).access_token;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const existing=await fetch(`${base}/admin/realms/ltas-development`,{headers,signal:AbortSignal.timeout(15000)});
const identities=[['40000000-0000-4000-8000-000000000001','alex.admin','Alex','Rivera'],['40000000-0000-4000-8000-000000000002','sam.reviewer','Sam','Torres'],['40000000-0000-4000-8000-000000000003','jamie.secretary','Jamie','Cruz'],['40000000-0000-4000-8000-000000000004','morgan.auditor','Morgan','Reyes'],['40000000-0000-4000-8000-000000000005','casey.committee','Casey','Santos'],['40000000-0000-4000-8000-000000000006','riley.staff','Riley','Flores']];
const users=identities.map(([id,username,firstName,lastName])=>({id,username,firstName,lastName,email:`${username}@example.invalid`,emailVerified:true,enabled:true,credentials:[{type:'password',value:randomBytes(20).toString('base64url'),temporary:false}],requiredActions:[]}));
const output=new URL('../.local/development-accounts.json',import.meta.url);
await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
async function appendAccounts(created){
  let current=[];
  try {current=JSON.parse(await readFile(output,'utf8'));} catch (error) {if(error.code!=='ENOENT') throw error;}
  const known=new Set(current.map(row=>row.username));
  const next=[...current,...created.filter(row=>!known.has(row.username))];
  await writeFile(output,JSON.stringify(next,null,2),{mode:0o600});
}
if(existing.status!==404){
  const created=[];
  for(const user of users){
    const search=await fetch(`${base}/admin/realms/ltas-development/users?username=${encodeURIComponent(user.username)}&exact=true`,{headers,signal:AbortSignal.timeout(15000)});
    const found=await search.json();
    if(Array.isArray(found) && found.length) continue;
    const create=await fetch(`${base}/admin/realms/ltas-development/users/${user.id}`,{method:'PUT',headers,body:JSON.stringify(user),signal:AbortSignal.timeout(15000)});
    if(!create.ok) throw new Error(`Could not add ${user.username} (${create.status}).`);
    created.push({username:user.username,password:user.credentials[0].value,subject:user.id});
  }
  if(created.length) await appendAccounts(created);
  console.log(created.length?`Added ${created.length} missing fictional identit${created.length===1?'y':'ies'} privately.`:'Realm already has the documented fictional identities.');
} else {
  try {await access(output);throw new Error('Account file already exists; refusing to overwrite it.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(output,JSON.stringify(users.map(u=>({username:u.username,password:u.credentials[0].value,subject:u.id})),null,2),{flag:'wx',mode:0o600});
  const origins=(()=>{
    const primary=env.APP_ORIGIN;
    const url=new URL(primary);
    const port=url.port?`:${url.port}`:'';
    const pair=url.hostname==='localhost'?`http://127.0.0.1${port}`:url.hostname==='127.0.0.1'?`http://localhost${port}`:null;
    return pair?[primary,pair]:[primary];
  })();
  const realm={realm:'ltas-development',displayName:'LTAS · Fictional Municipality',enabled:true,registrationAllowed:false,resetPasswordAllowed:false,bruteForceProtected:true,sslRequired:'external',accessTokenLifespan:1800,ssoSessionIdleTimeout:1800,ssoSessionMaxLifespan:28800,clients:[{clientId:env.OIDC_CLIENT_ID,enabled:true,protocol:'openid-connect',publicClient:false,secret:env.OIDC_CLIENT_SECRET,standardFlowEnabled:true,directAccessGrantsEnabled:false,redirectUris:origins.map(origin=>`${origin}/api/v1/auth/callback`),webOrigins:origins,attributes:{'pkce.code.challenge.method':'S256','post.logout.redirect.uris':origins.join('##')}}],users};
  const response=await fetch(`${base}/admin/realms`,{method:'POST',headers,body:JSON.stringify(realm),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Realm import failed (${response.status}); inspect the local account file and server before retrying.`);
  console.log(`Fictional identities created. Credentials saved privately to ${fileURLToPath(output)}.`);
}
