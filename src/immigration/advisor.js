import { COUNTRIES, NATIONALITY_NOTES } from './countries.js';

const LANG_OK = new Set(['native', 'C2', 'C1', 'B2']);
const LANG_SOME = new Set(['B1', 'A2']);

/**
 * Rank target countries for this profile. Returns an array sorted best-first:
 * { code, name, fa, score, reasons[], routes[], blocked? }
 */
export function countryFit(profile, countries, jobs = [], nationality = '', lang = 'en') {
  const spoken = new Map((profile.languages ?? []).map((l) => [l.name, l.level]));
  const english = spoken.get('English');
  const hasDegree = ['bachelor', 'master', 'phd'].includes(profile.highestDegree);
  const natNotes = NATIONALITY_NOTES[nationality?.toUpperCase()] ?? null;

  return countries
    .filter((code) => COUNTRIES[code])
    .map((code) => {
      const c = COUNTRIES[code];
      let score = 40;
      const reasons = [];
      if (c.shortage.includes(profile.roleFamily)) (score += 20), reasons.push('shortage-occupation');

      const local = c.mainLanguage.split('/')[0];
      const localLevel = spoken.get(local);
      if (c.englishOk === 'native') {
        if (LANG_OK.has(english)) (score += 10), reasons.push('english-ok');
        else if (english === 'unknown' || !english) reasons.push('prove-english');
        else (score -= 10), reasons.push('english-weak');
      } else if (LANG_OK.has(localLevel)) {
        (score += 12), reasons.push('speaks-local-language');
      } else if (c.englishOk === 'wide' || (c.englishOk === 'tech' && ['software', 'data', 'devops', 'security', 'qa'].includes(profile.roleFamily))) {
        (score += 6), reasons.push('english-workplace');
      } else {
        (score -= LANG_SOME.has(localLevel) ? 5 : 15), reasons.push('needs-local-language');
      }

      const routes = c.routes.filter((r) => (!r.needsDegree || hasDegree) && (!r.families || r.families.includes(profile.roleFamily)));
      if (hasDegree) score += 5;
      else if (c.routes.every((r) => r.needsDegree)) (score -= 10), reasons.push('degree-needed');

      if (['senior', 'lead'].includes(profile.seniority)) (score += 8), reasons.push('salary-threshold-likely');
      else if (profile.seniority === 'junior') (score -= 5), reasons.push('salary-threshold-risk');

      const local_jobs = jobs.filter((j) => j.countries.includes(code));
      const sponsored = local_jobs.filter((j) => j.signals.visa || j.signals.relocation).length;
      score += Math.min(15, local_jobs.length + sponsored * 2);
      if (sponsored) reasons.push(`sponsored-jobs:${sponsored}`);

      const blocked = (lang === 'fa' ? natNotes?.blockedCountriesFa?.[code] : null) ?? natNotes?.blockedCountries?.[code] ?? null;
      if (blocked) (score -= 60), reasons.push('nationality-restriction');

      return { code, name: c.name, fa: c.fa, score: Math.max(0, Math.min(100, score)), reasons, routes, blocked, official: c.official, recognition: c.recognition, cv: c.cv, notes: c.notes, jobCount: local_jobs.length, sponsoredCount: sponsored };
    })
    .sort((a, b) => b.score - a.score);
}

const toYear = ({ amount, period }) => (period === 'month' ? amount * 12 : amount);

/**
 * Compare a job's advertised salary with the main visa threshold of its country.
 * Returns null when it cannot be compared (no salary, other currency, no threshold).
 */
export function salaryCheck(job) {
  if (!job.salary?.min || job.salary.period === 'hour' || job.salary.period === 'project') return null;
  for (const code of job.countries) {
    const route = COUNTRIES[code]?.routes.find((r) => r.threshold);
    if (!route) continue;
    const cur = job.salary.currency || route.threshold.currency;
    if (cur !== route.threshold.currency) continue;
    const offered = job.salary.max || job.salary.min;
    const full = toYear(route.threshold);
    const reduced = route.reduced ? toYear(route.reduced) : null;
    const status = offered >= full ? 'meets' : reduced && offered >= reduced ? 'meets-reduced' : 'below';
    return { country: code, route: route.name, offered, threshold: full, reduced, currency: cur, status };
  }
  return null;
}

export function nationalityNotes(nationality = '', lang = 'en') {
  const n = NATIONALITY_NOTES[nationality.toUpperCase()];
  return (lang === 'fa' ? n?.generalFa : null) ?? n?.general ?? [];
}
