// Rank jobs for someone who needs to relocate: skills and title fit matter,
// but so do visa sponsorship, relocation help, language and location.

import { findSkills, aliasRegex, SKILLS } from '../profile/taxonomy.js';
import { isEU } from '../jobs/geo.js';

const LEVEL_OK = new Set(['native', 'C2', 'C1', 'B2']);
const STOP = new Set(['developer', 'engineer', 'senior', 'junior', 'lead', 'the', 'and', 'of', 'for', 'remote']);

export function scoreJob(job, profile, countries = []) {
  const reasons = [];
  const text = `${job.title}\n${job.tags.join(', ')}\n${job.description}`;
  const jobSkills = findSkills(text);
  const mine = new Set(profile.skills);
  const matched = jobSkills.filter((s) => mine.has(s));
  // Resume skills not in our taxonomy (from Claude) still count when they appear verbatim.
  for (const s of profile.skills) {
    if (!SKILLS[s] && !matched.includes(s) && s.length > 2 && aliasRegex(s.toLowerCase()).test(text.toLowerCase())) matched.push(s);
  }
  const missing = jobSkills.filter((s) => !mine.has(s)).slice(0, 8);

  let score = 0;
  const skillPart = Math.min(1, matched.length / Math.min(6, Math.max(3, jobSkills.length || 3)));
  score += skillPart * 40;

  const title = job.title.toLowerCase();
  const words = new Set([...(profile.titles ?? []), ...(profile.searchQueries ?? [])].flatMap((t) => t.toLowerCase().split(/[^a-z0-9+#.]+/)).filter((w) => w.length > 1 && !STOP.has(w)));
  const titleHits = [...words].filter((w) => aliasRegex(w).test(title)).length;
  score += Math.min(20, titleHits * 10);
  if (titleHits) reasons.push('title');

  const s = job.signals;
  const inTarget = job.countries.some((c) => countries.includes(c));
  const loc = job.location;
  const usOnly = /\b(us|usa|u\.s\.|united states)\b/i.test(loc) && !/europe|emea|worldwide|anywhere|global|canada/i.test(loc);
  const americasOnly = /\b(north america|americas)\b/i.test(loc);
  const remoteRestricted = s.remote && ((usOnly && !countries.includes('US')) || (americasOnly && !countries.includes('US') && !countries.includes('CA')));

  if (job.kind === 'freelance') {
    score += 20;
  } else {
    if (s.visa) (score += 15), reasons.push('visa');
    if (s.relocation) (score += 10), reasons.push('relocation');
    if (inTarget) (score += 8), reasons.push('target-country');
    if (s.remote && !remoteRestricted && (job.region === 'WW' || job.region === 'EU' || /remote/i.test(job.location))) (score += 6), reasons.push('remote');
    if (s.noVisa) (score -= 25), reasons.push('no-sponsorship');
    if (remoteRestricted) (score -= 12), reasons.push('region-locked');
    if (!inTarget && !s.remote && job.countries.length) score -= 5;
    // EU jobs are reachable via the EU Blue Card even if the country is not a target.
    if (!inTarget && job.countries.some(isEU) && (s.visa || s.relocation)) score += 4;
  }

  const spoken = new Map((profile.languages ?? []).map((l) => [l.name, l.level]));
  const lackingLang = s.languages.filter((l) => !LEVEL_OK.has(spoken.get(l)));
  if (lackingLang.length) (score -= 10 * lackingLang.length), reasons.push('language');

  const senior = /\b(senior|sr\.?|lead|principal|staff|head)\b/i.test(job.title);
  const junior = /\b(junior|jr\.?|intern|graduate|trainee|entry)\b/i.test(job.title);
  if (senior && profile.seniority === 'junior') score -= 8;
  if (junior && ['senior', 'lead'].includes(profile.seniority)) score -= 4;

  if (job.postedAt) {
    const days = (Date.now() - new Date(job.postedAt).getTime()) / 864e5;
    if (days <= 7) score += 5;
    else if (days <= 30) score += 2;
    else if (days > 60) score -= 5;
  }

  if (s.scamFlags.length) (score -= 40), reasons.push('scam-risk');

  return {
    ...job,
    score: Math.max(0, Math.min(100, Math.round(score))),
    matchedSkills: matched,
    missingSkills: missing,
    missingLanguages: lackingLang,
    reasons,
  };
}

export function rankJobs(jobs, profile, countries, { minScore = 30 } = {}) {
  return jobs
    .map((j) => scoreJob(j, profile, countries))
    .filter((j) => j.score >= minScore && !j.signals.scamFlags.length)
    .sort((a, b) => b.score - a.score || (b.postedAt ?? '').localeCompare(a.postedAt ?? ''));
}

/** Jobs that look like scams are reported separately so users can learn the patterns. */
export const flagged = (jobs) => jobs.filter((j) => j.signals.scamFlags.length);
