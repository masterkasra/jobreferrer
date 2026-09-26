// Jobs straight from the career pages of companies that hire internationally
// (visa sponsorship, relocation or fully remote). Their applicant-tracking
// systems (Greenhouse, Lever, Ashby) publish free public JSON feeds, so these
// ads are first-hand and current — no aggregator in between.

import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';
import { ROLE_FAMILIES, aliasRegex } from '../profile/taxonomy.js';

// remote: the company is remote-first (most roles can be done from many countries).
export const COMPANIES = [
  // Remote-first
  { name: 'GitLab', ats: 'greenhouse', token: 'gitlab', remote: true },
  { name: 'Canonical', ats: 'greenhouse', token: 'canonical', remote: true },
  { name: 'Grafana Labs', ats: 'greenhouse', token: 'grafanalabs', remote: true },
  { name: 'Vercel', ats: 'greenhouse', token: 'vercel', remote: true },
  { name: 'PostHog', ats: 'ashby', token: 'posthog', remote: true },
  { name: 'Supabase', ats: 'ashby', token: 'supabase', remote: true },
  { name: 'Linear', ats: 'ashby', token: 'linear', remote: true },
  { name: 'Zapier', ats: 'ashby', token: 'zapier', remote: true },
  { name: 'Deel', ats: 'ashby', token: 'deel', remote: true },
  // European tech employers known for international hiring and relocation
  { name: 'N26', ats: 'greenhouse', token: 'n26' },
  { name: 'GetYourGuide', ats: 'greenhouse', token: 'getyourguide' },
  { name: 'HelloFresh', ats: 'greenhouse', token: 'hellofresh' },
  { name: 'Contentful', ats: 'greenhouse', token: 'contentful' },
  { name: 'Celonis', ats: 'greenhouse', token: 'celonis' },
  { name: 'Babbel', ats: 'greenhouse', token: 'babbel' },
  { name: 'Adyen', ats: 'greenhouse', token: 'adyen' },
  { name: 'Monzo', ats: 'greenhouse', token: 'monzo' },
  { name: 'Wise', ats: 'greenhouse', token: 'transferwise' },
  { name: 'SumUp', ats: 'greenhouse', token: 'sumup' },
  { name: 'Miro', ats: 'greenhouse', token: 'realtimeboardglobal' },
  { name: 'Spotify', ats: 'lever', token: 'spotify' },
  // Global companies with large EU/UK/Canada offices
  { name: 'Stripe', ats: 'greenhouse', token: 'stripe' },
  { name: 'Cloudflare', ats: 'greenhouse', token: 'cloudflare' },
  { name: 'Datadog', ats: 'greenhouse', token: 'datadog' },
  { name: 'Elastic', ats: 'greenhouse', token: 'elastic', remote: true },
  { name: 'MongoDB', ats: 'greenhouse', token: 'mongodb' },
  { name: 'Palantir', ats: 'lever', token: 'palantir' },
];

const unescape = (s = '') => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

const FEEDS = {
  greenhouse: {
    url: (t) => `https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`,
    list: (d) => d.jobs ?? [],
    title: (j) => j.title,
    map: (j, c) => ({ title: j.title, location: j.location?.name ?? '', url: j.absolute_url, description: unescape(j.content), postedAt: j.updated_at, tags: (j.departments ?? []).map((d) => d.name) }),
  },
  lever: {
    url: (t) => `https://api.lever.co/v0/postings/${t}?mode=json`,
    list: (d) => (Array.isArray(d) ? d : []),
    title: (j) => j.text,
    map: (j) => ({
      title: j.text, location: [j.categories?.location, ...(j.categories?.allLocations ?? [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      url: j.hostedUrl, description: [j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text}\n${l.content}`), j.additionalPlain].filter(Boolean).join('\n'),
      postedAt: j.createdAt, tags: [j.categories?.team, j.categories?.commitment].filter(Boolean), remote: j.workplaceType === 'remote',
    }),
  },
  ashby: {
    url: (t) => `https://api.ashbyhq.com/posting-api/job-board/${t}?includeCompensation=true`,
    list: (d) => d.jobs ?? [],
    title: (j) => j.title,
    map: (j) => ({
      title: j.title, location: [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join(', '),
      url: j.jobUrl || j.applyUrl, description: j.descriptionHtml || j.descriptionPlain || '', postedAt: j.publishedAt,
      tags: [j.department, j.team, j.employmentType].filter(Boolean), remote: j.isRemote || j.workplaceType === 'Remote',
    }),
  },
};

/** Title filter: keep only roles in the candidate's field (company boards list every department). */
function titleFilter(profile, queries) {
  const words = new Set(queries.flatMap((q) => q.toLowerCase().split(/\s+/)).filter((w) => w.length > 2 && !['senior', 'junior', 'lead', 'the', 'and'].includes(w)));
  const res = [...(ROLE_FAMILIES[profile.roleFamily]?.keywords ?? []), ...words].map(aliasRegex);
  return (title) => res.some((r) => r.test(title.toLowerCase()));
}

async function fetchCompany(c, keep) {
  const feed = FEEDS[c.ats];
  const url = feed.url(c.token);
  const data = await cached(url, 6 * HOURS, () => getJson(url, { timeout: 20000, retries: 0 }));
  return feed.list(data).filter((j) => keep(feed.title(j) ?? '')).map((j) => {
    const m = feed.map(j, c);
    return makeJob({
      source: 'companies', sourceName: `${c.name} careers`, title: m.title, company: c.name, location: m.location,
      url: m.url, description: m.description, tags: m.tags, postedAt: m.postedAt,
      hints: { remote: m.remote || (c.remote && !/on-?site|hybrid|office/i.test(m.location)) },
    });
  });
}

export default {
  id: 'companies',
  name: 'Company career pages',
  kind: 'job',
  async search({ profile, queries }) {
    const keep = titleFilter(profile, queries);
    const results = await Promise.allSettled(COMPANIES.map((c) => fetchCompany(c, keep)));
    const jobs = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (process.env.JOBREFERRER_DEBUG) {
      results.forEach((r, i) => console.error(`companies/${COMPANIES[i].token}: ${r.status === 'fulfilled' ? r.value.length : r.reason.message}`));
    }
    if (!jobs.length && failed === COMPANIES.length) throw new Error('all company career feeds failed');
    return jobs;
  },
  relevanceFilter: true,
};
