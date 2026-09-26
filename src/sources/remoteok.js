// https://remoteok.com/api — free, no key. Remote OK's terms require linking
// back to the original listing, which every report does.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

export default {
  id: 'remoteok',
  name: 'Remote OK',
  kind: 'job',
  relevanceFilter: true,
  async search() {
    const url = 'https://remoteok.com/api';
    const data = await cached(url, 6 * HOURS, () => getJson(url));
    return (Array.isArray(data) ? data : [])
      .filter((j) => j && j.position)
      .map((j) => makeJob({
        source: 'remoteok', sourceName: 'Remote OK',
        title: j.position, company: j.company, location: j.location || 'Remote',
        url: j.url || `https://remoteok.com/remote-jobs/${j.id}`, description: j.description, tags: j.tags,
        postedAt: j.date || j.epoch, hints: { remote: true },
        salary: j.salary_min ? { min: j.salary_min, max: j.salary_max || j.salary_min, currency: 'USD', period: 'year' } : null,
      }));
  },
};
