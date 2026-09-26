// Germany's Federal Employment Agency job board (public API, shared key
// documented at https://jobsuche.api.bund.dev). Only runs when Germany is a target.
import { getJson } from './http.js';
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
      const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?was=${encodeURIComponent(q)}&angebotsart=1&size=50&page=1`;
      const data = await cached(url, 6 * HOURS, () => getJson(url, { headers: { 'X-API-Key': 'jobboerse-jobsuche' } }));
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
