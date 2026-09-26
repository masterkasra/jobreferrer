// Local web UI: upload a resume in the browser, get the HTML report back.
//   npm run web   →  http://localhost:3000

import { createServer } from 'node:http';
import { loadResume, resumeErrorMessage } from '../resume/load.js';
import { run } from '../pipeline.js';
import { toHtml } from '../report/html.js';
import { COUNTRIES } from '../immigration/countries.js';
import { config, hasClaude } from '../config.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const MAX = 10 * 1024 * 1024;

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => `<option value="${l}">${l || '—'}</option>`).join('');

const page = () => `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>jobreferrer</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f6f7fb;--card:#fff;--ink:#16181d;--muted:#5d6472;--line:#e3e6ee;--accent:#2f6fed}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--ink:#e8eaf0;--muted:#9aa2b2;--line:#2a2f3a;--accent:#6a9cff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 Vazirmatn,system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:32px 16px}form{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}
label{display:block;margin:14px 0 6px;font-weight:700}input[type=text],select{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}
.drop{border:2px dashed var(--line);border-radius:12px;padding:28px;text-align:center;cursor:pointer}.drop.has{border-color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px}.grid label{font-weight:400;margin:0}
button{margin-top:18px;width:100%;padding:12px;border:0;border-radius:10px;background:var(--accent);color:#fff;font:700 16px Vazirmatn,sans-serif;cursor:pointer}button:disabled{opacity:.6}
.muted{color:var(--muted);font-size:.9rem}
.more{margin-top:14px;border:1px solid var(--line);border-radius:12px;padding:8px 12px}.more summary{cursor:pointer;font-weight:700;color:var(--accent)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.row4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
input[type=number]{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}
</style></head><body><main>
<h1>jobreferrer</h1>
<p class="muted">رزومه بدهید؛ موقعیت‌های دارای اسپانسر ویزا و جابه‌جایی، پروژه‌های فریلنسری، نامه آماده برای هر کارفرما و برنامه مهاجرت بگیرید. ${hasClaude() ? `حالت هوش مصنوعی فعال است (${config.anthropic.model}).` : 'حالت بدون هوش مصنوعی (برای متن‌های شخصی‌تر ANTHROPIC_API_KEY را تنظیم کنید).'}</p>
<form id="f">
<label>رزومه (PDF، Word، ODT، RTF، متن یا عکس)</label>
<div class="drop" id="drop"><span id="dl">فایل را اینجا بکشید یا کلیک کنید</span><input type="file" id="file" accept=".pdf,.docx,.doc,.odt,.rtf,.txt,.md,.html,.json,.jpg,.jpeg,.png,.webp" hidden></div>
<label>کشورهای هدف</label>
<div class="grid">${Object.entries(COUNTRIES).map(([c, v]) => `<label><input type="checkbox" name="c" value="${c}" ${config.defaults.countries.includes(c) ? 'checked' : ''}> ${v.fa}</label>`).join('')}</div>
<label>ملیت (کد دوحرفی پاسپورت)</label><input type="text" id="nat" value="IR" placeholder="IR" maxlength="2">
<details class="more"><summary>اطلاعات تکمیلی برای ارزیابی دقیق مهاجرت (اختیاری، ۱ دقیقه)</summary>
<p class="muted">با این‌ها امتیاز شما در سیستم‌های رسمی (اکسپرس انتری کانادا، فرصت شغلی آلمان، امتیاز استرالیا) دقیق محاسبه می‌شود. هیچ‌کدام ذخیره نمی‌شود.</p>
<div class="row"><div><label>سن</label><input type="number" id="age" min="16" max="70" placeholder="مثلاً ۳۱"></div>
<div><label>وضعیت تأهل</label><select id="married"><option value="">—</option><option value="false">مجرد</option><option value="true">متأهل (همسر همراه می‌آید)</option></select></div></div>
<div class="row"><div><label>کشور محل زندگی فعلی</label><input type="text" id="res" placeholder="مثل ملیت" maxlength="2"></div>
<div><label>بالاترین مدرک</label><select id="edu"><option value="">از رزومه</option><option value="phd">دکتری</option><option value="master">کارشناسی ارشد</option><option value="bachelor">کارشناسی</option><option value="two-year">کاردانی</option><option value="secondary">دیپلم</option></select></div></div>
<label>نمره آیلتس (جنرال) — هر مهارت</label>
<div class="row4"><input type="number" step="0.5" min="0" max="9" id="il" placeholder="Listening"><input type="number" step="0.5" min="0" max="9" id="ir" placeholder="Reading"><input type="number" step="0.5" min="0" max="9" id="iw" placeholder="Writing"><input type="number" step="0.5" min="0" max="9" id="is" placeholder="Speaking"></div>
<div class="row"><div><label>سطح آلمانی</label><select id="de">${LEVELS}</select></div><div><label>سطح فرانسوی</label><select id="fr">${LEVELS}</select></div></div>
<label><input type="checkbox" id="destay"> حداقل ۶ ماه (غیرتوریستی) در آلمان بوده‌ام</label>
</details>
<label>عنوان شغلی دلخواه (اختیاری)</label><input type="text" id="title" placeholder="مثلاً Data Engineer" maxlength="60">
<label>زبان گزارش</label><select id="lang"><option value="fa">فارسی</option><option value="en">English</option></select>
<button id="go" type="submit">جستجو</button>
<p class="muted" id="status"></p>
<p class="muted">🔒 رزومه شما فقط برای همین جستجو خوانده می‌شود و جایی ذخیره نمی‌شود.</p>
</form></main>
<script>
const drop = document.getElementById('drop'), dl = document.getElementById('dl'), file = document.getElementById('file'), status = document.getElementById('status');
drop.onclick = (e) => { if (e.target !== file) file.click(); };
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('has'); };
drop.ondrop = (e) => { e.preventDefault(); file.files = e.dataTransfer.files; dl.textContent = file.files[0].name; };
file.onchange = () => { drop.classList.add('has'); dl.textContent = file.files[0].name; };
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const f = file.files[0];
  if (!f) { status.textContent = 'اول فایل رزومه را انتخاب کنید.'; return; }
  if (f.size > 4.4 * 1024 * 1024) { status.textContent = 'حجم فایل بیشتر از ۴ مگابایت است؛ لطفاً PDF کم‌حجم‌تر یا فایل Word بفرستید.'; return; }
  const v = (id) => document.getElementById(id).value;
  const q = new URLSearchParams({ countries: [...document.querySelectorAll('[name=c]:checked')].map((x) => x.value).join(','), nationality: v('nat'), title: v('title'), lang: v('lang'),
    age: v('age'), married: v('married'), residence: v('res'), education: v('edu'), il: v('il'), ir: v('ir'), iw: v('iw'), is: v('is'), german: v('de'), french: v('fr'), destay: document.getElementById('destay').checked ? '1' : '' });
  for (const [k, val] of [...q]) if (!val) q.delete(k);
  const btn = document.getElementById('go'); btn.disabled = true; status.textContent = '⏳ در حال تحلیل رزومه، جستجو در ده‌ها سایت کاریابی و صفحه استخدام شرکت‌ها و محاسبه امتیاز مهاجرت… (۱ تا ۳ دقیقه)';
  try {
    const res = await fetch('/api/run?' + q, { method: 'POST', headers: { 'X-Filename': encodeURIComponent(f.name) }, body: f });
    const html = await res.text();
    if (!res.ok) throw new Error(html);
    document.open(); document.write(html); document.close();
  } catch (err) { status.textContent = '❌ ' + err.message; btn.disabled = false; }
};
</script></body></html>`;

const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const EDU = new Set(['phd', 'master', 'bachelor', 'two-year', 'secondary']);

/** Optional immigration facts from the form (all validated, nothing stored). */
export function applicantFrom(q) {
  const num = (k, min, max) => { const n = Number(q.get(k)); return Number.isFinite(n) && n >= min && n <= max && q.get(k) !== '' && q.get(k) !== null ? n : null; };
  const bands = { l: num('il', 0, 9), r: num('ir', 0, 9), w: num('iw', 0, 9), s: num('is', 0, 9) };
  const given = Object.values(bands).filter((b) => b !== null);
  const a = {};
  if (num('age', 16, 70)) a.age = num('age', 16, 70);
  if (q.get('married') === 'true' || q.get('married') === 'false') a.married = q.get('married') === 'true';
  if (/^[A-Za-z]{2}$/.test(q.get('residence') ?? '')) a.residence = q.get('residence').toUpperCase();
  if (EDU.has(q.get('education'))) a.education = q.get('education');
  if (given.length === 4) a.ielts = bands;
  else if (given.length) a.ielts = Math.min(...given);
  if (CEFR.has(q.get('german'))) a.german = q.get('german');
  if (CEFR.has(q.get('french'))) a.french = q.get('french');
  if (q.get('destay') === '1') a.stayInGermany = true;
  return a;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX) throw Object.assign(new Error('File too large (max 10 MB)'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

// Shared by the local server and the Vercel function (api/index.js):
// GET → upload page, POST → run the search and return the HTML report.
export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && !url.pathname.startsWith('/api/run')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page());
    }
    if (req.method === 'POST') {
      const buffer = await readBody(req);
      const name = decodeURIComponent(req.headers['x-filename'] ?? 'resume.txt');
      const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fa';
      let resume;
      try {
        resume = await loadResume(buffer, name);
      } catch (err) {
        if (!err.code) throw err;
        res.writeHead(422, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(resumeErrorMessage(err, lang));
      }
      const title = (url.searchParams.get('title') ?? '').trim().slice(0, 60);
      const report = await run({
        text: resume.text,
        pdf: resume.pdf,
        countries: (url.searchParams.get('countries') ?? '').split(',').filter((c) => COUNTRIES[c]),
        lang,
        nationality: (url.searchParams.get('nationality') ?? '').slice(0, 2),
        applicant: applicantFrom(url.searchParams),
        overrides: title ? { titles: [title], searchQueries: [title.toLowerCase()], headline: title } : {},
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(toHtml(report));
    }
    res.writeHead(404).end('Not found');
  } catch (err) {
    console.error(err);
    res.writeHead(err.status ?? 500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(err.message);
  }
}

export const server = createServer(handler);

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, HOST, () => console.log(`jobreferrer web UI: http://${HOST}:${PORT}`));
}
