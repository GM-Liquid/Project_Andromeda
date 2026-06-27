import { getBaseMovementSpeedByRank } from '../config/character-defaults.mjs';

export { getBaseMovementSpeedByRank } from '../config/character-defaults.mjs';

export function calcMovementSpeed(system = {}, itemTotals = {}) {
  const armorSpeed = Number(itemTotals?.armor?.speed) || 0;
  const tempSpeed = Number(system?.tempspeed) || 0;
  return getBaseMovementSpeedByRank(system?.currentRank) + armorSpeed + tempSpeed;
}
