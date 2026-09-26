// Personal immigration assessment, the way an immigration adviser would do a
// first consultation: establish the facts, run the official points systems,
// rate every route in the target countries, then list documents, costs,
// timelines and a 90-day plan. It is guidance, not legal advice: every item
// links to the official source and the report says so.

import { COUNTRIES } from './countries.js';
import { ieltsToClb, cefrToIelts, cefrToNclc, crs, fsw67, chancenkarte, australiaPoints } from './calculators.js';

const DEGREE_TO_EDU = { phd: 'phd', master: 'master', bachelor: 'bachelor', diploma: 'two-year' };
const TECH = ['software', 'data', 'devops', 'security', 'qa'];
const CEFR_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, native: 7 };
const atLeast = (level, min) => (CEFR_RANK[level] ?? 0) >= CEFR_RANK[min];

/**
 * Merge what the resume says with what the user typed in the form.
 * @param {object} profile
 * @param {object} input  { age, married, spouseComes, ielts: {l,r,w,s}|number, german, french, education, residence, nationality, stayInGermany, jobOffer }
 */
export function resolveApplicant(profile, input = {}) {
  const estimated = [];
  const lang = new Map((profile.languages ?? []).map((l) => [l.name, l.level]));
  const age = Number(input.age) || profile.age || null;
  if (!input.age && profile.age) estimated.push('age-from-resume');
  if (!age) estimated.push('age-unknown');

  let ielts = null;
  let source = 'test';
  if (input.ielts && typeof input.ielts === 'object' && ['l', 'r', 'w', 's'].every((k) => Number(input.ielts[k]))) {
    ielts = Object.fromEntries(['l', 'r', 'w', 's'].map((k) => [k, Number(input.ielts[k])]));
  } else if (Number(input.ielts)) {
    const o = Number(input.ielts);
    ielts = { l: o, r: o, w: o, s: o };
    source = 'overall';
  } else {
    const est = cefrToIelts(lang.get('English'));
    if (est) (ielts = { l: est, r: est, w: est, s: est }), (source = 'estimated');
    else source = 'unknown';
  }
  if (source === 'estimated') estimated.push('english-estimated');
  if (source === 'overall') estimated.push('english-overall');
  if (source === 'unknown') estimated.push('english-unknown');

  const education = input.education || DEGREE_TO_EDU[profile.highestDegree] || null;
  if (!education) estimated.push('education-unknown');

  const german = input.german || lang.get('German') || null;
  const french = input.french || lang.get('French') || null;
  const nationality = (input.nationality || '').toUpperCase();
  return {
    age,
    married: input.married === true || input.married === 'true' || (input.married == null && profile.maritalStatus === 'married'),
    spouseComes: input.spouseComes !== false && input.spouseComes !== 'false',
    ielts,
    ieltsSource: source,
    clb: ielts ? ieltsToClb(ielts) : { l: 0, r: 0, w: 0, s: 0 },
    englishLevel: lang.get('English') ?? null,
    german,
    french,
    education: education ?? 'secondary',
    educationKnown: Boolean(education),
    years: profile.yearsExperience || 0,
    family: profile.roleFamily,
    seniority: profile.seniority,
    nationality,
    residence: (input.residence || nationality || '').toUpperCase(),
    stayInGermany: Boolean(input.stayInGermany),
    jobOffer: Boolean(input.jobOffer),
    militaryService: profile.militaryService ?? 'unknown',
    estimated,
  };
}

/** Run every calculator relevant to the target countries. */
export function runCalculators(a, countries) {
  const out = {};
  if (countries.includes('CA')) {
    const base = { age: a.age, spouse: a.married && a.spouseComes, education: a.education, clb: a.clb, foreignYears: Math.min(a.years, 10), frenchNclc: a.french ? cefrToNclc(a.french) : 0, secondClb: a.french && cefrToNclc(a.french) >= 5 ? { l: cefrToNclc(a.french), r: cefrToNclc(a.french), w: cefrToNclc(a.french), s: cefrToNclc(a.french) } : null };
    const score = crs(base);
    const whatIf = [];
    const low = Math.min(a.clb.l, a.clb.r, a.clb.w, a.clb.s);
    if (low < 9) whatIf.push({ key: 'clb9', total: crs({ ...base, clb: { l: Math.max(9, a.clb.l), r: Math.max(9, a.clb.r), w: Math.max(9, a.clb.w), s: Math.max(9, a.clb.s) } }).total });
    if (low < 10) whatIf.push({ key: 'clb10', total: crs({ ...base, clb: { l: 10, r: 10, w: 10, s: 10 } }).total });
    if (!base.frenchNclc || base.frenchNclc < 7) whatIf.push({ key: 'french7', total: crs({ ...base, frenchNclc: 7, secondClb: { l: 7, r: 7, w: 7, s: 7 } }).total });
    if (a.education === 'bachelor') whatIf.push({ key: 'master', total: crs({ ...base, education: 'master' }).total });
    whatIf.push({ key: 'pnp', total: score.total + 600 });
    out.crs = { ...score, whatIf: whatIf.map((w) => ({ ...w, delta: w.total - score.total })).filter((w) => w.delta > 0) };
    out.fsw = fsw67({ ...base, jobOffer: a.jobOffer });
  }
  if (countries.includes('DE')) {
    out.chancenkarte = chancenkarte({ age: a.age, years: a.years, german: a.german, english: a.englishLevel ?? (a.ielts && a.ielts.l >= 6.5 ? 'B2' : null), education: a.education, shortageOccupation: TECH.includes(a.family) || a.family === 'engineering' || a.family === 'healthcare', stayInGermany: a.stayInGermany, partnerEligible: false });
  }
  if (countries.includes('AU')) {
    const ieltsMin = a.ielts ? Math.min(a.ielts.l, a.ielts.r, a.ielts.w, a.ielts.s) : 0;
    out.australia = australiaPoints({ age: a.age, ieltsMin, years: a.years, assessmentDeduction: TECH.includes(a.family) ? 2 : 0, education: a.education, single: !(a.married && a.spouseComes) });
  }
  return out;
}

// ---------------------------------------------------------------- pathways

function pathwaysFor(code, a, calc, L) {
  const c = COUNTRIES[code];
  if (!c) return [];
  const tech = TECH.includes(a.family);
  const degree = ['bachelor', 'two-or-more', 'master', 'phd'].includes(a.education);
  const senior = ['senior', 'lead'].includes(a.seniority);
  const eng = a.englishLevel;
  const P = (route, status, why, next, extra = {}) => ({ code, country: L(c.fa, c.name), route, status, why: why.filter(Boolean), next: next.filter(Boolean), url: extra.url ?? c.official, timeline: extra.timeline ?? '', cost: extra.cost ?? '', points: extra.points ?? null });

  if (code === 'CA') {
    const s = calc.crs;
    const f = calc.fsw;
    const status = !a.age ? 'info' : !f.languageOk || !f.experienceOk ? 'hard' : s.total >= 500 ? 'strong' : s.total >= 450 ? 'possible' : 'hard';
    const best = [...s.whatIf].sort((x, y) => y.delta - x.delta).find((w) => w.key !== 'pnp');
    return [P('Express Entry — Federal Skilled Worker', status, [
      !a.age ? L('سن شما مشخص نیست، پس امتیاز سن (تا ۱۱۰) و جدول FSW ناقص است؛ سن را در فرم وارد کنید.', 'Your age is unknown, so age points (up to 110) and the FSW grid are incomplete: enter your age in the form.') : '',
      L(`امتیاز CRS شما حدود ${s.total} است (سن ${s.parts.age}، تحصیلات ${s.parts.education}، زبان ${s.parts.language}، انتقال‌پذیری مهارت ${s.parts.transferability}).`, `Your CRS is about ${s.total} (age ${s.parts.age}, education ${s.parts.education}, language ${s.parts.language}, skill transferability ${s.parts.transferability}).`),
      L(`جدول ۶۷ امتیازی FSW: ${f.total}/100 ${f.pass ? '— قبول' : '— هنوز کافی نیست'}${f.languageOk ? '' : ' (حداقل CLB 7 در هر چهار مهارت لازم است)'}.`, `FSW 67-point grid: ${f.total}/100 ${f.pass ? '— pass' : '— not yet'}${f.languageOk ? '' : ' (CLB 7 in all four abilities is required)'}.`),
      L('در قرعه‌های عمومی اخیر معمولاً ۵۰۰+ لازم بوده؛ قرعه‌های دسته‌ای (زبان فرانسه، سلامت، STEM/فنی) حد پایین‌تری داشته‌اند.', 'Recent general draws have usually needed 500+; category-based draws (French, healthcare, STEM/trades) have had lower cut-offs.'),
      best ? L(`بیشترین اثر: ${whatIfLabel(best.key, L)} ← ${best.total} (+${best.delta}).`, `Biggest lever: ${whatIfLabel(best.key, L)} → ${best.total} (+${best.delta}).`) : '',
      a.age >= 30 ? L('هر سال بعد از ۲۹ سالگی حدود ۵–۶ امتیاز CRS کم می‌شود؛ زمان به نفع شما نیست.', 'Every year after 29 costs about 5–6 CRS points: start soon.') : '',
    ], [
      L('آزمون IELTS General یا CELPIP بدهید (هدف: CLB 9 یعنی L8 R7 W7 S7 در آیلتس).', 'Take IELTS General or CELPIP (target CLB 9 = IELTS L8 R7 W7 S7).'),
      L('ارزیابی مدرک (ECA) از WES یا ICAS/IQAS بگیرید؛ WES مدارک را مستقیم از دانشگاه می‌خواهد.', 'Get an Educational Credential Assessment (WES, ICAS or IQAS); WES requires documents sent directly by the university.'),
      L('پروفایل Express Entry بسازید و استریم‌های PNP (بریتیش کلمبیا و انتاریو برای فناوری) را دنبال کنید؛ نامزدی استانی ۶۰۰ امتیاز دارد.', 'Create the Express Entry profile and watch PNP tech streams (BC, Ontario); a provincial nomination adds 600 points.'),
      L('تمکن مالی: حدود ۱۵٬۳۰۰ دلار کانادا برای یک نفر (سالانه در ژوئیه به‌روز می‌شود).', 'Proof of funds: about CAD 15,300 for one person (updated every July).'),
    ], { url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html', timeline: L('۶ ماه پس از دعوت (ITA) + بررسی امنیتی بیشتر برای اتباع ایران', '≈6 months after the invitation (ITA), longer security screening for some nationalities'), cost: L('هزینه دولتی اقامت دائم ≈ ۱٬۵۲۵ دلار کانادا برای هر بزرگسال + ECA + آزمون زبان', 'Government fees ≈ CAD 1,525 per adult + ECA + language test'), points: s.total })];
  }

  if (code === 'DE') {
    const ck = calc.chancenkarte;
    const out = [];
    if (degree) {
      out.push(P('EU Blue Card', tech || senior ? 'strong' : 'possible', [
        L('با مدرک دانشگاهی شناخته‌شده (دانشگاه H+ در anabin یا تأییدیه ZAB) و پیشنهاد کار، ویزای کار مستقیم می‌گیرید.', 'With a recognised degree (H+ university in anabin, or a ZAB statement) and a job offer you get the work visa directly.'),
        L('حداقل حقوق ۲۰۲۶: ۵۰٬۷۰۰ یورو؛ برای مشاغل کمبود (از جمله IT) و فارغ‌التحصیلان ۳ سال اخیر: ۴۵٬۹۳۴ یورو.', '2026 minimum salary: €50,700; €45,934 for shortage occupations (incl. IT) and recent graduates.'),
        L('اقامت دائم بعد از ۲۱ ماه (با زبان B1) یا ۲۷ ماه.', 'Permanent residence after 21 months (with German B1) or 27 months.'),
      ], [
        L('نام دانشگاه و رشته خود را در anabin چک کنید؛ اگر H+ نیست یا مدرک «entspricht» ندارد، Statement of Comparability از ZAB بگیرید (≈۲۰۰ یورو، ۱–۳ ماه).', 'Check your university and degree in anabin; if not H+/“entspricht”, request a ZAB Statement of Comparability (≈€200, 1–3 months).'),
        L('از کارفرما بخواهید «روند تسریع‌شده متخصصان» (§81a) را انجام دهد: هزینه ۴۱۱ یورو، نوبت سفارت ظرف حدود ۳ هفته.', 'Ask the employer to use the accelerated skilled-worker procedure (§81a): €411 fee, embassy appointment within about 3 weeks.'),
      ], { url: 'https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card', timeline: L('۱–۳ ماه پس از نوبت سفارت', '1–3 months after the embassy appointment'), cost: L('ویزا ۷۵ یورو؛ ZAB ≈ ۲۰۰ یورو', 'Visa €75; ZAB ≈ €200') }));
    } else if (tech && a.years >= 3) {
      out.push(P('IT specialist without a degree (§19c)', 'possible', [
        L('بدون مدرک دانشگاهی هم با ۳ سال سابقه IT در ۷ سال اخیر و پیشنهاد کار با حقوق حداقل ۴۵٬۹۳۴ یورو ممکن است.', 'Possible without a degree: 3 years of IT experience in the last 7 and a job offer paying at least €45,934.'),
      ], [L('نامه‌های سابقه کار دقیق (عنوان، تاریخ، وظایف، تکنولوژی‌ها) آماده کنید.', 'Prepare detailed employment letters (title, dates, duties, technologies).')], { url: 'https://www.make-it-in-germany.com/en/visa-residence/types/it-specialists' }));
    }
    if (ck) {
      const status = ck.viaRecognition ? 'strong' : ck.eligibleByPoints ? 'possible' : 'hard';
      out.push(P('Opportunity Card (Chancenkarte)', status, [
        ck.viaRecognition ? L('اگر مدرک شما در آلمان شناخته‌شده باشد (H+ در anabin یا ZAB)، بدون امتیاز واجد شرایط هستید.', 'If your degree is recognised in Germany (anabin H+ or ZAB), you qualify without points.') : '',
        L(`امتیاز شما: ${ck.points} از ۶ لازم (سابقه ${ck.parts.experience}، سن ${ck.parts.age}، آلمانی ${ck.parts.german}، انگلیسی ${ck.parts.english}، شغل کمبود ${ck.parts.shortageOccupation}).`, `Your points: ${ck.points} of the 6 needed (experience ${ck.parts.experience}, age ${ck.parts.age}, German ${ck.parts.german}, English ${ck.parts.english}, shortage occupation ${ck.parts.shortageOccupation}).`),
        ck.languageBase ? '' : L('حداقل آلمانی A1 یا انگلیسی B2 لازم است.', 'German A1 or English B2 is required.'),
        L('تا ۱ سال در آلمان کار پیدا کنید؛ کار پاره‌وقت ۲۰ ساعت در هفته و کار آزمایشی مجاز است.', 'Up to 1 year in Germany to find a job; part-time work (20 h/week) and trial work are allowed.'),
      ], [
        L('تمکن مالی: حساب بلوکه (حدود ۱٬۱۰۰ یورو در ماه) یا تعهدنامه (Verpflichtungserklärung) از یک ضامن در آلمان. برخی ارائه‌دهندگان حساب بلوکه اتباع ایران را نمی‌پذیرند؛ قبل از پرداخت بپرسید.', 'Funds: a blocked account (about €1,100/month) or a formal obligation (Verpflichtungserklärung) from a sponsor in Germany. Some blocked-account providers do not accept Iranian nationals; ask before paying.'),
        !atLeast(a.german, 'A2') ? L('آلمانی A2 یک امتیاز و B1 دو امتیاز اضافه می‌کند و بازار کار غیرفنی را هم باز می‌کند.', 'German A2 adds 1 point, B1 adds 2, and opens non-tech jobs too.') : '',
      ], { url: 'https://www.make-it-in-germany.com/en/visa-residence/types/job-search-opportunity-card', timeline: L('۱–۴ ماه (بسته به نوبت سفارت)', '1–4 months (embassy queue)'), cost: L('ویزا ۷۵ یورو + تمکن مالی', 'Visa €75 + proof of funds'), points: ck.points }));
    }
    return out;
  }

  if (code === 'NL') {
    const under30 = a.age && a.age < 30;
    return [P('Highly Skilled Migrant (kennismigrant)', senior || under30 ? 'strong' : 'possible', [
      L(`نیازی به مدرک نیست؛ کارفرما باید اسپانسر شناخته‌شده IND باشد و حقوق ماهانه حداقل ${under30 ? '۴٬۳۵۷ یورو (زیر ۳۰ سال)' : '۵٬۹۴۲ یورو (۳۰ سال به بالا)'} بدون احتساب ۸٪ هالیدی‌پی.`, `No degree needed; the employer must be an IND recognised sponsor and pay at least ${under30 ? '€4,357/month (under 30)' : '€5,942/month (30+)'} excluding the 8% holiday allowance.`),
      L('سریع‌ترین مسیر اروپا: تصمیم IND معمولاً ۲–۴ هفته.', 'The fastest route in Europe: IND decisions usually take 2–4 weeks.'),
    ], [L('فقط به شرکت‌هایی که در فهرست رسمی اسپانسرهای IND هستند اپلای کنید (این گزارش خودش بررسی می‌کند).', 'Only apply to employers on the IND public register of recognised sponsors (this report checks it for you).')], { url: 'https://ind.nl/en/residence-permits/work/highly-skilled-migrant', timeline: L('۲–۴ هفته + ویزای ورود MVV', '2–4 weeks + MVV entry visa'), cost: L('هزینه IND را کارفرما می‌پردازد', 'The employer pays the IND fee') })];
  }

  if (code === 'GB') {
    const englishOk = atLeast(eng, 'B2') || (a.ielts && Math.min(a.ielts.l, a.ielts.r, a.ielts.w, a.ielts.s) >= 5.5);
    return [P('Skilled Worker visa', !englishOk || !degree ? 'hard' : senior ? 'possible' : 'hard', [
      L('کارفرما باید اسپانسر دارای مجوز Home Office باشد؛ شغل باید در سطح مدرک دانشگاهی (RQF 6) باشد.', 'The employer must hold a Home Office sponsor licence; the job must be at degree level (RQF 6).'),
      L('حداقل حقوق ۴۱٬۷۰۰ پوند یا نرخ رایج آن شغل (هر کدام بیشتر). انگلیسی در سطح B2 با آزمون SELT (مثل IELTS for UKVI).', 'Salary at least £41,700 or the occupation going rate, whichever is higher. English at B2 via a SELT (e.g. IELTS for UKVI).'),
      !degree ? L('بدون مدرک دانشگاهی این مسیر تقریباً بسته است.', 'Without a degree this route is mostly closed.') : '',
    ], [L('فقط برای آگهی‌هایی که در این گزارش «در فهرست رسمی اسپانسرها» علامت دارند وقت بگذارید.', 'Focus on ads marked “on the official sponsor register” in this report.')], { url: 'https://www.gov.uk/skilled-worker-visa', timeline: L('۳–۸ هفته پس از CoS', '3–8 weeks after the Certificate of Sponsorship'), cost: L('هزینه درمان (IHS) ۱٬۰۳۵ پوند در سال + هزینه ویزا', 'Healthcare surcharge £1,035/year + visa fee') })];
  }

  if (code === 'IE') {
    return [P('Critical Skills Employment Permit', tech && degree ? 'possible' : 'hard', [
      L('برای مشاغل فهرست مهارت‌های حیاتی (بیشتر نقش‌های IT و مهندسی) با حقوق حداقل ۴۰٬۹۰۴ یورو و مدرک مرتبط.', 'For roles on the Critical Skills list (most IT and engineering) with salary ≥ €40,904 and a relevant degree.'),
      L('خانواده بلافاصله می‌تواند بیاید؛ بعد از ۲ سال Stamp 4 (اقامت بدون نیاز به مجوز کار).', 'Family can join immediately; Stamp 4 (no permit needed) after 2 years.'),
    ], [], { url: 'https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/permit-types/critical-skills-employment-permit/', timeline: L('حدود ۱–۳ ماه', 'About 1–3 months') })];
  }

  if (code === 'AU') {
    const au = calc.australia;
    const status = !a.age ? 'info' : !au.ageOk ? 'blocked' : !au.englishOk ? 'hard' : au.points >= 85 ? 'strong' : au.points >= 65 ? 'possible' : 'hard';
    return [P('Skilled Independent (189) / Nominated (190)', status, [
      L(`امتیاز شما ${au.points} (حداقل ۶۵؛ در دعوت‌های اخیر مشاغل IT معمولاً ۸۵–۹۵+ لازم بوده).`, `Your points: ${au.points} (minimum 65; recent ICT invitations have usually needed 85–95+).`),
      L(`سن ${au.parts.age}، انگلیسی ${au.parts.english}، سابقه ${au.parts.experience}، تحصیلات ${au.parts.education}، وضعیت همسر ${au.parts.partner}.`, `Age ${au.parts.age}, English ${au.parts.english}, experience ${au.parts.experience}, education ${au.parts.education}, partner ${au.parts.partner}.`),
      TECH.includes(a.family) ? L('ACS معمولاً ۲ سال اول سابقه را کسر می‌کند (در محاسبه لحاظ شده).', 'ACS usually deducts the first 2 years of experience (already applied).') : '',
      !a.age ? L('سن شما مشخص نیست؛ امتیاز سن (تا ۳۰) لحاظ نشده است.', 'Your age is unknown; age points (up to 30) are not included.') : !au.ageOk ? L('برای ویزاهای امتیازی باید زیر ۴۵ سال باشید.', 'You must be under 45 for points-tested visas.') : '',
    ], [
      L('آیلتس ۸ در هر مهارت ۲۰ امتیاز دارد (۷ = ۱۰ امتیاز)؛ بزرگ‌ترین اهرم شماست.', 'IELTS 8 in each band gives 20 points (7 gives 10): your biggest lever.'),
      L('ارزیابی مهارت (ACS برای IT، Engineers Australia برای مهندسی) را شروع کنید.', 'Start the skills assessment (ACS for ICT, Engineers Australia for engineering).'),
    ], { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189/points-table', points: au.points })];
  }

  if (code === 'US' && a.nationality === 'IR') {
    return [P('H-1B / O-1 / EB-2 NIW', 'blocked', [L('ورود اتباع ایران با فرمان ریاست‌جمهوری (از ژوئن ۲۰۲۵) متوقف است، جز استثناهای محدود.', 'Entry for Iranian nationals has been suspended by presidential proclamation since June 2025, with narrow exceptions.')], [L('وضعیت را در travel.state.gov دنبال کنید؛ فعلاً روی کشورهای دیگر تمرکز کنید.', 'Follow travel.state.gov; focus on other countries for now.')], { url: 'https://travel.state.gov/' })];
  }

  if (code === 'AE') {
    return [P('Employer-sponsored work visa', 'strong', [
      L('کارفرما تمام مراحل را انجام می‌دهد؛ ۱–۴ هفته. بدون مالیات بر درآمد.', 'The employer handles everything; 1–4 weeks. No income tax.'),
      a.nationality === 'IR' ? L('برای اتباع ایران گاهی محدودیت‌های موقت یا بررسی بیشتر وجود دارد؛ از بخش PRO کارفرما زود بپرسید.', 'Iranian nationals sometimes face temporary restrictions or extra checks; ask the employer’s PRO early.') : '',
      L('اقامت دائم ندارد؛ بسیاری از آن به عنوان سکوی ۲–۳ ساله برای اروپا/کانادا استفاده می‌کنند.', 'No permanent residence track; many use it as a 2–3 year stepping stone to Europe/Canada.'),
    ], [L('مدارک تحصیلی باید تأیید (Attestation) سفارت امارات و وزارت خارجه امارات را داشته باشد.', 'Degrees need UAE embassy + MOFA attestation.')], { url: c.routes[0].url, timeline: L('۱–۴ هفته', '1–4 weeks') })];
  }

  // Other countries: summarise the knowledge-base routes.
  return c.routes.slice(0, 2).filter((r) => !r.needsDegree || degree).map((r) => P(r.name, tech && c.shortage.includes(a.family) ? 'possible' : 'info', [r.summary], [], { url: r.url }));
}

const whatIfLabel = (key, L) => ({
  clb9: L('آیلتس L8 R7 W7 S7 (CLB 9)', 'IELTS L8 R7 W7 S7 (CLB 9)'),
  clb10: L('آیلتس L8.5 R8 W7.5 S7.5 (CLB 10)', 'IELTS L8.5 R8 W7.5 S7.5 (CLB 10)'),
  french7: L('فرانسه NCLC 7 (حدود B2)', 'French NCLC 7 (about B2)'),
  master: L('مدرک کارشناسی ارشد', 'a master’s degree'),
  pnp: L('نامزدی استانی (PNP)', 'a provincial nomination (PNP)'),
})[key];

// ---------------------------------------------------------------- documents & plan

function documents(a, countries, L) {
  const docs = [];
  if (a.nationality === 'IR') {
    docs.push(
      { title: L('پاسپورت و خروج از کشور', 'Passport and exit'), detail: L('حداقل ۱۸ ماه اعتبار. برای آقایان کارت پایان خدمت یا معافیت برای گرفتن پاسپورت/خروج لازم است.', 'At least 18 months validity. Men need a completed military service card or exemption to get a passport and leave Iran.') },
      { title: L('آزادسازی و تأییدیه مدرک', 'Degree release and verification'), detail: L('فارغ‌التحصیلان دوره روزانه دانشگاه‌های دولتی باید تعهد آموزش رایگان را تسویه یا تضمین کنند تا مدرک آزاد شود. تأییدیه تحصیلی از سامانه سجاد (وزارت علوم) یا سامانه وزارت بهداشت.', 'Graduates of free public (daytime) programmes must settle or guarantee the free-education bond before the degree is released. Get the official verification via the Sajad portal (Ministry of Science) or the Ministry of Health system.') },
      { title: L('ترجمه رسمی و تأیید', 'Certified translation and legalisation'), detail: L('ترجمه توسط مترجم رسمی قوه قضاییه + مهر دادگستری و وزارت امور خارجه. ایران عضو کنوانسیون آپوستیل نیست، پس برخی کشورها تأیید سفارت خود را هم می‌خواهند.', 'Translation by an official Judiciary translator + Justice Ministry and Foreign Ministry stamps. Iran is not in the Apostille Convention, so some countries also require their embassy’s legalisation.') },
      { title: L('سوابق کار', 'Employment evidence'), detail: L('نامه روی سربرگ شرکت با عنوان شغلی، تاریخ شروع/پایان، ساعات کار، حقوق و وظایف دقیق + سوابق بیمه تأمین اجتماعی به عنوان مدرک پشتیبان.', 'Letters on company letterhead with job title, start/end dates, hours, salary and detailed duties + social-security (Tamin Ejtemaei) insurance records as supporting proof.') },
      { title: L('گواهی عدم سوءپیشینه', 'Police certificate'), detail: L('از دفاتر پلیس+۱۰ یا خدمات قضایی؛ ترجمه رسمی. اعتبار آن معمولاً ۶ ماه است، پس نزدیک زمان اپلای بگیرید.', 'From Police+10 or judicial service offices, officially translated. Usually valid for 6 months, so get it close to applying.') },
      { title: L('آزمون زبان', 'Language test'), detail: L('آیلتس و تافل در ایران برگزار می‌شود؛ CELPIP در ایران نیست. برای آلمانی مراکز Goethe/telc/ÖSD را چک کنید.', 'IELTS and TOEFL are available in Iran; CELPIP is not. For German check Goethe/telc/ÖSD centres.') },
      { title: L('محل انگشت‌نگاری و مصاحبه', 'Biometrics and interviews'), detail: L('کانادا در ایران سفارت و VAC ندارد (نزدیک‌ترین‌ها: آنکارا، استانبول، دبی، ایروان). برای سایر کشورها صف نوبت تهران را با کنسولگری‌های منطقه مقایسه کنید.', 'Canada has no embassy or VAC in Iran (nearest: Ankara, Istanbul, Dubai, Yerevan). For other countries compare the Tehran queue with regional consulates.') },
      { title: L('تمکن مالی', 'Proof of funds'), detail: L('به دلیل تحریم، صورت‌حساب بانک‌های ایرانی اغلب پذیرفته یا قابل انتقال نیست؛ از راه‌های قانونی مجاز در کشور مقصد (حساب بلوکه، ضامن، حساب در کشور ثالث) زودتر برنامه‌ریزی کنید.', 'Because of sanctions, Iranian bank statements are often not accepted or transferable; plan early for a legal alternative accepted by the destination (blocked account, sponsor, account in a third country).') },
    );
  } else {
    docs.push(
      { title: L('پاسپورت', 'Passport'), detail: L('حداقل ۱۸ ماه اعتبار.', 'At least 18 months validity.') },
      { title: L('مدارک تحصیلی و ترجمه', 'Degrees and translations'), detail: L('ترجمه رسمی و آپوستیل (در صورت عضویت کشور).', 'Certified translations and apostille where available.') },
      { title: L('سوابق کار', 'Employment evidence'), detail: L('نامه روی سربرگ با عنوان، تاریخ، ساعات، حقوق و وظایف.', 'Letters on letterhead with title, dates, hours, salary and duties.') },
      { title: L('گواهی عدم سوءپیشینه', 'Police certificate'), detail: L('معمولاً ۶ ماه اعتبار دارد.', 'Usually valid for 6 months.') },
    );
  }
  for (const code of countries) {
    const c = COUNTRIES[code];
    if (c) docs.push({ title: L(`ارزیابی مدرک برای ${c.fa}`, `Degree recognition for ${c.name}`), detail: c.recognition.name, url: c.recognition.url });
  }
  return docs;
}

function roadmap(a, top, L) {
  const dest = top ? L(top.country, top.country) : '';
  return [
    { phase: L('روز ۱–۱۴: پایه', 'Days 1–14: foundations'), tasks: [
      L('آزمون زبان را رزرو کنید (هدف: آیلتس ۷+ در هر مهارت).', 'Book the language test (target IELTS 7+ in every band).'),
      L('ترجمه رسمی مدارک، تأییدیه تحصیلی و نامه‌های سابقه کار را شروع کنید.', 'Start certified translations, degree verification and employment letters.'),
      L('رزومه انگلیسی و لینکدین را طبق اصلاحات این گزارش بازنویسی کنید.', 'Rewrite the English resume and LinkedIn with this report’s fixes.'),
    ] },
    { phase: L('روز ۱۵–۴۵: اپلای هدفمند', 'Days 15–45: targeted applications'), tasks: [
      L(`هفته‌ای ۱۰–۲۰ اپلای شخصی‌سازی‌شده، اولویت با ${dest || 'بهترین مقصد'} و آگهی‌های دارای اسپانسر.`, `10–20 tailored applications a week, prioritising ${dest || 'your best destination'} and sponsored roles.`),
      L('ارزیابی مدرک (anabin/ZAB، WES، ACS…) را ثبت کنید؛ چند هفته تا چند ماه طول می‌کشد.', 'File the degree recognition (anabin/ZAB, WES, ACS…); it takes weeks to months.'),
      L('برای هر آگهی یک نفر در همان شرکت را در لینکدین پیدا و پیام کوتاه بفرستید (معرفی داخلی شانس را چند برابر می‌کند).', 'Message one person at each company on LinkedIn (referrals multiply your odds).'),
    ] },
    { phase: L('روز ۴۶–۷۵: مصاحبه و مذاکره', 'Days 46–75: interviews and negotiation'), tasks: [
      L('سوالات مصاحبه این گزارش را با صدای بلند تمرین کنید.', 'Practise this report’s interview questions out loud.'),
      L('در مذاکره: حقوق را بالاتر از حداقل ویزا نگه دارید و کمک هزینه جابه‌جایی و هزینه ویزا را بخواهید.', 'Negotiate: keep salary above the visa threshold and ask for relocation and visa costs.'),
    ] },
    { phase: L('روز ۷۶–۹۰: ویزا', 'Days 76–90: visa'), tasks: [
      L('بعد از قرارداد: از کارفرما روند تسریع‌شده (مثل §81a آلمان) یا اسپانسرشیپ را بخواهید و نوبت سفارت را فوراً بگیرید.', 'After signing: ask the employer for the accelerated procedure (e.g. Germany §81a) or sponsorship and book the embassy appointment at once.'),
      L('مدارک را طبق چک‌لیست این گزارش کامل و کپی‌های تأییدشده نگه دارید.', 'Complete the document checklist and keep certified copies.'),
    ] },
  ];
}

const ADVISORS = {
  CA: { fa: 'فقط با مشاور دارای مجوز RCIC (ثبت‌شده در CICC) یا وکیل کانادایی کار کنید.', en: 'Only use a licensed RCIC (CICC register) or a Canadian lawyer.', url: 'https://college-ic.ca/protecting-the-public/find-an-immigration-consultant' },
  GB: { fa: 'مشاوران مهاجرت انگلستان باید در IAA (سابقاً OISC) ثبت باشند.', en: 'UK immigration advisers must be registered with the IAA (formerly OISC).', url: 'https://www.gov.uk/find-an-immigration-adviser' },
  AU: { fa: 'فقط با Registered Migration Agent ثبت‌شده در OMARA.', en: 'Only use a Registered Migration Agent (OMARA register).', url: 'https://portal.mara.gov.au/search-the-register-of-migration-agents/' },
  DE: { fa: 'مشاوره رایگان رسمی: خط تماس و فرم Make it in Germany؛ برای پرونده پیچیده وکیل مهاجرت (Fachanwalt für Migrationsrecht).', en: 'Free official advice: the Make it in Germany hotline/contact form; for complex cases a migration lawyer (Fachanwalt für Migrationsrecht).', url: 'https://www.make-it-in-germany.com/en/about-us/contact' },
  NL: { fa: 'اطلاعات رسمی و تماس با IND؛ برای موارد خاص وکیل عضو NOvA.', en: 'Official IND information and contact; for special cases a NOvA-registered lawyer.', url: 'https://ind.nl/en/contact' },
};

/**
 * Full assessment for the report.
 * @returns {{ applicant, calculators, pathways, documents, roadmap, advisors, lang }}
 */
export function assessImmigration(profile, countries, input = {}, lang = 'fa') {
  const L = (fa, en) => (lang === 'fa' ? fa : en);
  const a = resolveApplicant(profile, input);
  const calc = runCalculators(a, countries);
  const order = { strong: 0, possible: 1, hard: 2, info: 3, blocked: 4 };
  const pathways = countries.flatMap((code) => pathwaysFor(code, a, calc, L)).sort((x, y) => order[x.status] - order[y.status]);
  const advisors = countries.filter((c) => ADVISORS[c]).map((c) => ({ code: c, text: L(ADVISORS[c].fa, ADVISORS[c].en), url: ADVISORS[c].url }));
  return {
    applicant: a,
    calculators: calc,
    pathways,
    documents: documents(a, countries, L),
    roadmap: roadmap(a, pathways.find((p) => p.status === 'strong' || p.status === 'possible'), L),
    advisors,
    scamWarning: L('هیچ مشاور معتبری «ویزای تضمینی» یا «پیشنهاد کار فروشی» (مثلاً خرید LMIA) نمی‌فروشد؛ این‌ها کلاهبرداری و غیرقانونی است.', 'No legitimate adviser sells “guaranteed visas” or job offers (e.g. buying an LMIA); that is fraud and illegal.'),
  };
}
