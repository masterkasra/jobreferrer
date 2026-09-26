// Offline resume parser. Good enough to drive the search when no AI key is
// configured; the Claude parser (src/llm/claude.js) replaces it when one is.

import { findSkills, ROLE_FAMILIES, LANGUAGES, aliasRegex } from './taxonomy.js';

const DEGREES = [
  ['phd', /\b(ph\.?\s?d|doctorate|doctor of philosophy|دکتری|دکترا)\b/i],
  ['master', /\b(master'?s?|m\.?\s?sc|msc|m\.?\s?eng|mba|m\.?\s?a\.?|ma|کارشناسی ارشد)\b/i],
  ['bachelor', /\b(bachelor'?s?|b\.?\s?sc|bsc|b\.?\s?eng|b\.?\s?a\.?|b\.?\s?tech|licen[cs]e|کارشناسی)\b/i],
  ['diploma', /\b(diploma|associate degree|کاردانی|دیپلم)\b/i],
];

const LEVELS = [
  ['native', /native|mother tongue|زبان مادری/i],
  ['C2', /\bc2\b|proficient|fluent|full professional/i],
  ['C1', /\bc1\b|advanced|ielts\s*(7|8|9)|toefl\s*(1[01]\d|120)/i],
  ['B2', /\bb2\b|upper[- ]intermediate|ielts\s*6(\.5)?/i],
  ['B1', /\bb1\b|intermediate/i],
  ['A2', /\ba2\b|elementary/i],
  ['A1', /\ba1\b|beginner|basic/i],
];

export function heuristicProfile(text = '') {
  const lower = text.toLowerCase();
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const skills = findSkills(text);
  const family = detectFamily(lower, skills);
  const years = detectYears(text);
  const titles = detectTitles(lower, family);
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
    links: [...new Set(text.match(/https?:\/\/[^\s)>\]]+|(?:linkedin|github)\.com\/[^\s)>\]]+/gi) ?? [])].slice(0, 6),
    summary: '',
    strengths: achievements(lines),
    searchQueries: buildQueries(uniqueTitles, family, skills),
    freelanceServices: ROLE_FAMILIES[family].freelance,
    source: 'heuristic',
  };
}

// The job title people put under their name ("Senior Full Stack Developer").
const TITLE_WORD = /\b(developer|engineer|designer|scientist|analyst|manager|architect|administrator|consultant|specialist|accountant|nurse|teacher|translator|writer|marketer|owner|lead|programmer|tester)\b/i;
function explicitTitle(lines) {
  const line = lines.slice(0, 6).find((l) => TITLE_WORD.test(l) && l.length <= 60 && !/@|http|\d{4}/.test(l));
  return line ? line.replace(/^(senior|sr\.?|lead|principal|staff|junior|jr\.?|mid-level)\s+/i, '').replace(/\s*[|,–—-].*$/, '').trim() : '';
}

// Bullet points with numbers ("cut load time by 45%") are the best selling points.
function achievements(lines) {
  return lines
    .filter((l) => /^[•*▪◦-]\s*/.test(l) && /\d/.test(l) && l.length > 25)
    .map((l) => l.replace(/^[•*▪◦-]\s*/, '').replace(/\.$/, ''))
    .sort((a, b) => Number(/%|\bx\b|k\b|million|users|orders/i.test(b)) - Number(/%|\bx\b|k\b|million|users|orders/i.test(a)))
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

function detectTitles(lower, family) {
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
  return titles.length ? titles.slice(0, 4) : ROLE_FAMILIES[family].queries.slice(0, 2);
}

export function detectYears(text) {
  const explicit = [...text.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs?|سال)/gi)].map((m) => Number(m[1])).filter((n) => n < 45);
  if (explicit.length) return Math.max(...explicit);
  // Fall back to the span of years mentioned in date ranges like "2016 - Present".
  const now = new Date().getFullYear();
  const ranges = [...text.matchAll(/((?:19|20)\d{2})\s*(?:-|–|—|to|تا)\s*((?:19|20)\d{2}|present|now|current|today|اکنون|تاکنون)/gi)];
  if (!ranges.length) return 0;
  const starts = ranges.map((m) => Number(m[1]));
  const ends = ranges.map((m) => (/^\d+$/.test(m[2]) ? Number(m[2]) : now));
  return Math.max(0, Math.min(40, Math.max(...ends) - Math.min(...starts)));
}

function seniorityFor(years, lower) {
  if (/\b(lead|principal|staff|head of|architect)\b/.test(lower) && years >= 6) return 'lead';
  if (years >= 5 || /\bsenior\b/.test(lower)) return 'senior';
  if (years >= 2) return 'mid';
  return 'junior';
}

function detectLanguages(text) {
  const out = [];
  for (const [name, aliases] of Object.entries(LANGUAGES)) {
    for (const alias of aliases) {
      const re = aliasRegex(alias);
      const line = text.split(/\n/).find((l) => re.test(l.toLowerCase()));
      if (!line) continue;
      // Only look at text right after the language name so "English C1, German A2" parses per language.
      const idx = line.toLowerCase().search(re);
      const tail = line.slice(idx, idx + alias.length + 30);
      const level = LEVELS.find(([, r]) => r.test(tail))?.[0] ?? (/ielts|toefl/i.test(line) && name === 'English' ? 'B2' : 'unknown');
      out.push({ name, level });
      break;
    }
  }
  return out;
}

function guessName(lines) {
  const first = lines.slice(0, 4).find((l) => /^[\p{L} .'-]{3,40}$/u.test(l) && l.split(/\s+/).length <= 4 && !/resume|cv|curriculum|رزومه/i.test(l));
  return first ?? '';
}

function guessLocation(text) {
  const m = text.match(/(?:location|address|based in|city|محل سکونت|آدرس)\s*[:\-]?\s*([^\n|]{2,40})/i);
  if (m) return m[1].trim();
  const city = text.match(/\b(Tehran|Isfahan|Shiraz|Mashhad|Tabriz|Karaj|Istanbul|Dubai|Yerevan|Tbilisi)\b/i);
  return city ? city[1] : '';
}

function buildQueries(titles, family, skills) {
  const q = titles.filter((t) => t.split(' ').length > 1).slice(0, 2);
  for (const fq of ROLE_FAMILIES[family].queries) if (q.length < 3 && !q.includes(fq)) q.push(fq);
  // A skill-led query catches roles whose title we didn't anticipate.
  const lead = skills.find((s) => ROLE_FAMILIES[family].skills.includes(s));
  if (lead) q.push(`${lead} ${family === 'data' ? 'engineer' : 'developer'}`.replace('Machine Learning developer', 'machine learning engineer'));
  return [...new Set(q.map((s) => s.toLowerCase()))].slice(0, 4);
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
