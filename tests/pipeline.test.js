import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/pipeline.js';
import { toMarkdown } from '../src/report/markdown.js';
import { toHtml } from '../src/report/html.js';
import { toTelegram, pitchMessages } from '../src/report/telegram.js';

const text = readFileSync(new URL('../examples/sample-resume.md', import.meta.url), 'utf8');
const fixtureJobs = JSON.parse(readFileSync(new URL('../examples/demo-jobs.json', import.meta.url), 'utf8'));

test('offline pipeline produces a complete report', async () => {
  const steps = [];
  const r = await run({ text, fixtureJobs, useAI: false, countries: ['DE', 'NL', 'GB', 'US'], nationality: 'IR', lang: 'fa', onProgress: (m) => steps.push(m.step) });
  assert.deepEqual(steps, ['profile', 'search', 'pitches', 'strategy', 'done']);
  assert.equal(r.jobs[0].company, 'Nordlicht Software GmbH (demo)');
  assert.ok(r.jobs[0].pitch.coverLetter.includes('Senior Full Stack Engineer'));
  assert.equal(r.jobs[0].salaryCheck.status, 'meets');
  assert.equal(r.freelance.length, 3);
  assert.ok(r.freelance[0].proposal.startsWith('Hi, I read your project'));
  assert.equal(r.scams.length, 1);
  assert.equal(r.stats.visa >= 4, true);
  assert.ok(r.strategy.warnings.some((w) => w.includes('آمریکا')));
  assert.ok(r.strategy.actionPlan.length === 4);
  assert.ok(r.jobs.every((j) => !('description' in j) && typeof j.excerpt === 'string'));
});

test('seen file marks only new jobs on the second run', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jr-'));
  const seenFile = join(dir, 'seen.json');
  try {
    const first = await run({ text, fixtureJobs, useAI: false, seenFile });
    assert.ok(first.jobs.every((j) => j.isNew));
    const second = await run({ text, fixtureJobs: [...fixtureJobs, { ...fixtureJobs[0], url: 'https://example.com/jobs/brand-new', company: 'Fresh GmbH' }], useAI: false, seenFile });
    assert.deepEqual(second.jobs.filter((j) => j.isNew).map((j) => j.company), ['Fresh GmbH']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('renderers: markdown, html (escaped, RTL) and telegram (size limits)', async () => {
  const r = await run({ text, fixtureJobs, useAI: false, lang: 'fa' });
  const md = toMarkdown(r);
  assert.match(md, /^# گزارش فرصت‌های شغلی و مهاجرت/);
  assert.match(md, /Nordlicht Software GmbH/);
  assert.match(toHtml(r), /<html lang="fa" dir="rtl">/);
  // Job data comes from third parties: it must be escaped and links must be http(s).
  r.jobs[1] = { ...r.jobs[1], company: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' };
  const html = toHtml(r);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('href="javascript:'));
  const msgs = toTelegram(r);
  assert.ok(msgs.length >= 2);
  for (const m of msgs) assert.ok(m.length < 4096);
  const pm = pitchMessages(r, 0);
  assert.match(pm[0], /<pre>Dear Nordlicht/);
  const en = toHtml(await run({ text, fixtureJobs, useAI: false, lang: 'en' }));
  assert.match(en, /dir="ltr"/);
});
