import { writePitches } from '../llm/claude.js';
import { templatePitch, templateTips, freelanceProposal } from './templates.js';

/**
 * Application material for each job: Claude-written when available, template
 * otherwise. Data-driven tips (salary threshold, sponsor register) are always
 * appended because the model does not see those checks.
 */
export async function generatePitches(profile, jobs, { lang = 'fa', useAI = true } = {}) {
  const ai = useAI ? await writePitches({ profile, jobs, guidanceLang: lang }) : null;
  const out = new Map();
  for (const job of jobs) {
    const fallback = templatePitch(job, profile, lang);
    const p = ai?.get(job.id);
    if (!p) {
      out.set(job.id, fallback);
      continue;
    }
    const dataTips = templateTips(job, profile, lang).filter((t) => /sponsor|اسپانسر|threshold|حداقل/i.test(t));
    out.set(job.id, { ...p, tips: [...p.tips, ...dataTips].slice(0, 6), source: 'claude' });
  }
  return out;
}

export function generateProposals(profile, gigs) {
  return new Map(gigs.map((g) => [g.id, freelanceProposal(g, profile)]));
}
