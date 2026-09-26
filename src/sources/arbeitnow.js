// https://www.arbeitnow.com/api/job-board-api — free, no key. Germany/Europe
// focused and flags visa sponsorship explicitly on many listings.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

export default {
  id: 'arbeitnow',
  name: 'Arbeitnow',
  kind: 'job',
  relevanceFilter: true,
  async search() {
    const out = [];
    for (let page = 1; page <= 3; page++) {
      const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`;
      const data = await cached(url, 6 * HOURS, () => getJson(url));
      for (const j of data.data ?? []) {
        out.push(makeJob({
          source: 'arbeitnow', sourceName: 'Arbeitnow',
          title: j.title, company: j.company_name, location: j.location,
          url: j.url, description: j.description, tags: [...(j.tags ?? []), ...(j.job_types ?? [])],
          postedAt: j.created_at, hints: { remote: j.remote, visa: j.visa_sponsorship === true },
        }));
      }
      if (!data.links?.next) break;
    }
    return out;
  },
};
