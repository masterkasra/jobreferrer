<div align="center">

# jobreferrer

**Upload your resume → get visa-sponsored and relocation jobs abroad, freelance gigs, a tailored pitch for every employer and a step-by-step immigration plan.**

[![CI](https://github.com/masterkasra/jobreferrer/actions/workflows/ci.yml/badge.svg)](https://github.com/masterkasra/jobreferrer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-10b981.svg)](LICENSE)

[فارسی](README.fa.md) · [Sample report](examples/sample-report.md) · [Competitor analysis](docs/competitors.md)

<img src="docs/screenshot.png" width="720" alt="jobreferrer report">

</div>

## What it does

1. **Reads your resume in any common format**: PDF, Word (DOCX and legacy DOC), ODT, RTF, HTML, TXT/MD, JSON Resume, and photos or scans (JPG/PNG/WEBP, scanned PDF). English and **Persian** resumes are both supported (Persian digits, Jalali dates and job titles are understood). Without an API key a built-in parser extracts titles, skills, years, languages, degree and achievements; with a Claude key, Claude reads the resume directly and also transcribes photos and scans.
2. **Searches 14 job sources in parallel** and generates ready-made searches for 40+ more (LinkedIn, Indeed in 31 countries, StepStone, XING, SEEK, Bayt, Relocate.me, Jaabz, EURES…).
3. **Ranks every job for someone who has to move**: skill and title fit, *visa sponsorship*, *relocation help*, target country, required local language, region-locked "remote" roles, freshness.
4. **Checks the immigration side**: the employer against the official UK / Netherlands sponsor registers, and the advertised salary against the 2026 visa threshold (EU Blue Card, kennismigrant, Skilled Worker, Critical Skills, Sweden work permit).
5. **Writes application material** for the top jobs: cover letter, short recruiter message, email subject, missing keywords, how to win this job, and likely interview questions.
6. **Lists freelance projects** with a ready proposal, plus freelance platforms to use while the job search runs.
7. **Builds your strategy**: best countries and visa routes for your profile, resume and LinkedIn fixes, freelance pricing, a 4-week action plan, scam and nationality-specific warnings.
8. **Delivers it** as a self-contained HTML report (Persian RTL or English), Markdown, JSON, a Telegram bot, a local web page, or a daily Telegram digest from GitHub Actions.

## Job sources

| Source | Key | Notes |
|---|---|---|
| Arbeitnow | free | Germany/EU, explicit visa-sponsorship flag |
| Bundesagentur für Arbeit | free | German federal job board (only when DE is a target) |
| Remotive, Remote OK, Jobicy, Himalayas, Working Nomads, We Work Remotely | free | Remote jobs; region-locked roles are penalised |
| The Muse | free | Jobs in target cities |
| HN "Who is hiring" | free | Posts that mention VISA / RELOCATION |
| Freelancer.com | free | Live freelance projects |
| Adzuna | free key | National boards in 19 countries, filtered for visa/sponsor/relocation |
| Jooble | free key | 70+ countries |
| Reed | free key | UK |

`jobreferrer --list-sources` shows them all. Any failing source is reported and skipped; the rest of the run continues.

## Quick start

Requires Node.js 20+.

```bash
git clone https://github.com/masterkasra/jobreferrer.git
cd jobreferrer
npm install

# Try it with demo data (no network, no keys)
npm run demo            # → examples/sample-report.html

# Real search
node bin/jobreferrer.js my-resume.pdf --countries DE,NL,GB,IE,CA --nationality IR --lang fa
```

Optional: copy `.env.example` to `.env` and add `ANTHROPIC_API_KEY` for Claude-written letters and strategy (default model `claude-opus-5`), and the free Adzuna / Jooble / Reed keys for more coverage.

### CLI options

```
-c, --countries DE,NL,GB   target countries (ISO codes)
-l, --lang fa|en           report language
-n, --nationality IR       passport country → nationality-specific warnings
-o, --out reports/report   output path without extension
-f, --format html,md,json
    --top 25 / --pitches 10
    --title "Data Engineer"  force the job title to search for
    --only a,b / --skip a,b  pick sources
    --no-ai                  never call Claude
    --offline                demo data instead of live search
    --seen FILE              remember jobs and flag new ones
    --telegram [--only-new]  send the result to TELEGRAM_CHAT_ID
```

## Telegram bot

1. Create a bot with [@BotFather](https://t.me/BotFather) and put the token in `.env` as `TELEGRAM_BOT_TOKEN`.
2. `npm run bot` (or `docker build -t jobreferrer . && docker run -d --env-file .env -v jr:/app/.cache jobreferrer`).
3. Send the bot your resume. It replies with ranked jobs, a button per job for the full application kit, and the HTML report.

Commands: `/countries DE NL GB`, `/nationality IR`, `/title …`, `/lang fa|en`, `/jobs`, `/daily` (daily digest of new jobs), `/settings`, `/forget`.
Set `TELEGRAM_ALLOWED_USERS` to limit who can use your bot (it spends your API credits).

## Daily digest with GitHub Actions (no server)

The [`daily-digest`](.github/workflows/daily-digest.yml) workflow runs every morning and sends only jobs you have not seen before.

1. Repository → Settings → Secrets and variables → Actions.
2. Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RESUME_B64` (`base64 -w0 resume.pdf`) or `RESUME_TEXT`, optionally `ANTHROPIC_API_KEY` and job-board keys.
3. Variables: `DIGEST_ENABLED=true`, `TARGET_COUNTRIES`, `NATIONALITY`, `REPORT_LANG`, `RESUME_NAME`.

Keep the repository private if you store your resume in it.

## Web UI

`npm run web` → <http://localhost:3000>: upload the resume, tick countries, get the report in the browser.

## How ranking works

| Signal | Effect |
|---|---|
| Skills in the ad that you have | up to +40 |
| Title matches your target titles | up to +20 |
| Visa sponsorship / relocation mentioned | +15 / +10 |
| In one of your target countries | +8 |
| Remote and open to your region | +6 |
| "No sponsorship" / "must have right to work" | −25 |
| Remote but US-only (and US not targeted) | −12 |
| Requires a language you don't speak at B2+ | −10 each |
| Posted in the last week / older than 60 days | +5 / −5 |
| Scam patterns (fees, guaranteed visa, WhatsApp-only) | removed and listed separately |

## Project layout

```
bin/jobreferrer.js        CLI
src/pipeline.js           resume → profile → search → rank → checks → pitches → strategy
src/profile/              offline parser + skill taxonomy
src/llm/claude.js         Claude: profile extraction, pitches, strategy (structured outputs)
src/sources/              14 job-source adapters, search links, cache
src/jobs/                 normalisation, visa/relocation/language/scam signals, geo
src/match/score.js        ranking
src/immigration/          country knowledge base, salary checks, sponsor registers
src/writer/, src/guidance/  offline templates and strategy
src/report/               HTML, Markdown, Telegram renderers (fa/en)
src/bot/, src/web/        Telegram bot, local web UI
```

## Development

```bash
npm test          # unit + integration tests (no network): every resume format, English + Persian, bot, web, pipeline
npm run smoke     # live check of every job source
npm run e2e       # live end to end: each resume format → real job boards → ranked jobs + reports in e2e-reports/
```

CI runs the tests on Node 20 and 22, a live check of the job boards, and the live end-to-end run (its HTML reports are uploaded as the `e2e-reports` artifact).

## Disclaimer

Immigration rules and salary thresholds change. Figures in `src/immigration/countries.js` were checked in September 2026; the report always links the official source. This is guidance, not legal advice. Respect each job board's terms; the bot only uses public APIs and feeds and links back to the original ads.

## License

MIT
