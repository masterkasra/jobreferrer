// Telegram bot (long polling — runs on any server, PC or free container).
//   TELEGRAM_BOT_TOKEN=... npm run bot
// Users send their resume; the bot replies with ranked jobs, the HTML report
// and, on request, a tailored cover letter for each job. /daily turns on a
// daily digest of new matches.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tg, sendMessages, sendDocument, downloadFile } from './api.js';
import { extractText } from '../resume/extract.js';
import { run } from '../pipeline.js';
import { toHtml } from '../report/html.js';
import { toTelegram, pitchMessages } from '../report/telegram.js';
import { COUNTRIES } from '../immigration/countries.js';
import { config } from '../config.js';

const STATE_FILE = join(config.cacheDir, 'bot-state.json');
const DAY = 24 * 3600 * 1000;
let state = { users: {} };
const lastReports = new Map(); // chatId -> report (memory only)
const running = new Set();

const TEXT = {
  fa: {
    welcome: `سلام! 👋 من ربات <b>jobreferrer</b> هستم.

رزومه‌تان را (PDF، Word یا متن) همینجا بفرستید تا:
• در ده‌ها سایت کاریابی موقعیت‌های دارای <b>اسپانسر ویزا و کمک جابه‌جایی</b> را پیدا کنم
• برای هر موقعیت <b>نامه و پیام آماده</b> برای متقاعد کردن کارفرما بنویسم
• پروژه‌های <b>فریلنسری</b> مرتبط را لیست کنم
• بهترین کشورها و مسیرهای ویزا و یک <b>برنامه ۴ هفته‌ای</b> پیشنهاد بدهم

⚙️ تنظیمات:
/countries DE NL GB CA — کشورهای هدف
/nationality IR — ملیت (برای هشدارهای مخصوص)
/title Data Engineer — عنوان شغلی دلخواه
/lang en — زبان گزارش (fa یا en)
/jobs — جستجوی دوباره با رزومه قبلی
/daily — روشن/خاموش کردن گزارش روزانه آگهی‌های جدید
/settings — نمایش تنظیمات
/forget — پاک کردن رزومه و اطلاعات شما`,
    working: '⏳ رزومه دریافت شد. در حال تحلیل و جستجو در سایت‌های کاریابی… (۱ تا ۳ دقیقه)',
    busy: 'یک جستجو برای شما در حال انجام است، لطفاً صبر کنید.',
    noResume: 'اول رزومه‌تان را بفرستید (فایل PDF/DOCX یا متن).',
    unreadable: 'نتوانستم متن کافی از فایل بخوانم. اگر PDF اسکن‌شده است، نسخه Word یا متنی بفرستید.',
    saved: '✅ ذخیره شد.',
    forgot: '🗑 رزومه و تنظیمات شما پاک شد.',
    dailyOn: '🔔 گزارش روزانه روشن شد. هر روز آگهی‌های جدید را برایتان می‌فرستم.',
    dailyOff: '🔕 گزارش روزانه خاموش شد.',
    noNew: 'امروز آگهی جدیدی پیدا نشد.',
    denied: 'دسترسی به این ربات محدود است.',
    error: '❌ خطا در پردازش. دوباره تلاش کنید.',
    pitchButtons: '✉️ نامه آماده برای هر موقعیت:',
    report: '📄 گزارش کامل (در مرورگر باز کنید)',
  },
  en: {
    welcome: `Hi! 👋 I'm <b>jobreferrer</b>.

Send me your resume (PDF, Word or text) and I will:
• search dozens of job boards for roles with <b>visa sponsorship and relocation</b>
• write a <b>tailored cover letter and recruiter message</b> for each job
• list matching <b>freelance</b> projects
• recommend countries, visa routes and a <b>4-week plan</b>

⚙️ Settings:
/countries DE NL GB CA — target countries
/nationality IR — your passport (adds specific warnings)
/title Data Engineer — force a job title
/lang fa — report language (fa or en)
/jobs — search again with your saved resume
/daily — toggle a daily digest of new jobs
/settings — show settings
/forget — delete your resume and data`,
    working: '⏳ Got it. Reading your resume and searching job boards… (1–3 minutes)',
    busy: 'A search is already running for you, please wait.',
    noResume: 'Send your resume first (PDF/DOCX file or text).',
    unreadable: 'I could not read enough text. If it is a scanned PDF, send a Word or text version.',
    saved: '✅ Saved.',
    forgot: '🗑 Your resume and settings were deleted.',
    dailyOn: '🔔 Daily digest on. I will send new matches every day.',
    dailyOff: '🔕 Daily digest off.',
    noNew: 'No new jobs today.',
    denied: 'Access to this bot is restricted.',
    error: '❌ Something went wrong. Please try again.',
    pitchButtons: '✉️ Ready-made letter for each job:',
    report: '📄 Full report (open in a browser)',
  },
};

async function loadState() {
  try {
    state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    state = { users: {} };
  }
}
async function saveState() {
  await mkdir(config.cacheDir, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state));
}

function user(chatId) {
  state.users[chatId] ??= { lang: config.defaults.lang, countries: config.defaults.countries, nationality: '', title: '', resume: '', daily: false, lastDaily: 0 };
  return state.users[chatId];
}

const allowed = (fromId) => !config.telegram.allowedUsers.length || config.telegram.allowedUsers.includes(String(fromId));

async function search(chatId, { onlyNew = false, quiet = false } = {}) {
  const u = user(chatId);
  const tx = TEXT[u.lang] ?? TEXT.fa;
  if (!u.resume) return sendMessages(chatId, [tx.noResume]);
  if (running.has(chatId)) return sendMessages(chatId, [tx.busy]);
  running.add(chatId);
  try {
    if (!quiet) await sendMessages(chatId, [tx.working]);
    await tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
    const report = await run({
      text: u.resume,
      countries: u.countries,
      lang: u.lang,
      nationality: u.nationality,
      overrides: u.title ? { titles: [u.title], searchQueries: [u.title.toLowerCase()], headline: u.title } : {},
      seenFile: join(config.cacheDir, `seen-${chatId}.json`),
    });
    lastReports.set(chatId, report);
    if (onlyNew && !report.jobs.some((j) => j.isNew)) return sendMessages(chatId, [tx.noNew]);
    await sendMessages(chatId, toTelegram(report, { onlyNew }));
    const withPitch = report.jobs.map((j, i) => [j, i]).filter(([j]) => j.pitch).slice(0, 10);
    if (withPitch.length) {
      const rows = [];
      for (let i = 0; i < withPitch.length; i += 5) rows.push(withPitch.slice(i, i + 5).map(([, idx]) => ({ text: `✉️ ${idx + 1}`, callback_data: `pitch:${idx}` })));
      await tg('sendMessage', { chat_id: chatId, text: tx.pitchButtons, reply_markup: { inline_keyboard: rows } });
    }
    await sendDocument(chatId, `jobreferrer-${report.generatedAt.slice(0, 10)}.html`, toHtml(report), tx.report);
  } catch (err) {
    console.error(`[bot] search failed for ${chatId}:`, err);
    await sendMessages(chatId, [tx.error]).catch(() => {});
  } finally {
    running.delete(chatId);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const u = user(chatId);
  const tx = TEXT[u.lang] ?? TEXT.fa;
  if (!allowed(msg.from?.id)) return sendMessages(chatId, [tx.denied]);
  const text = (msg.text ?? '').trim();
  const [cmd, ...args] = text.split(/\s+/);
  const arg = args.join(' ').trim();

  switch (cmd.replace(/@.*$/, '')) {
    case '/start':
    case '/help':
      return sendMessages(chatId, [tx.welcome]);
    case '/countries': {
      const codes = arg.toUpperCase().split(/[\s,]+/).filter((c) => COUNTRIES[c]);
      if (codes.length) (u.countries = codes), await saveState();
      return sendMessages(chatId, [`${tx.saved} ${u.countries.join(', ')}\n\n${Object.entries(COUNTRIES).map(([c, v]) => `${c} ${u.lang === 'fa' ? v.fa : v.name}`).join(' · ')}`]);
    }
    case '/nationality':
      u.nationality = arg.toUpperCase().slice(0, 2);
      await saveState();
      return sendMessages(chatId, [`${tx.saved} ${u.nationality || '—'}`]);
    case '/title':
      u.title = arg.slice(0, 60);
      await saveState();
      return sendMessages(chatId, [`${tx.saved} ${u.title || '—'}`]);
    case '/lang':
      u.lang = arg === 'en' ? 'en' : 'fa';
      await saveState();
      return sendMessages(chatId, [TEXT[u.lang].saved]);
    case '/settings':
      return sendMessages(chatId, [`countries: ${u.countries.join(', ')}\nnationality: ${u.nationality || '—'}\ntitle: ${u.title || 'auto'}\nlang: ${u.lang}\ndaily: ${u.daily ? 'on' : 'off'}\nresume: ${u.resume ? `${u.resume.length} chars` : '—'}`]);
    case '/daily':
      u.daily = !u.daily;
      u.lastDaily = Date.now();
      await saveState();
      return sendMessages(chatId, [u.daily ? tx.dailyOn : tx.dailyOff]);
    case '/forget':
      delete state.users[chatId];
      lastReports.delete(chatId);
      await saveState();
      return sendMessages(chatId, [tx.forgot]);
    case '/jobs':
      return search(chatId);
    default:
      break;
  }

  if (msg.document) {
    const doc = msg.document;
    if (doc.file_size > 10 * 1024 * 1024) return sendMessages(chatId, [tx.unreadable]);
    const buffer = await downloadFile(doc.file_id);
    const resume = await extractText(buffer, doc.file_name ?? '');
    if (resume.length < 80) return sendMessages(chatId, [tx.unreadable]);
    u.resume = resume.slice(0, 30000);
    await saveState();
    return search(chatId);
  }
  if (text.length > 300 && !text.startsWith('/')) {
    u.resume = text.slice(0, 30000);
    await saveState();
    return search(chatId);
  }
  return sendMessages(chatId, [tx.welcome]);
}

async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  await tg('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});
  const m = cb.data?.match(/^pitch:(\d+)$/);
  const report = lastReports.get(chatId);
  if (!m || !report) return sendMessages(chatId, [(TEXT[user(chatId).lang] ?? TEXT.fa).noResume]);
  return sendMessages(chatId, pitchMessages(report, Number(m[1])));
}

async function dailyTick() {
  for (const [chatId, u] of Object.entries(state.users)) {
    if (!u.daily || !u.resume || Date.now() - (u.lastDaily ?? 0) < DAY) continue;
    u.lastDaily = Date.now();
    await saveState();
    await search(chatId, { onlyNew: true, quiet: true });
  }
}

export async function startBot() {
  if (!config.telegram.token) {
    console.error('Set TELEGRAM_BOT_TOKEN (from @BotFather) first.');
    process.exit(1);
  }
  await loadState();
  const me = await tg('getMe');
  // Long polling and webhooks are exclusive; make sure no stale webhook is set.
  await tg('deleteWebhook', { drop_pending_updates: false });
  await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'Help / راهنما' },
      { command: 'jobs', description: 'Search again / جستجوی دوباره' },
      { command: 'countries', description: 'Target countries / کشورهای هدف' },
      { command: 'nationality', description: 'Passport country / ملیت' },
      { command: 'title', description: 'Job title / عنوان شغلی' },
      { command: 'daily', description: 'Daily digest / گزارش روزانه' },
      { command: 'lang', description: 'fa | en' },
      { command: 'settings', description: 'Settings / تنظیمات' },
      { command: 'forget', description: 'Delete my data / حذف اطلاعات' },
    ],
  });
  console.log(`jobreferrer bot @${me.username} is running`);
  setInterval(() => dailyTick().catch((e) => console.error('[bot] daily', e)), 15 * 60 * 1000);

  let offset = 0;
  for (;;) {
    try {
      const updates = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
      for (const up of updates) {
        offset = up.update_id + 1;
        // Handle each update without blocking the poll loop (searches take minutes).
        const job = up.message ? handleMessage(up.message) : up.callback_query ? handleCallback(up.callback_query) : null;
        job?.catch((e) => console.error('[bot] update failed', e));
      }
    } catch (err) {
      console.error('[bot] polling error:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) startBot();
