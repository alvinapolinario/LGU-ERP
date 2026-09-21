import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonical, digest } from './integrity.js';

export async function exportEvent(directory:string,eventId:string,payload:unknown):Promise<string> {
  if(!/^[0-9a-f-]{36}$/i.test(eventId)) throw new Error('Invalid event identifier');
  await mkdir(directory,{recursive:true});
  const content=canonical(payload),path=join(directory,`${eventId}.json`);
  try {await writeFile(path,content,{flag:'wx',mode:0o600});}
  catch(error) {
    if((error as NodeJS.ErrnoException).code!=='EEXIST') throw error;
    if(await readFile(path,'utf8')!==content) throw new Error('Independent audit export mismatch');
  }
  return digest(payload);
}
