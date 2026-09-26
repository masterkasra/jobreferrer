// Live check of every free job source. Runs in CI (weekly and on demand) so a
// board that changes its API shows up as a failing row instead of silently
// returning nothing.
import { SOURCES } from '../src/sources/index.js';
import { setCacheEnabled } from '../src/sources/cache.js';

setCacheEnabled(false);
process.env.JOBREFERRER_DEBUG = '1';
const profile = { roleFamily: 'software', skills: ['JavaScript', 'React', 'Node.js', 'Python'], searchQueries: ['software engineer', 'softwareentwickler'], titles: ['Software Engineer'] };
const countries = ['DE', 'GB', 'NL'];

let failed = 0;
const rows = await Promise.all(SOURCES.map(async (src) => {
  if (src.enabled && !src.enabled()) return [src.id, 'skipped (needs key)', 0, ''];
  const started = Date.now();
  try {
    const jobs = await src.search({ profile, queries: profile.searchQueries, countries });
    const valid = jobs.filter((j) => j.title && /^https?:\/\//.test(j.url));
    if (!valid.length) failed++;
    return [src.id, valid.length ? 'ok' : 'EMPTY', valid.length, `${Date.now() - started}ms · e.g. ${valid[0]?.title ?? '-'} @ ${valid[0]?.company ?? '-'}`];
  } catch (err) {
    failed++;
    return [src.id, 'ERROR', 0, err.message];
  }
}));
for (const [id, status, n, note] of rows) console.log(`${id.padEnd(16)} ${status.padEnd(20)} ${String(n).padStart(4)}  ${note}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| source | status | jobs | note |\n|---|---|---|---|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`);
}
console.log(`\n${rows.length - failed}/${rows.length} sources healthy`);
process.exitCode = failed > 3 ? 1 : 0;
