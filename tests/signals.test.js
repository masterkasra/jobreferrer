import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSignals, parseSalary } from '../src/jobs/signals.js';
import { countryOf, countriesIn, regionOf } from '../src/jobs/geo.js';
import { makeJob, dedupe } from '../src/jobs/normalize.js';

test('visa, relocation and remote signals', () => {
  const s = detectSignals('We offer visa sponsorship and a relocation package. Hybrid work.');
  assert.equal(s.visa, true);
  assert.equal(s.relocation, true);
  assert.equal(detectSignals('EU Blue Card support available').visa, true);
  assert.equal(detectSignals('Fully remote team').remote, true);
});

test('negative sponsorship statements win over positive keywords', () => {
  const s = detectSignals('Unfortunately we cannot sponsor visas. Must have the right to work in the UK.');
  assert.equal(s.visa, false);
  assert.equal(s.noVisa, true);
  assert.equal(detectSignals('Visa sponsorship: no sponsorship available').visa, false);
});

test('language requirements are detected in English and German ads', () => {
  assert.deepEqual(detectSignals('Fluent German is required').languages, ['German']);
  assert.deepEqual(detectSignals('Sehr gute Deutschkenntnisse').languages, ['German']);
  assert.deepEqual(detectSignals('Dutch (C1) is a must').languages, ['Dutch']);
  assert.deepEqual(detectSignals('English is our language').languages, []);
});

test('scam patterns are flagged', () => {
  const s = detectSignals('100% visa guaranteed! Pay the processing fee. Contact us on WhatsApp only.');
  assert.ok(s.scamFlags.includes('asks for a fee'));
  assert.ok(s.scamFlags.includes('guarantees a visa/job'));
  assert.ok(s.scamFlags.includes('contact only via messenger'));
  assert.deepEqual(detectSignals('Great team, competitive salary').scamFlags, []);
});

test('salary parsing', () => {
  assert.deepEqual(parseSalary('Salary €72,000 - €85,000'), { min: 72000, max: 85000, currency: 'EUR', period: 'year' });
  assert.deepEqual(parseSalary('$120k'), { min: 120000, max: 120000, currency: 'USD', period: 'year' });
  assert.equal(parseSalary('no money talk'), null);
});

test('geo detection', () => {
  assert.equal(countryOf('Berlin, Germany'), 'DE');
  assert.equal(countryOf('München'), 'DE');
  assert.deepEqual(countriesIn('London or Amsterdam'), ['GB', 'NL']);
  assert.equal(countryOf('Remote'), '');
  assert.equal(regionOf('Remote - Worldwide'), 'WW');
  assert.equal(regionOf('Remote (EMEA)'), 'EU');
});

test('makeJob normalises HTML and dedupe merges boards', () => {
  const a = makeJob({ source: 'x', sourceName: 'X', title: 'Dev &amp; Ops', company: 'Acme', location: 'Dublin, Ireland', url: 'https://a', description: '<p>We sponsor visas</p>' });
  assert.equal(a.title, 'Dev & Ops');
  assert.deepEqual(a.countries, ['IE']);
  assert.equal(a.signals.visa, true);
  assert.equal(a.description, 'We sponsor visas');
  const b = makeJob({ source: 'y', sourceName: 'Y', title: 'Dev & Ops', company: 'ACME', location: 'Dublin', url: 'https://b', description: 'longer description here' });
  const merged = dedupe([a, b]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].alsoOn, [{ source: 'Y', url: 'https://b' }]);
});
