// Offline relocation strategy. Same shape as the Claude strategy so the report
// renders either one.

import { nationalityNotes } from '../immigration/advisor.js';

const RATES = { junior: [15, 25], mid: [25, 45], senior: [45, 80], lead: [60, 110] };

export function offlineStrategy(profile, fit, stats, { lang = 'fa', nationality = '' } = {}) {
  const fa = lang === 'fa';
  const top = fit.filter((c) => !c.blocked).slice(0, 4);
  const best = top[0];
  const [lo, hi] = RATES[profile.seniority] ?? RATES.mid;

  const overview = fa
    ? `بر اساس رزومه، شما یک ${profile.headline} با حدود ${profile.yearsExperience || 'چند'} سال سابقه هستید. در این جستجو ${stats.total} موقعیت پیدا شد که ${stats.visa} مورد صریحاً اسپانسر ویزا و ${stats.relocation} مورد کمک جابه‌جایی دارند. ${best ? `بهترین مقصد فعلی برای شما «${best.fa}» است (${best.routes[0]?.name ?? 'مسیر کاری'}).` : ''} تمرکز روی ۱۰–۲۰ درخواست باکیفیت در هفته بسیار موثرتر از ارسال انبوه است.`
    : `You are a ${profile.headline} with about ${profile.yearsExperience || 'several'} years of experience. This search found ${stats.total} roles; ${stats.visa} explicitly offer visa sponsorship and ${stats.relocation} offer relocation help. ${best ? `Your strongest destination right now is ${best.name} (${best.routes[0]?.name ?? 'work route'}).` : ''} Ten to twenty tailored applications a week beat mass-applying.`;

  const verdict = (s) => (s >= 70 ? 'strong' : s >= 50 ? 'possible' : 'hard');
  const countryAdvice = top.map((c) => ({
    country: fa ? c.fa : c.name,
    verdict: verdict(c.score),
    reasoning: [
      c.routes[0] ? `${c.routes[0].name}: ${c.routes[0].summary}` : '',
      c.reasons.includes('needs-local-language') ? (fa ? 'یادگیری زبان محلی لازم است.' : 'Local language needed.') : '',
      c.sponsoredCount ? (fa ? `${c.sponsoredCount} آگهی با اسپانسر/جابه‌جایی پیدا شد.` : `${c.sponsoredCount} sponsored/relocation ads found.`) : '',
    ].filter(Boolean).join(' '),
  }));

  const resumeImprovements = [];
  if (!profile.links?.some((l) => /linkedin/i.test(l))) resumeImprovements.push(fa ? 'لینک پروفایل لینکدین را بالای رزومه اضافه کنید.' : 'Add your LinkedIn URL to the header.');
  if (['software', 'data', 'devops', 'security', 'qa'].includes(profile.roleFamily) && !profile.links?.some((l) => /github|gitlab|portfolio/i.test(l))) resumeImprovements.push(fa ? 'لینک گیت‌هاب یا نمونه‌کار اضافه کنید؛ برای کارفرمای خارجی که شما را نمی‌شناسد اعتمادساز است.' : 'Add a GitHub or portfolio link: it builds trust with employers who cannot check local references.');
  if (!profile.languages?.length || profile.languages.some((l) => l.level === 'unknown')) resumeImprovements.push(fa ? 'سطح زبان‌ها را با استاندارد CEFR (مثل English C1) یا نمره آیلتس بنویسید.' : 'State language levels using CEFR (e.g. "English C1") or your IELTS score.');
  resumeImprovements.push(
    fa ? 'هر تجربه را با عدد بنویسید: «زمان پاسخ API را ۴۰٪ کم کردم» به جای «مسئول بک‌اند بودم».' : 'Quantify each role: "cut API latency by 40%" instead of "responsible for backend".',
    fa ? 'در خلاصه بالای رزومه بنویسید: «آماده جابه‌جایی به … — نیازمند اسپانسر ویزا»؛ ریکروترها این را دنبال می‌کنند.' : 'Add "Open to relocation to … — requires visa sponsorship" to your summary; recruiters filter for it.',
    fa ? 'نام شرکت‌های ایرانی را با یک توضیح کوتاه (حوزه، اندازه، کاربران) همراه کنید تا برای کارفرمای خارجی قابل‌فهم باشد.' : 'Add one line of context (industry, size, users) under each local company name so foreign employers understand it.',
    fa ? 'رزومه تک‌ستونه و بدون جدول/عکس بسازید تا سیستم‌های ATS آن را درست بخوانند.' : 'Use a single-column layout without tables or images so ATS systems parse it.',
  );

  const linkedinTips = fa
    ? [
        `عنوان پروفایل را اینطور بنویسید: «${profile.headline} | ${profile.skills.slice(0, 3).join(' · ')} | Open to relocation»`,
        `در Open to Work، گزینه «فقط ریکروترها» و شهرهای هدف (${top.map((c) => c.fa).join('، ')}) را اضافه کنید.`,
        'هفته‌ای ۱۰ ریکروتر فنی در کشورهای هدف را با یک پیام کوتاه شخصی کانکت کنید.',
        'هفته‌ای یک پست درباره پروژه یا یادگیری‌تان منتشر کنید تا در جستجوی ریکروترها بالاتر بیایید.',
      ]
    : [
        `Headline: "${profile.headline} | ${profile.skills.slice(0, 3).join(' · ')} | Open to relocation"`,
        `Turn on Open to Work (recruiters only) with your target cities in ${top.map((c) => c.name).join(', ')}.`,
        'Connect with 10 tech recruiters in target countries every week with a short personal note.',
        'Post once a week about a project or something you learned so you rank higher in recruiter searches.',
      ];

  const services = profile.freelanceServices ?? [];
  const freelanceStrategy = fa
    ? [
        `سه سرویس مشخص بسازید: ${services.slice(0, 3).join('، ')}.`,
        `نرخ پیشنهادی برای شروع: ${lo}–${hi} دلار در ساعت (بسته به سطح و بازار)؛ بعد از ۵ نظر مثبت نرخ را بالا ببرید.`,
        'روزانه ۳–۵ پروپوزال شخصی‌سازی‌شده (مثل نمونه‌های این گزارش) بفرستید، نه متن تکراری.',
        'فقط از پلتفرم‌ها و روش‌های پرداختی استفاده کنید که رسماً کشور محل اقامت شما را پشتیبانی می‌کنند.',
        'درآمد فریلنسری را مستند کنید؛ برای ویزای دیجیتال‌نومد (پرتغال، اسپانیا، استونی) مدرک درآمد خارجی لازم است.',
      ]
    : [
        `Package three concrete services: ${services.slice(0, 3).join(', ')}.`,
        `Starting rate: about $${lo}–${hi}/hour depending on market; raise it after 5 good reviews.`,
        'Send 3–5 tailored proposals a day (like the samples in this report), never copy-paste.',
        'Only use platforms and payment methods that officially support your country of residence.',
        'Keep records of foreign freelance income: digital-nomad visas (Portugal, Spain, Estonia) require proof of it.',
      ];

  const actionPlan = fa
    ? [
        { week: 'هفته ۱', tasks: ['رزومه انگلیسی را با نکات بالا بازنویسی کنید.', 'پروفایل لینکدین را به‌روز کنید.', `مدارک تحصیلی را برای ارزیابی (${best?.recognition?.name ?? 'ارزیابی مدرک'}) آماده کنید.`, 'در آزمون زبان ثبت‌نام کنید (اگر مدرک معتبر ندارید).'] },
        { week: 'هفته ۲', tasks: ['به ۱۰ آگهی برتر این گزارش با نامه‌های آماده اپلای کنید.', 'برای هر آگهی یک نفر در شرکت را در لینکدین پیدا کنید و پیام بدهید.', 'پروفایل فریلنسری بسازید و ۱۰ پروپوزال بفرستید.'] },
        { week: 'هفته ۳', tasks: ['ربات را دوباره اجرا کنید و آگهی‌های جدید را اپلای کنید.', 'سوالات مصاحبه این گزارش را تمرین کنید (با ضبط صدای خودتان).', 'یک پروژه کوچک برای پر کردن مهارت‌های جاافتاده شروع کنید.'] },
        { week: 'هفته ۴', tasks: ['نتایج را بررسی کنید: نرخ پاسخ زیر ۵٪ یعنی رزومه یا هدف‌گیری باید اصلاح شود.', 'با کسانی که پاسخ ندادند یک پیگیری مودبانه بفرستید.', 'کشورهای هدف را بر اساس پاسخ‌ها تنظیم کنید.'] },
      ]
    : [
        { week: 'Week 1', tasks: ['Rewrite your English resume with the improvements above.', 'Update your LinkedIn profile.', `Start credential recognition (${best?.recognition?.name ?? 'degree evaluation'}).`, 'Book a language test if you have no valid certificate.'] },
        { week: 'Week 2', tasks: ['Apply to the top 10 jobs in this report with the prepared letters.', 'Message one person at each company on LinkedIn.', 'Create freelance profiles and send 10 proposals.'] },
        { week: 'Week 3', tasks: ['Run the bot again and apply to new matches.', 'Practise the interview questions in this report out loud.', 'Start a small project that covers your most common missing skill.'] },
        { week: 'Week 4', tasks: ['Review results: under 5% reply rate means fix the resume or targeting.', 'Send polite follow-ups to employers who did not answer.', 'Adjust target countries based on replies.'] },
      ];

  const warnings = [
    fa ? 'هیچ کارفرمای واقعی برای استخدام یا ویزا از شما پول نمی‌گیرد. آگهی‌هایی که هزینه ثبت‌نام، «ویزای تضمینی» یا تماس فقط از واتساپ/تلگرام دارند را کنار بگذارید.' : 'Real employers never charge you for a job or a visa. Skip ads with fees, "guaranteed visas" or WhatsApp/Telegram-only contact.',
    fa ? 'قوانین و حداقل حقوق ویزا مرتب تغییر می‌کند؛ قبل از هر اقدام، لینک رسمی هر کشور را بررسی کنید.' : 'Visa rules and salary thresholds change often: confirm on the official government site before acting.',
    ...nationalityNotes(nationality, lang),
    ...fit.filter((c) => c.blocked).map((c) => c.blocked),
  ];

  return { overview, countryAdvice, resumeImprovements: resumeImprovements.slice(0, 6), linkedinTips, freelanceStrategy, actionPlan, warnings, source: 'offline' };
}
