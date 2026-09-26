// Rank jobs for someone who needs to relocate or work remotely from abroad:
// skills and title fit matter, but so do experience level, visa sponsorship,
// relocation help, language, where a remote hire may live, and sanctions.

import { findSkills, aliasRegex, SKILLS } from '../profile/taxonomy.js';
import { isEU } from '../jobs/geo.js';
import { requiredYears, jobLevel, CANDIDATE_LEVEL, jobFamily, adjacentFamily, remoteScope, usHours, sanctionsExcluded } from './requirements.js';
import { NATIONALITY_NOTES } from '../immigration/countries.js';

const LEVEL_OK = new Set(['native', 'C2', 'C1', 'B2']);
const STOP = new Set(['developer', 'engineer', 'senior', 'junior', 'lead', 'the', 'and', 'of', 'for', 'remote', 'specialist', 'manager']);
// Residents of these countries are normally inside "Europe-only" remote hiring.
const EUROPE_RESIDENT = (code) => isEU(code) || ['GB', 'CH', 'NO', 'IS', 'LI'].includes(code);
const SANCTIONED = new Set(['IR', 'CU', 'SY', 'KP']);
const TECHNICAL = new Set(['software', 'data', 'devops', 'security', 'qa', 'engineering']);

/**
 * @param {object} job
 * @param {object} profile
 * @param {string[]} countries  target countries
 * @param {{ residence?: string, nationality?: string }} [ctx]  where the candidate lives now and their passport (ISO codes)
 */
export function scoreJob(job, profile, countries = [], ctx = {}) {
  const residence = (ctx.residence ?? '').toUpperCase();
  const blocked = NATIONALITY_NOTES[(ctx.nationality ?? '').toUpperCase()]?.blockedCountries ?? {};
  const reasons = [];
  const text = `${job.title}\n${job.tags.join(', ')}\n${job.description}`;
  const jobSkills = findSkills(text);
  const mine = new Set(profile.skills);
  const core = new Set(profile.skills.slice(0, 8));
  const matched = jobSkills.filter((s) => mine.has(s));
  // Resume skills not in our taxonomy (from Claude) still count when they appear verbatim.
  for (const s of profile.skills) {
    if (!SKILLS[s] && !matched.includes(s) && s.length > 2 && aliasRegex(s.toLowerCase()).test(text.toLowerCase())) matched.push(s);
  }
  const missing = jobSkills.filter((s) => !mine.has(s)).slice(0, 8);
  const breakdown = {};

  // Skills (max 40): core resume skills count 1.5×.
  const weight = matched.reduce((sum, s) => sum + (core.has(s) ? 1.5 : 1), 0);
  breakdown.skills = Math.round(Math.min(1, weight / Math.min(6, Math.max(3, jobSkills.length || 3))) * 40);
  let score = breakdown.skills;

  // Title (max 25): exact phrase > word hits; penalise unrelated role families.
  const title = job.title.toLowerCase();
  const phrases = [...(profile.titles ?? []), ...(profile.searchQueries ?? [])].map((t) => t.toLowerCase().trim()).filter(Boolean);
  const split = (list) => new Set(list.flatMap((t) => t.toLowerCase().split(/[^a-z0-9+#.]+/)).filter((w) => w.length > 1 && !STOP.has(w)));
  // Words from the candidate's own titles count double compared with generated search queries.
  const own = split(profile.titles ?? []);
  const broad = [...split(phrases)].filter((w) => !own.has(w));
  const titleHits = [...own].filter((w) => aliasRegex(w).test(title)).length * 10 + broad.filter((w) => aliasRegex(w).test(title)).length * 5;
  // Only the candidate's own titles count as an exact match; generated search queries are broader.
  const exact = (profile.titles ?? []).some((p) => p.split(' ').length > 1 && aliasRegex(p.toLowerCase()).test(title));
  breakdown.title = exact ? 25 : Math.min(20, titleHits);
  if (breakdown.title) reasons.push('title');
  const fam = jobFamily(job.title);
  if (fam && profile.roleFamily && fam !== profile.roleFamily && !adjacentFamily(profile.roleFamily, fam)) {
    breakdown.title -= 20;
    reasons.push('other-field');
  }
  // A technology named in the title that the resume lacks (".NET Developer" for a React dev) is a hard requirement.
  const inTitle = findSkills(job.title).filter((x) => !['REST APIs', 'Microservices'].includes(x));
  if (inTitle.length && !inTitle.some((x) => mine.has(x))) {
    breakdown.title -= 12;
    reasons.push('title-skill-missing');
  }
  score += breakdown.title;

  // Experience and level.
  breakdown.experience = 0;
  const years = profile.yearsExperience || 0;
  const needYears = requiredYears(job.description);
  if (needYears && years) {
    if (needYears > years + 2) (breakdown.experience -= 12), reasons.push('needs-more-experience');
    else if (needYears > years) breakdown.experience -= 4;
    else (breakdown.experience += 4), reasons.push('experience-fit');
  }
  // People-management roles for an individual contributor in a technical field.
  if (/\b(manager|head of|director)\b/i.test(job.title) && TECHNICAL.has(profile.roleFamily) && profile.seniority !== 'lead' && !/\b(manager|head|director)\b/i.test((profile.titles ?? []).join(' '))) {
    breakdown.experience -= 10;
    reasons.push('management-role');
  }
  const gap = jobLevel(job.title) - (CANDIDATE_LEVEL[profile.seniority] ?? 2);
  if (gap >= 2) (breakdown.experience -= 12), reasons.push('level-too-high');
  else if (gap === 1) breakdown.experience -= 3;
  else if (gap <= -2) (breakdown.experience -= 6), reasons.push('overqualified');
  score += breakdown.experience;

  // Mobility: visa, relocation, target country, remote eligibility.
  const s = job.signals;
  const inTarget = job.countries.some((c) => countries.includes(c));
  const scope = remoteScope(job);
  const loc = job.location;
  const usOnly = /\b(us|usa|u\.s\.|united states)\b/i.test(loc) && !/europe|emea|worldwide|anywhere|global|canada/i.test(loc);
  const americas = /\b(north america|americas)\b/i.test(loc);
  const regionLocked = s.remote && ((usOnly && !countries.includes('US') && residence !== 'US')
    || (americas && !countries.includes('US') && !countries.includes('CA'))
    || (scope === 'region-other' && !americas));
  // Remote jobs a person can do from where they live today (no move needed).
  const openFromHome = Boolean(s.remote && !regionLocked && (scope === 'worldwide' || scope === 'unspecified'
    || (scope === 'emea' && residence !== 'US')
    || ((scope === 'europe' || scope === 'multi-country') && (!residence || EUROPE_RESIDENT(residence)))
    || (scope === 'country' && (!residence || job.countries.includes(residence)))));
  breakdown.mobility = 0;
  if (job.kind === 'freelance') {
    breakdown.mobility += 20;
    // Gigs restricted to US citizens (or similar) are not open to the candidate.
    if (s.noVisa) (breakdown.mobility -= 30), reasons.push('no-sponsorship');
  } else {
    if (s.visa) (breakdown.mobility += 15), reasons.push('visa');
    if (s.relocation) (breakdown.mobility += 10), reasons.push('relocation');
    if (inTarget) (breakdown.mobility += 8), reasons.push('target-country');
    if (openFromHome) (breakdown.mobility += scope === 'worldwide' ? 8 : 6), reasons.push('remote');
    // "No sponsorship" matters for moving; for a remote contract from home it matters less.
    if (s.noVisa) (breakdown.mobility -= openFromHome ? 8 : 25), reasons.push('no-sponsorship');
    if (regionLocked) (breakdown.mobility -= 12), reasons.push('region-locked');
    if (!inTarget && !s.remote && job.countries.length) breakdown.mobility -= 5;
    // EU jobs are reachable via the EU Blue Card even if the country is not a target.
    if (!inTarget && job.countries.some(isEU) && (s.visa || s.relocation)) breakdown.mobility += 4;
    if (s.remote && residence && !openFromHome && !inTarget && !regionLocked) (breakdown.mobility -= 6), reasons.push('remote-needs-residence');
  }
  if (openFromHome && residence && !['US', 'CA'].includes(residence) && usHours(job.description)) (breakdown.mobility -= 6), reasons.push('us-hours');
  if (SANCTIONED.has(residence) && sanctionsExcluded(text)) (breakdown.mobility -= 30), reasons.push('sanctions');
  // Jobs that require moving to a country closed to the candidate's passport.
  if (!openFromHome && job.countries.length && job.countries.every((c) => blocked[c])) (breakdown.mobility -= 40), reasons.push('entry-blocked');
  score += breakdown.mobility;

  const spoken = new Map((profile.languages ?? []).map((l) => [l.name, l.level]));
  const lackingLang = s.languages.filter((l) => !LEVEL_OK.has(spoken.get(l)));
  if (lackingLang.length) (score -= 10 * lackingLang.length), reasons.push('language');

  if (job.postedAt) {
    const days = (Date.now() - new Date(job.postedAt).getTime()) / 864e5;
    if (days <= 7) (score += 5), reasons.push('fresh');
    else if (days <= 30) score += 2;
    else if (days > 60) (score -= 5), reasons.push('old');
  }

  if (s.scamFlags.length) (score -= 40), reasons.push('scam-risk');

  return {
    ...job,
    score: Math.max(0, Math.min(100, Math.round(score))),
    matchedSkills: matched,
    missingSkills: missing,
    missingLanguages: lackingLang,
    requiredYears: needYears || null,
    remoteScope: scope || null,
    openFromHome,
    breakdown,
    reasons,
  };
}

export function rankJobs(jobs, profile, countries, { minScore = 30, residence = '', nationality = '' } = {}) {
  return jobs
    .map((j) => scoreJob(j, profile, countries, { residence, nationality }))
    .filter((j) => j.score >= minScore && !j.signals.scamFlags.length)
    .sort((a, b) => b.score - a.score || (b.postedAt ?? '').localeCompare(a.postedAt ?? ''));
}

/**
 * Keep the list varied: at most `perCompany` jobs from one employer near the top
 * (marketplaces like Lemon.io post dozens of near-identical ads). Extra ones move to the end.
 */
export function diversify(list, perCompany = 2) {
  const count = new Map();
  const head = [];
  const tail = [];
  for (const j of list) {
    const key = (j.company || '').toLowerCase().replace(/\W+/g, '');
    const n = count.get(key) ?? 0;
    count.set(key, n + 1);
    (key && n >= perCompany ? tail : head).push(j);
  }
  return [...head, ...tail];
}

/** Jobs that look like scams are reported separately so users can learn the patterns. */
export const flagged = (jobs) => jobs.filter((j) => j.signals.scamFlags.length);
