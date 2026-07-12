import { PROJECT_ANDROMEDA } from './config.mjs';
import { getItemAdvancementCost } from './item-config.mjs';
import { ARCHETYPE_BASELINE_RANK, getSkillAdvancementCost } from './skill-check.mjs';

export { getSkillAdvancementCost } from './skill-check.mjs';

// Sum the progression-point cost of every purchasable trait / ability the actor owns
// (черта = 2 × rank, способность = 3 × rank; see item-config). `items` accepts a
// Foundry EmbeddedCollection or a plain array; non-purchasable entries cost 0.
export function getItemsAdvancementSpent(items = []) {
  let total = 0;
  for (const item of items) {
    total += getItemAdvancementCost(item);
  }
  return total;
}

export function getTotalAdvancementSpent(system = {}, { archetypeSkillKey = '', items = [] } = {}) {
  const skillsSpent = Object.keys(PROJECT_ANDROMEDA.skills ?? {}).reduce((sum, skillKey) => {
    const baselineRank = skillKey && skillKey === archetypeSkillKey ? ARCHETYPE_BASELINE_RANK : 1;
    return sum + getSkillAdvancementCost(system?.skills?.[skillKey], { baselineRank });
  }, 0);
  return skillsSpent + getItemsAdvancementSpent(items);
}
