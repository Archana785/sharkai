import JSZip from 'jszip';
import { AppError } from './errors.js';

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Text of a .pdf (pdf.js, the same engine Firefox uses). Loaded lazily because it is large. */
async function fromPdf(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages && i <= 60; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join(''));
    }
    return pages.join('\n');
  } finally {
    await task.destroy();
  }
}

/** Text of a .pptx: every <a:t> run on every slide, in slide order. */
async function fromPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
  const out = [];
  for (const name of slides) {
    const xml = await zip.file(name).async('string');
    const paras = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => decode(m[1])).join(''));
    out.push(paras.filter(Boolean).join(' '));
  }
  return out.filter(Boolean).join('\n');
}

/** Text of a .docx: every <w:t> run, one line per paragraph. */
async function fromDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) return '';
  const xml = await file.async('string');
  return xml
    .split(/<\/w:p>/)
    .map((p) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => decode(m[1])).join(''))
    .filter(Boolean)
    .join('\n');
}

/** Extract plain text from an uploaded file (.txt .md .pdf .pptx .docx). */
export async function extractText(buffer, filename) {
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  try {
    if (ext === 'txt' || ext === 'md') return buffer.toString('utf8');
    if (ext === 'pdf') return await fromPdf(buffer);
    if (ext === 'pptx') return await fromPptx(buffer);
    if (ext === 'docx') return await fromDocx(buffer);
  } catch {
    throw new AppError(422, 'UNREADABLE_FILE', 'That file could not be read. Try a different file or paste the text instead.');
  }
  throw new AppError(415, 'UNSUPPORTED_FILE', 'Please upload a .pdf, .pptx, .docx, .txt or .md file.');
}
