// The whole flow: resume → profile → search → rank → sponsor/salary checks →
// pitches → strategy → one report object that every output format renders.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildProfile } from './profile/index.js';
import { searchAll } from './sources/index.js';
import { searchLinks } from './sources/links.js';
import { makeJob, dedupe } from './jobs/normalize.js';
import { rankJobs, flagged, scoreJob, diversify } from './match/score.js';
import { countryFit, salaryCheck } from './immigration/advisor.js';
import { checkSponsors } from './immigration/sponsors.js';
import { assessImmigration } from './immigration/assess.js';
import { generatePitches, generateProposals } from './writer/index.js';
import { writeStrategy } from './llm/claude.js';
import { offlineStrategy } from './guidance/index.js';
import { config, hasClaude } from './config.js';

/**
 * @param {object} opts
 * @param {string} opts.text              resume text
 * @param {Buffer} [opts.pdf]             original PDF (Claude reads it directly)
 * @param {string[]} [opts.countries]     ISO codes, e.g. ['DE','NL']
 * @param {'fa'|'en'} [opts.lang]
 * @param {string} [opts.nationality]     ISO code, e.g. 'IR'
 * @param {string} [opts.residence]       where the candidate lives now (defaults to nationality)
 * @param {object} [opts.applicant]       extra facts for the immigration assessment (age, ielts, german, married…)
 * @param {boolean} [opts.useAI]
 * @param {number} [opts.top]             jobs in the report
 * @param {number} [opts.pitches]         jobs that get a tailored letter
 * @param {object[]} [opts.fixtureJobs]   raw jobs to use instead of live search (demo/tests)
 * @param {string} [opts.seenFile]        remembers jobs across runs to mark new ones
 * @param {boolean} [opts.sponsorCheck]
 * @param {object} [opts.overrides]       profile fields to force
 * @param {(msg: object) => void} [opts.onProgress]
 */
export async function run(opts) {
  const {
    text, pdf, lang = config.defaults.lang, nationality = '', top = config.defaults.topJobs,
    pitches = config.defaults.pitches, fixtureJobs, seenFile, sponsorCheck = true, overrides = {},
    only = [], skip = [], applicant = {}, onProgress = () => {},
  } = opts;
  const residence = (opts.residence || applicant.residence || nationality || '').toUpperCase();
  const countries = (opts.countries?.length ? opts.countries : config.defaults.countries).map((c) => c.toUpperCase());
  const useAI = opts.useAI ?? hasClaude();

  onProgress({ step: 'profile' });
  const profile = await buildProfile({ text, pdf, overrides, useAI });

  onProgress({ step: 'search', queries: profile.searchQueries });
  const { jobs: all, sources } = fixtureJobs
    ? { jobs: dedupe(fixtureJobs.map(makeJob)), sources: [{ id: 'demo', name: 'Demo data', count: fixtureJobs.length, status: 'ok' }] }
    : await searchAll({ profile, countries, only, skip, onProgress: (row) => onProgress({ step: 'source', ...row }) });

  const scams = flagged(all).map((j) => scoreJob(j, profile, countries, { residence, nationality })).slice(0, 5);
  const ranked = rankJobs(all, profile, countries, { residence, nationality });
  const employment = ranked.filter((j) => j.kind === 'job');
  // Two tracks: jobs to move for (sponsorship, relocation, target country) and remote jobs open from home.
  const movable = (j) => j.signals.visa || j.signals.relocation || j.countries.some((c) => countries.includes(c));
  const remoteOnly = (j) => j.openFromHome && !j.signals.visa && !j.signals.relocation;
  const jobs = diversify(employment.filter((j) => !remoteOnly(j) && movable(j))).slice(0, top);
  const remote = diversify(employment.filter(remoteOnly)).slice(0, Math.max(10, Math.round(top / 2)));
  const gigs = diversify(ranked.filter((j) => j.kind === 'freelance'), 3).slice(0, Math.max(5, Math.round(top / 3)));

  if (sponsorCheck && !fixtureJobs) {
    onProgress({ step: 'sponsors' });
    await checkSponsors(jobs);
  }
  for (const j of jobs) j.salaryCheck = salaryCheck(j);

  const seen = await loadSeen(seenFile);
  for (const j of [...jobs, ...remote, ...gigs]) j.isNew = seen ? !seen.has(j.id) : false;
  await saveSeen(seenFile, seen, [...jobs, ...remote, ...gigs]);

  const stats = {
    total: all.length,
    matched: ranked.length,
    visa: all.filter((j) => j.signals.visa).length,
    relocation: all.filter((j) => j.signals.relocation).length,
    remote: all.filter((j) => j.signals.remote).length,
    remoteOpen: ranked.filter((j) => j.kind === 'job' && j.openFromHome).length,
    freelance: all.filter((j) => j.kind === 'freelance').length,
    scams: flagged(all).length,
    newJobs: seen ? [...jobs, ...gigs].filter((j) => j.isNew).length : null,
  };

  const fit = countryFit(profile, countries, ranked, nationality, lang);

  const remotePitches = Math.min(remote.length, Math.max(3, Math.round(pitches / 2)));
  onProgress({ step: 'pitches', count: Math.min(pitches, jobs.length) + remotePitches });
  const pitchMap = await generatePitches(profile, [...jobs.slice(0, pitches), ...remote.slice(0, remotePitches)], { lang, useAI });
  for (const j of [...jobs, ...remote]) j.pitch = pitchMap.get(j.id) ?? null;
  const proposals = generateProposals(profile, gigs);
  for (const g of gigs) g.proposal = proposals.get(g.id);

  const immigration = assessImmigration(profile, countries, { ...applicant, nationality, residence }, lang);

  onProgress({ step: 'strategy' });
  const aiStrategy = useAI ? await writeStrategy({ profile, countryFit: fit, stats, immigration, lang }) : null;
  const strategy = aiStrategy ? { ...aiStrategy, source: 'claude' } : offlineStrategy(profile, fit, stats, { lang, nationality });
  if (aiStrategy) {
    // Hard facts (scam patterns, nationality restrictions) are always included.
    const offline = offlineStrategy(profile, fit, stats, { lang, nationality });
    strategy.warnings = [...new Set([...strategy.warnings, ...offline.warnings])];
  }

  onProgress({ step: 'done' });
  return {
    generatedAt: new Date().toISOString(),
    lang,
    nationality,
    residence,
    countries,
    ai: useAI,
    profile,
    sources,
    stats,
    jobs: jobs.map(stripDescription),
    remote: remote.map(stripDescription),
    freelance: gigs.map(stripDescription),
    scams: scams.map(stripDescription),
    countryFit: fit,
    immigration,
    strategy,
    links: searchLinks(profile, countries),
  };
}

// Keep reports small: a short excerpt is enough, the link has the full ad.
function stripDescription(j) {
  const { description, ...rest } = j;
  return { ...rest, excerpt: description.slice(0, 400) };
}

async function loadSeen(file) {
  if (!file) return null;
  try {
    return new Set(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return new Set();
  }
}

async function saveSeen(file, seen, jobs) {
  if (!file || !seen) return;
  const ids = [...new Set([...seen, ...jobs.map((j) => j.id)])].slice(-5000);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ids));
}
