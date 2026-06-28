import { PROJECT_ANDROMEDA } from './config.mjs';
import { ARCHETYPE_BASELINE_RANK, getSkillAdvancementCost } from './skill-check.mjs';

export { getSkillAdvancementCost } from './skill-check.mjs';

export function getTotalAdvancementSpent(system = {}, { archetypeSkillKey = '' } = {}) {
  return Object.keys(PROJECT_ANDROMEDA.skills ?? {}).reduce((sum, skillKey) => {
    const baselineRank = skillKey && skillKey === archetypeSkillKey ? ARCHETYPE_BASELINE_RANK : 1;
    return sum + getSkillAdvancementCost(system?.skills?.[skillKey], { baselineRank });
  }, 0);
}
