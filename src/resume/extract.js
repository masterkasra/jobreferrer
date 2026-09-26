// Turn a resume file into plain text.
// Text formats: PDF, DOCX, DOC (legacy Word, best effort), ODT, RTF, HTML, TXT, MD, JSON Resume.
// Images (JPG/PNG/WEBP/GIF) and scanned PDFs have no text layer: see src/resume/load.js,
// which sends them to Claude for transcription when an API key is configured.

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.odt', '.rtf', '.txt', '.md', '.markdown', '.html', '.htm', '.json', '.jpg', '.jpeg', '.png', '.webp', '.gif'];
export const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

export class ResumeFormatError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Detect the real type from magic bytes first (users rename files), then the extension. */
export function detectType(filename = '', buffer) {
  const head = buffer?.subarray(0, 8) ?? Buffer.alloc(0);
  const latin = head.toString('latin1');
  if (latin.startsWith('%PDF')) return '.pdf';
  if (head[0] === 0x89 && latin.slice(1, 4) === 'PNG') return '.png';
  if (head[0] === 0xff && head[1] === 0xd8) return '.jpg';
  if (latin.startsWith('GIF8')) return '.gif';
  if (latin.startsWith('RIFF') && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return '.doc';
  if (latin.startsWith('{\\rtf')) return '.rtf';
  const ext = extname(filename).toLowerCase();
  if (latin.startsWith('PK')) {
    if (ext === '.odt' || buffer.includes('application/vnd.oasis.opendocument.text')) return '.odt';
    return '.docx';
  }
  return ext || '.txt';
}

export async function extractText(buffer, filename = '') {
  const type = detectType(filename, buffer);
  if (IMAGE_TYPES[type]) return '';
  if (type === '.pdf') return clean(await pdfText(buffer));
  if (type === '.docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return clean(value);
  }
  if (type === '.odt') return clean(await odtText(buffer));
  if (type === '.doc') return clean(docText(buffer));
  if (type === '.rtf') return clean(rtfText(buffer.toString('latin1')));
  if (type === '.html' || type === '.htm') return clean(htmlToText(buffer.toString('utf8')));
  if (type === '.json') return clean(jsonText(buffer.toString('utf8')));
  if (looksBinary(buffer)) {
    throw new ResumeFormatError('unsupported', `Unsupported file type (${type}). Send PDF, Word (DOCX/DOC), ODT, RTF, TXT or an image.`);
  }
  return clean(buffer.toString('utf8'));
}

export async function readResume(path) {
  const buffer = await readFile(path);
  return { buffer, text: await extractText(buffer, path), type: detectType(path, buffer) };
}

// Rebuild PDF text line by line from glyph positions. pdf.js returns right-to-left
// scripts (Persian, Arabic) as visually ordered glyphs in presentation forms, so
// RTL lines are read right to left and normalised with NFKC; embedded Latin
// words keep their left-to-right order.
async function pdfText(buffer) {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    const lines = new Map();
    for (const it of items) {
      if (!('str' in it) || it.str === '') continue;
      const y = Math.round(it.transform[5] / 2) * 2;
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y).push({ str: it.str, x: it.transform[4], w: it.width ?? 0, rtl: RTL.test(it.str) });
    }
    const out = [];
    for (const y of [...lines.keys()].sort((a, b) => b - a)) out.push(joinLine(lines.get(y)));
    pages.push(out.join('\n'));
  }
  return pages.join('\n\n').normalize('NFKC');
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

function joinLine(items) {
  const rtlChars = items.filter((i) => i.rtl).reduce((n, i) => n + i.str.length, 0);
  const total = items.reduce((n, i) => n + i.str.trim().length, 0) || 1;
  if (rtlChars / total < 0.3) {
    items.sort((a, b) => a.x - b.x);
    return glue(items);
  }
  items.sort((a, b) => b.x - a.x);
  // Consecutive non-RTL items (Latin words, numbers, emails) go back to left-to-right order.
  const out = [];
  for (let i = 0; i < items.length; ) {
    if (items[i].rtl || !items[i].str.trim()) {
      out.push(items[i++]);
      continue;
    }
    let j = i;
    while (j < items.length && !items[j].rtl) j++;
    // Keep a trailing space outside the reversed run.
    let end = j;
    while (end > i && !items[end - 1].str.trim()) end--;
    out.push(...items.slice(i, end).reverse(), ...items.slice(end, j));
    i = j;
  }
  return glue(out, true);
}

function glue(items, rtl = false) {
  let s = '';
  for (let k = 0; k < items.length; k++) {
    const cur = items[k];
    const prev = items[k - 1];
    // Insert a space where glyph runs are visibly apart but pdf.js gave no space item.
    if (prev && !/\s$/.test(s) && !/^\s/.test(cur.str)) {
      const gap = rtl && prev.rtl && cur.rtl ? prev.x - (cur.x + cur.w) : Math.abs(cur.x - (prev.x + prev.w));
      if (!(prev.rtl && cur.rtl) && gap > 2) s += ' ';
      else if (prev.rtl && cur.rtl && gap > 3) s += ' ';
    }
    s += cur.str;
  }
  return s.replace(/\s+/g, ' ').trim();
}

async function odtText(buffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file('content.xml')?.async('string')) ?? '';
  return htmlToText(
    xml
      .replace(/<text:tab\/>/g, ' ')
      .replace(/<text:s[^>]*\/>/g, ' ')
      .replace(/<text:line-break\/>/g, '\n')
      .replace(/<\/text:(p|h)>/g, '\n'),
  );
}

// Legacy .doc (Word 97-2003) is a binary OLE file. Without a full parser we pull
// out the longest readable runs, trying both UTF-16LE (non-Latin text) and 8-bit.
function docText(buffer) {
  const runs = (text, re) => (text.match(re) ?? []).map((s) => s.trim()).filter((s) => s.length >= 4);
  const utf16 = runs(buffer.toString('utf16le'), /[\p{L}\p{N}\p{P}\p{Zs}\r\n\t•+#]{4,}/gu).filter((s) => /\p{L}{3}/u.test(s));
  const ascii = runs(buffer.toString('latin1'), /[\x20-\x7E\r\n\t]{4,}/g).filter((s) => /[a-z]{3}/i.test(s));
  const best = utf16.join('\n').length >= ascii.join('\n').length ? utf16 : ascii;
  return best.filter((s) => !/^(Microsoft|Normal|Times New Roman|Arial|Calibri|Default Paragraph|Word\.Document|MSWordDoc|Root Entry|SummaryInformation|DocumentSummaryInformation|CompObj|WordDocument|1Table|0Table)/.test(s)).join('\n');
}

export function rtfText(rtf) {
  // Drop destination groups (font/colour tables, metadata, \* groups) by brace depth.
  let body = '';
  for (let i = 0; i < rtf.length; i++) {
    if (rtf[i] === '{' && /^\{\\(\*|fonttbl|colortbl|stylesheet|info|pict|header|footer)/.test(rtf.slice(i, i + 12))) {
      let depth = 0;
      for (; i < rtf.length; i++) {
        if (rtf[i] === '\\') i++;
        else if (rtf[i] === '{') depth++;
        else if (rtf[i] === '}' && --depth === 0) break;
      }
      continue;
    }
    body += rtf[i];
  }
  return body
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCodePoint(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\bullet\s?/g, '• ')
    .replace(/\\(par|line)\b\s?/g, '\n')
    .replace(/\\tab\b\s?/g, ' ')
    .replace(/\\([\\{}])/g, '$1')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

function jsonText(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return raw;
  }
  // JSON Resume (jsonresume.org) or any JSON: flatten "key: value" lines, keys give context.
  const lines = [];
  const walk = (v, key = '') => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    else lines.push(/^(name|label|position|title|summary|highlights|keywords|language|fluency|studyType|area)$/i.test(key) ? String(v) : `${key}: ${v}`);
  };
  walk(data);
  return lines.join('\n');
}

function looksBinary(buffer) {
  const sample = buffer.subarray(0, 2048);
  let bad = 0;
  for (const b of sample) if (b === 0 || (b < 9) || (b > 13 && b < 32)) bad++;
  return sample.length > 0 && bad / sample.length > 0.1;
}

export function htmlToText(html = '') {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, ' ');
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Persian/Arabic digits → ASCII, Arabic ي/ك → Persian ی/ک, zero-width non-joiner → space. */
export function normalizeText(text = '') {
  return text
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ');
}

function clean(text = '') {
  return normalizeText(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
