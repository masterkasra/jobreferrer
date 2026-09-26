import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heuristicProfile } from '../src/profile/heuristic.js';
import { makeJob } from '../src/jobs/normalize.js';
import { rankJobs, scoreJob, flagged } from '../src/match/score.js';

const profile = heuristicProfile(readFileSync(new URL('../examples/sample-resume.md', import.meta.url), 'utf8'));
const jobs = JSON.parse(readFileSync(new URL('../examples/demo-jobs.json', import.meta.url), 'utf8')).map(makeJob);
const byCompany = (name) => jobs.find((j) => j.company.startsWith(name));
const countries = ['DE', 'NL', 'GB', 'IE', 'CA'];

test('sponsored job in a target country ranks first', () => {
  const ranked = rankJobs(jobs, profile, countries);
  assert.equal(ranked[0].company, 'Nordlicht Software GmbH (demo)');
  assert.ok(ranked[0].matchedSkills.includes('React'));
});

test('scams are removed from the ranking and reported separately', () => {
  const ranked = rankJobs(jobs, profile, countries);
  assert.ok(!ranked.some((j) => j.company.startsWith('Global Visa')));
  assert.equal(flagged(jobs).length, 1);
});

test('language requirements and US-only remote roles are penalised', () => {
  const german = scoreJob(byCompany('Schwabenwerk'), profile, countries);
  assert.deepEqual(german.missingLanguages, ['German']);
  const usOnly = scoreJob(byCompany('Liberty'), profile, countries);
  assert.ok(usOnly.reasons.includes('region-locked'));
  assert.ok(usOnly.reasons.includes('no-sponsorship'));
  assert.ok(usOnly.score < scoreJob(byCompany('Distributed'), profile, countries).score);
});

test('freelance projects are ranked by skills', () => {
  const gigs = rankJobs(jobs, profile, countries).filter((j) => j.kind === 'freelance');
  assert.equal(gigs.length, 3);
});

test('remote roles locked to other regions and US-citizen gigs are penalised', () => {
  const latam = makeJob({ source: 't', sourceName: 'T', title: 'Senior React Developer', company: 'X', location: 'LATAM', url: 'https://x', description: 'Remote. React, Node.js, TypeScript' });
  const eu = makeJob({ source: 't', sourceName: 'T', title: 'Senior React Developer', company: 'Y', location: 'Europe', url: 'https://y', description: 'Remote. React, Node.js, TypeScript' });
  assert.ok(scoreJob(latam, profile, countries).reasons.includes('region-locked'));
  assert.ok(scoreJob(latam, profile, countries).score < scoreJob(eu, profile, countries).score);
  const gig = makeJob({ source: 't', sourceName: 'T', kind: 'freelance', title: 'U.S. Citizen Full-Stack Developer', url: 'https://z', description: 'React Node.js' });
  const ok = makeJob({ source: 't', sourceName: 'T', kind: 'freelance', title: 'Full-Stack Developer', url: 'https://w', description: 'React Node.js' });
  assert.ok(scoreJob(gig, profile, countries).score < scoreJob(ok, profile, countries).score - 20);
  const long = makeJob({ source: 't', sourceName: 'T', title: 'Dev', url: 'https://v', location: Array(40).fill('Germany, Netherlands').join(', ') });
  assert.ok(long.location.length <= 92 && long.location.endsWith('…'));
  assert.ok(long.countries.includes('DE') && long.countries.includes('NL'));
});
