// Germany's Federal Employment Agency job board (public API, shared key
// documented at https://jobsuche.api.bund.dev). Only runs when Germany is a target.
import { getJson, HttpError } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

export default {
  id: 'arbeitsagentur',
  name: 'Bundesagentur für Arbeit',
  kind: 'job',
  countries: ['DE'],
  async search({ queries }) {
    const out = [];
    for (const q of queries.slice(0, 2)) {
      const data = await cached(`arbeitsagentur|${q}`, 6 * HOURS, () => fetchJobs(q));
      for (const j of listOf(data) ?? []) out.push(toJob(j));
    }
    return out;
  },
};

// v4 answered { stellenangebote: [...] }; v6 answers { ergebnisliste: [...] }
// with renamed fields. Accept both.
export const listOf = (data) => data?.ergebnisliste ?? data?.stellenangebote ?? null;

const pick = (o, ...keys) => keys.map((k) => k.split('.').reduce((v, p) => v?.[p], o)).find((v) => v !== undefined && v !== null && v !== '');

export function toJob(j) {
  const loc = pick(j, 'stellenlokationen.0.adresse', 'stellenlokationen.0', 'arbeitsort', 'arbeitsorte.0') ?? {};
  // v6 sends region/country in capitals ("HESSEN", "DEUTSCHLAND").
  const nice = (v) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()) : v);
  const place = [loc.ort, nice(loc.region), nice(loc.land) || 'Deutschland'].filter(Boolean).join(', ');
  const refnr = pick(j, 'refnr', 'referenznummer', 'chiffrenummer', 'stellenangebotsId', 'id');
  const from = pick(j, 'gehaltsspanneVon');
  return makeJob({
    source: 'arbeitsagentur', sourceName: 'Bundesagentur für Arbeit',
    title: pick(j, 'stellenangebotsTitel', 'titel', 'beruf', 'hauptberuf') ?? '',
    company: pick(j, 'arbeitgeber', 'arbeitgeberName', 'firma', 'arbeitgeberdaten.name') ?? '',
    location: place,
    url: pick(j, 'externeUrl', 'allianzpartnerUrl') ?? (refnr ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(refnr)}` : ''),
    description: [pick(j, 'beruf', 'hauptberuf'), pick(j, 'stellenbeschreibung')].filter(Boolean).join('\n'),
    postedAt: pick(j, 'aktuelleVeroeffentlichungsdatum', 'datumErsteVeroeffentlichung', 'veroeffentlichungszeitraum.von', 'modifikationsTimestamp', 'eintrittszeitraum.von'),
    salary: from ? { min: from, max: pick(j, 'gehaltsspanneBis') ?? from, currency: 'EUR', period: 'year' } : null,
  });
}

// The agency retires API versions without notice: try the newest path first.
const PATHS = ['pc/v6/jobs', 'pc/v4/app/jobs', 'pc/v4/jobs'];

async function fetchJobs(q) {
  let lastError;
  let empty = null;
  for (const path of PATHS) {
    try {
      const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/${path}?was=${encodeURIComponent(q)}&angebotsart=1&size=50&page=1`;
      const data = await getJson(url, { retries: 0, headers: { 'X-API-Key': 'jobboerse-jobsuche' } });
      const list = listOf(data);
      if (process.env.JOBREFERRER_DEBUG && list?.[0]) console.warn(`[arbeitsagentur] ${path} item keys: ${Object.keys(list[0]).join(', ')}\n  location: ${JSON.stringify(list[0].stellenlokationen ?? list[0].arbeitsort ?? null).slice(0, 300)}`);
      if (!Array.isArray(list)) {
        // Newer versions may omit the key when there are no hits; remember and keep trying.
        empty ??= { ergebnisliste: [] };
        lastError = new Error(`${path}: no job list (keys: ${Object.keys(data ?? {}).join(', ') || 'none'})`);
        continue;
      }
      if (list.length) return data;
      empty = data;
    } catch (err) {
      if (!(err instanceof HttpError) || ![403, 404, 410].includes(err.status)) throw err;
      lastError = err;
    }
  }
  if (empty && process.env.JOBREFERRER_DEBUG) console.warn(`[arbeitsagentur] ${lastError?.message ?? 'empty result'}`);
  if (empty) return empty;
  throw lastError;
}
