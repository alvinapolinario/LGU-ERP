import { fail } from '../http.js';
export function detectMime(body:Buffer,declared:string):string {
  if(body.length>=5 && body.subarray(0,5).toString('ascii')==='%PDF-') return 'application/pdf';
  if(body.length>=3 && body[0]===0xff && body[1]===0xd8 && body[2]===0xff) return 'image/jpeg';
  if(body.length>=8 && body.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if(body.length>=4 && (body.subarray(0,4).equals(Buffer.from([0x49,0x49,0x2a,0x00])) || body.subarray(0,4).equals(Buffer.from([0x4d,0x4d,0x00,0x2a])))) return 'image/tiff';
  if(body.length>=4 && body[0]===0x50 && body[1]===0x4b && declared==='application/vnd.openxmlformats-officedocument.wordprocessingml.document') return declared;
  fail(422,'UNSUPPORTED_TYPE','The file signature is not an allowed PDF, DOCX, JPEG, PNG or TIFF.');
}
