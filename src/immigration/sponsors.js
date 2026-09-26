// Cross-check employers against official sponsor registers:
//  - UK: Home Office register of licensed sponsors (CSV, updated daily)
//  - NL: IND public register of recognised sponsors (HTML table)
// A job whose employer is not on the register cannot sponsor that visa route.

import { getText } from '../sources/http.js';
import { cached, HOURS } from '../sources/cache.js';

const SUFFIX = /\b(ltd|limited|plc|llp|llc|inc|incorporated|gmbh|ag|bv|b\.v\.|nv|n\.v\.|holding|holdings|group|uk|europe|international|the|co|company|corp|corporation)\b/g;

export function normaliseCompany(name = '') {
  return name.toLowerCase().replace(/\b([a-z])\.([a-z])\.?(?=\s|$)/g, '$1$2').replace(/&/g, ' and ').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
}

export function parseCsvFirstColumn(csv) {
  const names = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const m = line.match(/^"((?:[^"]|"")*)"|^([^,]*)/);
    const value = (m[1] ?? m[2] ?? '').replace(/""/g, '"');
    if (value) names.push(normaliseCompany(value));
  }
  return names;
}

async function ukRegister() {
  return cached('uk-sponsor-register', 24 * HOURS, async () => {
    const page = await getText('https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers');
    const csvUrl = page.match(/https:\/\/assets\.publishing\.service\.gov\.uk\/[^"'\s]+\.csv/)?.[0];
    if (!csvUrl) throw new Error('UK sponsor CSV link not found');
    return [...new Set(parseCsvFirstColumn(await getText(csvUrl, { timeout: 60000 })))];
  });
}

async function nlRegister() {
  return cached('nl-sponsor-register', 24 * HOURS, async () => {
    const html = await getText('https://ind.nl/en/public-register-recognised-sponsors/public-register-regular-labour-and-highly-skilled-migrants', { timeout: 30000 });
    const cells = [...html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    return [...new Set(cells.filter((c) => c && !/^\d+$/.test(c)).map(normaliseCompany))];
  });
}

const REGISTERS = { GB: ['UK Home Office', ukRegister], NL: ['IND', nlRegister] };

/** Annotate jobs in the UK/NL with `sponsor: { register, listed }`. Never throws. */
export async function checkSponsors(jobs) {
  const status = {};
  for (const [code, [label, load]] of Object.entries(REGISTERS)) {
    const relevant = jobs.filter((j) => j.countries.includes(code) && j.company && j.kind === 'job');
    if (!relevant.length) continue;
    let names;
    try {
      names = new Set(await load());
      status[code] = { register: label, size: names.size };
    } catch (err) {
      status[code] = { register: label, error: err.message };
      continue;
    }
    for (const job of relevant) {
      const n = normaliseCompany(job.company);
      const listed = n.length > 1 && (names.has(n) || [...names].some((x) => x.startsWith(`${n} `)));
      job.sponsor = { register: label, country: code, listed };
    }
  }
  return status;
}
