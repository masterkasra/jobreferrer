import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { server } from '../src/web/server.js';

let base;
const realFetch = globalThis.fetch;
before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('upload page renders', async () => {
  const res = await realFetch(`${base}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /jobreferrer/);
  assert.match(html, /name="c" value="DE"/);
});

test('rejects unreadable resumes', async () => {
  const res = await realFetch(`${base}/api/run`, { method: 'POST', headers: { 'X-Filename': 'cv.txt' }, body: 'too short' });
  assert.equal(res.status, 422);
});

test('runs the pipeline and survives every job board being offline', async () => {
  const resume = readFileSync(new URL('../examples/sample-resume.md', import.meta.url));
  // Job boards are unreachable: the server must still answer with a report.
  globalThis.fetch = async (url, opts) => (String(url).startsWith(base) ? realFetch(url, opts) : Promise.reject(new Error('offline')));
  try {
    const res = await realFetch(`${base}/api/run?countries=DE,NL&lang=en`, { method: 'POST', headers: { 'X-Filename': 'cv.md' }, body: resume });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Relocation Job Report/);
    assert.match(html, /StepStone/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
