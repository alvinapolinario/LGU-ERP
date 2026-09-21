import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createReadStream, createWriteStream} from 'node:fs';
import {cp, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import net from 'node:net';
import {join, resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourceCompose=resolve(root,'infrastructure/docker/compose.dev.yml');
const restoreCompose=resolve(root,'infrastructure/docker/compose.restore.yml');
const grantsSql=resolve(root,'infrastructure/database/runtime-grants.sql');
const sourceProject='ltas-development';
const restoreProject='ltas-restore-rehearsal';
const command=process.argv[2];
if(!['checkpoint','restore','rehearse'].includes(command)) throw new Error('Usage: node scripts/recovery-rehearsal.mjs checkpoint|restore|rehearse');

if(process.env.NODE_ENV==='production') throw new Error('Refuse production recovery automation.');
if(process.env.ALLOW_SYNTHETIC_SEED!=='yes') throw new Error('Synthetic recovery only (ALLOW_SYNTHETIC_SEED=yes).');

const snapshotSql=`SELECT JSON_OBJECT(
  'users', (SELECT COUNT(*) FROM ltas.users),
  'grants', (SELECT COUNT(*) FROM ltas.user_roles WHERE revokedAt IS NULL),
  'terms', (SELECT COUNT(*) FROM ltas.council_terms),
  'people', (SELECT COUNT(*) FROM ltas.persons),
  'memberships', (SELECT COUNT(*) FROM ltas.committee_members),
  'auditLogs', (SELECT COUNT(*) FROM ltas.audit_logs),
  'outbox', (SELECT COUNT(*) FROM ltas.outbox_events),
  'outboxPending', (SELECT COUNT(*) FROM ltas.outbox_events WHERE state <> 'DELIVERED'),
  'cursorSequence', (SELECT CAST(sequence AS CHAR) FROM ltas.audit_cursors ORDER BY municipalityId LIMIT 1),
  'cursorHash', (SELECT hash FROM ltas.audit_cursors ORDER BY municipalityId LIMIT 1),
  'keycloakTables', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='keycloak'),
  'keycloakUsers', IF(
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='keycloak' AND table_name='USER_ENTITY'),
    (SELECT COUNT(*) FROM keycloak.USER_ENTITY),
    NULL
  )
)`;

function run(file,args,options={}) {
  return new Promise((resolvePromise,reject)=>{
    const child=spawn(file,args,{cwd:options.cwd??root,env:options.env??process.env,stdio:options.stdio??['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout?.on('data',chunk=>{stdout+=chunk;});
    child.stderr?.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject);
    child.on('close',code=>{
      if(code!==0 && !options.allowFailure) reject(new Error(`${file} exited ${code}${(stderr||stdout).trim()?`: ${String(stderr||stdout).slice(0,400)}`:''}`));
      else resolvePromise({code,stdout,stderr,child});
    });
  });
}

function listening(port) {
  return new Promise(resolvePromise=>{
    const socket=net.connect({host:'127.0.0.1',port});
    socket.once('connect',()=>{socket.destroy();resolvePromise(true);});
    socket.once('error',()=>resolvePromise(false));
  });
}

function withPort(connection,port) {
  const url=new URL(connection);
  url.port=String(port);
  return url.href;
}

async function sha256File(path) {
  const hash=createHash('sha256');
  await pipeline(createReadStream(path),hash);
  return hash.digest('hex');
}

async function compose(file,args,options={}) {
  return run('docker',['compose','-f',file,...args],options);
}

async function mysqlStdin(file,args,sql,options={}) {
  return new Promise((resolvePromise,reject)=>{
    const child=spawn('docker',['compose','-f',file,'exec','-T','mysql','sh','-c',...args],{cwd:root,env:process.env,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;});
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject);
    child.stdin.on('error',reject);
    child.stdin.end(sql);
    child.on('close',code=>{
      if(code!==0 && !options.allowFailure) reject(new Error(`mysql exited ${code}: ${String(stderr||stdout).slice(0,400)}`));
      else resolvePromise({code,stdout,stderr});
    });
  });
}

async function mysqlRoot(file,sql,options={}) {
  return mysqlStdin(file,['MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -s'],sql,options);
}

async function snapshot(file) {
  const {stdout}=await mysqlRoot(file,`${snapshotSql};`);
  return JSON.parse(stdout.trim().split('\n').at(-1));
}

async function waitHealthy(file,service,timeoutMs=180000) {
  const started=Date.now();
  while(Date.now()-started<timeoutMs) {
    const {stdout}=await compose(file,['ps','--format','{{.Health}}',service],{allowFailure:true});
    if(stdout.trim().split('\n').at(-1)==='healthy') return;
    await delay(2000);
  }
  throw new Error(`${service} did not become healthy`);
}

async function waitHttp(url,timeoutMs=180000) {
  const started=Date.now();
  while(Date.now()-started<timeoutMs) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(3000)});
      if(response.ok) return;
    } catch {}
    await delay(2000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function imagePins(file) {
  const {stdout}=await compose(file,['images','--format','json']);
  const parsed=JSON.parse(stdout.trim());
  const rows=Array.isArray(parsed)?parsed:[parsed];
  return rows.map(row=>`${row.Repository}:${row.Tag} ${row.ID}`).sort();
}

async function drainWorker(env=process.env) {
  const {code,stderr}=await run('node',['dist/worker.js'],{cwd:resolve(root,'apps/api'),env:{...env,LTAS_WORKER_ONCE:'yes'},allowFailure:true});
  if(code!==0) throw new Error(`Worker drain failed (${code}): ${String(stderr).slice(0,400)}`);
}

async function checkpoint() {
  if(await listening(3000)) throw new Error('Stop the host API on port 3000 before the checkpoint. Do not stop MySQL.');
  const {stdout:project}=await compose(sourceCompose,['config','--format','json']);
  if(JSON.parse(project).name!==sourceProject) throw new Error('Checkpoint source is not ltas-development.');
  const directory=resolve(root,'.local/recovery',new Date().toISOString().replaceAll(':','-'));
  await mkdir(directory,{recursive:true,mode:0o700});
  const auditSource=process.env.AUDIT_EXPORT_DIR;
  if(!auditSource) throw new Error('AUDIT_EXPORT_DIR is required.');
  let pending=Number((await snapshot(sourceCompose)).outboxPending);
  if(pending>0) {
    await drainWorker();
    pending=Number((await snapshot(sourceCompose)).outboxPending);
  }
  if(pending>0) throw new Error('Outbox still pending after worker drain; independent audit export is incomplete.');
  const counts=await snapshot(sourceCompose);
  const dumpPath=join(directory,'mysql.sql');
  await new Promise((resolvePromise,reject)=>{
    const child=spawn('docker',['compose','-f',sourceCompose,'exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --events --triggers --databases ltas keycloak'],{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
    const out=createWriteStream(dumpPath,{mode:0o600});
    let stderr='';
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject);
    out.on('error',reject);
    const done=pipeline(child.stdout,out);
    child.on('close',code=>{
      done.then(()=>{
        if(code) reject(new Error(`mysqldump exited ${code}: ${stderr.slice(0,400)}`));
        else resolvePromise();
      }).catch(reject);
    });
  });
  const auditCopy=join(directory,'audit-exports');
  await mkdir(auditCopy,{recursive:true,mode:0o700});
  await cp(auditSource,auditCopy,{recursive:true});
  const files=(await readdir(auditCopy)).filter(name=>name.endsWith('.json'));
  if(!files.length) throw new Error('No audit evidence copied; an empty export directory is not a complete checkpoint.');
  const {stdout:verifyOut}=await run('node',[resolve(root,'scripts/verify-audit.mjs'),auditCopy]);
  const dumpSha=await sha256File(dumpPath);
  await writeFile(join(directory,'mysql.sql.sha256'),`${dumpSha}  mysql.sql\n`,{mode:0o600});
  const lockSha=await sha256File(resolve(root,'package-lock.json'));
  const {stdout:revision}=await run('git',['rev-parse','HEAD']);
  const manifest={
    requirement:'LTAS-NFR-RECOVERY-001',
    recordedAt:new Date().toISOString(),
    sourceProject,
    restoreProject,
    revision:revision.trim(),
    lockfileSha256:lockSha,
    images:await imagePins(sourceCompose),
    counts,
    dumpSha256:dumpSha,
    auditExportFiles:files.length,
    auditVerify:verifyOut.trim().split('\n'),
    minio:'Phase 1 has no authoritative object store.',
  };
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({checkpoint:directory,dumpSha256:dumpSha,counts,auditExportFiles:files.length}));
  return directory;
}

async function assertIsolatedTarget() {
  if(process.env.LTAS_RESTORE_CONFIRM!==restoreProject) throw new Error('Set LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal. Refusing to restore without an explicit isolated target.');
  const {stdout}=await compose(restoreCompose,['config','--format','json']);
  const config=JSON.parse(stdout);
  if(config.name!==restoreProject) throw new Error(`Restore compose project is ${config.name}, not ${restoreProject}.`);
  const published=JSON.stringify(config.services?.mysql?.ports??[]);
  if(published.includes('3307')||!published.includes('3308')) throw new Error('Isolated MySQL must publish 3308, never 3307.');
  const {stdout:volumeNames}=await compose(restoreCompose,['config','--volumes']);
  const volumes=volumeNames.split('\n').map(name=>name.trim()).filter(Boolean);
  if(volumes.includes('mysql-data')) throw new Error('Refuse restore: compose still references mysql-data.');
  if(!volumes.includes('restore-mysql-data')) throw new Error('Isolated compose must use restore-mysql-data.');
}

async function latestCheckpoint() {
  if(process.env.LTAS_CHECKPOINT_DIR) return resolve(process.env.LTAS_CHECKPOINT_DIR);
  const parent=resolve(root,'.local/recovery');
  const entries=(await readdir(parent).catch(()=>[])).filter(name=>name.startsWith('20'));
  entries.sort();
  for(const name of entries.reverse()) {
    try {
      await readFile(join(parent,name,'manifest.json'));
      return join(parent,name);
    } catch {}
  }
  throw new Error('No complete checkpoint found. Run checkpoint first.');
}

async function restore(directory) {
  await assertIsolatedTarget();
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  const dumpPath=join(directory,'mysql.sql');
  const actualSha=await sha256File(dumpPath);
  if(actualSha!==manifest.dumpSha256) throw new Error('Dump checksum mismatch; refusing to restore.');
  const started=Date.now();
  await compose(restoreCompose,['up','-d','mysql','redis']);
  await waitHealthy(restoreCompose,'mysql');
  await waitHealthy(restoreCompose,'redis');
  await new Promise((resolvePromise,reject)=>{
    const child=spawn('docker',['compose','-f',restoreCompose,'exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'],{cwd:root,env:process.env,stdio:['pipe','pipe','pipe']});
    let stderr='';
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject);
    child.stdin.on('error',reject);
    createReadStream(dumpPath).pipe(child.stdin);
    child.on('close',code=>{
      if(code!==0) reject(new Error(`restore mysql exited ${code}: ${stderr.slice(0,400)}`));
      else resolvePromise();
    });
  });
  const grants=await readFile(grantsSql,'utf8');
  await mysqlRoot(restoreCompose,grants);
  const restored=await snapshot(restoreCompose);
  for(const key of ['users','grants','terms','people','memberships','auditLogs','outbox','cursorSequence','cursorHash','keycloakTables']) {
    if(String(restored[key])!==String(manifest.counts[key])) throw new Error(`Reconcile mismatch for ${key}: checkpoint ${manifest.counts[key]} restored ${restored[key]}`);
  }
  const deniedUpdate=await mysqlStdin(restoreCompose,['MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql -ultas_app'],'UPDATE ltas.audit_logs SET action=action LIMIT 1;',{allowFailure:true});
  if(deniedUpdate.code===0) throw new Error('Application identity must not UPDATE audit_logs after restore.');
  const deniedDelete=await mysqlStdin(restoreCompose,['MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql -ultas_app'],'DELETE FROM ltas.audit_logs LIMIT 1;',{allowFailure:true});
  if(deniedDelete.code===0) throw new Error('Application identity must not DELETE audit_logs after restore.');
  const deniedKeycloak=await mysqlStdin(restoreCompose,['MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql -ultas_app'],'SELECT 1 FROM keycloak.USER_ENTITY LIMIT 1;',{allowFailure:true});
  if(deniedKeycloak.code===0) throw new Error('Application identity must not read the Keycloak database.');
  const isolatedExports=join(directory,'isolated-audit-exports');
  await cp(join(directory,'audit-exports'),isolatedExports,{recursive:true});
  const {stdout:verifyOut}=await run('node',[resolve(root,'scripts/verify-audit.mjs'),isolatedExports]);
  const delivered=await mysqlRoot(restoreCompose,"SELECT id FROM ltas.outbox_events WHERE state='DELIVERED' ORDER BY createdAt,id LIMIT 1;");
  const eventId=delivered.stdout.trim();
  if(!/^[0-9a-f-]{36}$/i.test(eventId)) throw new Error('No delivered outbox event to retry.');
  const before=await sha256File(join(isolatedExports,`${eventId}.json`));
  await mysqlRoot(restoreCompose,`UPDATE ltas.outbox_events SET state='PENDING', availableAt=UTC_TIMESTAMP(3) WHERE id='${eventId}';`);
  const workerEnv={
    ...process.env,
    LTAS_WORKER_ONCE:'yes',
    DATABASE_URL:withPort(process.env.DATABASE_URL,3308),
    WORKER_DATABASE_URL:withPort(process.env.WORKER_DATABASE_URL,3308),
    MIGRATION_DATABASE_URL:withPort(process.env.MIGRATION_DATABASE_URL,3308),
    REDIS_URL:withPort(process.env.REDIS_URL,6381),
    AUDIT_EXPORT_DIR:isolatedExports,
  };
  await drainWorker(workerEnv);
  const afterRetry=await sha256File(join(isolatedExports,`${eventId}.json`));
  if(afterRetry!==before) throw new Error('Identical outbox retry changed independent evidence.');
  const retryState=(await mysqlRoot(restoreCompose,`SELECT state FROM ltas.outbox_events WHERE id='${eventId}';`)).stdout.trim();
  if(retryState!=='DELIVERED') throw new Error(`Identical retry did not re-deliver (${retryState}).`);
  await writeFile(join(isolatedExports,`${eventId}.json`),'{"tampered":true}\n');
  await mysqlRoot(restoreCompose,`UPDATE ltas.outbox_events SET state='PENDING', attempts=0, availableAt=UTC_TIMESTAMP(3) WHERE id='${eventId}';`);
  await drainWorker(workerEnv);
  const mismatchState=(await mysqlRoot(restoreCompose,`SELECT state FROM ltas.outbox_events WHERE id='${eventId}';`)).stdout.trim();
  if(mismatchState==='DELIVERED') throw new Error('Mismatched independent export must fail closed.');
  const tampered=await readFile(join(isolatedExports,`${eventId}.json`),'utf8');
  if(!tampered.includes('tampered')) throw new Error('Worker overwrote mismatched evidence.');
  await compose(restoreCompose,['--profile','identity','up','-d','keycloak']);
  await waitHttp('http://127.0.0.1:8082/realms/ltas-development/.well-known/openid-configuration');
  if(await listening(3001)) throw new Error('Port 3001 is already in use; refusing to start the isolated API.');
  const apiEnv={...workerEnv,PORT:'3001'};
  const api=spawn('node',['dist/main.js'],{cwd:resolve(root,'apps/api'),env:apiEnv,stdio:['ignore','pipe','pipe']});
  try {
    await waitHttp('http://127.0.0.1:3001/api/v1/health/live');
    const ready=await fetch('http://127.0.0.1:3001/api/v1/health/ready',{signal:AbortSignal.timeout(5000)});
    if(!ready.ok) throw new Error(`Isolated readiness failed (${ready.status}).`);
  } finally {
    api.kill('SIGTERM');
  }
  const elapsedMs=Date.now()-started;
  const result={
    requirement:'LTAS-NFR-RECOVERY-001',
    test:'T-NFR-RECOVERY-001',
    restoredAt:new Date().toISOString(),
    checkpoint:directory,
    elapsedMs,
    restored,
    deniedAuditMutation:true,
    deniedKeycloakAccess:true,
    identicalOutboxRetry:true,
    mismatchedExportFailClosed:true,
    isolatedKeycloakDiscovery:true,
    isolatedApiReady:true,
    applicationPasswordLogin:'not executed; isolated stack uses ports 3308/6381/8082/3001 and does not retarget the live 5173/8081 development pair',
    rpoRto:'unselected (D-06)',
    offHostCopy:'not performed; artifacts remain under .local/recovery on this workstation',
  };
  await writeFile(join(directory,'restore-result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({restore:directory,elapsedMs,restored,verify:verifyOut.trim().split('\n').at(-1)}));
  return result;
}

const checkpointDir=command==='restore'?await latestCheckpoint():await checkpoint();
if(command!=='checkpoint') await restore(checkpointDir);
console.log('Isolated volumes were not deleted. There is no repository command that removes recovery or original volumes.');
