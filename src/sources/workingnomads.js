// https://www.workingnomads.com/api/exposed_jobs/ — free, no key.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

export default {
  id: 'workingnomads',
  name: 'Working Nomads',
  kind: 'job',
  relevanceFilter: true,
  async search() {
    const url = 'https://www.workingnomads.com/api/exposed_jobs/';
    const data = await cached(url, 6 * HOURS, () => getJson(url));
    return (Array.isArray(data) ? data : []).map((j) => makeJob({
      source: 'workingnomads', sourceName: 'Working Nomads',
      title: j.title, company: j.company_name, location: j.location || 'Remote',
      url: j.url, description: j.description, tags: [j.category_name, ...String(j.tags ?? '').split(',')],
      postedAt: j.pub_date, hints: { remote: true },
    }));
  },
};
