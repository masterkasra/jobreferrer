// Hacker News "Ask HN: Who is hiring?" threads via the Algolia API. Many
// posts state VISA / RELOCATION explicitly, which makes them gold for movers.
import { getJson } from './http.js';
import { cached, HOURS } from './cache.js';
import { makeJob } from '../jobs/normalize.js';
import { htmlToText } from '../resume/extract.js';

export default {
  id: 'hackernews',
  name: 'HN Who is Hiring',
  kind: 'job',
  relevanceFilter: true,
  families: ['software', 'data', 'devops', 'security', 'qa', 'design', 'product'],
  async search() {
    const storiesUrl = 'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5';
    const stories = await cached(storiesUrl, 12 * HOURS, () => getJson(storiesUrl));
    const story = (stories.hits ?? []).find((h) => /who is hiring/i.test(h.title ?? ''));
    if (!story) return [];
    const out = [];
    for (const term of ['visa', 'relocation']) {
      const url = `https://hn.algolia.com/api/v1/search?tags=comment,story_${story.objectID}&query=${term}&hitsPerPage=100`;
      const data = await cached(url, 6 * HOURS, () => getJson(url));
      for (const c of data.hits ?? []) {
        if (c.parent_id && String(c.parent_id) !== String(story.objectID)) continue; // top-level posts only
        const text = htmlToText((c.comment_text ?? '').replace(/<p>/g, '\n'));
        const header = text.split('\n')[0];
        const parts = header.split('|').map((s) => s.trim()).filter(Boolean);
        if (parts.length < 2) continue;
        const location = parts.find((p) => /remote|onsite|on-site|hybrid|,|\b[A-Z]{2}\b/.test(p) && p !== parts[0]) ?? '';
        out.push(makeJob({
          source: 'hackernews', sourceName: 'HN Who is Hiring',
          title: parts.find((p, i) => i > 0 && /engineer|developer|scientist|designer|manager|analyst|sre|devops|lead|architect/i.test(p)) ?? parts[1],
          company: parts[0], location, url: `https://news.ycombinator.com/item?id=${c.objectID}`,
          description: text, postedAt: c.created_at,
        }));
      }
    }
    return out;
  },
};
