import { createHash } from 'node:crypto';
import { htmlToText } from '../resume/extract.js';
import { detectSignals, parseSalary } from './signals.js';
import { countriesIn, regionOf } from './geo.js';

/**
 * Build the common job shape every source returns.
 * @param {object} raw
 * @param {string} raw.source         adapter id, e.g. "remotive"
 * @param {string} raw.sourceName     display name, e.g. "Remotive"
 * @param {string} raw.title
 * @param {string} [raw.company]
 * @param {string} [raw.location]
 * @param {string} raw.url
 * @param {string} [raw.description]  HTML or text
 * @param {string[]} [raw.tags]
 * @param {object|null} [raw.salary]  { min, max, currency, period }
 * @param {string|number|Date} [raw.postedAt]
 * @param {'job'|'freelance'} [raw.kind]
 * @param {object} [raw.hints]        { visa, relocation, remote } flags provided by the source
 */
export function makeJob(raw) {
  const description = htmlToText(raw.description ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const location = (raw.location ?? '').toString().trim();
  const tags = (raw.tags ?? []).filter(Boolean).map(String);
  const haystack = `${raw.title}\n${location}\n${tags.join(', ')}\n${description}`;
  const countries = countriesIn(location || '');
  const signals = detectSignals(haystack, raw.hints);
  if (!countries.length && !signals.remote) countries.push(...countriesIn(description.slice(0, 400)).slice(0, 1));
  return {
    id: createHash('sha1').update(`${raw.source}|${raw.url}`).digest('hex').slice(0, 12),
    source: raw.source,
    sourceName: raw.sourceName,
    kind: raw.kind ?? 'job',
    title: clean(raw.title),
    company: clean(raw.company ?? ''),
    // Some remote boards list 70+ countries; keep the display short (countries[] keeps them all).
    location: shorten(location) || (signals.remote ? 'Remote' : ''),
    countries,
    region: regionOf(location),
    url: raw.url,
    description,
    tags,
    salary: raw.salary ?? parseSalary(haystack),
    postedAt: toIso(raw.postedAt),
    signals,
  };
}

const shorten = (loc) => (loc.length > 90 ? `${loc.slice(0, 87).replace(/[,\s]+[^,]*$/, '')}, …` : loc);

const clean = (s) => htmlToText(String(s)).replace(/\s+/g, ' ').trim();

function toIso(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// "Senior React.js Full-stack Developer" and "Senior React Full-Stack Developer (Remote)" are the same ad.
const titleKey = (t) => t.toLowerCase().replace(/\((remote|hybrid|on-?site|m\/w\/d|f\/m\/d|m\/f\/d|w\/m\/d|all genders?)\)/g, '').replace(/\.js\b/g, '').replace(/\W+/g, '');

/** Remove duplicates posted on several boards (same company + title). */
export function dedupe(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = `${job.company.toLowerCase().replace(/\W+/g, '')}|${titleKey(job.title)}`;
    const prev = seen.get(key);
    // Keep the richer record, but remember every board it was seen on.
    if (!prev) seen.set(key, { ...job, alsoOn: [] });
    else {
      prev.alsoOn.push({ source: job.sourceName, url: job.url });
      if (job.description.length > prev.description.length) Object.assign(prev, { ...job, alsoOn: prev.alsoOn });
    }
  }
  return [...seen.values()];
}
