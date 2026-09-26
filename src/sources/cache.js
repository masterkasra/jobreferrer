// Tiny disk cache so repeated runs (and the daily digest) stay polite to the
// free job-board APIs, several of which ask for low request volumes.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { config } from '../config.js';

let enabled = !process.env.NODE_TEST_CONTEXT;
export const setCacheEnabled = (on) => (enabled = on);

export async function cached(key, ttlMs, fn) {
  if (!enabled || ttlMs <= 0) return fn();
  const file = join(config.cacheDir, `${createHash('sha1').update(key).digest('hex')}.json`);
  try {
    const { at, value } = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - at < ttlMs) return value;
  } catch {
    // Missing or unreadable cache entry: fetch fresh.
  }
  const value = await fn();
  try {
    await mkdir(config.cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Read-only filesystems (serverless) just skip caching.
  }
  return value;
}

export const HOURS = 3600 * 1000;
