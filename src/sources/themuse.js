// https://www.themuse.com/api/public/jobs — free, no key (500 req/hour).
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

const CATEGORY = {
  software: 'Software Engineering', data: 'Data and Analytics', devops: 'IT', security: 'IT', qa: 'Software Engineering',
  design: 'Design and UX', product: 'Product Management', marketing: 'Marketing', finance: 'Accounting',
  engineering: 'Science and Engineering', healthcare: 'Healthcare', education: 'Education', sales: 'Sales',
};
const CITY = {
  DE: 'Berlin, Germany', NL: 'Amsterdam, Netherlands', GB: 'London, United Kingdom', IE: 'Dublin, Ireland',
  CA: 'Toronto, Canada', US: 'New York, NY', AU: 'Sydney, Australia', SE: 'Stockholm, Sweden', SG: 'Singapore, Singapore',
  AE: 'Dubai, United Arab Emirates', ES: 'Madrid, Spain', PT: 'Lisbon, Portugal', PL: 'Warsaw, Poland', FR: 'Paris, France',
};

export default {
  id: 'themuse',
  name: 'The Muse',
  kind: 'job',
  async search({ profile, countries }) {
    const params = new URLSearchParams({ page: '0', descending: 'true', category: CATEGORY[profile.roleFamily] ?? 'Software Engineering' });
    for (const c of countries) if (CITY[c]) params.append('location', CITY[c]);
    params.append('location', 'Flexible / Remote');
    const url = `https://www.themuse.com/api/public/jobs?${params}`;
    const data = await cached(url, 6 * HOURS, () => getJson(url));
    return (data.results ?? []).map((j) => makeJob({
      source: 'themuse', sourceName: 'The Muse',
      title: j.name, company: j.company?.name, location: (j.locations ?? []).map((l) => l.name).join(' / '),
      url: j.refs?.landing_page, description: j.contents, tags: [...(j.levels ?? []), ...(j.categories ?? [])].map((x) => x.name),
      postedAt: j.publication_date,
    }));
  },
};
