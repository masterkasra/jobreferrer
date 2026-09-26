// Offline application material. Used when no Claude key is configured and as a
// safety net if the AI call fails. Pitches are English (the language of most
// international job ads); advice follows the report language.

import { COUNTRY_NAMES } from '../jobs/geo.js';
import { COUNTRIES } from '../immigration/countries.js';
import { salaryCheck } from '../immigration/advisor.js';

const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const firstName = (name) => (name || '').split(/\s+/)[0] || '';

export function templatePitch(job, profile, lang = 'fa') {
  const skills = (job.matchedSkills.length ? job.matchedSkills : profile.skills).slice(0, 3);
  const years = profile.yearsExperience ? `${profile.yearsExperience}+ years` : 'hands-on experience';
  const where = job.countries[0] ? COUNTRY_NAMES[job.countries[0]] : '';
  const route = job.countries[0] && COUNTRIES[job.countries[0]]?.routes[0]?.name;
  const company = job.company || 'your team';
  const mobility = job.signals.remote
    ? `I work fully remotely across time zones and I'm also open to relocating${where ? ` to ${where}` : ''} if the role requires it.`
    : `I'm ready to relocate${where ? ` to ${where}` : ''} and would need visa sponsorship${route ? ` (the ${route} route fits this role)` : ''}. I can start the paperwork immediately and I'm flexible on the start date.`;
  const strengths = (profile.strengths?.length ? profile.strengths : skills.map((s) => `Production experience with ${s}`)).slice(0, 2);

  const coverLetter = [
    `Dear ${company} hiring team,`,
    '',
    `I'm applying for the ${job.title} position. I'm a ${profile.seniority} ${profile.headline} with ${years} working with ${list(skills)}, which matches the core of what you're looking for.`,
    '',
    'What I would bring:',
    ...strengths.map((s) => `• ${s}`),
    ...(job.matchedSkills.length > 3 ? [`• Also comfortable with ${list(job.matchedSkills.slice(3, 6))}`] : []),
    '',
    mobility,
    '',
    "I'd welcome a short call to discuss how I can help your team. Thank you for your time.",
    '',
    'Best regards,',
    profile.name || '[Your name]',
    [profile.email, ...(profile.links ?? []).slice(0, 2)].filter(Boolean).join(' | '),
  ].join('\n');

  const recruiterMessage = `Hi! I'm a ${profile.headline} (${years}, ${skills.slice(0, 2).join(', ')}) and very interested in the ${job.title} role at ${company}. ${job.signals.remote ? 'Available to start soon.' : `Open to relocating${where ? ` to ${where}` : ''} with sponsorship.`} Could we have a quick chat?`.slice(0, 300);

  return {
    id: job.id,
    fitSummary: '',
    coverLetter,
    recruiterMessage,
    emailSubject: `${job.title} — ${profile.name || firstName(profile.name) || 'Application'} (${years}, ${job.signals.remote ? 'remote' : 'open to relocation'})`,
    missingKeywords: job.missingSkills.slice(0, 6),
    tips: templateTips(job, profile, lang),
    interviewQuestions: interviewQuestions(profile.roleFamily),
    source: 'template',
  };
}

export function templateTips(job, profile, lang = 'fa') {
  const fa = lang === 'fa';
  const tips = [];
  const fresh = job.postedAt && Date.now() - new Date(job.postedAt).getTime() < 3 * 864e5;
  if (fresh) tips.push(fa ? 'این آگهی تازه است؛ ظرف ۲۴–۴۸ ساعت اپلای کنید، شانس دیده شدن خیلی بیشتر است.' : 'This ad is fresh: apply within 24–48 hours to be seen early.');
  if (job.missingSkills.length) tips.push(fa ? `اگر با ${job.missingSkills.slice(0, 3).join('، ')} کار کرده‌اید، صریحاً در رزومه بیاورید؛ این کلیدواژه‌ها را ATS بررسی می‌کند.` : `If you have used ${job.missingSkills.slice(0, 3).join(', ')}, say so explicitly in your resume: ATS filters look for these keywords.`);
  if (job.missingLanguages?.length) tips.push(fa ? `آگهی ${job.missingLanguages.join('، ')} می‌خواهد؛ سطح فعلی و برنامه یادگیری‌تان را در نامه بنویسید.` : `The ad asks for ${job.missingLanguages.join(', ')}: state your current level and learning plan in the letter.`);
  const sal = salaryCheck(job);
  if (sal?.status === 'below') tips.push(fa ? `حقوق اعلام‌شده (${sal.offered.toLocaleString()} ${sal.currency}) از حداقل ویزای ${sal.route} (${sal.threshold.toLocaleString()}) کمتر است؛ در مذاکره به این حد برسانید.` : `The advertised salary (${sal.offered.toLocaleString()} ${sal.currency}) is below the ${sal.route} threshold (${sal.threshold.toLocaleString()}): negotiate up to it.`);
  if (job.sponsor && !job.sponsor.listed) tips.push(fa ? `این شرکت در فهرست رسمی اسپانسرهای ${job.sponsor.register} پیدا نشد؛ قبل از وقت گذاشتن از ریکروتر بپرسید که اسپانسر ویزا می‌شوند یا نه.` : `Employer not found on the ${job.sponsor.register} sponsor register: ask the recruiter to confirm sponsorship before investing time.`);
  if (job.sponsor?.listed) tips.push(fa ? `این شرکت در فهرست رسمی اسپانسرهای ${job.sponsor.register} ثبت شده است؛ این را در پیام به ریکروتر ذکر کنید.` : `Employer is on the ${job.sponsor.register} sponsor register: mention that you need the standard sponsorship.`);
  tips.push(fa ? 'در لینکدین مدیر استخدام یا یکی از اعضای تیم را پیدا کنید و پیام کوتاه بالا را برایش بفرستید؛ معرفی داخلی (referral) شانس مصاحبه را چند برابر می‌کند.' : 'Find the hiring manager or a team member on LinkedIn and send the short message above: referrals multiply interview chances.');
  if (!job.signals.visa && !job.signals.relocation && !job.signals.remote && job.kind === 'job') tips.push(fa ? 'آگهی درباره ویزا چیزی نگفته؛ در اولین تماس محترمانه بپرسید که امکان اسپانسرشیپ وجود دارد یا نه.' : 'The ad does not mention visas: ask politely about sponsorship in the first contact.');
  return tips.slice(0, 5);
}

const QUESTIONS = {
  software: ['Walk us through a system you designed: what trade-offs did you make?', 'How do you debug a production issue you cannot reproduce locally?', 'Tell us about a time you improved performance or reliability measurably.'],
  data: ['How do you validate a model before it goes to production?', 'Describe a data pipeline you built end to end.', 'How would you explain a complex result to non-technical stakeholders?'],
  devops: ['How would you design zero-downtime deployments for this stack?', 'Tell us about an incident you handled and what you changed afterwards.', 'How do you control cloud costs?'],
  default: ['Why do you want to move to this country and this company?', 'Tell us about your biggest professional achievement.', 'How do you handle disagreements within a team?'],
};
export const interviewQuestions = (family) => [...(QUESTIONS[family] ?? QUESTIONS.default).slice(0, 2), 'Why do you want to relocate, and what is your timeline?'];

export function freelanceProposal(job, profile) {
  const skills = (job.matchedSkills.length ? job.matchedSkills : profile.skills).slice(0, 3);
  return [
    `Hi, I read your project "${job.title}" and it's a strong match for my background: ${profile.yearsExperience || 'several'} years with ${list(skills)}.`,
    '',
    'How I would approach it:',
    '1. A short call to confirm scope, deadline and acceptance criteria.',
    '2. Deliver a first working milestone quickly so you can give feedback early.',
    '3. Finish, test and hand over with clear documentation.',
    '',
    `Relevant work: ${(profile.strengths ?? []).slice(0, 2).join('; ') || 'portfolio available on request'}.`,
    'I can start right away. Happy to answer any questions.',
  ].join('\n');
}
