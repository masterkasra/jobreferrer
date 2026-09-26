// https://jobicy.com/api/v2/remote-jobs — free, no key.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

export default {
  id: 'jobicy',
  name: 'Jobicy',
  kind: 'job',
  async search({ queries }) {
    const out = [];
    for (const q of queries.slice(0, 2)) {
      const url = `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(q)}`;
      const data = await cached(url, 6 * HOURS, () => getJson(url));
      for (const j of data.jobs ?? []) {
        out.push(makeJob({
          source: 'jobicy', sourceName: 'Jobicy',
          kind: (j.jobType ?? []).some((t) => /contract|freelance/i.test(t)) ? 'freelance' : 'job',
          title: j.jobTitle, company: j.companyName, location: j.jobGeo,
          url: j.url, description: j.jobDescription || j.jobExcerpt, tags: [...(j.jobIndustry ?? []), ...(j.jobType ?? [])],
          postedAt: j.pubDate, hints: { remote: true },
          salary: j.annualSalaryMin ? { min: Number(j.annualSalaryMin), max: Number(j.annualSalaryMax || j.annualSalaryMin), currency: j.salaryCurrency || 'USD', period: 'year' } : null,
        }));
      }
    }
    return out;
  },
};
