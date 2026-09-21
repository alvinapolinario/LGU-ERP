export interface ObjectStore {
  put(bucket:string, key:string, body:Buffer, contentType:string):Promise<void>;
  get(bucket:string, key:string):Promise<Buffer>;
}
export class MemoryObjectStore implements ObjectStore {
  readonly objects=new Map<string,Buffer>();
  async put(bucket:string, key:string, body:Buffer):Promise<void> {
    this.objects.set(`${bucket}/${key}`, Buffer.from(body));
  }
  async get(bucket:string, key:string):Promise<Buffer> {
    const found=this.objects.get(`${bucket}/${key}`);
    if(!found) throw new Error('missing object');
    return found;
  }
}
export class UnavailableObjectStore implements ObjectStore {
  async put():Promise<void> {const {fail}=await import('../http.js');return fail(503,'STORAGE_UNAVAILABLE','Object storage is not configured.');}
  async get():Promise<Buffer> {const {fail}=await import('../http.js');return fail(503,'STORAGE_UNAVAILABLE','Object storage is not configured.');}
}
export async function createObjectStore(config:{MINIO_ENDPOINT?:string;MINIO_ACCESS_KEY?:string;MINIO_SECRET_KEY?:string;MINIO_BUCKET_QUARANTINE:string;}):Promise<ObjectStore> {
  if(!config.MINIO_ENDPOINT || !config.MINIO_ACCESS_KEY || !config.MINIO_SECRET_KEY) return new UnavailableObjectStore();
  try {
    const {Client}=await import('minio');
    const url=new URL(config.MINIO_ENDPOINT);
    const client=new Client({endPoint:url.hostname,port:Number(url.port||(url.protocol==='https:'?443:9000)),useSSL:url.protocol==='https:',accessKey:config.MINIO_ACCESS_KEY,secretKey:config.MINIO_SECRET_KEY});
    const bucket=config.MINIO_BUCKET_QUARANTINE;
    if(!await client.bucketExists(bucket)) await client.makeBucket(bucket);
    return {
      async put(name,key,body,type){await client.putObject(name,key,body,body.length,{'Content-Type':type});},
      async get(name,key){
        const stream=await client.getObject(name,key);
        const chunks:Buffer[]=[];
        for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as Uint8Array));
        return Buffer.concat(chunks);
      },
    };
  } catch {
    console.error(JSON.stringify({level:'error',code:'STORAGE_UNAVAILABLE'}));
    return new UnavailableObjectStore();
  }
}
