const MOVEMENT_SPEED_BY_RANK = Object.freeze({
  1: 15,
  2: 45,
  3: 150,
  4: 450
});

export function getBaseMovementSpeedByRank(rank) {
  const normalizedRank = Math.max(Math.trunc(Number(rank) || 0), 0);
  if (!normalizedRank) return 0;
  const boundedRank = Math.min(normalizedRank, 4);
  return MOVEMENT_SPEED_BY_RANK[boundedRank] ?? 0;
}

export function calcMovementSpeed(system = {}, itemTotals = {}) {
  const armorSpeed = Number(itemTotals?.armor?.speed) || 0;
  const tempSpeed = Number(system?.tempspeed) || 0;
  return getBaseMovementSpeedByRank(system?.currentRank) + armorSpeed + tempSpeed;
}
