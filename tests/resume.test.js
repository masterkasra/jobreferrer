import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractText, detectType, rtfText, normalizeText } from '../src/resume/extract.js';
import { loadResume, resumeErrorMessage } from '../src/resume/load.js';
import { heuristicProfile } from '../src/profile/heuristic.js';
import { setClient } from '../src/llm/claude.js';
import { config } from '../src/config.js';

const dir = new URL('./fixtures/resumes/', import.meta.url);
const file = (name) => readFileSync(new URL(name, dir));
after(() => (config.anthropic.apiKey = ''));

const EN_FORMATS = ['en-resume.pdf', 'en-resume.docx', 'en-resume.odt', 'en-resume.rtf', 'en-resume.html', 'en-resume.txt', 'en-resume.md'];
const FA_FORMATS = ['fa-resume.pdf', 'fa-resume.docx', 'fa-resume.odt', 'fa-resume.rtf', 'fa-resume.html'];

for (const name of EN_FORMATS) {
  test(`English resume from ${name.split('.').pop().toUpperCase()} parses to the same profile`, async () => {
    const { text, via } = await loadResume(file(name), name, { useAI: false });
    assert.equal(via, 'text');
    const p = heuristicProfile(text);
    assert.equal(p.name, 'Arman Karimi');
    assert.equal(p.email, 'arman.karimi@example.com');
    assert.equal(p.headline, 'Full Stack Developer');
    assert.equal(p.yearsExperience, 7);
    assert.equal(p.highestDegree, 'bachelor');
    assert.equal(p.seniority, 'senior');
    for (const s of ['React', 'Node.js', 'PostgreSQL', 'Kubernetes', 'TypeScript', 'AWS']) assert.ok(p.skills.includes(s), `${name}: ${s}`);
    assert.deepEqual(p.languages.map((l) => `${l.name}:${l.level}`).sort(), ['English:C1', 'German:A2', 'Persian:native']);
    assert.equal(p.searchQueries[0], 'full stack developer');
    assert.ok(p.strengths.some((x) => /45%/.test(x)), `${name}: achievements`);
  });
}

for (const name of FA_FORMATS) {
  test(`Persian resume from ${name.split('.').pop().toUpperCase()} parses (titles translated to English)`, async () => {
    const { text } = await loadResume(file(name), name, { useAI: false });
    const p = heuristicProfile(text);
    assert.equal(p.name, 'سارا محمدی');
    assert.equal(p.email, 'sara.mohammadi@example.com');
    assert.equal(p.headline, 'Data Engineer');
    assert.equal(p.roleFamily, 'data');
    assert.equal(p.yearsExperience, 5);
    assert.equal(p.highestDegree, 'master');
    assert.equal(p.location, 'Tehran');
    for (const s of ['Python', 'SQL', 'Spark', 'Airflow', 'dbt', 'PostgreSQL', 'Power BI']) assert.ok(p.skills.includes(s), `${name}: ${s}`);
    assert.deepEqual(p.languages.map((l) => `${l.name}:${l.level}`).sort(), ['English:C1', 'German:A1', 'Persian:native']);
    assert.ok(p.searchQueries.includes('data engineer'));
    assert.ok(p.searchQueries.every((q) => /^[a-z /.+#-]+$/.test(q)), 'queries are English');
  });
}

test('file type is detected from content even when the extension is wrong', () => {
  assert.equal(detectType('cv.txt', file('en-resume.pdf')), '.pdf');
  assert.equal(detectType('cv', file('en-resume.docx')), '.docx');
  assert.equal(detectType('cv.docx', file('en-resume.odt')), '.odt');
  assert.equal(detectType('cv.pdf', file('en-resume-scan.png')), '.png');
  assert.equal(detectType('cv', file('en-resume.rtf')), '.rtf');
});

test('images and scanned PDFs need Claude when there is no API key', async () => {
  for (const name of ['en-resume-scan.png', 'en-resume-scan.pdf']) {
    await assert.rejects(loadResume(file(name), name, { useAI: false }), (err) => err.code === 'needs-ai');
  }
  const msg = resumeErrorMessage({ code: 'needs-ai' }, 'fa');
  assert.match(msg, /ANTHROPIC_API_KEY/);
});

test('images and scanned PDFs are transcribed by Claude when a key is set', async () => {
  config.anthropic.apiKey = 'test-key';
  const transcript = readFileSync(new URL('en-resume.txt', dir), 'utf8');
  const calls = [];
  setClient({
    beta: {
      messages: {
        stream: (params) => {
          calls.push(params);
          return { finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ text: transcript }) }] }) };
        },
      },
    },
  });
  const img = await loadResume(file('en-resume-scan.png'), 'photo.png');
  assert.equal(img.via, 'ocr');
  assert.equal(calls[0].messages[0].content[0].type, 'image');
  assert.equal(calls[0].messages[0].content[0].source.media_type, 'image/png');
  assert.equal(heuristicProfile(img.text).headline, 'Full Stack Developer');

  const scan = await loadResume(file('en-resume-scan.pdf'), 'scan.pdf');
  assert.equal(scan.via, 'ocr');
  assert.equal(calls[1].messages[0].content[0].type, 'document');
  assert.ok(scan.pdf);
  config.anthropic.apiKey = '';
});

test('legacy Word .doc: text is recovered from the binary', async () => {
  // Minimal OLE-looking buffer: magic header, binary noise and UTF-16LE text like Word 97 stores it.
  const body = 'Arman Karimi\rSenior Full Stack Developer\r7 years of experience with React, Node.js and PostgreSQL\rEnglish C1';
  const buf = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(512, 0), Buffer.from(body, 'utf16le'), Buffer.alloc(64, 0xff)]);
  const text = await extractText(buf, 'old.doc');
  const p = heuristicProfile(text);
  assert.equal(p.headline, 'Full Stack Developer');
  assert.ok(p.skills.includes('React'));
});

test('JSON Resume is flattened into text', async () => {
  const json = JSON.stringify({
    basics: { name: 'Lina Park', label: 'Backend Developer', email: 'lina@example.com', summary: 'Backend developer with 6 years of experience in Go and Kubernetes.' },
    work: [{ position: 'Backend Developer', highlights: ['Cut API latency by 40% using Redis caching'] }],
    skills: [{ name: 'Backend', keywords: ['Go', 'Kubernetes', 'PostgreSQL'] }],
    languages: [{ language: 'English', fluency: 'Fluent' }],
  });
  const { text } = await loadResume(Buffer.from(json), 'resume.json', { useAI: false });
  const p = heuristicProfile(text);
  assert.equal(p.email, 'lina@example.com');
  assert.ok(p.skills.includes('Go') && p.skills.includes('Kubernetes'));
  assert.equal(p.yearsExperience, 6);
});

test('unsupported binary files and empty files get clear errors', async () => {
  await assert.rejects(loadResume(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 1, 2, 3]), 'x.bin', { useAI: false }), (e) => e.code === 'unsupported');
  await assert.rejects(loadResume(Buffer.from('hello'), 'x.txt', { useAI: false }), (e) => e.code === 'empty');
  await assert.rejects(loadResume(Buffer.from('%PDF-1.4 broken'), 'x.pdf', { useAI: false }), (e) => e.code === 'unsupported');
  await assert.rejects(loadResume(Buffer.from('PK\u0003\u0004garbage'), 'x.docx', { useAI: false }), (e) => e.code === 'unsupported');
});

test('Persian digits and Jalali years are normalised', () => {
  assert.equal(normalizeText('۵ سال · ٣٠٪'), '5 سال · 30٪');
  const p = heuristicProfile('برنامه نویس\nتوسعه دهنده بک اند — شرکت نمونه (۱۳۹۶ تا اکنون)');
  assert.equal(p.headline, 'Backend Developer');
  assert.ok(p.yearsExperience >= 8);
  assert.match(rtfText('{\\rtf1{\\fonttbl{\\f0 Arial;}}Name\\par \\u1587?\\u1575?\\u1585?\\u1575?\\par}'), /Name\n\s*سارا/);
});
