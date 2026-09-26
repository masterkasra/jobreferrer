// Turn a resume file (PDF, DOCX, TXT, MD, HTML) into plain text.

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.html', '.htm', '.rtf'];

export function detectType(filename = '', buffer) {
  const ext = extname(filename).toLowerCase();
  if (ext) return ext;
  if (buffer?.subarray(0, 4).toString('latin1') === '%PDF') return '.pdf';
  if (buffer?.subarray(0, 2).toString('latin1') === 'PK') return '.docx';
  return '.txt';
}

export async function extractText(buffer, filename = '') {
  const type = detectType(filename, buffer);
  if (type === '.pdf') {
    const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfText(pdf, { mergePages: true });
    return clean(text);
  }
  if (type === '.docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return clean(value);
  }
  if (type === '.html' || type === '.htm') return clean(htmlToText(buffer.toString('utf8')));
  if (type === '.rtf') return clean(buffer.toString('utf8').replace(/\\[a-z]+-?\d* ?|[{}]/g, ''));
  return clean(buffer.toString('utf8'));
}

export async function readResume(path) {
  const buffer = await readFile(path);
  return { buffer, text: await extractText(buffer, path), type: detectType(path, buffer) };
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

function clean(text = '') {
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
