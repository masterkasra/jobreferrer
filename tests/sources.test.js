import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mockFetch } from './helpers.js';
import remotive from '../src/sources/remotive.js';
import arbeitnow from '../src/sources/arbeitnow.js';
import remoteok from '../src/sources/remoteok.js';
import jobicy from '../src/sources/jobicy.js';
import himalayas from '../src/sources/himalayas.js';
import themuse from '../src/sources/themuse.js';
import hackernews from '../src/sources/hackernews.js';
import workingnomads from '../src/sources/workingnomads.js';
import weworkremotely, { parseRss } from '../src/sources/weworkremotely.js';
import arbeitsagentur from '../src/sources/arbeitsagentur.js';
import freelancer from '../src/sources/freelancer.js';
import adzuna from '../src/sources/adzuna.js';
import companies from '../src/sources/companies.js';
import { searchAll } from '../src/sources/index.js';
import { searchLinks } from '../src/sources/links.js';
import { config } from '../src/config.js';

let mock;
afterEach(() => mock?.restore());
const profile = { roleFamily: 'software', skills: ['React', 'Node.js'], searchQueries: ['react developer'], titles: ['React Developer'] };
const ctx = { profile, queries: profile.searchQueries, countries: ['DE', 'GB'] };

test('remotive', async () => {
  mock = mockFetch([['remotive.com', { jobs: [{ id: 1, url: 'https://remotive.com/j/1', title: 'React Dev', company_name: 'Acme', tags: ['react'], job_type: 'full_time', publication_date: '2026-09-20T10:00:00', candidate_required_location: 'Europe', salary: '€60k - €70k', description: '<p>React</p>' }] }]]);
  const [j] = await remotive.search(ctx);
  assert.equal(j.company, 'Acme');
  assert.equal(j.kind, 'job');
  assert.equal(j.region, 'EU');
  assert.deepEqual(j.salary, { min: 60000, max: 70000, currency: 'EUR', period: 'year' });
});

test('arbeitnow flags visa sponsorship from the API field', async () => {
  mock = mockFetch([['arbeitnow.com', { data: [{ slug: 'x', company_name: 'Berlin Co', title: 'Node Engineer', description: 'Node.js', remote: false, url: 'https://arbeitnow.com/x', tags: [], job_types: [], location: 'Berlin', created_at: 1790000000, visa_sponsorship: true }], links: { next: null } }]]);
  const [j] = await arbeitnow.search(ctx);
  assert.equal(j.signals.visa, true);
  assert.deepEqual(j.countries, ['DE']);
});

test('remoteok skips the legal notice row', async () => {
  mock = mockFetch([['remoteok.com', [{ legal: 'notice' }, { id: 5, position: 'Frontend Dev', company: 'Rok', tags: ['react'], location: 'Worldwide', url: 'https://remoteok.com/remote-jobs/5', description: 'React', salary_min: 80000, salary_max: 100000, date: '2026-09-20' }]]]);
  const jobs = await remoteok.search(ctx);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].salary.min, 80000);
});

test('jobicy', async () => {
  mock = mockFetch([['jobicy.com', { jobs: [{ id: 1, url: 'https://jobicy.com/1', jobTitle: 'React Engineer', companyName: 'J', jobIndustry: ['Dev'], jobType: ['Contract'], jobGeo: 'EMEA', jobDescription: 'React', pubDate: '2026-09-21', annualSalaryMin: '50000', annualSalaryMax: '60000', salaryCurrency: 'EUR' }] }]]);
  const [j] = await jobicy.search(ctx);
  assert.equal(j.kind, 'freelance');
  assert.equal(j.salary.currency, 'EUR');
});

test('himalayas falls back to the feed when search fails', async () => {
  mock = mockFetch([['/jobs/api/search', { __status: 404 }], ['himalayas.app/jobs/api', { jobs: [{ title: 'React Dev', companyName: 'H', employmentType: 'Full Time', locationRestrictions: ['Germany'], description: 'React', pubDate: 1790000000, applicationLink: 'https://himalayas.app/j/1' }] }]]);
  const [j] = await himalayas.search(ctx);
  assert.deepEqual(j.countries, ['DE']);
});

test('the muse', async () => {
  mock = mockFetch([['themuse.com', { results: [{ id: 1, name: 'Software Engineer', contents: '<b>React</b>', publication_date: '2026-09-01', locations: [{ name: 'London, United Kingdom' }], levels: [{ name: 'Mid Level' }], categories: [{ name: 'Software Engineering' }], company: { name: 'Muse Co' }, refs: { landing_page: 'https://themuse.com/j/1' } }] }]]);
  const [j] = await themuse.search(ctx);
  assert.deepEqual(j.countries, ['GB']);
  assert.ok(mock.calls[0].url.includes('location=London'));
});

test('hacker news who is hiring parses the header line', async () => {
  mock = mockFetch([
    ['search_by_date', { hits: [{ objectID: '100', title: 'Ask HN: Who is hiring? (September 2026)' }] }],
    ['story_100', { hits: [{ objectID: '101', parent_id: 100, created_at: '2026-09-02', comment_text: 'Acme | Senior Backend Engineer | Berlin, Germany | ONSITE | VISA<p>We sponsor visas. Node.js' }] }],
  ]);
  const jobs = await hackernews.search(ctx);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].title, 'Senior Backend Engineer');
  assert.equal(jobs[0].url, 'https://news.ycombinator.com/item?id=101');
  assert.equal(jobs[0].signals.visa, true);
});

test('working nomads and we work remotely', async () => {
  mock = mockFetch([
    ['workingnomads.com', [{ url: 'https://wn/1', title: 'React Dev', description: 'React', company_name: 'WN', category_name: 'Development', tags: 'react,js', location: 'Anywhere', pub_date: '2026-09-20' }]],
    ['weworkremotely.com', '<rss><channel><item><title>Acme: Senior React Developer</title><link>https://wwr/1</link><pubDate>Mon, 21 Sep 2026 10:00:00 +0000</pubDate><region>Anywhere in the World</region><description><![CDATA[<p>React</p>]]></description></item></channel></rss>'],
  ]);
  assert.equal((await workingnomads.search(ctx))[0].tags.includes('react'), true);
  const [w] = await weworkremotely.search(ctx);
  assert.equal(w.company, 'Acme');
  assert.equal(w.title, 'Senior React Developer');
  assert.equal(parseRss('<item><title>x</title></item>').length, 1);
});

test('arbeitsagentur sends the public API key and falls back to older API versions', async () => {
  mock = mockFetch([['pc/v6/jobs', { __status: 403 }], ['arbeitsagentur.de', { stellenangebote: [{ titel: 'Softwareentwickler', beruf: 'Informatiker', refnr: '123-ABC', arbeitgeber: 'BA GmbH', arbeitsort: { ort: 'Hamburg', land: 'Deutschland' }, aktuelleVeroeffentlichungsdatum: '2026-09-20' }] }]]);
  const [j] = await arbeitsagentur.search(ctx);
  assert.equal(mock.calls[0].opts.headers['X-API-Key'], 'jobboerse-jobsuche');
  assert.ok(mock.calls[1].url.includes('pc/v4/app/jobs'));
  assert.equal(j.url, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/123-ABC');
  assert.deepEqual(j.countries, ['DE']);
});

test('arbeitsagentur v6 response shape (ergebnisliste)', async () => {
  mock = mockFetch([['pc/v6/jobs', { ergebnisliste: [{ stellenangebotsTitel: 'Softwareentwickler (m/w/d)', refnr: '10000-1', arbeitgeber: 'Hamburg IT GmbH', stellenlokationen: [{ adresse: { ort: 'Hamburg', region: 'HAMBURG', land: 'DEUTSCHLAND' } }], gehaltsspanneVon: 45000, gehaltsspanneBis: 60000, eintrittszeitraum: { von: '2026-09-25' } }] }]]);
  const [j] = await arbeitsagentur.search(ctx);
  assert.equal(j.title, 'Softwareentwickler (m/w/d)');
  assert.equal(j.company, 'Hamburg IT GmbH');
  assert.equal(j.location, 'Hamburg, Hamburg, Deutschland');
  assert.deepEqual(j.countries, ['DE']);
  assert.equal(j.url, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/10000-1');
  assert.deepEqual(j.salary, { min: 45000, max: 60000, currency: 'EUR', period: 'year' });
});

test('freelancer.com projects become freelance gigs', async () => {
  mock = mockFetch([['freelancer.com', { result: { projects: [{ id: 9, title: 'Build React app', seo_url: 'react/build-app', description: 'React + Node', type: 'fixed', budget: { minimum: 500, maximum: 1000 }, currency: { code: 'USD' }, time_submitted: 1790000000, jobs: [{ name: 'React.js' }] }] } }]]);
  const [g] = await freelancer.search(ctx);
  assert.equal(g.kind, 'freelance');
  assert.equal(g.url, 'https://www.freelancer.com/projects/react/build-app');
  assert.deepEqual(g.salary, { min: 500, max: 1000, currency: 'USD', period: 'project' });
});

test('adzuna needs keys and queries per target country', async () => {
  assert.equal(adzuna.enabled(), false);
  Object.assign(config.adzuna, { appId: 'id', appKey: 'key' });
  try {
    mock = mockFetch([['api.adzuna.com', { results: [{ title: 'React Developer', company: { display_name: 'AZ' }, location: { display_name: 'London' }, redirect_url: 'https://adzuna/1', description: 'visa sponsorship', created: '2026-09-20' }] }]]);
    const jobs = await adzuna.search(ctx);
    assert.equal(mock.calls.length, 2);
    assert.ok(mock.calls[0].url.includes('/jobs/de/') && mock.calls[1].url.includes('/jobs/gb/'));
    assert.equal(jobs[1].signals.visa, true);
  } finally {
    Object.assign(config.adzuna, { appId: '', appKey: '' });
  }
});

test('company career pages: greenhouse, lever and ashby feeds, filtered to the candidate field', async () => {
  mock = mockFetch([
    ['boards-api.greenhouse.io/v1/boards/n26/', { jobs: [
      { title: 'Senior React Developer', absolute_url: 'https://n26.com/j/1', location: { name: 'Berlin' }, updated_at: '2026-09-20T10:00:00Z', content: '&lt;p&gt;React, Node.js. We offer relocation support and visa sponsorship.&lt;/p&gt;', departments: [{ name: 'Engineering' }] },
      { title: 'Accountant', absolute_url: 'https://n26.com/j/2', location: { name: 'Berlin' }, content: 'Excel' },
    ] }],
    ['api.lever.co/v0/postings/spotify', [{ text: 'Backend Developer', hostedUrl: 'https://jobs.lever.co/spotify/1', categories: { location: 'Stockholm', team: 'Eng' }, descriptionPlain: 'Node.js services', lists: [{ text: 'You have', content: '5+ years of experience' }], createdAt: 1790000000000, workplaceType: 'onsite' }]],
    ['api.ashbyhq.com/posting-api/job-board/posthog', { jobs: [{ title: 'Product Engineer (React)', location: 'Remote', isRemote: true, descriptionHtml: '<p>React</p>', jobUrl: 'https://jobs.ashbyhq.com/posthog/1', publishedAt: '2026-09-21' }] }],
    ['greenhouse.io', { __status: 404 }],
    ['lever.co', { __status: 404 }],
    ['ashbyhq.com', { __status: 404 }],
  ]);
  const jobs = await companies.search(ctx);
  assert.deepEqual(jobs.map((j) => j.company).sort(), ['N26', 'PostHog', 'Spotify']);
  const n26 = jobs.find((j) => j.company === 'N26');
  assert.ok(n26.signals.visa && n26.signals.relocation && n26.description.startsWith('React'));
  assert.ok(jobs.find((j) => j.company === 'PostHog').signals.remote);
  assert.ok(jobs.find((j) => j.company === 'Spotify').description.includes('5+ years'));
});

test('searchAll isolates failing sources and reports status', async () => {
  mock = mockFetch([
    ['remotive.com', new Error('network down')],
    ['arbeitnow.com', { data: [{ title: 'React Developer', company_name: 'A', url: 'https://a/1', description: 'React Node.js', location: 'Berlin', tags: [], job_types: [] }], links: {} }],
  ]);
  const { jobs, sources } = await searchAll({ profile, countries: ['DE'], only: ['remotive', 'arbeitnow', 'adzuna', 'reed'] });
  assert.equal(jobs.length, 1);
  const status = Object.fromEntries(sources.map((s) => [s.id, s.status]));
  assert.equal(status.remotive, 'error');
  assert.equal(status.arbeitnow, 'ok');
  assert.equal(status.adzuna, 'needs-key');
  assert.equal(status.jobicy, 'skipped');
});

test('search links cover global, per-country and freelance boards', () => {
  const groups = searchLinks(profile, ['DE', 'AE']);
  assert.deepEqual(groups.map((g) => g.group), ['global', 'DE', 'AE', 'freelance']);
  const de = groups[1].links.map((l) => l.name);
  assert.ok(de.includes('StepStone'));
  assert.ok(groups[1].links.find((l) => l.name === 'Indeed DE').url.startsWith('https://de.indeed.com/jobs?q=react%20developer'));
  for (const g of groups) for (const l of g.links) assert.match(l.url, /^https:\/\//);
});
