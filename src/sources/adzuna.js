// Adzuna — free API key (https://developer.adzuna.com). Covers national job
// boards in 19 countries; we ask for ads mentioning visa/sponsorship/relocation.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';
import { config } from '../config.js';

const SUPPORTED = ['gb', 'de', 'nl', 'ca', 'au', 'at', 'fr', 'it', 'es', 'pl', 'nz', 'sg', 'us', 'ch', 'be', 'in', 'br', 'za', 'mx'];

export default {
  id: 'adzuna',
  name: 'Adzuna',
  kind: 'job',
  requires: ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'],
  enabled: () => Boolean(config.adzuna.appId && config.adzuna.appKey),
  async search({ queries, countries }) {
    const out = [];
    const targets = countries.map((c) => c.toLowerCase()).filter((c) => SUPPORTED.includes(c)).slice(0, 6);
    for (const country of targets) {
      const params = new URLSearchParams({
        app_id: config.adzuna.appId, app_key: config.adzuna.appKey, results_per_page: '40',
        what: queries[0], what_or: 'visa sponsorship sponsor relocation', 'content-type': 'application/json',
      });
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
      const data = await cached(url, 6 * HOURS, () => getJson(url));
      for (const j of data.results ?? []) {
        out.push(makeJob({
          source: 'adzuna', sourceName: 'Adzuna',
          title: j.title, company: j.company?.display_name, location: `${j.location?.display_name ?? ''}, ${country.toUpperCase()}`,
          url: j.redirect_url, description: j.description, postedAt: j.created,
          salary: j.salary_min ? { min: Math.round(j.salary_min), max: Math.round(j.salary_max || j.salary_min), currency: '', period: 'year' } : null,
        }));
      }
    }
    return out;
  },
};
