// https://remotive.com/api/remote-jobs — free, no key. Remotive asks clients
// to keep request volume low, so results are cached for 6 hours.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';
import { parseSalary } from '../jobs/signals.js';

export default {
  id: 'remotive',
  name: 'Remotive',
  kind: 'both',
  async search({ queries }) {
    const out = [];
    for (const q of queries.slice(0, 3)) {
      const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`;
      const data = await cached(url, 6 * HOURS, () => getJson(url));
      for (const j of data.jobs ?? []) {
        out.push(makeJob({
          source: 'remotive', sourceName: 'Remotive',
          kind: /freelance|contract/i.test(j.job_type ?? '') ? 'freelance' : 'job',
          title: j.title, company: j.company_name, location: j.candidate_required_location,
          url: j.url, description: j.description, tags: [...(j.tags ?? []), j.category],
          postedAt: j.publication_date, hints: { remote: true },
          salary: j.salary ? parseSalary(j.salary) : null,
        }));
      }
    }
    return out;
  },
};
