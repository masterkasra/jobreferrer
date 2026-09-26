// Checks the deployed site like a user would: open the page, upload resumes,
// expect a report with jobs. Usage: node scripts/check-live.mjs https://jobreferrer.vercel.app
import { readFileSync } from 'node:fs';

const base = (process.argv[2] ?? process.env.SITE_URL ?? 'https://jobreferrer.vercel.app').replace(/\/$/, '');
const dir = new URL('../tests/fixtures/resumes/', import.meta.url);
const failures = [];

const page = await fetch(`${base}/`);
const html = await page.text();
console.log(`GET / → ${page.status} ${html.includes('jobreferrer') ? '(upload page)' : html.slice(0, 200)}`);
if (page.status !== 200 || !html.includes('jobreferrer')) failures.push(`upload page: HTTP ${page.status}`);

for (const name of ['en-resume.pdf', 'fa-resume.docx', 'en-resume-scan.png']) {
  const started = Date.now();
  const res = await fetch(`${base}/api/run?countries=DE,NL,GB,IE,CA,AE&lang=fa&nationality=IR`, {
    method: 'POST', headers: { 'X-Filename': name }, body: readFileSync(new URL(name, dir)),
  });
  const body = await res.text();
  const cards = (body.match(/class="card job"/g) ?? []).length;
  const titles = [...body.matchAll(/<h3>([^<]+)<\/h3><div class="company">([^<]+)</g)].slice(0, 3).map((m) => `${m[1]} @ ${m[2]}`);
  console.log(`POST ${name} → ${res.status} in ${Date.now() - started}ms · ${cards} job cards${titles.length ? ` · e.g. ${titles.join(' | ')}` : ` · ${body.slice(0, 160)}`}`);
  if (name.includes('scan')) {
    // No API key on the deployment: a photo must get a clear 422 message, not a crash.
    if (res.status !== 422 && res.status !== 200) failures.push(`${name}: HTTP ${res.status}`);
  } else if (res.status !== 200 || cards < 5) failures.push(`${name}: HTTP ${res.status}, ${cards} job cards`);
}

if (failures.length) {
  console.error(`FAILED:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('Live site OK.');
