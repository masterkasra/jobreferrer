// Read a job ad for the things that matter when you need to move countries:
// visa sponsorship, relocation help, language requirements and scam patterns.

const VISA = /visa[- ]sponsor|sponsorship (is |will be )?(available|provided|offered|possible)|(we|will|can|happy to|able to) sponsor|sponsor (your |a |the )?(work )?(visa|permit)|blue card|work permit (support|assistance|sponsorship)|h-?1b|skilled worker (visa|route)|tier 2|highly skilled migrant|kennismigrant|visa (support|assistance|help|processing)|immigration support|relocation and visa|visa and relocation/i;
const NO_VISA = /no (visa )?sponsorship|(not|un)able to (offer |provide )?sponsor|cannot (offer |provide )?sponsor|can'?t sponsor|do(es)? not (offer |provide )?(visa )?sponsor|without (the need for )?(visa )?sponsorship|must (already )?(have|hold|possess) (the |a |valid )?(right|authori[sz]ation|permit) to work|eu (citizens|passport) only|us citizens? only|must be a (us|u\.s\.) citizen|security clearance|green card holders?/i;
const RELOCATION = /relocation (package|support|assistance|bonus|budget|allowance|help|costs?|is (provided|offered|available|covered))|help (you )?(to )?relocate|we (will )?(help )?relocate|relocate you|moving (costs|allowance|expenses)|relocation to [A-Z]/i;
const REMOTE = /\bremote\b|work from home|wfh|work from anywhere|distributed team|fully remote|home[- ]office/i;
const LANG_REQ = /(fluent|fluency in|business[- ]level|native|proficient|very good|excellent|good|strong|working knowledge of)\s+(german|dutch|french|swedish|danish|finnish|norwegian|italian|spanish|polish|czech|portuguese|japanese|arabic)|(german|dutch|french|swedish|danish|finnish|norwegian|italian|spanish|polish|czech|portuguese|japanese|arabic)\s*(\(|-|:)?\s*(c1|c2|b2|fluent|native|business)|deutschkenntnisse|deutsch (in wort und schrift|fließend|verhandlungssicher)|nederlands (vloeiend|spreken)/gi;
const SCAM = [
  [/(registration|application|processing|training|placement|visa|onboarding)\s+fees?/i, 'asks for a fee'],
  [/(send|transfer) (money|payment)|western union|moneygram|gift cards?|crypto(currency)? payment/i, 'asks you to send money'],
  [/(whatsapp|telegram|signal)\s+(only|us at|me at)|contact (us|me) (on|via) (whatsapp|telegram)/i, 'contact only via messenger'],
  [/guaranteed (job|visa|work permit|placement)|100% (visa|job|approval)|visa guaranteed/i, 'guarantees a visa/job'],
  [/no (interview|experience) (needed|required).*(visa|relocat)/i, 'no interview but offers visa'],
  [/earn \$?\d{3,5} (per|a) (day|week) from home/i, 'too-good-to-be-true pay'],
];

export function detectSignals(text = '', extra = {}) {
  const t = text.replace(/\s+/g, ' ');
  const noVisa = NO_VISA.test(t);
  const languages = [...new Set([...t.matchAll(LANG_REQ)].map((m) => normaliseLang(m[2] || m[3] || m[0])).filter(Boolean))];
  return {
    visa: (Boolean(extra.visa) || VISA.test(t)) && !noVisa,
    noVisa,
    relocation: Boolean(extra.relocation) || RELOCATION.test(t),
    remote: Boolean(extra.remote) || REMOTE.test(t),
    languages,
    scamFlags: SCAM.filter(([re]) => re.test(t)).map(([, label]) => label),
  };
}

function normaliseLang(s = '') {
  const m = s.toLowerCase().match(/german|deutsch|dutch|nederlands|french|swedish|danish|finnish|norwegian|italian|spanish|polish|czech|portuguese|japanese|arabic/);
  if (!m) return '';
  const map = { deutsch: 'German', nederlands: 'Dutch' };
  return map[m[0]] ?? m[0][0].toUpperCase() + m[0].slice(1);
}

/** Pull a salary range out of free text such as "€60,000 - €75,000" or "$120k". */
export function parseSalary(text = '') {
  const m = text.match(/(€|\$|£|eur|usd|gbp|chf|sek|cad|aud|aed)\s?(\d{2,3}(?:[.,]\d{3})+|\d{2,3}\s?k)(?:\s*(?:-|–|to)\s*(?:€|\$|£|eur|usd|gbp|chf|sek|cad|aud|aed)?\s?(\d{2,3}(?:[.,]\d{3})+|\d{2,3}\s?k))?/i);
  if (!m) return null;
  const num = (s) => (s ? (/k$/i.test(s.trim()) ? Number(s.replace(/\D/g, '')) * 1000 : Number(s.replace(/\D/g, ''))) : null);
  const cur = { '€': 'EUR', $: 'USD', '£': 'GBP' }[m[1]] ?? m[1].toUpperCase();
  const min = num(m[2]);
  const max = num(m[3]) ?? min;
  if (!min || min < 1000) return null;
  return { min, max, currency: cur, period: 'year' };
}
