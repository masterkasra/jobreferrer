import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heuristicProfile, detectYears } from '../src/profile/heuristic.js';
import { findSkills, canonicalSkill } from '../src/profile/taxonomy.js';
import { buildProfile } from '../src/profile/index.js';

const resume = readFileSync(new URL('../examples/sample-resume.md', import.meta.url), 'utf8');

test('offline parser extracts the essentials from a resume', () => {
  const p = heuristicProfile(resume);
  assert.equal(p.name, 'Arman Karimi');
  assert.equal(p.email, 'arman.karimi@example.com');
  assert.equal(p.roleFamily, 'software');
  assert.equal(p.headline, 'Full Stack Developer');
  assert.equal(p.seniority, 'senior');
  assert.equal(p.yearsExperience, 7);
  assert.equal(p.highestDegree, 'bachelor');
  for (const s of ['React', 'Node.js', 'PostgreSQL', 'Kubernetes', 'TypeScript']) assert.ok(p.skills.includes(s), s);
  assert.deepEqual(p.languages.find((l) => l.name === 'English'), { name: 'English', level: 'C1' });
  assert.deepEqual(p.languages.find((l) => l.name === 'German'), { name: 'German', level: 'A2' });
  assert.equal(p.searchQueries[0], 'full stack developer');
  assert.ok(p.freelanceServices.length >= 3);
});

test('skill matching respects word boundaries and symbols', () => {
  assert.deepEqual(findSkills('We use C# and .NET, not C++'), ['C#', 'C++', '.NET']);
  assert.ok(!findSkills('excellent communication').includes('Excel'));
  assert.ok(findSkills('Built REST APIs with node.js').includes('Node.js'));
  assert.equal(canonicalSkill('reactjs'), 'React');
  assert.equal(canonicalSkill('Quantum Basket Weaving'), 'Quantum Basket Weaving');
});

test('years of experience fall back to date ranges', () => {
  assert.equal(detectYears('Engineer 2015 - 2019\nLead 2019 - 2021'), 6);
  assert.equal(detectYears('no dates here'), 0);
});

test('buildProfile applies overrides without AI', async () => {
  const p = await buildProfile({ text: resume, useAI: false, overrides: { titles: ['Platform Engineer'], headline: 'Platform Engineer' } });
  assert.equal(p.headline, 'Platform Engineer');
  assert.deepEqual(p.titles, ['Platform Engineer']);
  assert.equal(p.source, 'heuristic');
});
