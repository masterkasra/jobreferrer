// Live end-to-end check against the real job boards (runs in CI):
// every resume format → profile → live search → ranked jobs with employers and links.
// Also exercises the web UI with a real upload. Reports are written to e2e-reports/.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadResume } from '../src/resume/load.js';
import { run } from '../src/pipeline.js';
import { toHtml } from '../src/report/html.js';
import { server } from '../src/web/server.js';

const dir = new URL('../tests/fixtures/resumes/', import.meta.url);
const out = new URL('../e2e-reports/', import.meta.url);
mkdirSync(out, { recursive: true });

const CASES = [
  ['en-resume.pdf', 'fa'], ['en-resume.docx', 'fa'], ['en-resume.odt', 'en'], ['en-resume.rtf', 'en'], ['en-resume.txt', 'en'],
  ['fa-resume.pdf', 'fa'], ['fa-resume.docx', 'fa'],
];
const countries = ['DE', 'NL', 'GB', 'IE', 'SE', 'CA', 'AE'];
const failures = [];
const summary = ['| resume | profile | jobs scanned | ranked | visa | top jobs | freelance |', '|---|---|---|---|---|---|---|'];

for (const [name, lang] of CASES) {
  const started = Date.now();
  try {
    const resume = await loadResume(readFileSync(new URL(name, dir)), name, { useAI: false });
    const r = await run({ text: resume.text, countries, lang, nationality: 'IR', useAI: false });
    const jobs = r.jobs.filter((j) => j.company && /^https?:\/\//.test(j.url));
    console.log(`\n=== ${name} → ${r.profile.headline} (${r.profile.roleFamily}, ${r.profile.yearsExperience}y) · queries: ${r.profile.searchQueries.join(' | ')} · ${Date.now() - started}ms`);
    console.log(`scanned ${r.stats.total} · ranked ${r.stats.matched} · visa ${r.stats.visa} · relocation ${r.stats.relocation} · freelance ${r.freelance.length} · scams ${r.stats.scams}`);
    for (const j of jobs.slice(0, 8)) console.log(`  [${j.score}] ${j.title} — ${j.company} (${j.location}) ${j.signals.visa ? '[visa]' : ''}${j.signals.relocation ? '[relocation]' : ''}${j.sponsor ? (j.sponsor.listed ? '[sponsor ✓]' : '[sponsor ?]') : ''}\n       ${j.url}`);
    for (const g of r.freelance.slice(0, 3)) console.log(`  freelance: ${g.title} — ${g.url}`);
    console.log(`  sources: ${r.sources.map((s) => `${s.id}=${s.status === 'ok' ? s.count : s.status}`).join(' ')}`);
    writeFileSync(new URL(`${name.replace(/\W/g, '_')}.html`, out), toHtml(r));
    if (jobs.length < 5) failures.push(`${name}: only ${jobs.length} ranked jobs with employer + link`);
    if (!jobs.every((j) => j.pitch?.coverLetter)) failures.push(`${name}: missing cover letters`);
    summary.push(`| ${name} | ${r.profile.headline} | ${r.stats.total} | ${r.stats.matched} | ${r.stats.visa} | ${jobs.slice(0, 3).map((j) => `${j.title} @ ${j.company}`).join('<br>')} | ${r.freelance.length} |`);
  } catch (err) {
    failures.push(`${name}: ${err.stack}`);
  }
}

// Web UI: real HTTP upload of a PDF.
await new Promise((r) => server.listen(0, '127.0.0.1', r));
try {
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/run?countries=DE,NL,GB&lang=fa&nationality=IR`, {
    method: 'POST', headers: { 'X-Filename': 'cv.pdf' }, body: readFileSync(new URL('en-resume.pdf', dir)),
  });
  const html = await res.text();
  const cards = (html.match(/class="card job"/g) ?? []).length;
  console.log(`\n=== web UI upload: HTTP ${res.status}, ${cards} job cards`);
  if (res.status !== 200 || cards < 5) failures.push(`web UI: HTTP ${res.status}, ${cards} job cards`);
  writeFileSync(new URL('web-upload.html', out), html);
} finally {
  server.close();
}

if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n\n${failures.length ? `**Failures:**\n${failures.map((f) => `- ${f.split('\n')[0]}`).join('\n')}` : '**All end-to-end checks passed.**'}\n`, { flag: 'a' });
if (failures.length) {
  console.error(`\nFAILED:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('\nAll end-to-end checks passed.');
