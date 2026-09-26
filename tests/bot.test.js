// Telegram bot end to end with a fake Telegram API and a fake job board:
// user sends a resume (PDF / DOCX / photo / pasted text) → bot reads it,
// searches, and replies with jobs, pitch buttons and the HTML report.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../src/config.js';
import { handleMessage, handleCallback, loadState } from '../src/bot/telegram.js';

const fixtures = new URL('./fixtures/resumes/', import.meta.url);
const realFetch = globalThis.fetch;
let sent;
let files;
let dir;

const JOB = {
  slug: 'x', company_name: 'Nordlicht Software GmbH', title: 'Senior Full Stack Developer (React/Node.js)',
  description: 'React, Node.js, TypeScript, PostgreSQL, Kubernetes. We offer visa sponsorship (EU Blue Card) and relocation support.',
  remote: false, url: 'https://www.arbeitnow.com/jobs/nordlicht', tags: ['react'], job_types: [], location: 'Berlin, Germany', created_at: Math.floor(Date.now() / 1000),
};
const DATA_JOB = { ...JOB, company_name: 'Datenwerk AG', title: 'Data Engineer (Python/Airflow)', description: 'Python, SQL, Airflow, Spark, dbt. Visa sponsorship available.', url: 'https://www.arbeitnow.com/jobs/datenwerk' };

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jr-bot-'));
  config.cacheDir = dir;
  config.telegram.token = 'TEST:TOKEN';
  await loadState();
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.telegram.org/file/')) return new Response(files[u.split('/').pop()]);
    if (u.startsWith('https://api.telegram.org/')) {
      const method = u.split('/').pop();
      const body = opts.body instanceof FormData ? Object.fromEntries(opts.body.entries()) : JSON.parse(opts.body ?? '{}');
      sent.push({ method, body });
      if (method === 'getFile') return Response.json({ ok: true, result: { file_path: body.file_id } });
      return Response.json({ ok: true, result: {} });
    }
    // One live-looking job board; every other board is "offline".
    if (u.includes('arbeitnow.com')) return Response.json({ data: [JOB, DATA_JOB], links: {} });
    throw new Error('offline');
  };
});
after(() => {
  globalThis.fetch = realFetch;
  config.telegram.token = '';
  rmSync(dir, { recursive: true, force: true });
});

const chat = (id) => ({ chat: { id }, from: { id } });
const texts = () => sent.filter((m) => m.method === 'sendMessage').map((m) => m.body.text).join('\n');

async function sendFile(chatId, name, extra = {}) {
  files = { [name]: readFileSync(new URL(name, fixtures)) };
  sent = [];
  await handleMessage({ ...chat(chatId), document: { file_id: name, file_name: name, file_size: files[name].length }, ...extra });
}

test('PDF resume → jobs, pitch buttons and HTML report', async () => {
  await sendFile(101, 'en-resume.pdf');
  const out = texts();
  assert.match(out, /رزومه دریافت شد/);
  assert.match(out, /Senior Full Stack Developer \(React\/Node\.js\)/);
  assert.match(out, /Nordlicht Software GmbH/);
  assert.match(out, /https:\/\/www\.arbeitnow\.com\/jobs\/nordlicht/);
  const buttons = sent.find((m) => m.body.reply_markup)?.body.reply_markup.inline_keyboard.flat();
  assert.ok(buttons?.length >= 1);
  const doc = sent.find((m) => m.method === 'sendDocument');
  assert.ok(doc, 'HTML report sent');
  assert.match(await doc.body.document.text(), /Nordlicht Software GmbH/);

  // Tapping a pitch button returns the cover letter.
  sent = [];
  await handleCallback({ id: 'cb', data: buttons[0].callback_data, message: { chat: { id: 101 } } });
  assert.match(texts(), /Dear Nordlicht Software GmbH hiring team/);
});

test('Persian DOCX resume → data jobs', async () => {
  await sendFile(102, 'fa-resume.docx');
  const out = texts();
  assert.match(out, /Data Engineer \(Python\/Airflow\)/);
  assert.match(out, /Datenwerk AG/);
});

test('photo without an AI key → clear Persian error, no search', async () => {
  files = { photo: readFileSync(new URL('en-resume-scan.png', fixtures)) };
  sent = [];
  await handleMessage({ ...chat(103), photo: [{ file_id: 'photo', file_size: 100 }, { file_id: 'photo', file_size: files.photo.length }] });
  const out = texts();
  assert.match(out, /ANTHROPIC_API_KEY/);
  assert.ok(!sent.some((m) => m.method === 'sendDocument'));
});

test('pasted resume text works too', async () => {
  sent = [];
  await handleMessage({ ...chat(104), text: readFileSync(new URL('en-resume.txt', fixtures), 'utf8') });
  assert.match(texts(), /Nordlicht Software GmbH/);
});

test('settings commands', async () => {
  sent = [];
  await handleMessage({ ...chat(105), text: '/countries DE NL xx' });
  assert.match(texts(), /DE, NL/);
  sent = [];
  await handleMessage({ ...chat(105), text: '/settings' });
  assert.match(texts(), /countries: DE, NL/);
});
