// Offline resume parser. Good enough to drive the search when no AI key is
// configured; the Claude parser (src/llm/claude.js) replaces it when one is.
// Handles English and Persian resumes (text is normalised in src/resume/extract.js:
// Persian digits → ASCII, ي/ك → ی/ک, ZWNJ → space).

import { findSkills, ROLE_FAMILIES, LANGUAGES, aliasRegex } from './taxonomy.js';
import { normalizeText } from '../resume/extract.js';

// \b does not work next to Persian letters, so Persian terms use their own patterns.
const DEGREES = [
  ['phd', /\b(ph\.?\s?d|doctorate|doctor of philosophy)\b|دکتری|دکترا/i],
  ['master', /\b(master'?s?|m\.?\s?sc|msc|m\.?\s?eng|mba|m\.?\s?a\.?)\b|کارشناسی ارشد|فوق لیسانس/i],
  ['bachelor', /\b(bachelor'?s?|b\.?\s?sc|bsc|b\.?\s?eng|b\.?\s?a\.?|b\.?\s?tech|licen[cs]e)\b|کارشناسی|لیسانس/i],
  ['diploma', /\b(diploma|associate degree)\b|کاردانی|فوق دیپلم|دیپلم/i],
];

const LEVELS = [
  ['native', /native|mother tongue|زبان مادری|بومی/i],
  ['C2', /\bc2\b|proficient|fluent|full professional|مسلط|روان/i],
  ['C1', /\bc1\b|advanced|(ielts|آیلتس)\s*(7|8|9)|(toefl|تافل)\s*(1[01]\d|120)|پیشرفته|عالی/i],
  ['B2', /\bb2\b|upper[- ]intermediate|(ielts|آیلتس)\s*6(\.5)?|خوب/i],
  ['B1', /\bb1\b|intermediate|متوسط/i],
  ['A2', /\ba2\b|elementary/i],
  ['A1', /\ba1\b|beginner|basic|مبتدی|آشنایی/i],
];

// Persian job titles → English search title + role family. Longest phrases first.
const FA_TITLES = [
  ['توسعه دهنده فرانت اند', 'frontend developer', 'software'],
  ['برنامه نویس فرانت اند', 'frontend developer', 'software'],
  ['توسعه دهنده بک اند', 'backend developer', 'software'],
  ['برنامه نویس بک اند', 'backend developer', 'software'],
  ['فول استک', 'full stack developer', 'software'],
  ['توسعه دهنده موبایل', 'mobile developer', 'software'],
  ['برنامه نویس اندروید', 'android developer', 'software'],
  ['مهندس نرم افزار', 'software engineer', 'software'],
  ['توسعه دهنده وب', 'web developer', 'software'],
  ['برنامه نویس وب', 'web developer', 'software'],
  ['مهندس یادگیری ماشین', 'machine learning engineer', 'data'],
  ['دانشمند داده', 'data scientist', 'data'],
  ['مهندس داده', 'data engineer', 'data'],
  ['تحلیلگر داده', 'data analyst', 'data'],
  ['تحلیل گر داده', 'data analyst', 'data'],
  ['کارشناس هوش تجاری', 'bi analyst', 'data'],
  ['مهندس دواپس', 'devops engineer', 'devops'],
  ['مدیر سیستم', 'system administrator', 'devops'],
  ['کارشناس شبکه', 'network engineer', 'devops'],
  ['کارشناس امنیت', 'security analyst', 'security'],
  ['متخصص امنیت', 'security engineer', 'security'],
  ['تست نرم افزار', 'qa engineer', 'qa'],
  ['طراح رابط کاربری', 'ui/ux designer', 'design'],
  ['طراح تجربه کاربری', 'ux designer', 'design'],
  ['طراح محصول', 'product designer', 'design'],
  ['طراح گرافیک', 'graphic designer', 'design'],
  ['مدیر محصول', 'product manager', 'product'],
  ['مالک محصول', 'product owner', 'product'],
  ['مدیر پروژه', 'project manager', 'product'],
  ['کارشناس سئو', 'seo specialist', 'marketing'],
  ['بازاریابی دیجیتال', 'digital marketing specialist', 'marketing'],
  ['تولید محتوا', 'content writer', 'marketing'],
  ['تحلیلگر مالی', 'financial analyst', 'finance'],
  ['حسابدار', 'accountant', 'finance'],
  ['مهندس برق', 'electrical engineer', 'engineering'],
  ['مهندس مکانیک', 'mechanical engineer', 'engineering'],
  ['مهندس عمران', 'civil engineer', 'engineering'],
  ['مهندس شیمی', 'chemical engineer', 'engineering'],
  ['مهندس صنایع', 'industrial engineer', 'engineering'],
  ['مهندس کنترل', 'automation engineer', 'engineering'],
  ['پرستار', 'registered nurse', 'healthcare'],
  ['پزشک', 'physician', 'healthcare'],
  ['داروساز', 'pharmacist', 'healthcare'],
  ['فیزیوتراپیست', 'physiotherapist', 'healthcare'],
  ['مترجم', 'translator', 'education'],
  ['مدرس', 'teacher', 'education'],
  ['معلم', 'teacher', 'education'],
  ['کارشناس فروش', 'sales representative', 'sales'],
  ['پشتیبانی مشتری', 'customer support specialist', 'sales'],
  ['برنامه نویس', 'software developer', 'software'],
  ['توسعه دهنده', 'software developer', 'software'],
];

const FA_LANGUAGES = {
  English: ['انگلیسی'], German: ['آلمانی'], French: ['فرانسوی', 'فرانسه'], Dutch: ['هلندی'], Spanish: ['اسپانیایی'],
  Italian: ['ایتالیایی'], Swedish: ['سوئدی'], Turkish: ['ترکی'], Arabic: ['عربی'], Russian: ['روسی'], Persian: ['فارسی'],
};

const FA_CITIES = { تهران: 'Tehran', اصفهان: 'Isfahan', شیراز: 'Shiraz', مشهد: 'Mashhad', تبریز: 'Tabriz', کرج: 'Karaj', اهواز: 'Ahvaz', قم: 'Qom', رشت: 'Rasht', کرمان: 'Kerman' };

export function heuristicProfile(input = '') {
  const text = normalizeText(input);
  const lower = text.toLowerCase();
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const skills = findSkills(text);
  const faTitles = persianTitles(text);
  const family = faTitles[0]?.family ?? detectFamily(lower, skills);
  const years = detectYears(text);
  const titles = [...faTitles.map((t) => t.title), ...detectTitles(lower, family, faTitles.length > 0)];
  const explicit = explicitTitle(lines);
  if (explicit) titles.unshift(explicit.toLowerCase());
  const uniqueTitles = [...new Set(titles)].filter((t, _, all) => !all.some((o) => o !== t && o.includes(t)));

  return {
    name: guessName(lines),
    email: text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? '',
    phone: text.match(/\+?\d[\d\s()-]{8,}\d/)?.[0]?.trim() ?? '',
    location: guessLocation(text),
    headline: uniqueTitles[0] ? titleCase(uniqueTitles[0]) : ROLE_FAMILIES[family].label,
    roleFamily: family,
    titles: uniqueTitles.slice(0, 4).map(titleCase),
    seniority: seniorityFor(years, lower),
    yearsExperience: years,
    skills,
    languages: detectLanguages(text),
    highestDegree: DEGREES.find(([, re]) => re.test(text))?.[0] ?? 'unknown',
    age: detectAge(text),
    maritalStatus: /(marital status|وضعیت تا[هه]ل)\s*[:\-]?\s*(married|متا[هه]ل)/i.test(text) ? 'married' : /(marital status|وضعیت تا[هه]ل)\s*[:\-]?\s*(single|مجرد)/i.test(text) ? 'single' : 'unknown',
    militaryService: detectMilitary(text),
    links: [...new Set(text.match(/https?:\/\/[^\s)>\]]+|(?:linkedin|github)\.com\/[^\s)>\]]+/gi) ?? [])].slice(0, 6),
    summary: '',
    strengths: achievements(lines),
    searchQueries: buildQueries(uniqueTitles, family, skills),
    freelanceServices: ROLE_FAMILIES[family].freelance,
    source: 'heuristic',
  };
}

// Age from "Date of birth: 1992", "Born 14/03/1990", "تاریخ تولد: ۱۳۷۰" or "Age: 32" (Jalali years are converted).
export function detectAge(text) {
  const now = new Date().getFullYear();
  const direct = text.match(/(?:\bage|سن)\s*[:\-]?\s*(\d{2})\b/i);
  if (direct && Number(direct[1]) >= 16 && Number(direct[1]) <= 70) return Number(direct[1]);
  const m = text.match(/(?:date of birth|birth ?date|\bdob|\bborn(?: on| in)?|تاریخ تولد|متولد|سال تولد)\s*[:\-]?\s*(?:\d{1,2}[./-]\d{1,2}[./-])?((?:19|20|13)\d{2})/i);
  if (!m) return null;
  const year = toGregorian(Number(m[1]));
  const age = now - year;
  return age >= 16 && age <= 70 ? age : null;
}

function detectMilitary(text) {
  if (/پایان خدمت|military service\s*[:\-]?\s*(completed|done|finished)/i.test(text)) return 'done';
  if (/معافیت|معاف (دائم|تحصیلی)?|military service\s*[:\-]?\s*exempt/i.test(text)) return 'exempt';
  return 'unknown';
}

function persianTitles(text) {
  const found = [];
  for (const [fa, title, family] of FA_TITLES) {
    const idx = text.indexOf(fa);
    if (idx >= 0 && !found.some((f) => f.title === title)) found.push({ title, family, idx });
  }
  // "برنامه نویس" / "توسعه دهنده" are generic: drop them when a specific title is present.
  const specific = found.filter((f) => f.title !== 'software developer');
  return (specific.length ? specific : found).sort((a, b) => a.idx - b.idx);
}

// The job title people put under their name ("Senior Full Stack Developer").
const TITLE_WORD = /\b(developer|engineer|designer|scientist|analyst|manager|architect|administrator|consultant|specialist|accountant|nurse|teacher|translator|writer|marketer|owner|lead|programmer|tester)\b/i;
function explicitTitle(lines) {
  const line = lines.slice(0, 6).find((l) => TITLE_WORD.test(l) && l.length <= 60 && !/@|http|\d{4}/.test(l));
  return line ? line.replace(/^(senior|sr\.?|lead|principal|staff|junior|jr\.?|mid-level)\s+/i, '').replace(/\s*[|,–—-].*$/, '').trim() : '';
}

const ACTION_VERB = /^(built|led|migrated|introduced|reduced|increased|improved|designed|developed|created|launched|managed|delivered|cut|grew|implemented|automated|optimi[sz]ed|mentored|scaled|shipped|owned|drove|saved|طراحی|ساخت|مهاجرت|کاهش|افزایش|راه اندازی|توسعه|پیاده سازی|مدیریت)/i;

// Bullet points with numbers ("cut load time by 45%") are the best selling points.
function achievements(lines) {
  return lines
    .filter((l) => (/^[•*▪◦-]\s*/.test(l) || ACTION_VERB.test(l)) && /\d/.test(l) && l.length > 25 && l.length < 220)
    .map((l) => l.replace(/^[•*▪◦-]\s*/, '').replace(/\.$/, ''))
    .sort((a, b) => Number(/%|٪|\bx\b|k\b|million|میلیون|users|orders/i.test(b)) - Number(/%|٪|\bx\b|k\b|million|میلیون|users|orders/i.test(a)))
    .slice(0, 5);
}

function detectFamily(lower, skills) {
  let best = 'software';
  let bestScore = 0;
  for (const [key, fam] of Object.entries(ROLE_FAMILIES)) {
    let score = 0;
    for (const kw of fam.keywords) if (aliasRegex(kw).test(lower)) score += 3;
    for (const s of fam.skills) if (skills.includes(s)) score += 1;
    if (score > bestScore) [best, bestScore] = [key, score];
  }
  return best;
}

function detectTitles(lower, family, haveOthers = false) {
  const found = [];
  for (const fam of Object.values(ROLE_FAMILIES)) {
    for (const kw of fam.keywords) {
      const re = new RegExp(`((?:senior|lead|principal|staff|junior|mid-level)\\s+)?${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const m = lower.match(re);
      if (m) found.push({ title: m[0].trim(), index: m.index });
    }
  }
  found.sort((a, b) => a.index - b.index);
  const titles = [...new Set(found.map((f) => f.title.replace(/^(senior|lead|principal|staff|junior|mid-level)\s+/, '')))];
  if (titles.length || haveOthers) return titles.slice(0, 4);
  return ROLE_FAMILIES[family].queries.slice(0, 2);
}

// Jalali (Persian calendar) years such as 1399 are converted to Gregorian.
const toGregorian = (y) => (y >= 1300 && y <= 1450 ? y + 621 : y);

export function detectYears(input) {
  const text = normalizeText(input);
  const explicit = [...text.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs?|سال)/gi)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 45);
  if (explicit.length) return Math.max(...explicit);
  // Fall back to the span of years mentioned in date ranges like "2016 - Present" or "1398 تا اکنون".
  const now = new Date().getFullYear();
  const ranges = [...text.matchAll(/((?:19|20|13|14)\d{2})\s*(?:-|–|—|to|تا)\s*((?:19|20|13|14)\d{2}|present|now|current|today|اکنون|تاکنون|کنون|حال)/gi)];
  if (!ranges.length) return 0;
  const starts = ranges.map((m) => toGregorian(Number(m[1])));
  const ends = ranges.map((m) => (/^\d+$/.test(m[2]) ? toGregorian(Number(m[2])) : now));
  return Math.max(0, Math.min(40, Math.max(...ends) - Math.min(...starts)));
}

function seniorityFor(years, lower) {
  if (/\b(lead|principal|staff|head of|architect)\b|سرپرست|مدیر فنی|معمار/.test(lower) && years >= 6) return 'lead';
  if (years >= 5 || /\bsenior\b|ارشد/.test(lower)) return 'senior';
  if (years >= 2) return 'mid';
  return 'junior';
}

function detectLanguages(text) {
  const out = [];
  const lines = text.split(/\n/);
  for (const [name, aliases] of Object.entries(LANGUAGES)) {
    for (const alias of [...aliases, ...(FA_LANGUAGES[name] ?? [])]) {
      const persian = /[؀-ۿ]/.test(alias);
      const re = persian ? new RegExp(alias) : aliasRegex(alias);
      const line = lines.find((l) => re.test(persian ? l : l.toLowerCase()));
      if (!line) continue;
      // Only look at text right after the language name so "English C1, German A2" parses per language.
      const idx = (persian ? line : line.toLowerCase()).search(re);
      const tail = line.slice(idx + alias.length).split(/[,،;]/)[0].slice(0, 30);
      const level = LEVELS.find(([, r]) => r.test(tail))?.[0] ?? (/ielts|toefl|آیلتس|تافل/i.test(line) && name === 'English' ? 'B2' : 'unknown');
      out.push({ name, level });
      break;
    }
  }
  return out;
}

function guessName(lines) {
  const first = lines.slice(0, 4).find((l) => /^[\p{L} .'-]{3,40}$/u.test(l) && l.split(/\s+/).length <= 4 && !/resume|cv|curriculum|رزومه|سوابق|خلاصه/i.test(l) && !FA_TITLES.some(([fa]) => l.includes(fa)) && !TITLE_WORD.test(l));
  return first ?? '';
}

function guessLocation(text) {
  const m = text.match(/(?:location|address|based in|city|محل سکونت|آدرس|شهر)\s*[:\-]?\s*([^\n|·]{2,40})/i);
  if (m) return m[1].trim();
  const city = text.match(/\b(Tehran|Isfahan|Shiraz|Mashhad|Tabriz|Karaj|Istanbul|Dubai|Yerevan|Tbilisi)\b/i);
  if (city) return city[1];
  const fa = Object.keys(FA_CITIES).find((c) => text.includes(c));
  return fa ? FA_CITIES[fa] : '';
}

const LEAD_SKILL_SUFFIX = { software: 'developer', data: 'data engineer', devops: 'engineer', qa: 'test engineer' };
const WEAK_LEAD = new Set(['SQL', 'Excel', 'Statistics', 'Data Analysis', 'Git', 'HTML', 'CSS']);

function buildQueries(titles, family, skills) {
  const q = titles.filter((t) => t.split(' ').length > 1).slice(0, 2);
  for (const fq of ROLE_FAMILIES[family].queries) if (q.length < 3 && !q.includes(fq)) q.push(fq);
  // A skill-led query catches roles whose title we didn't anticipate.
  const lead = skills.find((s) => ROLE_FAMILIES[family].skills.includes(s) && !WEAK_LEAD.has(s));
  if (lead && LEAD_SKILL_SUFFIX[family]) q.push(`${lead} ${LEAD_SKILL_SUFFIX[family]}`.replace('Machine Learning data engineer', 'machine learning engineer'));
  return [...new Set(q.map((s) => s.toLowerCase()))].slice(0, 4);
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bUi\/Ux\b/, 'UI/UX').replace(/\bQa\b/, 'QA').replace(/\bBi\b/, 'BI').replace(/\bSeo\b/, 'SEO');
