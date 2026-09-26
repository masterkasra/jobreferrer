import { heuristicProfile } from './heuristic.js';
import { canonicalSkill, ROLE_FAMILIES } from './taxonomy.js';
import { extractProfile } from '../llm/claude.js';

/**
 * Build a candidate profile from resume text. Uses Claude when configured and
 * fills any gaps from the offline parser.
 * @param {{ text: string, pdf?: Buffer, overrides?: object, useAI?: boolean }} input
 */
export async function buildProfile({ text, pdf, overrides = {}, useAI = true }) {
  const offline = heuristicProfile(text);
  const ai = useAI ? await extractProfile({ text, pdf }) : null;
  const profile = { ...offline };
  if (ai) {
    for (const [key, value] of Object.entries(ai)) {
      const empty = value === '' || value === 0 || (Array.isArray(value) && value.length === 0);
      if (!empty) profile[key] = value;
    }
  }
  profile.skills = [...new Set(profile.skills.map(canonicalSkill))];
  if (!ROLE_FAMILIES[profile.roleFamily]) profile.roleFamily = offline.roleFamily;
  if (!profile.searchQueries?.length) profile.searchQueries = offline.searchQueries;
  if (!profile.freelanceServices?.length) profile.freelanceServices = ROLE_FAMILIES[profile.roleFamily].freelance;

  // User-supplied overrides (from CLI flags or bot commands) always win.
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null && value !== '') profile[key] = value;
  }
  return profile;
}
