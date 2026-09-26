// Freelancer.com public project search — no key needed for read-only search.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

export default {
  id: 'freelancer',
  name: 'Freelancer.com',
  kind: 'freelance',
  async search({ profile }) {
    const out = [];
    const terms = [...new Set([...(profile.skills ?? []).slice(0, 2), ...(profile.searchQueries ?? []).slice(0, 1)])];
    for (const q of terms) {
      const url = `https://www.freelancer.com/api/projects/0.1/projects/active/?query=${encodeURIComponent(q)}&limit=25&full_description=true&job_details=true&sort_field=time_updated`;
      const data = await cached(url, 3 * HOURS, () => getJson(url));
      for (const p of data.result?.projects ?? []) {
        const cur = p.currency?.code ?? 'USD';
        out.push(makeJob({
          source: 'freelancer', sourceName: 'Freelancer.com', kind: 'freelance',
          title: p.title, company: p.type === 'hourly' ? 'Hourly project' : 'Fixed-price project', location: 'Remote',
          url: `https://www.freelancer.com/projects/${p.seo_url}`, description: p.description || p.preview_description,
          tags: (p.jobs ?? []).map((j) => j.name), postedAt: p.time_submitted, hints: { remote: true },
          salary: p.budget?.minimum ? { min: p.budget.minimum, max: p.budget.maximum || p.budget.minimum, currency: cur, period: p.type === 'hourly' ? 'hour' : 'project' } : null,
        }));
      }
    }
    return out;
  },
};
