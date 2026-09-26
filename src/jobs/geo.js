// Map free-text job locations to ISO country codes.

export const COUNTRY_NAMES = {
  DE: 'Germany', NL: 'Netherlands', GB: 'United Kingdom', IE: 'Ireland', SE: 'Sweden', FI: 'Finland',
  DK: 'Denmark', NO: 'Norway', AT: 'Austria', CH: 'Switzerland', PT: 'Portugal', ES: 'Spain', FR: 'France',
  IT: 'Italy', PL: 'Poland', CZ: 'Czechia', EE: 'Estonia', LU: 'Luxembourg', BE: 'Belgium', CA: 'Canada',
  US: 'United States', AU: 'Australia', NZ: 'New Zealand', AE: 'United Arab Emirates', SA: 'Saudi Arabia',
  QA: 'Qatar', SG: 'Singapore', JP: 'Japan', TR: 'Turkey', MY: 'Malaysia', CY: 'Cyprus', GE: 'Georgia',
  AM: 'Armenia', HU: 'Hungary', RO: 'Romania', LT: 'Lithuania', LV: 'Latvia', GR: 'Greece', IN: 'India',
};

const PLACES = {
  DE: ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'muenchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'koeln', 'stuttgart', 'düsseldorf', 'dusseldorf', 'leipzig', 'dresden', 'nuremberg', 'nürnberg', 'karlsruhe', 'bonn', 'hannover', 'mannheim', 'essen', 'dortmund', 'bremen', 'heidelberg'],
  NL: ['netherlands', 'nederland', 'holland', 'amsterdam', 'rotterdam', 'utrecht', 'eindhoven', 'the hague', 'den haag', 'delft', 'leiden', 'groningen'],
  GB: ['united kingdom', 'uk', 'england', 'scotland', 'wales', 'london', 'manchester', 'edinburgh', 'glasgow', 'cambridge', 'oxford', 'bristol', 'birmingham', 'leeds', 'belfast'],
  IE: ['ireland', 'dublin', 'cork', 'galway', 'limerick'],
  SE: ['sweden', 'stockholm', 'gothenburg', 'göteborg', 'malmö', 'malmo', 'uppsala', 'lund'],
  FI: ['finland', 'helsinki', 'espoo', 'tampere', 'oulu'],
  DK: ['denmark', 'copenhagen', 'københavn', 'aarhus'],
  NO: ['norway', 'oslo', 'bergen', 'trondheim'],
  AT: ['austria', 'österreich', 'vienna', 'wien', 'graz', 'linz', 'salzburg'],
  CH: ['switzerland', 'schweiz', 'suisse', 'zurich', 'zürich', 'geneva', 'genève', 'basel', 'lausanne', 'bern'],
  PT: ['portugal', 'lisbon', 'lisboa', 'porto', 'braga'],
  ES: ['spain', 'españa', 'madrid', 'barcelona', 'valencia', 'malaga', 'málaga', 'seville'],
  FR: ['france', 'paris', 'lyon', 'toulouse', 'marseille', 'nantes'],
  IT: ['italy', 'italia', 'milan', 'milano', 'rome', 'roma', 'turin', 'torino'],
  PL: ['poland', 'polska', 'warsaw', 'warszawa', 'krakow', 'kraków', 'wroclaw', 'wrocław', 'gdansk', 'gdańsk', 'poznan'],
  CZ: ['czech', 'czechia', 'prague', 'praha', 'brno'],
  EE: ['estonia', 'tallinn', 'tartu'],
  LU: ['luxembourg'],
  BE: ['belgium', 'brussels', 'bruxelles', 'antwerp', 'ghent'],
  CA: ['canada', 'toronto', 'vancouver', 'montreal', 'montréal', 'calgary', 'ottawa', 'edmonton', 'waterloo', 'ontario', 'british columbia', 'quebec', 'alberta'],
  US: ['united states', 'usa', 'u.s.', 'new york', 'san francisco', 'seattle', 'austin', 'boston', 'chicago', 'los angeles', 'california', 'texas', 'washington, dc', 'denver', 'atlanta'],
  AU: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra'],
  NZ: ['new zealand', 'auckland', 'wellington', 'christchurch'],
  AE: ['united arab emirates', 'uae', 'dubai', 'abu dhabi', 'sharjah'],
  SA: ['saudi arabia', 'riyadh', 'jeddah', 'ksa'],
  QA: ['qatar', 'doha'],
  SG: ['singapore'],
  JP: ['japan', 'tokyo', 'osaka'],
  TR: ['turkey', 'türkiye', 'istanbul', 'ankara', 'izmir'],
  MY: ['malaysia', 'kuala lumpur'],
  CY: ['cyprus', 'limassol', 'nicosia', 'larnaca'],
  GE: ['georgia, tbilisi', 'tbilisi', 'batumi'],
  AM: ['armenia', 'yerevan'],
  HU: ['hungary', 'budapest'],
  RO: ['romania', 'bucharest', 'cluj'],
  LT: ['lithuania', 'vilnius', 'kaunas'],
  LV: ['latvia', 'riga'],
  GR: ['greece', 'athens', 'thessaloniki'],
  IN: ['india', 'bangalore', 'bengaluru', 'hyderabad', 'pune', 'mumbai', 'delhi', 'chennai'],
};

const EU = new Set(['DE', 'NL', 'IE', 'SE', 'FI', 'DK', 'AT', 'PT', 'ES', 'FR', 'IT', 'PL', 'CZ', 'EE', 'LU', 'BE', 'CY', 'HU', 'RO', 'LT', 'LV', 'GR']);
export const isEU = (code) => EU.has(code);

const compiled = Object.entries(PLACES).map(([code, names]) => [
  code,
  new RegExp(`(^|[^\\p{L}])(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[^\\p{L}])`, 'iu'),
]);

/** Return the ISO codes mentioned in a location string, in order of appearance. */
export function countriesIn(text = '') {
  const hits = [];
  for (const [code, re] of compiled) {
    const m = text.match(re);
    if (m) hits.push([code, m.index]);
  }
  return hits.sort((a, b) => a[1] - b[1]).map(([c]) => c);
}

export function countryOf(text = '') {
  return countriesIn(text)[0] ?? '';
}

/** Region hints for remote roles: 'WW' (worldwide), 'EU' (Europe/EMEA), '' otherwise. */
export function regionOf(text = '') {
  if (/worldwide|anywhere|global|any location|all countries/i.test(text)) return 'WW';
  if (/\b(europe|eu|emea|european union|cet|cest)\b/i.test(text)) return 'EU';
  return '';
}
