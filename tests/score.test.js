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
