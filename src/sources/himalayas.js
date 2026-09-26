// https://himalayas.app/jobs/api — free, no key. Tries the search endpoint and
// falls back to the latest-jobs feed filtered locally.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

function toJob(j) {
  const restrictions = (j.locationRestrictions ?? []).map((r) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
  return makeJob({
    source: 'himalayas', sourceName: 'Himalayas',
    kind: /contract|freelance/i.test(j.employmentType ?? '') ? 'freelance' : 'job',
    title: j.title, company: j.companyName, location: restrictions.length ? restrictions.join(', ') : 'Remote (worldwide)',
    url: j.applicationLink || j.guid, description: j.description || j.excerpt, tags: [...(j.categories ?? []), ...(j.seniority ?? [])],
    postedAt: j.pubDate, hints: { remote: true },
    salary: j.minSalary ? { min: j.minSalary, max: j.maxSalary || j.minSalary, currency: j.currency || 'USD', period: 'year' } : null,
  });
}

export default {
  id: 'himalayas',
  name: 'Himalayas',
  kind: 'both',
  async search({ queries }) {
    const out = [];
    try {
      for (const q of queries.slice(0, 2)) {
        const url = `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&limit=50`;
        const data = await cached(url, 6 * HOURS, () => getJson(url));
        out.push(...(data.jobs ?? []).map(toJob));
      }
      if (out.length) return out;
    } catch {
      // Search endpoint unavailable: use the feed below.
    }
    const url = 'https://himalayas.app/jobs/api?limit=100';
    const data = await cached(url, 6 * HOURS, () => getJson(url));
    return (data.jobs ?? []).map(toJob);
  },
  relevanceFilter: true,
};
