import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ieltsToClb, crs, fsw67, chancenkarte, australiaPoints } from '../src/immigration/calculators.js';
import { assessImmigration, resolveApplicant } from '../src/immigration/assess.js';
import { requiredYears, jobLevel, jobFamily, remoteScope, sanctionsExcluded, usHours } from '../src/match/requirements.js';
import { scoreJob, diversify } from '../src/match/score.js';
import { makeJob, dedupe } from '../src/jobs/normalize.js';
import { detectAge } from '../src/profile/heuristic.js';

test('IELTS → CLB follows the official IRCC table', () => {
  assert.deepEqual(ieltsToClb({ l: 8, r: 7, w: 7, s: 7 }), { l: 9, r: 9, w: 9, s: 9 });
  assert.deepEqual(ieltsToClb({ l: 7, r: 7, w: 7, s: 7 }), { l: 7, r: 9, w: 9, s: 9 });
  assert.deepEqual(ieltsToClb({ l: 8.5, r: 8, w: 7.5, s: 7.5 }), { l: 10, r: 10, w: 10, s: 10 });
});

test('CRS matches the official calculator for typical profiles', () => {
  // Single, 30, bachelor, IELTS 7 in every band, 5 years of foreign work.
  assert.equal(crs({ age: 30, education: 'bachelor', clb: ieltsToClb({ l: 7, r: 7, w: 7, s: 7 }), foreignYears: 5 }).total, 373);
  // Single, 29, master, CLB 10, 5 years.
  assert.equal(crs({ age: 29, education: 'master', clb: { l: 10, r: 10, w: 10, s: 10 }, foreignYears: 5 }).total, 481);
  // French NCLC 7 with strong English adds 50 plus second-language points.
  const base = { age: 29, education: 'master', clb: { l: 10, r: 10, w: 10, s: 10 }, foreignYears: 5 };
  assert.equal(crs({ ...base, frenchNclc: 7, secondClb: { l: 7, r: 7, w: 7, s: 7 } }).total, 481 + 50 + 12);
  assert.equal(crs({ ...base, age: 45 }).parts.age, 0);
});

test('FSW 67-point grid needs CLB 7 in every ability', () => {
  assert.equal(fsw67({ age: 30, education: 'bachelor', clb: { l: 7, r: 9, w: 9, s: 9 }, foreignYears: 5 }).total, 68);
  assert.equal(fsw67({ age: 30, education: 'bachelor', clb: { l: 6, r: 9, w: 9, s: 9 }, foreignYears: 5 }).pass, false);
});

test('Opportunity Card points and Australian points test', () => {
  const ck = chancenkarte({ age: 30, years: 5, english: 'C1', education: 'bachelor', german: null });
  assert.equal(ck.points, 6);
  assert.ok(ck.eligibleByPoints && ck.viaRecognition);
  const au = australiaPoints({ age: 30, ieltsMin: 7, years: 7, assessmentDeduction: 2, education: 'bachelor', single: true });
  assert.equal(au.points, 75);
  assert.equal(australiaPoints({ age: 46, ieltsMin: 8 }).pass, false);
});

test('assessment rates routes per country and adds Iran-specific documents', () => {
  const profile = { roleFamily: 'software', seniority: 'senior', yearsExperience: 7, highestDegree: 'bachelor', languages: [{ name: 'English', level: 'C1' }], age: 31 };
  const r = assessImmigration(profile, ['DE', 'CA', 'NL', 'US'], { nationality: 'IR', ielts: { l: 8, r: 7, w: 7, s: 7 } }, 'en');
  assert.equal(r.applicant.age, 31);
  assert.ok(r.calculators.crs.total > 400);
  assert.ok(r.calculators.fsw.pass);
  assert.equal(r.pathways.find((p) => p.code === 'US').status, 'blocked');
  assert.equal(r.pathways.find((p) => p.route === 'EU Blue Card').status, 'strong');
  assert.ok(r.documents.some((d) => /military service/.test(d.detail)));
  assert.ok(r.advisors.some((a) => a.code === 'CA'));
  assert.equal(r.pathways.at(-1).status, 'blocked');
  const fa = assessImmigration(profile, ['CA'], { nationality: 'IR' }, 'fa');
  assert.ok(fa.applicant.estimated.includes('english-estimated'));
  assert.match(fa.pathways[0].why[0], /امتیاز CRS/);
});

test('applicant facts come from the form first, then the resume', () => {
  const a = resolveApplicant({ age: 40, languages: [], highestDegree: 'unknown' }, { age: '33', ielts: '7' });
  assert.equal(a.age, 33);
  assert.equal(a.ieltsSource, 'overall');
  assert.ok(a.estimated.includes('education-unknown'));
  assert.equal(detectAge('تاریخ تولد: ۱۳۷۰'.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))), new Date().getFullYear() - 1991);
});

test('job requirement parsing: years, level, field, remote scope, sanctions, hours', () => {
  assert.equal(requiredYears('You have 5+ years of experience with React and 2 years with AWS'), 5);
  assert.equal(requiredYears('Mindestens 3 Jahre Berufserfahrung'), 3);
  assert.equal(requiredYears('Founded 30 years ago'), 0);
  assert.equal(jobLevel('Senior Staff ML Engineer'), 4);
  assert.equal(jobLevel('Product Manager'), 2);
  assert.equal(jobFamily('Senior Data Scientist'), 'data');
  const job = (location, description = '') => makeJob({ source: 't', sourceName: 'T', title: 'Dev', url: 'https://x', location, description: `Remote. ${description}` });
  assert.equal(remoteScope(job('Worldwide')), 'worldwide');
  assert.equal(remoteScope(job('EMEA')), 'emea');
  assert.equal(remoteScope(job('Europe')), 'europe');
  assert.equal(remoteScope(job('Germany')), 'country');
  assert.ok(sanctionsExcluded('Due to OFAC sanctions we cannot hire in Cuba, Iran, North Korea or Syria.'));
  assert.ok(usHours('Must overlap 4 hours with PST time zone'));
});

test('scorer: title skill gaps, level gaps, remote eligibility from Iran, sanctions and diversity', () => {
  const profile = { roleFamily: 'software', seniority: 'mid', yearsExperience: 4, skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'], titles: ['Frontend Developer'], searchQueries: ['frontend developer', 'react developer'], languages: [{ name: 'English', level: 'C1' }] };
  const mk = (o) => makeJob({ source: 't', sourceName: 'T', url: `https://x/${Math.random()}`, company: 'Acme', ...o });
  const ctx = { residence: 'IR' };
  const react = scoreJob(mk({ title: 'React Developer', description: 'React TypeScript Node.js, 3+ years of experience', location: 'Berlin', hints: { visa: true } }), profile, ['DE'], ctx);
  const dotnet = scoreJob(mk({ title: '.NET Developer', description: 'React TypeScript C#', location: 'Berlin', hints: { visa: true } }), profile, ['DE'], ctx);
  assert.ok(dotnet.reasons.includes('title-skill-missing') && dotnet.score < react.score);
  assert.ok(react.reasons.includes('experience-fit'));
  const principal = scoreJob(mk({ title: 'Principal Frontend Engineer', description: 'React, 10+ years of experience', location: 'Berlin' }), profile, ['DE'], ctx);
  assert.ok(principal.reasons.includes('level-too-high') && principal.reasons.includes('needs-more-experience'));
  const ww = scoreJob(mk({ title: 'React Developer', description: 'Fully remote, React TypeScript', location: 'Worldwide' }), profile, ['DE'], ctx);
  const euOnly = scoreJob(mk({ title: 'React Developer', description: 'Fully remote, React TypeScript', location: 'Europe' }), profile, ['DE'], ctx);
  assert.ok(ww.openFromHome && !euOnly.openFromHome);
  const sanctioned = scoreJob(mk({ title: 'React Developer', description: 'Remote. React. We cannot hire in OFAC sanctioned countries such as Iran.', location: 'Worldwide' }), profile, ['DE'], ctx);
  assert.ok(sanctioned.reasons.includes('sanctions') && sanctioned.score < ww.score - 20);
  const field = scoreJob(mk({ title: 'Sales Manager', description: 'CRM', location: 'Berlin' }), profile, ['DE'], ctx);
  assert.ok(field.reasons.includes('other-field'));
  const list = diversify([{ company: 'A' }, { company: 'A' }, { company: 'A' }, { company: 'B' }]);
  assert.deepEqual(list.map((j) => j.company), ['A', 'A', 'B', 'A']);
  const d = dedupe([mk({ title: 'Senior React.js Full-stack Developer', company: 'Lemon.io' }), mk({ title: 'Senior React Full-stack Developer (Remote)', company: 'lemon.io' })]);
  assert.equal(d.length, 1);
});
