// Cheap pre-filter for boards that return their whole feed instead of search
// results. The real ranking happens later in src/match/score.js.

import { aliasRegex, SKILLS } from '../profile/taxonomy.js';

const STOP = new Set(['developer', 'engineer', 'senior', 'junior', 'lead', 'manager', 'specialist', 'the', 'and', 'of', 'remote']);

export function makeRelevance(profile) {
  const words = new Set();
  for (const q of [...(profile.searchQueries ?? []), ...(profile.titles ?? [])]) {
    for (const w of q.toLowerCase().split(/[^a-z0-9+#.]+/)) if (w.length > 1 && !STOP.has(w)) words.add(w);
  }
  const titleRes = [...words].map(aliasRegex);
  const skillRes = (profile.skills ?? []).slice(0, 15).flatMap((s) => (SKILLS[s] ?? [s.toLowerCase()]).map(aliasRegex));
  return (job) => {
    const title = job.title.toLowerCase();
    if (titleRes.some((r) => r.test(title))) return true;
    const body = `${title} ${job.tags.join(' ')} ${job.description.slice(0, 1500)}`.toLowerCase();
    return skillRes.filter((r) => r.test(body)).length >= 2;
  };
}
