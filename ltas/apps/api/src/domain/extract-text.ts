const readableLetters = (value:string) => value.replace(/[^A-Za-z0-9]/g, '').length;
const PDF_PAGE_CAP = 8;

export function classifyExtracted(raw:string, mime:string):{extractState:'EXTRACTED'|'UNREADABLE'; extractedText:string|null; extractNote:string} {
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, 200_000);
  if (readableLetters(cleaned) < 12) {
    const extractNote = mime === 'application/pdf'
      ? 'Not enough text could be read from this PDF. The file is stored. Type the ordinance text if the reading is missing.'
      : 'Not enough text could be read from this image. Try a clearer, upright scan, or type the ordinance text.';
    return {extractState:'UNREADABLE', extractedText:cleaned || null, extractNote};
  }
  return {extractState:'EXTRACTED', extractedText:cleaned, extractNote:'Recognized text is not a certified copy. Compare it with the scan.'};
}

async function recognize(images:Buffer[]):Promise<string> {
  const {createWorker} = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const parts:string[] = [];
    for (const image of images) {
      const result = await worker.recognize(image);
      parts.push(result.data.text);
    }
    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}

async function rawImagePng(image:{data:Uint8ClampedArray; width:number; height:number; channels:1|3|4}):Promise<Buffer> {
  const {createCanvas, ImageData} = await import('@napi-rs/canvas');
  const canvas = createCanvas(image.width, image.height);
  const rgba = new Uint8ClampedArray(image.width * image.height * 4);
  const src = image.data;
  if (image.channels === 4) rgba.set(src);
  else if (image.channels === 3) {
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
      rgba[j] = src[i] ?? 0;
      rgba[j + 1] = src[i + 1] ?? 0;
      rgba[j + 2] = src[i + 2] ?? 0;
      rgba[j + 3] = 255;
    }
  } else {
    for (let i = 0, j = 0; i < src.length; i += 1, j += 4) {
      rgba[j] = rgba[j + 1] = rgba[j + 2] = src[i] ?? 0;
      rgba[j + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
  return canvas.toBuffer('image/png');
}

async function pdfText(body:Buffer):Promise<{raw:string; truncated:boolean}> {
  const {extractImages, extractText, getDocumentProxy, renderPageAsImage} = await import('unpdf');
  const data = new Uint8Array(body);
  const pdf = await getDocumentProxy(data);
  const extracted = await extractText(pdf, {mergePages:true});
  const joined = extracted.text;
  if (readableLetters(joined) >= 12) return {raw:joined, truncated:false};
  const total = extracted.totalPages;
  const pages = Math.min(total, PDF_PAGE_CAP);
  const embedded = [];
  for (let page = 1; page <= pages; page += 1) {
    try {embedded.push(...await extractImages(pdf, page));} catch { /* this page has no extractable picture */ }
  }
  const pictures = embedded.filter(image => image.width >= 40 && image.height >= 40).sort((a, b) => b.width * b.height - a.width * a.height).slice(0, PDF_PAGE_CAP);
  if (pictures.length > 0) {
    const pngs:Buffer[] = [];
    for (const picture of pictures) pngs.push(await rawImagePng(picture));
    const raw = await recognize(pngs);
    if (readableLetters(raw) >= 12) return {raw, truncated:total > PDF_PAGE_CAP};
  }
  try {
    const rendered:Buffer[] = [];
    const again = await getDocumentProxy(data);
    for (let page = 1; page <= pages; page += 1) {
      rendered.push(Buffer.from(await renderPageAsImage(again, page, {scale:1.5, canvasImport:() => import('@napi-rs/canvas')})));
    }
    return {raw:await recognize(rendered), truncated:total > PDF_PAGE_CAP};
  } catch {
    return {raw:joined, truncated:false};
  }
}

export async function extractOrdinanceText(body:Buffer, mime:string):Promise<{extractState:'EXTRACTED'|'UNREADABLE'; extractedText:string|null; extractNote:string}> {
  try {
    if (mime === 'application/pdf') {
      const {raw, truncated} = await pdfText(body);
      const result = classifyExtracted(raw, mime);
      if (truncated && result.extractState === 'EXTRACTED') {
        result.extractNote = `The first ${PDF_PAGE_CAP} pages were read. Later pages were not. Recognized text is not a certified copy. Compare it with the scan.`;
      }
      return result;
    }
    return classifyExtracted(await recognize([body]), mime);
  } catch {
    return {extractState:'UNREADABLE', extractedText:null, extractNote:'The scan was stored, but its text could not be read.'};
  }
}
