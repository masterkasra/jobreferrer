import { config } from '../config.js';

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
  }
}

/**
 * fetch() with a timeout, a descriptive User-Agent and one retry on 429/5xx.
 */
export async function request(url, { timeout = 15000, retries = 1, headers = {}, ...opts } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...opts,
      headers: { 'User-Agent': config.userAgent, Accept: 'application/json, text/xml, */*', ...headers },
      signal: AbortSignal.timeout(timeout),
    });
    if (res.ok) return res;
    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new HttpError(res.status, url.split('?')[0]);
  }
}

export const getJson = async (url, opts) => (await request(url, opts)).json();
export const getText = async (url, opts) => (await request(url, opts)).text();
