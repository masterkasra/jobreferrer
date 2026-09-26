// Jooble — free API key (https://jooble.org/api/about). Aggregates thousands
// of national job sites; we search per target country for sponsored roles.
import { request } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';
import { config } from '../config.js';
import { COUNTRY_NAMES } from '../jobs/geo.js';

export default {
  id: 'jooble',
  name: 'Jooble',
  kind: 'job',
  requires: ['JOOBLE_API_KEY'],
  enabled: () => Boolean(config.jooble.apiKey),
  async search({ queries, countries }) {
    const out = [];
    for (const code of countries.slice(0, 5)) {
      const body = JSON.stringify({ keywords: `${queries[0]} visa sponsorship`, location: COUNTRY_NAMES[code] ?? code, page: '1' });
      const data = await cached(`jooble|${body}`, 6 * HOURS, async () =>
        (await request(`https://jooble.org/api/${config.jooble.apiKey}`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })).json());
      for (const j of data.jobs ?? []) {
        out.push(makeJob({
          source: 'jooble', sourceName: 'Jooble',
          title: j.title, company: j.company, location: `${j.location}, ${COUNTRY_NAMES[code] ?? code}`,
          url: j.link, description: j.snippet, postedAt: j.updated, tags: [j.type, j.source],
        }));
      }
    }
    return out;
  },
};
