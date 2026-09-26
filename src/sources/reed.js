// Reed.co.uk — free API key (https://www.reed.co.uk/developers). UK only.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';
import { config } from '../config.js';

export default {
  id: 'reed',
  name: 'Reed',
  kind: 'job',
  countries: ['GB'],
  requires: ['REED_API_KEY'],
  enabled: () => Boolean(config.reed.apiKey),
  async search({ queries }) {
    const url = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(`${queries[0]} visa sponsorship`)}&resultsToTake=50`;
    const auth = `Basic ${Buffer.from(`${config.reed.apiKey}:`).toString('base64')}`;
    const data = await cached(url, 6 * HOURS, () => getJson(url, { headers: { Authorization: auth } }));
    return (data.results ?? []).map((j) => makeJob({
      source: 'reed', sourceName: 'Reed',
      title: j.jobTitle, company: j.employerName, location: `${j.locationName}, United Kingdom`,
      url: j.jobUrl, description: j.jobDescription, postedAt: j.date?.split('/').reverse().join('-'),
      salary: j.minimumSalary ? { min: j.minimumSalary, max: j.maximumSalary || j.minimumSalary, currency: j.currency || 'GBP', period: 'year' } : null,
    }));
  },
};
