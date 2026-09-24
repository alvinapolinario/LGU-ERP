import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { classifyExtracted, extractOrdinanceText } from './extract-text.js';

function textPdf(message:string):Buffer {
  const stream = `BT /F1 18 Tf 36 100 Td (${message}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) table += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  body += `${table}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

function imagePdf(jpeg:Buffer, width:number, height:number):Buffer {
  const draw = `q ${width} 0 0 ${height} 0 0 cm /Im Do Q`;
  const imageHead = `5 0 obj << /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >> stream\n`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Im 5 0 R >> >> >> endobj\n`,
    `4 0 obj << /Length ${draw.length} >> stream\n${draw}\nendstream\nendobj\n`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  offsets.push(Buffer.byteLength(body));
  body += imageHead;
  const header = Buffer.from(body);
  const footer = Buffer.from('\nendstream\nendobj\n');
  const xrefAt = header.length + jpeg.length + footer.length;
  let table = `xref\n0 6\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) table += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  const tail = Buffer.from(`${table}trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
  return Buffer.concat([header, jpeg, footer, tail]);
}

describe('ordinance text classification', () => {
  it('keeps a readable page searchable and labeled as unrecognized authority', () => {
    const result = classifyExtracted('An ordinance regulating the public market of Libungan.', 'image/jpeg');
    expect(result.extractState).toBe('EXTRACTED');
    expect(result.extractedText).toContain('public market');
    expect(result.extractNote).toMatch(/not a certified copy/i);
  });
  it('marks a PDF with no readable words as unread', () => {
    const result = classifyExtracted('   ', 'application/pdf');
    expect(result.extractState).toBe('UNREADABLE');
    expect(result.extractNote).toMatch(/PDF/i);
    expect(result.extractNote).toMatch(/type the ordinance text/i);
  });
  it('reads selectable words from a PDF into the ordinance text', async () => {
    const result = await extractOrdinanceText(textPdf('Libungan public market ordinance'), 'application/pdf');
    expect(result.extractState).toBe('EXTRACTED');
    expect(result.extractedText).toContain('public market');
  });
  it('reads words from a picture-only PDF', async () => {
    const canvas = createCanvas(900, 160);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 900, 160);
    context.fillStyle = '#000000';
    context.font = '32px sans-serif';
    context.fillText('Libungan public market ordinance', 24, 90);
    const result = await extractOrdinanceText(imagePdf(canvas.toBuffer('image/jpeg'), 900, 160), 'application/pdf');
    expect(result.extractState).toBe('EXTRACTED');
    expect(result.extractedText?.toLowerCase()).toContain('market');
  }, 30_000);
});
