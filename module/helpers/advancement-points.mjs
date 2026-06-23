import { PROJECT_ANDROMEDA } from './config.mjs';
import { getSkillAdvancementCost } from './skill-check.mjs';

export { getSkillAdvancementCost } from './skill-check.mjs';

export function getTotalAdvancementSpent(system = {}) {
  return Object.keys(PROJECT_ANDROMEDA.skills ?? {}).reduce(
    (sum, skillKey) => sum + getSkillAdvancementCost(system?.skills?.[skillKey]),
    0
  );
}
