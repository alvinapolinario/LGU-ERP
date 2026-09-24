import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const compose=resolve(root,'infrastructure/docker/compose.dev.yml');
const grantsSql=resolve(root,'infrastructure/database/runtime-grants.sql');

if(process.env.NODE_ENV==='production') throw new Error('Refuse production grant automation.');

function mysql(sql,shell,options={}) {
  return new Promise((resolvePromise,reject)=>{
    const child=spawn('docker',['compose','-f',compose,'exec','-T','mysql','sh','-c',shell],{cwd:root,env:process.env,stdio:['pipe','pipe','pipe']});
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

const grants=await readFile(grantsSql,'utf8');
await mysql(grants,'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot');
const denied=await mysql('UPDATE ltas.audit_logs SET action=action LIMIT 1;','MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql -ultas_app',{allowFailure:true});
if(denied.code===0) throw new Error('ltas_app was able to update audit_logs.');
console.log('Runtime grants applied. ltas_app cannot update audit_logs.');
