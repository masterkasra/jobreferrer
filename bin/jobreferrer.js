#!/usr/bin/env node
// Command-line entry point.
//   jobreferrer resume.pdf --countries DE,NL,GB --lang fa --nationality IR

import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadResume as parseResume, resumeErrorMessage } from '../src/resume/load.js';
import { run } from '../src/pipeline.js';
import { toMarkdown } from '../src/report/markdown.js';
import { toHtml } from '../src/report/html.js';
import { toTelegram } from '../src/report/telegram.js';
import { sendMessages, sendDocument } from '../src/bot/api.js';
import { SOURCES } from '../src/sources/index.js';
import { config, hasClaude } from '../src/config.js';

const HELP = `jobreferrer — find visa-sponsored and relocation jobs abroad from your resume

Usage: jobreferrer <resume: pdf|docx|doc|odt|rtf|html|txt|md|json|jpg|png|-> [options]

Options:
  -c, --countries DE,NL,GB   target countries (ISO codes). Default: ${config.defaults.countries.join(',')}
  -l, --lang fa|en           report language. Default: ${config.defaults.lang}
  -n, --nationality IR       your passport country, adds nationality-specific warnings
  -o, --out reports/report   output path without extension
  -f, --format html,md,json  formats to write. Default: html,md
      --top 25               jobs in the report
      --pitches 10           jobs that get a tailored cover letter
      --title "..."          force the job title to search for
  Immigration assessment (optional, makes the points calculators exact):
      --age 31  --married  --residence IR  --education master|bachelor|phd|two-year|secondary
      --ielts 8,7,7,7        IELTS General bands L,R,W,S (or one overall score)
      --german B1  --french A2
      --only a,b / --skip a,b  choose sources (see --list-sources)
      --no-ai                do not call Claude even if ANTHROPIC_API_KEY is set
      --offline              use bundled demo jobs instead of live search
      --seen FILE            remember jobs between runs and flag new ones
      --telegram             send the summary + HTML report to TELEGRAM_CHAT_ID
      --only-new             with --telegram: list only jobs not seen before
      --list-sources         show job sources and exit
  -h, --help

The resume can also come from the RESUME_TEXT or RESUME_B64 (+ RESUME_NAME) environment variables.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    countries: { type: 'string', short: 'c' },
    lang: { type: 'string', short: 'l' },
    nationality: { type: 'string', short: 'n', default: process.env.NATIONALITY ?? '' },
    out: { type: 'string', short: 'o' },
    format: { type: 'string', short: 'f', default: 'html,md' },
    top: { type: 'string' },
    pitches: { type: 'string' },
    title: { type: 'string' },
    age: { type: 'string' },
    married: { type: 'boolean', default: false },
    residence: { type: 'string' },
    education: { type: 'string' },
    ielts: { type: 'string' },
    german: { type: 'string' },
    french: { type: 'string' },
    only: { type: 'string', default: '' },
    skip: { type: 'string', default: '' },
    'no-ai': { type: 'boolean', default: false },
    offline: { type: 'boolean', default: false },
    seen: { type: 'string' },
    telegram: { type: 'boolean', default: false },
    'only-new': { type: 'boolean', default: false },
    'list-sources': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}
if (values['list-sources']) {
  for (const s of SOURCES) console.log(`${s.id.padEnd(16)} ${s.name.padEnd(26)} ${s.kind.padEnd(9)} ${s.requires ? `needs ${s.requires.join(' + ')}` : 'free'}${s.countries ? ` (only ${s.countries.join(',')})` : ''}`);
  process.exit(0);
}

async function loadResume() {
  const path = positionals[0];
  if (path === '-') {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const buffer = Buffer.concat(chunks);
    return { buffer, name: 'resume.txt' };
  }
  if (path) return { buffer: await readFile(path), name: path };
  if (process.env.RESUME_B64) return { buffer: Buffer.from(process.env.RESUME_B64, 'base64'), name: process.env.RESUME_NAME || 'resume.pdf' };
  if (process.env.RESUME_TEXT) return { buffer: Buffer.from(process.env.RESUME_TEXT), name: 'resume.txt' };
  console.error(HELP);
  process.exit(1);
}

const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

const { buffer, name } = await loadResume();
const useAI = !values['no-ai'] && hasClaude();
let resume;
try {
  resume = await parseResume(buffer, name, { useAI });
} catch (err) {
  console.error(resumeErrorMessage(err, values.lang === 'fa' ? 'fa' : 'en'));
  process.exit(1);
}
const { text } = resume;

const here = dirname(fileURLToPath(import.meta.url));
const fixtureJobs = values.offline ? JSON.parse(await readFile(resolve(here, '../examples/demo-jobs.json'), 'utf8')) : undefined;
const log = (m) => process.stderr.write(`${m}\n`);
log(`jobreferrer: ${useAI ? `AI mode (${config.anthropic.model})` : 'offline mode (no ANTHROPIC_API_KEY)'} · resume ${resume.type} read ${resume.via === 'ocr' ? 'by Claude (image/scan)' : 'locally'}, ${text.length} chars`);

const bands = list(values.ielts).map(Number);
const applicant = {
  age: values.age ? Number(values.age) : undefined,
  married: values.married || undefined,
  residence: values.residence,
  education: values.education,
  ielts: bands.length === 4 ? { l: bands[0], r: bands[1], w: bands[2], s: bands[3] } : bands[0],
  german: values.german,
  french: values.french,
};

const report = await run({
  applicant,
  text,
  pdf: resume.pdf,
  countries: list(values.countries),
  lang: values.lang ?? config.defaults.lang,
  nationality: values.nationality,
  top: values.top ? Number(values.top) : undefined,
  pitches: values.pitches ? Number(values.pitches) : undefined,
  overrides: values.title ? { titles: [values.title], searchQueries: [values.title.toLowerCase()], headline: values.title } : {},
  only: list(values.only),
  skip: list(values.skip),
  useAI,
  fixtureJobs,
  seenFile: values.seen,
  onProgress: (m) => {
    if (m.step === 'source') log(`  ${m.status === 'ok' ? '✔' : '✖'} ${m.name}: ${m.status === 'ok' ? `${m.count} jobs` : m.note}`);
    else if (m.step === 'search') log(`searching for: ${m.queries.join(' | ')}`);
    else if (m.step !== 'done') log(`${m.step}…`);
  },
});

const base = values.out ?? `reports/report-${new Date().toISOString().slice(0, 10)}`;
await mkdir(dirname(resolve(base)), { recursive: true });
const formats = list(values.format);
const html = toHtml(report);
if (formats.includes('html')) await writeFile(`${base}.html`, html);
if (formats.includes('md')) await writeFile(`${base}.md`, toMarkdown(report));
if (formats.includes('json')) await writeFile(`${base}.json`, JSON.stringify(report, null, 2));

log(`\n${report.stats.total} jobs scanned · ${report.jobs.length} in report · ${report.stats.visa} with visa sponsorship · ${report.freelance.length} freelance`);
for (const [i, j] of report.jobs.slice(0, 10).entries()) log(`${String(i + 1).padStart(2)}. [${j.score}] ${j.title} — ${j.company} (${j.location}) ${j.url}`);
log(`\nreport: ${formats.map((f) => `${base}.${f}`).join(', ')}`);

if (values.telegram) {
  const chatId = config.telegram.chatId;
  if (!chatId) {
    console.error('Set TELEGRAM_CHAT_ID to use --telegram');
    process.exit(1);
  }
  const onlyNew = values['only-new'];
  if (onlyNew && !report.jobs.some((j) => j.isNew) && !report.freelance.some((j) => j.isNew)) {
    log('no new jobs since the last run — nothing sent');
  } else {
    await sendMessages(chatId, toTelegram(report, { onlyNew }));
    await sendDocument(chatId, `jobreferrer-${report.generatedAt.slice(0, 10)}.html`, html, '📄');
    log('sent to Telegram');
  }
}
