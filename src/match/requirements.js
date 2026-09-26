// Read what a job ad actually requires: years of experience, level, where a
// remote hire may live, working hours, and sanctions exclusions. The scorer
// uses these to avoid recommending jobs the candidate cannot really get.

import { ROLE_FAMILIES, aliasRegex } from '../profile/taxonomy.js';

/** Minimum years of experience asked for, or 0 when the ad does not say. */
export function requiredYears(text = '') {
  const t = text.replace(/\s+/g, ' ');
  const found = [];
  const patterns = [
    /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(?:\d{1,2}\s*)?\+?\s*years?(?:'|’)?\s*(?:of\s+)?(?:\w+\s+){0,3}?(?:experience|exp\b)/gi,
    /(?:at least|minimum(?: of)?|min\.?|over|more than)\s*(\d{1,2})\s*\+?\s*years?/gi,
    /(\d{1,2})\s*\+?\s*(?:jahre|jahren)\s*(?:\w+\s+){0,2}?(?:berufserfahrung|erfahrung)/gi,
    /(\d{1,2})\s*\+?\s*(?:jaar|jaren)\s*(?:\w+\s+){0,2}?ervaring/gi,
  ];
  for (const re of patterns) for (const m of t.matchAll(re)) found.push(Number(m[1]));
  const valid = found.filter((n) => n >= 1 && n <= 15);
  // Ads often list "2+ years of X" for secondary skills; the headline requirement is the largest
  // stated number, but cap at the second-largest when one number is an outlier (e.g. "10 years of company history").
  if (!valid.length) return 0;
  valid.sort((a, b) => b - a);
  return valid.length > 1 && valid[0] - valid[1] > 5 ? valid[1] : valid[0];
}

const LEVELS = [
  [5, /\b(head of|director|vp|vice president|chief)\b/i],
  [4, /\b(staff|principal|lead|architect|(engineering|development|team) manager)\b/i],
  [3, /\b(senior|sr\.?|expert|iii)\b/i],
  [1, /\b(junior|jr\.?|intern|internship|graduate|trainee|entry[- ]level|werkstudent|praktikum|apprentice)\b/i],
];

/** Seniority level implied by a job title: 1 junior … 5 director; 2 when unspecified. */
export function jobLevel(title = '') {
  for (const [level, re] of LEVELS) if (re.test(title)) return level;
  return 2;
}

export const CANDIDATE_LEVEL = { junior: 1, mid: 2, senior: 3, lead: 4 };

/** Role family of a job title (software, data, …) or '' when unclear. */
export function jobFamily(title = '') {
  const t = title.toLowerCase();
  let best = '';
  let bestLen = 0;
  for (const [key, fam] of Object.entries(ROLE_FAMILIES)) {
    for (const kw of fam.keywords) {
      if (kw.length > bestLen && aliasRegex(kw).test(t)) [best, bestLen] = [key, kw.length];
    }
  }
  return best;
}

// Families that share enough work that a move between them is realistic.
const ADJACENT = {
  software: ['devops', 'qa', 'data', 'design'],
  data: ['software', 'devops'],
  devops: ['software', 'security'],
  security: ['devops'],
  qa: ['software'],
  design: ['software', 'marketing', 'product'],
  product: ['design', 'software', 'marketing'],
  marketing: ['sales', 'product', 'design'],
  sales: ['marketing'],
};
export const adjacentFamily = (a, b) => (ADJACENT[a] ?? []).includes(b);

const WORLDWIDE = /worldwide|anywhere|global|any location|all countries|work from anywhere/i;
const EMEA = /\b(emea|mena|middle east)\b/i;
const EUROPE = /\b(europe|european|eu|eea|cet|cest|european time ?zones?)\b/i;

/**
 * Where a remote hire may live:
 *  'worldwide' | 'emea' | 'europe' | 'country' (remote inside one country) | 'region-other' | '' (not remote)
 */
export function remoteScope(job) {
  if (!job.signals?.remote) return '';
  const loc = job.location ?? '';
  if (WORLDWIDE.test(loc) || job.region === 'WW') return 'worldwide';
  if (EMEA.test(loc)) return 'emea';
  if (/\b(latam|latin america|south america|apac|asia[- ]pacific|north america|americas)\b/i.test(loc)) return 'region-other';
  if (EUROPE.test(loc) || job.region === 'EU') return 'europe';
  if (job.countries.length === 1) return 'country';
  if (job.countries.length > 1) return 'multi-country';
  // A bare "Remote" with no location: check the ad text for hints.
  const text = (job.description ?? '').slice(0, 3000);
  if (WORLDWIDE.test(text)) return 'worldwide';
  return 'unspecified';
}

/** True when the ad wants overlap with US working hours. */
export const usHours = (text = '') => /\b(pst|est|cst|mst|pt|et)\b.{0,20}(hours|time ?zone|overlap)|(us|u\.s\.|north american?|pacific|eastern|central) (business )?(time ?zones?|hours)|overlap with (the )?(us|pst|est|pacific|eastern)/i.test(text);

/** True when the ad says it cannot hire people in sanctioned countries (e.g. Iran). */
export const sanctionsExcluded = (text = '') => /(ofac|sanction(ed|s)|embargo(ed)?)[^.]{0,120}(countr|iran|cuba|syria|north korea)|(iran|cuba|syria|north korea)[^.]{0,80}(not eligible|cannot|can't|unable|excluded|sanction)/i.test(text);
