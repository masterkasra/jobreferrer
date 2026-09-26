// Builds the resume fixtures in tests/fixtures/resumes from the HTML sources:
// DOCX and ODT (zip + XML), RTF, TXT, and PDF + PNG via Chromium (Playwright).
// Usage: NODE_PATH=$(npm root -g) node scripts/make-resume-fixtures.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import JSZip from 'jszip';

const dir = new URL('../tests/fixtures/resumes/', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function paragraphs(html) {
  return [...html.matchAll(/<(h1|h2|p|li)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], text: m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() }));
}

async function docx(paras, rtl) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const body = paras.map(({ tag, text }) => `<w:p><w:pPr>${rtl ? '<w:bidi/>' : ''}</w:pPr><w:r><w:rPr>${tag.startsWith('h') ? '<w:b/>' : ''}${rtl ? '<w:rtl/>' : ''}</w:rPr><w:t xml:space="preserve">${tag === 'li' ? '• ' : ''}${xml(text)}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function odt(paras) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>');
  const body = paras.map(({ tag, text }) => (tag.startsWith('h') ? `<text:h text:outline-level="1">${xml(text)}</text:h>` : `<text:p>${tag === 'li' ? '• ' : ''}${xml(text)}</text:p>`)).join('');
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${body}</office:text></office:body></office:document-content>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function rtf(paras) {
  const enc = (s) => [...s].map((c) => (c.charCodeAt(0) > 127 ? `\\u${c.charCodeAt(0)}?` : c.replace(/[\\{}]/g, '\\$&'))).join('');
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\n${paras.map(({ tag, text }) => `${tag.startsWith('h') ? '{\\b ' : ''}${tag === 'li' ? '\\bullet  ' : ''}${enc(text)}${tag.startsWith('h') ? '}' : ''}\\par`).join('\n')}\n}`;
}

for (const name of ['en-resume', 'fa-resume']) {
  const html = read(`${name}.html`);
  const paras = paragraphs(html);
  const rtl = name.startsWith('fa');
  writeFileSync(new URL(`${name}.docx`, dir), await docx(paras, rtl));
  writeFileSync(new URL(`${name}.odt`, dir), await odt(paras));
  writeFileSync(new URL(`${name}.rtf`, dir), rtf(paras));
}

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
for (const name of ['en-resume', 'fa-resume']) {
  await page.goto(new URL(`${name}.html`, dir).href);
  await page.pdf({ path: new URL(`${name}.pdf`, dir).pathname, format: 'A4' });
}
// A "scanned" resume: an image with no text layer.
await page.goto(new URL('en-resume.html', dir).href);
await page.screenshot({ path: new URL('en-resume-scan.png', dir).pathname, fullPage: true });
// A scanned PDF: the same image wrapped in a PDF with no text layer.
const png = readFileSync(new URL('en-resume-scan.png', dir)).toString('base64');
await page.setContent(`<html><body style="margin:0"><img style="width:100%" src="data:image/png;base64,${png}"></body></html>`);
await page.pdf({ path: new URL('en-resume-scan.pdf', dir).pathname, format: 'A4' });
await browser.close();
console.log('fixtures written');
