// Central configuration. Everything is optional: with no keys at all the bot
// still searches the free job boards and writes template-based pitches.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env loader so `npm start` works without extra dependencies.
function loadDotEnv(file = '.env') {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadDotEnv();

const env = (name, fallback = '') => (process.env[name] ?? fallback).trim();
const list = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  anthropic: {
    apiKey: env('ANTHROPIC_API_KEY'),
    model: env('CLAUDE_MODEL', 'claude-opus-5'),
    // Server-side refusal fallbacks; set CLAUDE_FALLBACKS=off to disable.
    fallbacks: env('CLAUDE_FALLBACKS', 'default') !== 'off',
  },
  adzuna: { appId: env('ADZUNA_APP_ID'), appKey: env('ADZUNA_APP_KEY') },
  jooble: { apiKey: env('JOOBLE_API_KEY') },
  reed: { apiKey: env('REED_API_KEY') },
  telegram: {
    token: env('TELEGRAM_BOT_TOKEN'),
    chatId: env('TELEGRAM_CHAT_ID'),
    allowedUsers: list(env('TELEGRAM_ALLOWED_USERS')),
  },
  defaults: {
    countries: list(env('TARGET_COUNTRIES', 'DE,NL,GB,IE,SE,CA,AE')),
    lang: env('REPORT_LANG', 'fa'),
    topJobs: Number(env('TOP_JOBS', '25')),
    pitches: Number(env('PITCH_COUNT', '10')),
  },
  cacheDir: resolve(process.cwd(), env('CACHE_DIR', '.cache')),
  userAgent: 'jobreferrer/1.0 (+https://github.com/masterkasra/jobreferrer)',
};

export const hasClaude = () => Boolean(config.anthropic.apiKey || process.env.ANTHROPIC_AUTH_TOKEN);
