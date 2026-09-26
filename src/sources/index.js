import remotive from './remotive.js';
import arbeitnow from './arbeitnow.js';
import remoteok from './remoteok.js';
import jobicy from './jobicy.js';
import himalayas from './himalayas.js';
import themuse from './themuse.js';
import hackernews from './hackernews.js';
import workingnomads from './workingnomads.js';
import weworkremotely from './weworkremotely.js';
import arbeitsagentur from './arbeitsagentur.js';
import freelancer from './freelancer.js';
import adzuna from './adzuna.js';
import jooble from './jooble.js';
import reed from './reed.js';
import { makeRelevance } from './filter.js';
import { dedupe } from '../jobs/normalize.js';

export const SOURCES = [
  arbeitnow, remotive, remoteok, jobicy, himalayas, themuse, hackernews, workingnomads,
  weworkremotely, arbeitsagentur, freelancer, adzuna, jooble, reed,
];

/**
 * Query every applicable source in parallel. A failing source never breaks the
 * run; its error is reported in `sources` instead.
 */
export async function searchAll({ profile, countries, only = [], skip = [], onProgress = () => {} }) {
  const queries = profile.searchQueries?.length ? profile.searchQueries : profile.titles;
  const relevant = makeRelevance(profile);
  const status = [];
  const tasks = SOURCES.map(async (src) => {
    const row = { id: src.id, name: src.name, count: 0, status: 'ok' };
    status.push(row);
    if ((only.length && !only.includes(src.id)) || skip.includes(src.id)) return (row.status = 'skipped'), [];
    if (src.enabled && !src.enabled()) return Object.assign(row, { status: 'needs-key', note: src.requires.join(', ') }), [];
    if (src.countries && !src.countries.some((c) => countries.includes(c))) return (row.status = 'not-targeted'), [];
    if (src.families && !src.families.includes(profile.roleFamily)) return (row.status = 'not-relevant'), [];
    const started = Date.now();
    try {
      let jobs = await src.search({ profile, queries, countries });
      if (src.relevanceFilter) jobs = jobs.filter(relevant);
      jobs = jobs.filter((j) => j.title && j.url);
      Object.assign(row, { count: jobs.length, ms: Date.now() - started });
      onProgress(row);
      return jobs;
    } catch (err) {
      Object.assign(row, { status: 'error', note: err.message, ms: Date.now() - started });
      onProgress(row);
      return [];
    }
  });
  const jobs = dedupe((await Promise.all(tasks)).flat());
  status.sort((a, b) => SOURCES.findIndex((s) => s.id === a.id) - SOURCES.findIndex((s) => s.id === b.id));
  return { jobs, sources: status };
}
