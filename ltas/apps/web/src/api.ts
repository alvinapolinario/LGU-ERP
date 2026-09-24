import type { Problem } from '@ltas/contracts';
export class ApiError extends Error {
  constructor(public readonly status:number,public readonly problem:Problem) {super(problem.detail);}
}
export async function request<T>(path:string,options?:{method?:string;body?:unknown;csrf?:string;key?:string}):Promise<T> {
  const response=await fetch(`/api/v1${path}`,{method:options?.method ?? 'GET',credentials:'same-origin',headers:{...(options?.body?{'Content-Type':'application/json'}:{}),...(options?.csrf?{'X-CSRF-Token':options.csrf}:{}),...(options?.key?{'Idempotency-Key':options.key}:{})},...(options?.body?{body:JSON.stringify(options.body)}:{})});
  let data:unknown;
  try {data=await response.json();} catch {throw new Error('The service returned an unexpected response. Please try again.');}
  if(!response.ok) throw new ApiError(response.status,data as Problem);
  return data as T;
}
export async function downloadDocument(path:string, filename:string):Promise<void> {
  const response=await fetch(`/api/v1${path}`,{credentials:'same-origin'});
  if(!response.ok) {
    let data:unknown;
    try {data=await response.json();} catch {throw new Error('The service returned an unexpected response. Please try again.');}
    throw new ApiError(response.status, data as Problem);
  }
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename.replace(/[/\\]/g,'_');
  link.click();
  URL.revokeObjectURL(url);
}
export async function uploadBytes(path:string, body:Blob, csrf:string, headers?:Record<string,string>):Promise<unknown> {
  const response=await fetch(`/api/v1${path}`,{method:'PUT',credentials:'same-origin',headers:{'X-CSRF-Token':csrf,'Content-Type':body.type || 'application/octet-stream',...(headers??{})},body});
  let data:unknown;
  try {data=await response.json();} catch {throw new Error('The service returned an unexpected response. Please try again.');}
  if(!response.ok) throw new ApiError(response.status,data as Problem);
  return data;
}
