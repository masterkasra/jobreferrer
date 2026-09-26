// Telegram-sized messages (HTML parse mode, < 4096 chars each). The full
// report is sent alongside as an HTML file.

import { t } from './i18n.js';
import { badges, salaryText } from './markdown.js';

const esc = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const LIMIT = 3800;

export function chunk(lines) {
  const out = [];
  let cur = '';
  for (const line of lines) {
    if ((cur + line).length > LIMIT && cur) (out.push(cur), (cur = ''));
    cur += `${line}\n`;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function toTelegram(r, { maxJobs = 10, onlyNew = false } = {}) {
  const s = t(r.lang);
  const st = r.stats;
  const g = r.strategy;
  const summary = [
    `<b>${esc(s.title)}</b>`,
    `${esc(r.profile.headline)} · ${esc(r.profile.seniority)} · ${r.profile.yearsExperience} ${esc(s.years)}`,
    '',
    `📊 ${st.total} ${esc(s.total)} · ${st.matched} ${esc(s.matched)}`,
    `🛂 ${st.visa} ${esc(s.visa)} · ✈️ ${st.relocation} ${esc(s.relocation)} · 💼 ${st.freelance} ${esc(s.freelanceCount)}${st.newJobs !== null ? ` · 🆕 ${st.newJobs}` : ''}`,
    '',
    `<b>${esc(s.countries)}</b>`,
    ...g.countryAdvice.slice(0, 4).map((c) => `• <b>${esc(c.country)}</b> — ${esc(s.verdict[c.verdict] ?? c.verdict)}`),
    '',
    esc(g.overview),
  ];

  const jobs = (onlyNew ? r.jobs.filter((j) => j.isNew) : r.jobs).slice(0, maxJobs);
  const jobLines = [`<b>${esc(s.jobs)}</b>`, ''];
  jobs.forEach((j, i) => {
    jobLines.push(`<b>${i + 1}. ${esc(j.title)}</b> — ${esc(j.company || '?')} (${j.score}/100)`);
    jobLines.push(`📍 ${esc(j.location)} · ${esc(j.sourceName)}`);
    const b = badges(j, s);
    if (b.length) jobLines.push(esc(b.join(' · ')));
    const sal = salaryText(j, s);
    if (sal) jobLines.push(`💶 ${esc(sal)}`);
    if (j.pitch?.tips?.[0]) jobLines.push(`💡 ${esc(j.pitch.tips[0])}`);
    jobLines.push(`🔗 <a href="${esc(j.url)}">${esc(s.apply)}</a>`, '');
  });
  if (!jobs.length) jobLines.push(esc(s.none));

  const gigLines = [`<b>${esc(s.freelance)}</b>`, ''];
  r.freelance.slice(0, 5).forEach((j) => {
    gigLines.push(`• <a href="${esc(j.url)}">${esc(j.title)}</a> — ${esc(j.sourceName)}${j.salary ? ` · ${esc(salaryText(j, s))}` : ''}`);
  });

  return [...chunk(summary), ...chunk(jobLines), ...(r.freelance.length ? chunk(gigLines) : [])];
}

/** One job's full application kit, sent when the user taps "Pitch N". */
export function pitchMessages(r, index) {
  const s = t(r.lang);
  const j = r.jobs[index];
  if (!j?.pitch) return [esc(s.none)];
  const p = j.pitch;
  return chunk([
    `<b>${esc(j.title)}</b> — ${esc(j.company)}`,
    `<b>${esc(s.subject)}:</b> ${esc(p.emailSubject)}`,
    '',
    `<b>${esc(s.coverLetter)}</b>`,
    `<pre>${esc(p.coverLetter)}</pre>`,
    `<b>${esc(s.recruiterMessage)}</b>`,
    `<pre>${esc(p.recruiterMessage)}</pre>`,
    `<b>${esc(s.tips)}</b>`,
    ...p.tips.map((x) => `• ${esc(x)}`),
    '',
    `<b>${esc(s.interview)}</b>`,
    ...p.interviewQuestions.map((x) => `• ${esc(x)}`),
    '',
    `🔗 <a href="${esc(j.url)}">${esc(s.apply)}</a>`,
  ]);
}
