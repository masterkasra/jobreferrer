// Official points systems, implemented from the published grids. Each function
// returns the total plus a per-factor breakdown so the report can explain it.
// Sources (checked September 2026):
//  - Canada CRS: canada.ca → Express Entry → Comprehensive Ranking System criteria
//  - Canada FSW 67 points: canada.ca → Six selection factors (Federal Skilled Worker)
//  - Germany Opportunity Card: make-it-in-germany.com → Opportunity Card points
//  - Australia points test: immi.homeaffairs.gov.au → Points table for Skilled Independent (189)

// ---------------------------------------------------------------- language

const IELTS_TO_CLB = {
  l: [[8.5, 10], [8, 9], [7.5, 8], [6, 7], [5.5, 6], [5, 5], [4.5, 4]],
  r: [[8, 10], [7, 9], [6.5, 8], [6, 7], [5, 6], [4, 5], [3.5, 4]],
  w: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]],
  s: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]],
};

/** IELTS General Training band scores → CLB levels per ability. */
export function ieltsToClb({ l, r, w, s }) {
  const conv = (table, band) => (band == null ? 0 : table.find(([min]) => band >= min)?.[1] ?? 0);
  return { l: conv(IELTS_TO_CLB.l, l), r: conv(IELTS_TO_CLB.r, r), w: conv(IELTS_TO_CLB.w, w), s: conv(IELTS_TO_CLB.s, s) };
}

// Rough IELTS equivalents of CEFR levels; used only when no test score is given (always shown as an estimate).
const CEFR_TO_IELTS = { native: 8.5, C2: 8.5, C1: 7.5, B2: 6.5, B1: 5, A2: 4, A1: 3 };
export const cefrToIelts = (level) => CEFR_TO_IELTS[level] ?? null;
// Rough NCLC (French CLB) equivalents of CEFR levels.
const CEFR_TO_NCLC = { native: 10, C2: 10, C1: 9, B2: 7, B1: 5, A2: 4, A1: 2 };
export const cefrToNclc = (level) => CEFR_TO_NCLC[level] ?? 0;

const minClb = (c) => Math.min(c.l, c.r, c.w, c.s);

// ---------------------------------------------------------------- Canada CRS

const AGE_SINGLE = { 18: 99, 19: 105, 20: 110, 30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77, 36: 72, 37: 66, 38: 61, 39: 55, 40: 50, 41: 39, 42: 28, 43: 17, 44: 6 };
const AGE_SPOUSE = { 18: 90, 19: 95, 20: 100, 30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70, 36: 65, 37: 60, 38: 55, 39: 50, 40: 45, 41: 35, 42: 25, 43: 15, 44: 5 };
function crsAge(age, spouse) {
  if (!age || age < 18 || age >= 45) return 0;
  const t = spouse ? AGE_SPOUSE : AGE_SINGLE;
  return age >= 20 && age <= 29 ? t[20] : t[age];
}

// Education levels used by every calculator.
export const EDUCATION = ['none', 'secondary', 'one-year', 'two-year', 'bachelor', 'two-or-more', 'master', 'phd'];
const CRS_EDU_SINGLE = { none: 0, secondary: 30, 'one-year': 90, 'two-year': 98, bachelor: 120, 'two-or-more': 128, master: 135, phd: 150 };
const CRS_EDU_SPOUSE = { none: 0, secondary: 28, 'one-year': 84, 'two-year': 91, bachelor: 112, 'two-or-more': 119, master: 126, phd: 140 };

function crsFirstLang(clb, spouse) {
  const per = (c) => {
    if (c >= 10) return spouse ? 32 : 34;
    if (c === 9) return spouse ? 29 : 31;
    if (c === 8) return spouse ? 22 : 23;
    if (c === 7) return spouse ? 16 : 17;
    if (c === 6) return spouse ? 8 : 9;
    if (c >= 4) return 6;
    return 0;
  };
  return per(clb.l) + per(clb.r) + per(clb.w) + per(clb.s);
}

function crsSecondLang(clb, spouse) {
  if (!clb) return 0;
  const per = (c) => (c >= 9 ? 6 : c >= 7 ? 3 : c >= 5 ? 1 : 0);
  return Math.min(spouse ? 22 : 24, per(clb.l) + per(clb.r) + per(clb.w) + per(clb.s));
}

const CRS_CAN_WORK_SINGLE = [0, 40, 53, 64, 72, 80];
const CRS_CAN_WORK_SPOUSE = [0, 35, 46, 56, 63, 70];

/**
 * Comprehensive Ranking System score (Express Entry).
 * @param {object} a
 * @param {number} a.age
 * @param {boolean} [a.spouse]            married/common-law partner who comes to Canada
 * @param {string} a.education            one of EDUCATION
 * @param {{l,r,w,s}} a.clb               first official language (CLB per ability)
 * @param {{l,r,w,s}} [a.secondClb]       second official language (NCLC/CLB per ability)
 * @param {number} [a.foreignYears]       skilled work outside Canada, last 10 years
 * @param {number} [a.canadianYears]      skilled work in Canada
 * @param {boolean} [a.provincialNomination]
 * @param {boolean} [a.siblingInCanada]
 * @param {number} [a.frenchNclc]         min NCLC over the four French abilities (for the French bonus)
 */
export function crs(a) {
  const spouse = Boolean(a.spouse);
  const clb = a.clb ?? { l: 0, r: 0, w: 0, s: 0 };
  const parts = {};
  parts.age = crsAge(a.age, spouse);
  parts.education = (spouse ? CRS_EDU_SPOUSE : CRS_EDU_SINGLE)[a.education] ?? 0;
  parts.language = crsFirstLang(clb, spouse);
  parts.secondLanguage = crsSecondLang(a.secondClb, spouse);
  parts.canadianWork = (spouse ? CRS_CAN_WORK_SPOUSE : CRS_CAN_WORK_SINGLE)[Math.min(5, Math.floor(a.canadianYears ?? 0))];

  // Skill transferability (max 100): education + language, foreign work + language (each capped at 50).
  const low = minClb(clb);
  const postSecondary = ['one-year', 'two-year', 'bachelor'].includes(a.education);
  const advanced = ['two-or-more', 'master', 'phd'].includes(a.education);
  let edu = 0;
  if (low >= 9) edu = advanced ? 50 : postSecondary ? 25 : 0;
  else if (low >= 7) edu = advanced ? 25 : postSecondary ? 13 : 0;
  const canYears = Math.floor(a.canadianYears ?? 0);
  if (canYears >= 1 && (advanced || postSecondary)) edu += canYears >= 2 ? (advanced ? 50 : 25) : (advanced ? 25 : 13);
  const fy = Math.floor(a.foreignYears ?? 0);
  let work = 0;
  if (fy >= 1) {
    const three = fy >= 3;
    if (low >= 9) work = three ? 50 : 25;
    else if (low >= 7) work = three ? 25 : 13;
    if (canYears >= 1) work += canYears >= 2 ? (three ? 50 : 25) : (three ? 25 : 13);
  }
  parts.transferability = Math.min(100, Math.min(50, edu) + Math.min(50, work));

  let extra = 0;
  if (a.provincialNomination) extra += 600;
  if (a.siblingInCanada) extra += 15;
  if ((a.frenchNclc ?? 0) >= 7) extra += low >= 5 ? 50 : 25;
  parts.additional = Math.min(600, extra);

  const total = Object.values(parts).reduce((s, n) => s + n, 0);
  return { total: Math.min(1200, total), parts };
}

// ---------------------------------------------------------------- Canada FSW 67-point grid

const FSW_EDU = { none: 0, secondary: 5, 'one-year': 15, 'two-year': 19, bachelor: 21, 'two-or-more': 22, master: 23, phd: 25 };

/** Federal Skilled Worker eligibility grid: 67 of 100 points needed, plus CLB 7 in every ability. */
export function fsw67(a) {
  const clb = a.clb ?? { l: 0, r: 0, w: 0, s: 0 };
  const per = (c) => (c >= 9 ? 6 : c === 8 ? 5 : c === 7 ? 4 : 0);
  const parts = {};
  parts.language = per(clb.l) + per(clb.r) + per(clb.w) + per(clb.s);
  parts.secondLanguage = a.secondClb && minClb(a.secondClb) >= 5 ? 4 : 0;
  parts.education = FSW_EDU[a.education] ?? 0;
  const y = Math.floor(a.foreignYears ?? 0);
  parts.experience = y >= 6 ? 15 : y >= 4 ? 13 : y >= 2 ? 11 : y >= 1 ? 9 : 0;
  const age = a.age ?? 0;
  parts.age = age >= 18 && age <= 35 ? 12 : age > 35 && age < 47 ? 12 - (age - 35) : 0;
  parts.arrangedEmployment = a.jobOffer ? 10 : 0;
  parts.adaptability = Math.min(10, (a.spouseEnglishClb4 ? 5 : 0) + (a.jobOffer ? 5 : 0) + (a.relativeInCanada ? 5 : 0));
  const total = Object.values(parts).reduce((s, n) => s + n, 0);
  const languageOk = minClb(clb) >= 7;
  return { total, parts, pass: total >= 67 && languageOk && y >= 1, languageOk, experienceOk: y >= 1 };
}

// ---------------------------------------------------------------- Germany Opportunity Card

const GERMAN_POINTS = { A2: 1, B1: 2, B2: 3, C1: 3, C2: 3, native: 3 };

/**
 * Chancenkarte. People whose degree is fully recognised in Germany qualify without points;
 * everyone else needs a recognised-at-home qualification, German A1 or English B2, and 6 points.
 */
export function chancenkarte(a) {
  const parts = {
    partialRecognition: a.partialRecognition ? 4 : 0,
    experience: a.years >= 5 ? 3 : a.years >= 2 ? 2 : 0,
    shortageOccupation: a.shortageOccupation ? 1 : 0,
    german: GERMAN_POINTS[a.german] ?? 0,
    english: ['C1', 'C2', 'native'].includes(a.english) ? 1 : 0,
    age: a.age && a.age < 35 ? 2 : a.age && a.age <= 40 ? 1 : 0,
    stayInGermany: a.stayInGermany ? 1 : 0,
    partner: a.partnerEligible ? 1 : 0,
  };
  const points = Object.values(parts).reduce((s, n) => s + n, 0);
  const languageBase = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'].includes(a.german) || ['B2', 'C1', 'C2', 'native'].includes(a.english);
  const hasQualification = ['two-year', 'bachelor', 'two-or-more', 'master', 'phd'].includes(a.education) || a.vocational;
  return {
    points,
    parts,
    languageBase,
    hasQualification,
    // A university degree from an institution rated H+ in anabin (or a ZAB statement) counts as recognised.
    viaRecognition: ['bachelor', 'two-or-more', 'master', 'phd'].includes(a.education),
    eligibleByPoints: hasQualification && languageBase && points >= 6,
  };
}

// ---------------------------------------------------------------- Australia points test (189/190/491)

export function australiaPoints(a) {
  const age = a.age ?? 0;
  const ielts = a.ieltsMin ?? 0;
  const parts = {
    age: age >= 18 && age < 25 ? 25 : age >= 25 && age < 33 ? 30 : age >= 33 && age < 40 ? 25 : age >= 40 && age < 45 ? 15 : 0,
    english: ielts >= 8 ? 20 : ielts >= 7 ? 10 : 0,
    // Skills assessors (e.g. ACS for ICT) usually discount the first 2 years of experience.
    experience: (() => { const y = Math.max(0, (a.years ?? 0) - (a.assessmentDeduction ?? 0)); return y >= 8 ? 15 : y >= 5 ? 10 : y >= 3 ? 5 : 0; })(),
    education: a.education === 'phd' ? 20 : ['bachelor', 'two-or-more', 'master'].includes(a.education) ? 15 : ['one-year', 'two-year'].includes(a.education) ? 10 : 0,
    partner: a.single ? 10 : a.partnerSkilled ? 10 : a.partnerEnglish ? 5 : 0,
    nomination: a.nomination === 190 ? 5 : a.nomination === 491 ? 15 : 0,
  };
  const points = Object.values(parts).reduce((s, n) => s + n, 0);
  return { points, parts, ageOk: age >= 18 && age < 45, englishOk: ielts >= 6, pass: points >= 65 && age < 45 && ielts >= 6 };
}
