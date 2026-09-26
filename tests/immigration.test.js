import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { countryFit, salaryCheck } from '../src/immigration/advisor.js';
import { COUNTRIES } from '../src/immigration/countries.js';
import { normaliseCompany, parseCsvFirstColumn, checkSponsors } from '../src/immigration/sponsors.js';
import { makeJob } from '../src/jobs/normalize.js';
import { mockFetch } from './helpers.js';

let mock;
afterEach(() => mock?.restore());

const profile = { roleFamily: 'software', seniority: 'senior', highestDegree: 'bachelor', languages: [{ name: 'English', level: 'C1' }, { name: 'German', level: 'A2' }] };

test('every country entry is complete and links are https', () => {
  for (const [code, c] of Object.entries(COUNTRIES)) {
    assert.ok(c.name && c.fa && c.routes.length && c.cv && c.recognition.url, code);
    for (const r of c.routes) assert.match(r.url, /^https:\/\//, `${code} ${r.name}`);
  }
});

test('salary check against visa thresholds', () => {
  const job = (salary, location) => ({ ...makeJob({ source: 't', sourceName: 'T', title: 'Dev', url: 'https://x', location }), salary });
  assert.equal(salaryCheck(job({ min: 60000, max: 70000, currency: 'EUR' }, 'Berlin')).status, 'meets');
  assert.equal(salaryCheck(job({ min: 46000, max: 47000, currency: 'EUR' }, 'Berlin')).status, 'meets-reduced');
  assert.equal(salaryCheck(job({ min: 30000, max: 35000, currency: 'EUR' }, 'Berlin')).status, 'below');
  // NL thresholds are monthly: 5,942 × 12 = 71,304
  assert.equal(salaryCheck(job({ min: 72000, max: 72000, currency: 'EUR' }, 'Amsterdam')).status, 'meets');
  assert.equal(salaryCheck(job({ min: 50000, max: 50000, currency: 'USD' }, 'Berlin')), null);
  assert.equal(salaryCheck(job(null, 'Berlin')), null);
});

test('country fit ranks and applies nationality restrictions', () => {
  const fit = countryFit(profile, ['DE', 'US', 'GB'], [], 'IR');
  assert.equal(fit.at(-1).code, 'US');
  assert.ok(fit.at(-1).blocked);
  assert.ok(fit.find((c) => c.code === 'GB').reasons.includes('english-ok'));
  const fa = countryFit(profile, ['US'], [], 'IR', 'fa');
  assert.match(fa[0].blocked, /آمریکا/);
});

test('degree-only routes are hidden for candidates without a degree', () => {
  const fit = countryFit({ ...profile, highestDegree: 'unknown' }, ['DE'], []);
  assert.ok(!fit[0].routes.some((r) => r.name === 'EU Blue Card'));
  assert.ok(fit[0].routes.some((r) => r.name === 'IT specialist without a degree'));
});

test('company names are normalised for register lookups', () => {
  assert.equal(normaliseCompany('Thames Fintech Ltd.'), 'thames fintech');
  assert.equal(normaliseCompany('Grachten Tech B.V.'), 'grachten tech');
  assert.deepEqual(parseCsvFirstColumn('"Organisation Name","Town/City"\n"Acme, Ltd","London"\nPlain Co,Leeds\n'), ['acme', 'plain']);
});

test('UK register check marks listed and unlisted employers', async () => {
  mock = mockFetch([
    ['gov.uk/government/publications', '<a href="https://assets.publishing.service.gov.uk/media/abc/2026-09-25_-_Worker_and_Temporary_Worker.csv">CSV</a>'],
    ['assets.publishing.service.gov.uk', '"Organisation Name","Town/City"\n"Thames Fintech Limited","London"\n'],
  ]);
  const jobs = [
    makeJob({ source: 't', sourceName: 'T', title: 'Dev', company: 'Thames Fintech Ltd', location: 'London, UK', url: 'https://a' }),
    makeJob({ source: 't', sourceName: 'T', title: 'Dev', company: 'Unknown Startup', location: 'London', url: 'https://b' }),
  ];
  const status = await checkSponsors(jobs);
  assert.equal(status.GB.size, 1);
  assert.equal(jobs[0].sponsor.listed, true);
  assert.equal(jobs[1].sponsor.listed, false);
});
