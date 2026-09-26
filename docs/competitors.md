# Competitor analysis (September 2026)

What exists today for people who want a job abroad, what each tool misses, and
what jobreferrer took from them or adds on top.

## AI job-search copilots

| Tool | What it does well | Gap for someone who needs to relocate |
|---|---|---|
| **Jobright** | Strong AI matching from skills rather than titles | US-focused; no visa/relocation filtering, no immigration guidance |
| **Teal** | Job tracker, resume-to-job match score, keyword matching | The useful parts (AI bullets, match score, cover letters) are behind Teal+; no sponsorship data |
| **Huntr** | Job-search CRM (Kanban), browser extension, AI resume tools | Tracking only, does not find sponsored jobs. Its own data: 11–20 targeted applications a week → 9.25% interview rate vs 2.58% for 100+ |
| **LazyApply / JobCopilot / LoopCV** | Auto-apply at volume on LinkedIn/Indeed Easy Apply | Same resume everywhere, no tailoring; reviews note they break on visa-sponsorship requirements; employers flag mass AI applications |
| **Simplify** | Autofill application forms with some help | Manual-with-help, no sponsorship intelligence |
| **AIApply** | "Application kit" documents, hosted agent | Generic; no country/visa knowledge |

## Visa-sponsorship focused tools and boards

| Tool | What it does well | Gap |
|---|---|---|
| **Migrate Mate / FrogHire.ai** | Verify that a US employer has actually sponsored before (DOL LCA data) | US-only (H-1B); no Europe, Canada, Gulf |
| **JobMetasearch / JobGlance / Workbeyond** | Upload CV once, AI scores roles, ATS score, keyword gaps, country-specific formatting advice | Paid, closed, English-only; no nationality-specific warnings; no freelance track |
| **Relocate.me** | Hand-checked tech jobs with relocation + visa (≈1,200 roles) | Tech only, manual search, no personalised pitches |
| **RelocateViaWork / VisaJobs.xyz / Jaabz / visasponsor.jobs** | Curated sponsorship boards, some with AI matching | Subscription or limited coverage; each is one more site to check |

## Remote-job platforms

| Tool | What it does well | Gap for someone outside the US/EU |
|---|---|---|
| **Remote Rocketship / Remote OK / We Work Remotely / Himalayas** | Large remote-only feeds, filters by region | "Remote" often means "remote in the US" or "EU residents only"; no check against where *you* live, no sanctions awareness |
| **Arc.dev / Turing / Toptal** | Vetted remote contracts, payroll handled | Long vetting, country restrictions on payouts, no immigration track |
| **Welcome to the Jungle (Otta)** | Curated startups, clear culture/salary info | Mostly UK/EU/US residents; sponsorship filter is coarse |

## Immigration calculators and advisers

| Tool | What it does well | Gap |
|---|---|---|
| **Official calculators** (IRCC CRS tool, Make it in Germany quick check, Home Affairs points table) | Authoritative | One country at a time, no link to real jobs, no "what should I improve first" |
| **Paid consultancies / lawyers** | Case-specific advice, representation | Expensive, slow to get a first opinion; unlicensed "consultants" are a common scam |
| **VisaGuide / country blogs** | Broad explanations | Generic, often outdated thresholds, nothing personal |

## What jobreferrer takes from them

- **Fit score per job** (JobGlance, Jobright) — `src/match/score.js`, weighted for mobility: visa, relocation, target country, language, region-locked remote roles.
- **ATS keyword gaps** (Teal, Workbeyond) — every job lists the skills the ad asks for that the resume does not show.
- **Employer sponsor verification** (Migrate Mate, FrogHire) — adapted to Europe: jobs in the UK and the Netherlands are checked against the official Home Office and IND sponsor registers.
- **Quality over volume** (Huntr's data) — no auto-apply. The bot prepares a tailored letter and recruiter message for the top 10 jobs and the plan targets 10–20 applications a week.
- **Country-specific CV advice** (JobMetasearch, Workbeyond) — per-country CV style notes in the knowledge base.
- **New-job alerts and memory** (Huntr tracker) — `--seen` / daily digest only sends jobs you have not seen.
- **Aggregation** (all the boards above) — 14 sources with an API plus ready-made search links for 40+ boards without one (LinkedIn, Indeed ×31 countries, StepStone, SEEK, Bayt, Relocate.me, Jaabz…).

- **First-hand ads from employer career pages** (Relocate.me's curation, automated) — ~27 internationally hiring companies read from their public Greenhouse/Lever/Ashby feeds.
- **Remote-eligibility filters** (Remote Rocketship) — but judged against *your* country of residence, including "EU residents only", one-country remote, US-hours and sanctions exclusions.
- **Official points calculators** (IRCC, Make it in Germany, Home Affairs) — combined in one report with what-if levers and tied to the jobs found.
- **Explainable match** (Jobright) — each job shows the reasons for and against it, including years asked and level fit.
- **Application tracker** (Teal, Huntr) — status per job saved in the browser, no account needed.

## What jobreferrer adds that none of them do

0. **A first consultation in the report**: case facts and assumptions, points in every relevant official system, each route in the target countries rated strong/possible/hard/closed with next steps, costs and timelines, a document checklist (Iran-specific: degree release and free-education bond, official translation and legalisation, military service card, insurance records, where to give biometrics), a 90-day plan, and links to *licensed* advisers (RCIC, IAA, OMARA) plus a warning about paid "guaranteed visa" offers.
1. **Immigration knowledge next to every job**: visa route, 2026 salary threshold check (Blue Card, kennismigrant, Skilled Worker, Critical Skills, Sweden), official links, degree-recognition body.
2. **Nationality-aware warnings** (e.g. Iranian passport: US entry suspension, extra security screening, consulate options, sanctions affecting freelance platforms).
3. **Scam detection**: ads asking for fees, "guaranteed visa", WhatsApp/Telegram-only contact are removed and shown separately.
4. **A parallel freelance track**: live Freelancer.com projects with ready proposals, plus Upwork/Fiverr/Toptal/Contra/Malt and Iranian markets (Ponisha, Karlancer) — income while the job search runs, and proof of income for digital-nomad visas.
5. **Persian-first reports** (RTL HTML, Telegram) with English application material.
6. **Free, open source, self-hosted**: works with zero API keys; Claude is optional for fully tailored writing.
7. **Telegram bot + GitHub Actions daily digest**: no server needed for daily alerts.

## Roadmap ideas

- ~~Points calculators (Canada CRS, Germany Opportunity Card, Australia 189)~~ — done, with what-if levers.
- ~~Application tracker~~ — done in the HTML report (browser storage); a Telegram version is next.
- More employer feeds (SmartRecruiters, Workable, Personio) and a community-maintained list of sponsoring employers.
- US H-1B employer history from DOL LCA disclosure data (useful once US entry reopens for affected nationalities).
- Mock interview over Telegram voice messages using Claude.
- LinkedIn profile rewrite from the resume.
