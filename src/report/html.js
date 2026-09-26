// Self-contained HTML report: RTL for Persian, dark mode, filters, copy buttons.

import { t } from './i18n.js';
import { badges, salaryText } from './markdown.js';
import { COUNTRY_NAMES } from '../jobs/geo.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u = '') => (/^https?:\/\//i.test(u) ? esc(u) : '#');
const ul = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

function copyBlock(label, text, s) {
  return `<div class="copy"><div class="copy-head"><span>${esc(label)}</span><button type="button" data-copy data-done="${esc(s.copied)}">${esc(s.copy)}</button></div><pre>${esc(text)}</pre></div>`;
}

function jobCard(j, i, s) {
  const flags = [j.signals.visa && 'visa', j.signals.relocation && 'relocation', j.signals.remote && 'remote', j.isNew && 'new'].filter(Boolean).join(' ');
  const meta = [
    `<bdi>${esc(j.location || j.countries.map((c) => COUNTRY_NAMES[c]).join(', '))}</bdi>`,
    `${esc(s.source)}: <bdi>${esc(j.sourceName)}</bdi>`,
    j.postedAt ? `${esc(s.posted)}: <bdi>${esc(j.postedAt.slice(0, 10))}</bdi>` : '',
  ].filter(Boolean);
  const sal = salaryText(j, s);
  const salClass = j.salaryCheck ? (j.salaryCheck.status === 'below' ? 'warn' : 'good') : '';
  const p = j.pitch;
  return `<article class="card job" data-flags="${flags}">
  <header><span class="rank">${i + 1}</span><div class="grow"><h3>${esc(j.title)}</h3><div class="company">${esc(j.company || '—')}</div></div><div class="score" style="--v:${j.score}">${j.score}</div></header>
  <div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
  <div class="badges">${badges(j, s).map((b) => `<span class="badge">${esc(b)}</span>`).join('')}</div>
  ${sal ? `<p class="salary ${salClass}">${esc(s.salary)}: <bdi>${esc(sal)}</bdi></p>` : ''}
  ${j.matchedSkills.length ? `<p class="skills"><b>${esc(s.matchedSkills)}:</b> ${j.matchedSkills.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</p>` : ''}
  ${p && (p.missingKeywords?.length || j.missingSkills.length) ? `<p class="skills"><b>${esc(s.missing)}:</b> ${(p.missingKeywords?.length ? p.missingKeywords : j.missingSkills).map((x) => `<span class="chip miss">${esc(x)}</span>`).join('')}</p>` : ''}
  ${whyLine(j, s)}
  ${p?.fitSummary ? `<p class="fit">${esc(p.fitSummary)}</p>` : ''}
  <div class="actions"><a class="btn" href="${safeUrl(j.url)}" target="_blank" rel="noopener">${esc(s.apply)} ↗</a>${(j.alsoOn ?? []).map((a) => `<a class="btn ghost" href="${safeUrl(a.url)}" target="_blank" rel="noopener">${esc(a.source)}</a>`).join('')}${trackSelect(j, s)}</div>
  ${p ? `<details><summary>${esc(s.coverLetter)} · ${esc(s.recruiterMessage)} · ${esc(s.tips)}</summary>
    <p class="subject"><b>${esc(s.subject)}:</b> ${esc(p.emailSubject)}</p>
    <div dir="auto">${copyBlock(s.coverLetter, p.coverLetter, s)}${copyBlock(s.recruiterMessage, p.recruiterMessage, s)}</div>
    <h4>${esc(s.tips)}</h4>${ul(p.tips)}
    <h4>${esc(s.interview)}</h4><div dir="auto">${ul(p.interviewQuestions)}</div>
  </details>` : ''}
</article>`;
}

const BAD = new Set(['management-role', 'entry-blocked', 'needs-more-experience', 'level-too-high', 'overqualified', 'title-skill-missing', 'other-field', 'no-sponsorship', 'region-locked', 'remote-needs-residence', 'us-hours', 'sanctions', 'language', 'old', 'scam-risk']);

function whyLine(j, s) {
  const chips = (j.reasons ?? []).filter((r) => s.reason[r]).map((r) => `<span class="chip ${BAD.has(r) ? 'miss' : 'ok'}">${BAD.has(r) ? '−' : '+'} ${esc(s.reason[r])}</span>`);
  if (j.requiredYears) chips.push(`<span class="chip">${esc(s.yearsAsked)}: ${j.requiredYears}+</span>`);
  return chips.length ? `<p class="skills why"><b>${esc(s.why)}:</b> ${chips.join('')}</p>` : '';
}

const trackSelect = (j, s) => `<select class="track" data-id="${esc(j.id)}" aria-label="${esc(s.tracker)}">${Object.entries(s.trackStates).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>`;

const STATUS_CLASS = { strong: 'good', possible: 'mid', hard: 'warn', blocked: 'bad', info: '' };

function immigrationSection(r, s) {
  const im = r.immigration;
  if (!im) return '';
  const a = im.applicant;
  const c = im.calculators;
  const ielts = a.ielts ? `IELTS L${a.ielts.l} R${a.ielts.r} W${a.ielts.w} S${a.ielts.s} → CLB ${a.clb.l}/${a.clb.r}/${a.clb.w}/${a.clb.s}` : s.unknown;
  const facts = [
    [s.age, a.age ?? s.unknown], [s.education, a.educationKnown ? (EDU_NAMES[r.lang]?.[a.education] ?? a.education) : s.unknown], [s.english, ielts], [s.german, a.german ?? '—'],
    [s.experience, `${a.years} ${s.years}`],
  ];
  const parts = (obj) => Object.entries(obj).filter(([, v]) => v).map(([k, v]) => `${esc(PARTS[r.lang]?.[k] ?? k)} ${v}`).join(' · ');
  const calc = [];
  if (c.crs) calc.push(`<div class="calc"><h4>🇨🇦 Express Entry CRS: <b>${c.crs.total}</b></h4><p class="muted">${parts(c.crs.parts)}</p><p>FSW 67: <b>${c.fsw.total}/100</b> ${c.fsw.pass ? '✅' : '❌'}</p>${c.crs.whatIf.length ? `<p><b>${esc(s.whatIf)}</b></p><ul>${c.crs.whatIf.map((w) => `<li>${esc(WHATIF[r.lang]?.[w.key] ?? w.key)}: <b>${w.total}</b> (+${w.delta})</li>`).join('')}</ul>` : ''}</div>`);
  if (c.chancenkarte) calc.push(`<div class="calc"><h4>🇩🇪 Chancenkarte: <b>${c.chancenkarte.points}/6</b> ${c.chancenkarte.viaRecognition || c.chancenkarte.eligibleByPoints ? '✅' : '❌'}</h4><p class="muted">${parts(c.chancenkarte.parts)}</p></div>`);
  if (c.australia) calc.push(`<div class="calc"><h4>🇦🇺 Skilled Independent: <b>${c.australia.points}</b> / 65 ${c.australia.pass ? '✅' : '❌'}</h4><p class="muted">${parts(c.australia.parts)}</p></div>`);
  return `<h2 id="immigration">${esc(s.immigration)}</h2>
<p class="muted">${esc(s.immigrationIntro)}</p>
<div class="card"><h4 style="margin-top:0">${esc(s.facts)}</h4><table>${facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td><bdi>${esc(v)}</bdi></td></tr>`).join('')}</table>
${a.estimated.length ? `<h4>${esc(s.assumptions)}</h4>${ul(a.estimated.map((e) => s.assumption[e] ?? e))}` : ''}</div>
${calc.length ? `<div class="card"><h4 style="margin-top:0">${esc(s.calculators)}</h4>${calc.join('')}</div>` : ''}
<h3>${esc(s.pathways)}</h3>
${im.pathways.map((p) => `<div class="card path ${STATUS_CLASS[p.status] ?? ''}"><h3>${esc(p.country)} — ${esc(p.route)} <span class="pill ${STATUS_CLASS[p.status] ?? ''}">${esc(s.status4[p.status] ?? p.status)}</span></h3>
${ul(p.why)}${p.next.length ? `<h4>${esc(s.nextSteps)}</h4>${ul(p.next)}` : ''}
<p class="muted">${p.timeline ? `${esc(s.timeline)}: ${esc(p.timeline)} · ` : ''}${p.cost ? `${esc(s.cost)}: ${esc(p.cost)} · ` : ''}<a href="${safeUrl(p.url)}" target="_blank" rel="noopener">${esc(s.official)}</a></p></div>`).join('')}
<div class="card"><h4 style="margin-top:0">${esc(s.documents)}</h4>
<ul class="checklist">${im.documents.map((d, i) => `<li><label><input type="checkbox" data-doc="${i}"> <b>${esc(d.title)}</b> — ${esc(d.detail)}${d.url ? ` <a href="${safeUrl(d.url)}" target="_blank" rel="noopener">↗</a>` : ''}</label></li>`).join('')}</ul></div>
<div class="card"><h4 style="margin-top:0">${esc(s.roadmap)}</h4>${im.roadmap.map((ph) => `<p><b>${esc(ph.phase)}</b></p>${ul(ph.tasks)}`).join('')}</div>
${im.advisors.length ? `<div class="card"><h4 style="margin-top:0">${esc(s.advisors)}</h4><ul>${im.advisors.map((x) => `<li>${esc(x.text)} <a href="${safeUrl(x.url)}" target="_blank" rel="noopener">↗</a></li>`).join('')}</ul><p class="warnbox">${esc(im.scamWarning)}</p></div>` : `<p class="warnbox">${esc(im.scamWarning)}</p>`}`;
}

const PARTS = {
  fa: { age: 'سن', education: 'تحصیلات', language: 'زبان', secondLanguage: 'زبان دوم', canadianWork: 'سابقه کانادا', transferability: 'انتقال‌پذیری مهارت', additional: 'امتیاز اضافه', experience: 'سابقه', arrangedEmployment: 'پیشنهاد کار', adaptability: 'سازگاری', partialRecognition: 'شناسایی نسبی مدرک', shortageOccupation: 'شغل کمبود', german: 'آلمانی', english: 'انگلیسی', stayInGermany: 'اقامت قبلی در آلمان', partner: 'همسر', nomination: 'نامزدی ایالتی' },
  en: { canadianWork: 'Canadian work', secondLanguage: 'second language', arrangedEmployment: 'job offer', partialRecognition: 'partial recognition', shortageOccupation: 'shortage occupation', stayInGermany: 'stay in Germany' },
};
const EDU_NAMES = { fa: { phd: 'دکتری', master: 'کارشناسی ارشد', bachelor: 'کارشناسی', 'two-or-more': 'دو مدرک دانشگاهی', 'two-year': 'کاردانی', 'one-year': 'دوره یک‌ساله', secondary: 'دیپلم' } };

const WHATIF = {
  fa: { clb9: 'آیلتس L8 R7 W7 S7 (CLB 9)', clb10: 'آیلتس L8.5 R8 W7.5 S7.5 (CLB 10)', french7: 'فرانسه NCLC 7 (حدود B2)', master: 'کارشناسی ارشد', pnp: 'نامزدی استانی (PNP)' },
  en: { clb9: 'IELTS L8 R7 W7 S7 (CLB 9)', clb10: 'IELTS L8.5 R8 W7.5 S7.5 (CLB 10)', french7: 'French NCLC 7 (about B2)', master: 'a master’s degree', pnp: 'a provincial nomination (PNP)' },
};

function gigCard(j, i, s) {
  const sal = salaryText(j, s);
  return `<article class="card job" data-flags="remote${j.isNew ? ' new' : ''}">
  <header><span class="rank">${i + 1}</span><div class="grow"><h3>${esc(j.title)}</h3><div class="company">${esc(j.sourceName)}${sal ? ` · <bdi>${esc(sal)}</bdi>` : ''}</div></div><div class="score" style="--v:${j.score}">${j.score}</div></header>
  ${j.matchedSkills.length ? `<p class="skills">${j.matchedSkills.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</p>` : ''}
  <div class="actions"><a class="btn" href="${safeUrl(j.url)}" target="_blank" rel="noopener">${esc(s.apply)} ↗</a></div>
  <details><summary>${esc(s.proposal)}</summary><div dir="ltr">${copyBlock(s.proposal, j.proposal, s)}</div></details>
</article>`;
}

export function toHtml(r) {
  const s = t(r.lang);
  const p = r.profile;
  const g = r.strategy;
  const st = r.stats;
  const countryName = (c) => (r.lang === 'fa' ? c.fa : c.name);
  const groupName = (grp) => (grp.group === 'global' ? s.global : grp.group === 'freelance' ? s.freelanceLinks : (r.lang === 'fa' ? r.countryFit.find((c) => c.code === grp.group)?.fa : null) ?? COUNTRY_NAMES[grp.group] ?? grp.group);

  return `<!doctype html>
<html lang="${r.lang}" dir="${s.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)} — ${esc(p.name || p.headline)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#f6f7fb;--card:#fff;--ink:#16181d;--muted:#5d6472;--line:#e3e6ee;--accent:#2f6fed;--good:#138a52;--warn:#b45309;--chip:#eef2fe;--miss:#fdeeee}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--ink:#e8eaf0;--muted:#9aa2b2;--line:#2a2f3a;--accent:#6a9cff;--good:#3ccf8e;--warn:#f0a44b;--chip:#1f2940;--miss:#3a2224}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 Vazirmatn,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.7rem;margin:.2em 0}h2{font-size:1.3rem;margin:2em 0 .6em;padding-bottom:.3em;border-bottom:2px solid var(--line)}h3{font-size:1.05rem;margin:0}h4{margin:1em 0 .3em}
a{color:var(--accent)}.muted{color:var(--muted);font-size:.9rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center}.stat b{display:block;font-size:1.5rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.job header{display:flex;gap:12px;align-items:flex-start}.grow{flex:1;min-width:0}.company{color:var(--muted)}
.rank{background:var(--chip);border-radius:8px;min-width:32px;text-align:center;font-weight:800}
.score{--v:50;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:conic-gradient(var(--accent) calc(var(--v)*1%),var(--line) 0);position:relative}.score::before{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--card)}.score{isolation:isolate}.score::before{z-index:-1}
.meta,.badges{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0;color:var(--muted);font-size:.88rem}.badge{background:var(--chip);color:var(--ink);border-radius:999px;padding:1px 10px}
.chip{display:inline-block;background:var(--chip);border-radius:6px;padding:0 8px;margin:2px}.chip.miss{background:var(--miss)}
.chip.ok{background:var(--chip)}.why .chip{font-size:.85rem}
.pill{font-size:.8rem;border-radius:999px;padding:1px 10px;background:var(--chip);vertical-align:middle}.pill.good{background:var(--good);color:#fff}.pill.mid{background:var(--accent);color:#fff}.pill.warn{background:var(--warn);color:#fff}.pill.bad{background:#b91c1c;color:#fff}
.path.good{border-inline-start:4px solid var(--good)}.path.mid{border-inline-start:4px solid var(--accent)}.path.warn{border-inline-start:4px solid var(--warn)}.path.bad{border-inline-start:4px solid #b91c1c}
.calc{border-bottom:1px dashed var(--line);padding-bottom:6px}.calc:last-child{border:0}.calc h4{margin:.4em 0}
.checklist{list-style:none;padding:0}.checklist li{margin:6px 0}
select.track{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:4px 8px;font:inherit}
nav.toc{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}nav.toc a{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 12px;text-decoration:none}
.trackbox span{display:inline-block;margin-inline-end:12px}
.salary.good{color:var(--good)}.salary.warn{color:var(--warn)}.fit{font-style:italic}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.btn{background:var(--accent);color:#fff;text-decoration:none;padding:6px 14px;border-radius:8px;font-weight:600}.btn.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}
details{border-top:1px dashed var(--line);margin-top:8px;padding-top:8px}summary{cursor:pointer;font-weight:600;color:var(--accent)}
.copy{border:1px solid var(--line);border-radius:10px;margin:10px 0;overflow:hidden}.copy-head{display:flex;justify-content:space-between;align-items:center;background:var(--chip);padding:4px 10px;font-size:.85rem}
.copy button{border:0;background:var(--accent);color:#fff;border-radius:6px;padding:2px 10px;cursor:pointer;font:inherit}
pre{margin:0;padding:12px;white-space:pre-wrap;word-wrap:break-word;font:14px/1.6 ui-sans-serif,system-ui,sans-serif;direction:ltr;text-align:left}
.filters{position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0;display:flex;flex-wrap:wrap;gap:6px}.filters button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:4px 12px;cursor:pointer;font:inherit}.filters button[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}
.country h3 small{color:var(--muted);font-weight:400}.warnbox{border-inline-start:4px solid var(--warn);padding:6px 12px;background:var(--miss);border-radius:6px}
.links p{margin:.4em 0}.links a{display:inline-block;margin:2px 4px}
table{width:100%;border-collapse:collapse;font-size:.9rem}td,th{border-bottom:1px solid var(--line);padding:6px;text-align:start}
footer{margin-top:40px;color:var(--muted);font-size:.85rem;text-align:center}
</style>
</head>
<body><main>
<h1>${esc(s.title)}</h1>
<p class="muted">${esc(new Date(r.generatedAt).toUTCString())} · ${esc(r.ai ? s.aiNote : s.templateNote)}</p>

<section class="card">
<h2 style="margin-top:0">${esc(s.profile)}</h2>
<p><b>${esc(p.name || '')}</b> — ${esc(p.headline)} · ${esc(p.seniority)} · ${esc(p.yearsExperience)} ${esc(s.years)}</p>
${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
<p class="skills"><b>${esc(s.skills)}:</b> ${p.skills.slice(0, 24).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</p>
<p><b>${esc(s.languages)}:</b> ${esc((p.languages ?? []).map((l) => `${l.name} ${l.level}`).join(' · ') || '—')}</p>
</section>

<h2>${esc(s.stats)}</h2>
<div class="stats">
${[[st.total, s.total], [st.matched, s.matched], [st.visa, s.visa], [st.relocation, s.relocation], [st.remote, s.remote], [st.freelance, s.freelanceCount], [st.newJobs, s.newJobs]].filter(([n]) => n !== null).map(([n, l]) => `<div class="stat"><b>${n}</b>${esc(l)}</div>`).join('')}
</div>

<nav class="toc"><a href="#jobs">✈️ ${esc(s.jobs)} (${r.jobs.length})</a><a href="#remote">🏠 ${esc(s.remoteJobs)} (${(r.remote ?? []).length})</a><a href="#freelance">💼 ${esc(s.freelance)} (${r.freelance.length})</a>${r.immigration ? `<a href="#immigration">🛂 ${esc(s.immigration)}</a>` : ''}<a href="#strategy">🧭 ${esc(s.strategy)}</a></nav>
<div class="card trackbox"><b>${esc(s.tracker)}:</b> <span id="trackSummary">—</span> <span class="muted">${esc(s.trackerNote)}</span></div>

${immigrationSection(r, s)}

<h2 id="strategy">${esc(s.strategy)}</h2>
<div class="card"><h4 style="margin-top:0">${esc(s.overview)}</h4><p>${esc(g.overview)}</p>
<ul>${g.countryAdvice.map((c) => `<li><b>${esc(c.country)}</b> — ${esc(s.verdict[c.verdict] ?? c.verdict)}: ${esc(c.reasoning)}</li>`).join('')}</ul></div>

<h2>${esc(s.countries)}</h2>
${r.countryFit.slice(0, 5).map((c) => `<div class="card country"><h3>${esc(countryName(c))} <small>${c.score}/100 · ${c.jobCount} jobs</small></h3>
${c.blocked ? `<p class="warnbox">⚠️ ${esc(c.blocked)}</p>` : ''}
<h4>${esc(s.routes)}</h4><ul>${c.routes.map((rt) => `<li><a href="${safeUrl(rt.url)}" target="_blank" rel="noopener">${esc(rt.name)}</a> — ${esc(rt.summary)}</li>`).join('')}</ul>
<p class="muted"><a href="${safeUrl(c.official)}" target="_blank" rel="noopener">${esc(s.official)}</a> · ${esc(s.recognition)}: <a href="${safeUrl(c.recognition.url)}" target="_blank" rel="noopener">${esc(c.recognition.name)}</a><br>${esc(s.cvStyle)}: ${esc(c.cv)}</p></div>`).join('')}

<div class="card">
<h4 style="margin-top:0">${esc(s.resumeImprovements)}</h4>${ul(g.resumeImprovements)}
<h4>${esc(s.linkedinTips)}</h4>${ul(g.linkedinTips)}
<h4>${esc(s.freelanceStrategy)}</h4>${ul(g.freelanceStrategy)}
<h4>${esc(s.actionPlan)}</h4>${g.actionPlan.map((w) => `<p><b>${esc(w.week)}</b></p>${ul(w.tasks)}`).join('')}
<h4>${esc(s.warnings)}</h4><div class="warnbox">${ul(g.warnings)}</div>
</div>

<h2 id="jobs">${esc(s.jobs)}</h2>
<div class="filters" role="toolbar">
<button type="button" data-filter="all" aria-pressed="true">★</button>
<button type="button" data-filter="visa" aria-pressed="false">🛂 ${esc(s.signals.visa)}</button>
<button type="button" data-filter="relocation" aria-pressed="false">✈️ ${esc(s.signals.relocation)}</button>
<button type="button" data-filter="remote" aria-pressed="false">🏠 ${esc(s.signals.remote)}</button>
<button type="button" data-filter="new" aria-pressed="false">🆕 ${esc(s.signals.new)}</button>
</div>
${r.jobs.length ? r.jobs.map((j, i) => jobCard(j, i, s)).join('\n') : `<p>${esc(s.none)}</p>`}

${r.remote ? `<h2 id="remote">${esc(s.remoteJobs)}</h2>
<p class="warnbox">${esc(['IR', 'CU', 'SY', 'KP'].includes(r.residence) ? s.remoteNoteSanctioned : s.remoteNote)}</p>
${r.remote.length ? r.remote.map((j, i) => jobCard(j, i, s)).join('\n') : `<p>${esc(s.none)}</p>`}` : ''}

<h2 id="freelance">${esc(s.freelance)}</h2>
${r.freelance.length ? r.freelance.map((j, i) => gigCard(j, i, s)).join('\n') : `<p>${esc(s.none)}</p>`}

${r.scams.length ? `<h2>${esc(s.scams)}</h2><div class="card warnbox"><ul>${r.scams.map((j) => `<li>${esc(j.title)} — ${esc(j.company)} <small>(${esc(j.signals.scamFlags.join(', '))})</small></li>`).join('')}</ul></div>` : ''}

<h2>${esc(s.links)}</h2>
<div class="card links">${r.links.map((grp) => `<p><b>${esc(groupName(grp))}:</b> ${grp.links.map((l) => `<a href="${safeUrl(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join(' · ')}</p>`).join('')}</div>

<h2>${esc(s.sources)}</h2>
<div class="card"><table>${r.sources.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(s.status[x.status] ?? x.status)}</td><td>${x.count || ''}</td><td class="muted">${esc(x.note ?? '')}</td></tr>`).join('')}</table></div>

<footer>${esc(s.footer)}<br><a href="https://github.com/masterkasra/jobreferrer">jobreferrer</a></footer>
</main>
<script>
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const tracked = store.get('jr-track');
const docs = store.get('jr-docs');
function summarise() {
  const counts = {};
  document.querySelectorAll('select.track').forEach((sel) => { if (sel.value) counts[sel.value] = (counts[sel.value] || 0) + 1; });
  const names = Object.fromEntries([...document.querySelector('select.track')?.options ?? []].map((o) => [o.value, o.textContent]));
  document.getElementById('trackSummary').textContent = Object.keys(counts).length ? Object.entries(counts).map(([k, n]) => names[k] + ': ' + n).join(' · ') : '—';
}
document.querySelectorAll('select.track').forEach((sel) => { sel.value = tracked[sel.dataset.id] || ''; sel.addEventListener('change', () => { tracked[sel.dataset.id] = sel.value; store.set('jr-track', tracked); summarise(); }); });
document.querySelectorAll('[data-doc]').forEach((cb) => { cb.checked = Boolean(docs[cb.dataset.doc]); cb.addEventListener('change', () => { docs[cb.dataset.doc] = cb.checked; store.set('jr-docs', docs); }); });
summarise();
document.addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const text = copy.closest('.copy').querySelector('pre').innerText;
    try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    const old = copy.textContent; copy.textContent = copy.dataset.done; setTimeout(() => (copy.textContent = old), 1500);
  }
  const f = e.target.closest('[data-filter]');
  if (f) {
    document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
    const want = f.dataset.filter;
    document.querySelectorAll('#jobs ~ .job').forEach((card) => { card.hidden = want !== 'all' && !card.dataset.flags.split(' ').includes(want); });
  }
});
</script>
</body></html>`;
}
