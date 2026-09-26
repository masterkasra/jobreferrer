// Ready-made search links for the big boards that have no free API
// (LinkedIn, Indeed, StepStone, SEEK, Bayt…). One tap opens the right search.

import { COUNTRY_NAMES } from '../jobs/geo.js';

const e = encodeURIComponent;
const dash = (q) => q.trim().toLowerCase().replace(/\s+/g, '-');

const INDEED = {
  DE: 'de', NL: 'nl', GB: 'uk', IE: 'ie', CA: 'ca', AU: 'au', SE: 'se', AT: 'at', CH: 'ch', ES: 'es', PT: 'pt',
  FR: 'fr', IT: 'it', PL: 'pl', AE: 'ae', SG: 'sg', US: 'www', NZ: 'nz', BE: 'be', FI: 'fi', DK: 'dk', NO: 'no',
  JP: 'jp', SA: 'sa', QA: 'qa', LU: 'lu', CZ: 'cz', HU: 'hu', RO: 'ro', TR: 'tr', MY: 'malaysia',
};

const NATIONAL = {
  DE: (q) => [
    ['StepStone', `https://www.stepstone.de/jobs/${dash(q)}`],
    ['XING Jobs', `https://www.xing.com/jobs/search?keywords=${e(q)}`],
    ['Bundesagentur für Arbeit', `https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=1&was=${e(q)}`],
    ['Make it in Germany (official)', 'https://www.make-it-in-germany.com/en/working-in-germany/job-listings'],
    ['GermanTechJobs', 'https://germantechjobs.de/'],
    ['Berlin Startup Jobs', `https://berlinstartupjobs.com/?s=${e(q)}`],
  ],
  NL: (q) => [
    ['Nationale Vacaturebank', `https://www.nationalevacaturebank.nl/vacature/zoeken?query=${e(q)}`],
    ['Undutchables (English-speaking roles)', 'https://undutchables.nl/'],
    ['IND recognised sponsors (check employer)', 'https://ind.nl/en/public-register-recognised-sponsors'],
  ],
  GB: (q) => [
    ['Reed', `https://www.reed.co.uk/jobs/${dash(q)}-jobs`],
    ['Totaljobs', `https://www.totaljobs.com/jobs/${dash(q)}`],
    ['Find a job (GOV.UK)', `https://findajob.dwp.gov.uk/search?q=${e(q)}`],
    ['Licensed visa sponsors register', 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers'],
  ],
  IE: (q) => [
    ['IrishJobs', `https://www.irishjobs.ie/jobs/${dash(q)}`],
    ['Jobs.ie', `https://www.jobs.ie/jobs/?q=${e(q)}`],
  ],
  SE: (q) => [
    ['Platsbanken (Arbetsförmedlingen)', `https://arbetsformedlingen.se/platsbanken/annonser?q=${e(q)}`],
    ['The Hub (Nordic startups)', `https://thehub.io/jobs?search=${e(q)}`],
  ],
  FI: (q) => [
    ['Duunitori', `https://duunitori.fi/tyopaikat?haku=${e(q)}`],
    ['Work in Finland (official)', 'https://www.workinfinland.com/en/'],
    ['The Hub (Nordic startups)', `https://thehub.io/jobs?search=${e(q)}`],
  ],
  DK: (q) => [
    ['Jobindex', `https://www.jobindex.dk/jobsoegning?q=${e(q)}`],
    ['Work in Denmark (official)', 'https://www.workindenmark.dk/'],
  ],
  NO: (q) => [['FINN jobb', `https://www.finn.no/job/fulltime/search.html?q=${e(q)}`]],
  AT: (q) => [
    ['karriere.at', `https://www.karriere.at/jobs/${dash(q)}`],
    ['AMS eJob-Room', `https://jobs.ams.at/public/emps/jobs?query=${e(q)}`],
  ],
  CH: (q) => [
    ['jobs.ch', `https://www.jobs.ch/en/vacancies/?term=${e(q)}`],
    ['SwissDevJobs', 'https://swissdevjobs.ch/'],
  ],
  PT: (q) => [
    ['Landing.jobs', `https://landing.jobs/jobs?search=${e(q)}`],
    ['ITJobs.pt', `https://www.itjobs.pt/emprego?q=${e(q)}`],
  ],
  ES: (q) => [
    ['InfoJobs', `https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=${e(q)}`],
    ['Tecnoempleo', `https://www.tecnoempleo.com/ofertas-trabajo/?te=${e(q)}`],
  ],
  PL: (q) => [
    ['No Fluff Jobs', `https://nofluffjobs.com/?criteria=${e(q)}`],
    ['Just Join IT', 'https://justjoin.it/'],
  ],
  EE: () => [
    ['Work in Estonia (official)', 'https://www.workinestonia.com/'],
    ['CV Keskus', 'https://www.cvkeskus.ee/'],
  ],
  CA: (q) => [
    ['Job Bank (Government of Canada)', `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${e(q)}`],
    ['Workopolis', `https://www.workopolis.com/jobsearch/find-jobs?ak=${e(q)}`],
  ],
  US: (q) => [
    ['Dice', `https://www.dice.com/jobs?q=${e(q)}`],
    ['MyVisaJobs (H-1B sponsors)', 'https://www.myvisajobs.com/'],
  ],
  AU: (q) => [['SEEK', `https://www.seek.com.au/${dash(q)}-jobs`]],
  NZ: (q) => [['SEEK NZ', `https://www.seek.co.nz/${dash(q)}-jobs`]],
  AE: (q) => [
    ['Bayt', `https://www.bayt.com/en/uae/jobs/${dash(q)}-jobs/`],
    ['GulfTalent', `https://www.gulftalent.com/uae/jobs/search?keywords=${e(q)}`],
    ['NaukriGulf', `https://www.naukrigulf.com/${dash(q)}-jobs-in-uae`],
  ],
  SA: (q) => [['Bayt', `https://www.bayt.com/en/saudi-arabia/jobs/${dash(q)}-jobs/`]],
  QA: (q) => [['Bayt', `https://www.bayt.com/en/qatar/jobs/${dash(q)}-jobs/`]],
  SG: (q) => [['MyCareersFuture', `https://www.mycareersfuture.gov.sg/search?search=${e(q)}`]],
  JP: () => [
    ['Japan Dev', 'https://japan-dev.com/jobs'],
    ['TokyoDev', 'https://www.tokyodev.com/jobs'],
  ],
  FR: (q) => [['Welcome to the Jungle', `https://www.welcometothejungle.com/en/jobs?query=${e(q)}`]],
  TR: (q) => [['Kariyer.net', `https://www.kariyer.net/is-ilanlari?kw=${e(q)}`]],
};

const TECH = new Set(['software', 'data', 'devops', 'security', 'qa']);

export function searchLinks(profile, countries) {
  const q = profile.searchQueries?.[0] || profile.titles?.[0] || 'software engineer';
  const groups = [];

  groups.push({
    group: 'global',
    links: [
      ['LinkedIn — visa sponsorship, last 7 days', `https://www.linkedin.com/jobs/search/?keywords=${e(`${q} visa sponsorship`)}&f_TPR=r604800`],
      ['LinkedIn — relocation, last 7 days', `https://www.linkedin.com/jobs/search/?keywords=${e(`${q} relocation`)}&f_TPR=r604800`],
      ['Google Jobs', `https://www.google.com/search?q=${e(`${q} jobs visa sponsorship`)}&ibp=htl;jobs`],
      ['Relocate.me (hand-checked relocation jobs)', `https://relocate.me/search?query=${e(q)}`],
      ['Visa Sponsor Jobs', 'https://visasponsor.jobs/'],
      ['Jaabz (visa & relocation jobs)', 'https://jaabz.com/'],
      ['EURES (EU job mobility portal)', 'https://europa.eu/eures/portal/jv-se/home'],
      ...(TECH.has(profile.roleFamily)
        ? [
            ['Wellfound (startups, many sponsor)', `https://wellfound.com/role/${dash(q)}`],
            ['Landing.jobs (EU tech, relocation)', `https://landing.jobs/jobs?search=${e(q)}`],
            ['Levels.fyi jobs (with salary data)', `https://www.levels.fyi/jobs?searchText=${e(q)}`],
          ]
        : []),
    ].map(([name, url]) => ({ name, url })),
  });

  for (const code of countries) {
    const links = [];
    const sub = INDEED[code];
    const where = COUNTRY_NAMES[code] ?? code;
    links.push({ name: `LinkedIn — ${where}`, url: `https://www.linkedin.com/jobs/search/?keywords=${e(q)}&location=${e(where)}&f_TPR=r604800` });
    if (sub) links.push({ name: `Indeed ${code}`, url: `https://${sub}.indeed.com/jobs?q=${e(`${q} visa sponsorship`)}` });
    links.push({ name: `Glassdoor — ${where}`, url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${e(`${q} ${where}`)}` });
    for (const [name, url] of NATIONAL[code]?.(q) ?? []) links.push({ name, url });
    groups.push({ group: code, links });
  }

  const skill = profile.skills?.[0] ?? q;
  const freelance = [
    ['Upwork', `https://www.upwork.com/nx/search/jobs/?q=${e(skill)}`],
    ['Fiverr (see competing gigs)', `https://www.fiverr.com/search/gigs?query=${e(skill)}`],
    ['PeoplePerHour', `https://www.peopleperhour.com/freelance-jobs?q=${e(skill)}`],
    ['Guru', `https://www.guru.com/d/jobs/q/${e(skill)}/`],
    ['Contra', 'https://contra.com/'],
    ['Malt (Europe)', 'https://www.malt.com/'],
    ['Toptal (top 3%, high rates)', 'https://www.toptal.com/talent/apply'],
    ...(TECH.has(profile.roleFamily)
      ? [
          ['Arc.dev (remote dev jobs)', 'https://arc.dev/remote-jobs'],
          ['Lemon.io (vetted devs)', 'https://lemon.io/for-developers/'],
          ['Turing (long-term remote)', 'https://www.turing.com/jobs'],
          ['Braintrust', 'https://www.usebraintrust.com/'],
        ]
      : []),
    ['Ponisha (Iranian freelance market)', `https://ponisha.ir/search/projects?q=${e(skill)}`],
    ['Karlancer (Iranian freelance market)', 'https://www.karlancer.com/'],
  ];
  groups.push({ group: 'freelance', links: freelance.map(([name, url]) => ({ name, url })) });
  return groups;
}
