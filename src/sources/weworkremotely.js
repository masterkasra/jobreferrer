// We Work Remotely public RSS feed — free, no key.
import { getText } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';

export function parseRss(xml = '') {
  const items = [];
  for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (name) => {
      const m = body.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
      return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() : '';
    };
    items.push({ title: tag('title'), link: tag('link') || tag('guid'), description: tag('description'), pubDate: tag('pubDate'), region: tag('region'), category: tag('category') });
  }
  return items;
}

export default {
  id: 'weworkremotely',
  name: 'We Work Remotely',
  kind: 'job',
  relevanceFilter: true,
  async search() {
    const url = 'https://weworkremotely.com/remote-jobs.rss';
    const xml = await cached(url, 6 * HOURS, () => getText(url));
    return parseRss(xml).map((i) => {
      const [company, ...rest] = i.title.split(':');
      return makeJob({
        source: 'weworkremotely', sourceName: 'We Work Remotely',
        title: rest.join(':').trim() || i.title, company: rest.length ? company.trim() : '',
        location: i.region || 'Remote', url: i.link, description: i.description, tags: [i.category],
        postedAt: i.pubDate, hints: { remote: true },
      });
    });
  },
};
