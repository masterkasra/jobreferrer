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
      for (const j of data.stellenangebote ?? []) {
        const place = [j.arbeitsort?.ort, j.arbeitsort?.region, j.arbeitsort?.land || 'Deutschland'].filter(Boolean).join(', ');
        out.push(makeJob({
          source: 'arbeitsagentur', sourceName: 'Bundesagentur für Arbeit',
          title: j.titel || j.beruf, company: j.arbeitgeber, location: place,
          url: j.externeUrl || `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(j.refnr)}`,
          description: `${j.beruf ?? ''}`, postedAt: j.aktuelleVeroeffentlichungsdatum,
        }));
      }
    }
    return out;
  },
};

// The agency retires API versions without notice: try the newest path first.
const PATHS = ['pc/v6/jobs', 'pc/v4/app/jobs', 'pc/v4/jobs'];

async function fetchJobs(q) {
  let lastError;
  let empty = null;
  for (const path of PATHS) {
    try {
      const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/${path}?was=${encodeURIComponent(q)}&angebotsart=1&size=50&page=1`;
      const data = await getJson(url, { retries: 0, headers: { 'X-API-Key': 'jobboerse-jobsuche' } });
      if (!Array.isArray(data?.stellenangebote)) {
        // Newer versions may omit the key when there are no hits; remember and keep trying.
        empty ??= { stellenangebote: [] };
        lastError = new Error(`${path}: no stellenangebote (keys: ${Object.keys(data ?? {}).join(', ') || 'none'})`);
        continue;
      }
      if (data.stellenangebote.length) return data;
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
