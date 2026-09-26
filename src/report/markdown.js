import { t } from './i18n.js';
import { COUNTRY_NAMES } from '../jobs/geo.js';

export function salaryText(job, s) {
  const parts = [];
  if (job.salary?.min) {
    const per = job.salary.period && job.salary.period !== 'year' ? `/${job.salary.period}` : '';
    parts.push(`${job.salary.min.toLocaleString('en')}${job.salary.max && job.salary.max !== job.salary.min ? `–${job.salary.max.toLocaleString('en')}` : ''} ${job.salary.currency}${per}`);
  }
  const c = job.salaryCheck;
  if (c) parts.push(`${c.status === 'meets' ? s.salaryMeets : c.status === 'meets-reduced' ? s.salaryReduced : s.salaryBelow} (${c.route}: ${c.threshold.toLocaleString('en')} ${c.currency})`);
  return parts.join(' — ');
}

export function badges(job, s) {
  const b = [];
  if (job.isNew) b.push(`🆕 ${s.signals.new}`);
  if (job.signals.visa) b.push(`🛂 ${s.signals.visa}`);
  if (job.signals.relocation) b.push(`✈️ ${s.signals.relocation}`);
  if (job.signals.remote) b.push(`🏠 ${s.signals.remote}`);
  if (job.signals.noVisa) b.push(`⛔ ${s.signals.noVisa}`);
  if (job.sponsor) b.push(job.sponsor.listed ? `✅ ${s.sponsorListed}` : `❔ ${s.sponsorNotListed}`);
  return b;
}

const date = (iso) => (iso ? iso.slice(0, 10) : '');
const fence = (text) => `\`\`\`\n${text}\n\`\`\``;

export function toMarkdown(r) {
  const s = t(r.lang);
  const p = r.profile;
  const out = [];
  out.push(`# ${s.title}`, '', `_${new Date(r.generatedAt).toUTCString()} · ${r.ai ? s.aiNote : s.templateNote}_`, '');

  out.push(`## ${s.profile}`, '');
  out.push(`- **${s.headline}:** ${p.headline} (${p.seniority}, ${p.yearsExperience} ${s.years})`);
  out.push(`- **${s.skills}:** ${p.skills.slice(0, 20).join(', ')}`);
  out.push(`- **${s.languages}:** ${(p.languages ?? []).map((l) => `${l.name} ${l.level}`).join(', ') || '—'}`);
  if (p.summary) out.push(`- **${s.summary}:** ${p.summary}`);
  out.push('');

  const st = r.stats;
  out.push(`## ${s.stats}`, '', `${st.total} ${s.total} · ${st.matched} ${s.matched} · ${st.visa} ${s.visa} · ${st.relocation} ${s.relocation} · ${st.freelance} ${s.freelanceCount}${st.newJobs !== null ? ` · ${st.newJobs} ${s.newJobs}` : ''}`, '');

  const g = r.strategy;
  out.push(`## ${s.strategy}`, '', g.overview, '');
  out.push(`### ${s.countries}`, '');
  for (const c of g.countryAdvice) out.push(`- **${c.country}** — ${s.verdict[c.verdict] ?? c.verdict}: ${c.reasoning}`);
  out.push('');
  for (const c of r.countryFit.slice(0, 5)) {
    out.push(`#### ${r.lang === 'fa' ? c.fa : c.name} (${c.score}/100)`);
    if (c.blocked) out.push(`> ⚠️ ${c.blocked}`);
    for (const route of c.routes) out.push(`- [${route.name}](${route.url}) — ${route.summary}`);
    out.push(`- ${s.official}: ${c.official} · ${s.recognition}: [${c.recognition.name}](${c.recognition.url})`, `- ${s.cvStyle}: ${c.cv}`, '');
  }
  for (const [key, items] of [['resumeImprovements', g.resumeImprovements], ['linkedinTips', g.linkedinTips], ['freelanceStrategy', g.freelanceStrategy], ['warnings', g.warnings]]) {
    out.push(`### ${s[key]}`, '', ...items.map((i) => `- ${i}`), '');
  }
  out.push(`### ${s.actionPlan}`, '');
  for (const w of g.actionPlan) out.push(`**${w.week}**`, ...w.tasks.map((x) => `- [ ] ${x}`), '');

  out.push(`## ${s.jobs}`, '');
  if (!r.jobs.length) out.push(s.none, '');
  r.jobs.forEach((j, i) => {
    out.push(`### ${i + 1}. ${j.title} — ${j.company || '?'}`);
    out.push(`${s.score}: **${j.score}/100** · ${j.location || j.countries.map((c) => COUNTRY_NAMES[c]).join(', ')} · ${s.source}: ${j.sourceName}${j.postedAt ? ` · ${s.posted}: ${date(j.postedAt)}` : ''}`);
    const b = badges(j, s);
    if (b.length) out.push(b.join(' · '));
    const sal = salaryText(j, s);
    if (sal) out.push(`${s.salary}: ${sal}`);
    out.push(`🔗 [${s.apply}](${j.url})${j.alsoOn?.length ? ` · ${s.alsoOn}: ${j.alsoOn.map((a) => `[${a.source}](${a.url})`).join(', ')}` : ''}`);
    if (j.matchedSkills.length) out.push(`${s.matchedSkills}: ${j.matchedSkills.join(', ')}`);
    if (j.pitch) {
      const miss = j.pitch.missingKeywords?.length ? j.pitch.missingKeywords : j.missingSkills;
      if (miss.length) out.push(`${s.missing}: ${miss.join(', ')}`);
      if (j.pitch.fitSummary) out.push('', `> ${j.pitch.fitSummary}`);
      out.push('', `**${s.subject}:** ${j.pitch.emailSubject}`, '', `**${s.coverLetter}:**`, fence(j.pitch.coverLetter), '', `**${s.recruiterMessage}:**`, fence(j.pitch.recruiterMessage), '');
      out.push(`**${s.tips}:**`, ...j.pitch.tips.map((x) => `- ${x}`), '', `**${s.interview}:**`, ...j.pitch.interviewQuestions.map((x) => `- ${x}`));
    }
    out.push('');
  });

  out.push(`## ${s.freelance}`, '');
  if (!r.freelance.length) out.push(s.none, '');
  r.freelance.forEach((j, i) => {
    out.push(`### ${i + 1}. ${j.title}`, `${s.score}: **${j.score}/100** · ${j.sourceName}${j.salary ? ` · ${salaryText(j, s)}` : ''}`, `🔗 [${s.apply}](${j.url})`, '', `**${s.proposal}:**`, fence(j.proposal), '');
  });

  if (r.scams.length) {
    out.push(`## ${s.scams}`, '');
    for (const j of r.scams) out.push(`- ${j.title} — ${j.company} (${j.signals.scamFlags.join(', ')}) — ${j.url}`);
    out.push('');
  }

  out.push(`## ${s.links}`, '');
  for (const grp of r.links) {
    const name = grp.group === 'global' ? s.global : grp.group === 'freelance' ? s.freelanceLinks : (r.lang === 'fa' ? r.countryFit.find((c) => c.code === grp.group)?.fa : null) ?? COUNTRY_NAMES[grp.group] ?? grp.group;
    out.push(`**${name}:** ${grp.links.map((l) => `[${l.name}](${l.url})`).join(' · ')}`, '');
  }

  out.push(`## ${s.sources}`, '', ...r.sources.map((x) => `- ${x.name}: ${s.status[x.status] ?? x.status}${x.count ? ` (${x.count})` : ''}${x.note ? ` — ${x.note}` : ''}`), '', `---`, `_${s.footer}_`, '');
  return out.join('\n');
}
