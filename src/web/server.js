// Local web UI: upload a resume in the browser, get the HTML report back.
//   npm run web   →  http://localhost:3000

import { createServer } from 'node:http';
import { extractText, detectType } from '../resume/extract.js';
import { run } from '../pipeline.js';
import { toHtml } from '../report/html.js';
import { COUNTRIES } from '../immigration/countries.js';
import { config, hasClaude } from '../config.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const MAX = 10 * 1024 * 1024;

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
</style></head><body><main>
<h1>jobreferrer</h1>
<p class="muted">رزومه بدهید؛ موقعیت‌های دارای اسپانسر ویزا و جابه‌جایی، پروژه‌های فریلنسری، نامه آماده برای هر کارفرما و برنامه مهاجرت بگیرید. ${hasClaude() ? `حالت هوش مصنوعی فعال است (${config.anthropic.model}).` : 'حالت بدون هوش مصنوعی (برای متن‌های شخصی‌تر ANTHROPIC_API_KEY را تنظیم کنید).'}</p>
<form id="f">
<label>رزومه (PDF، DOCX، TXT)</label>
<div class="drop" id="drop"><span id="dl">فایل را اینجا بکشید یا کلیک کنید</span><input type="file" id="file" accept=".pdf,.docx,.txt,.md" hidden></div>
<label>کشورهای هدف</label>
<div class="grid">${Object.entries(COUNTRIES).map(([c, v]) => `<label><input type="checkbox" name="c" value="${c}" ${config.defaults.countries.includes(c) ? 'checked' : ''}> ${v.fa}</label>`).join('')}</div>
<label>ملیت (کد دوحرفی، اختیاری)</label><input type="text" id="nat" placeholder="IR" maxlength="2">
<label>عنوان شغلی دلخواه (اختیاری)</label><input type="text" id="title" placeholder="مثلاً Data Engineer" maxlength="60">
<label>زبان گزارش</label><select id="lang"><option value="fa">فارسی</option><option value="en">English</option></select>
<button id="go" type="submit">جستجو</button>
<p class="muted" id="status"></p>
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
  const q = new URLSearchParams({ countries: [...document.querySelectorAll('[name=c]:checked')].map((x) => x.value).join(','), nationality: document.getElementById('nat').value, title: document.getElementById('title').value, lang: document.getElementById('lang').value });
  const btn = document.getElementById('go'); btn.disabled = true; status.textContent = '⏳ در حال تحلیل رزومه و جستجو در سایت‌های کاریابی… (۱ تا ۳ دقیقه)';
  try {
    const res = await fetch('/api/run?' + q, { method: 'POST', headers: { 'X-Filename': encodeURIComponent(f.name) }, body: f });
    const html = await res.text();
    if (!res.ok) throw new Error(html);
    document.open(); document.write(html); document.close();
  } catch (err) { status.textContent = '❌ ' + err.message; btn.disabled = false; }
};
</script></body></html>`;

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

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page());
    }
    if (req.method === 'POST' && url.pathname === '/api/run') {
      const buffer = await readBody(req);
      const name = decodeURIComponent(req.headers['x-filename'] ?? 'resume.txt');
      const text = await extractText(buffer, name);
      if (text.length < 80) {
        res.writeHead(422, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Could not read enough text from the resume (scanned PDF?).');
      }
      const title = (url.searchParams.get('title') ?? '').trim().slice(0, 60);
      const report = await run({
        text,
        pdf: detectType(name, buffer) === '.pdf' ? buffer : undefined,
        countries: (url.searchParams.get('countries') ?? '').split(',').filter((c) => COUNTRIES[c]),
        lang: url.searchParams.get('lang') === 'en' ? 'en' : 'fa',
        nationality: (url.searchParams.get('nationality') ?? '').slice(0, 2),
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
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, HOST, () => console.log(`jobreferrer web UI: http://${HOST}:${PORT}`));
}
