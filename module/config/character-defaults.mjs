export const CHARACTER_DEFAULTS = Object.freeze({
  playerCharacter: Object.freeze({
    stress: Object.freeze({
      perRank: 5,
      supportsAzureStress: true
    })
  }),
  minion: Object.freeze({
    stress: Object.freeze({
      perRank: 3,
      supportsAzureStress: false
    })
  }),
  rankAndFile: Object.freeze({
    stress: Object.freeze({
      perRank: 7,
      supportsAzureStress: true
    })
  }),
  elite: Object.freeze({
    stress: Object.freeze({
      firstRank: 15,
      rankOffset: 1,
      perRank: 25,
      supportsAzureStress: false
    })
  })
});

export const MOVEMENT_SPEED_BY_RANK = Object.freeze({
  1: 10,
  2: 30,
  3: 100,
  4: 300,
  5: 1000
});

export const DEFAULT_CHARACTER_DEFENSES = Object.freeze({
  physical: 1,
  azure: 1,
  mental: 1
});

function normalizeRank(rank, maxRank = 4) {
  const normalizedRank = Math.max(Math.trunc(Number(rank) || 0), 0);
  return Math.min(normalizedRank, maxRank);
}

export function getCharacterDefaults(actorType) {
  return CHARACTER_DEFAULTS[String(actorType ?? '').trim()] ?? CHARACTER_DEFAULTS.playerCharacter;
}

export function getBaseMovementSpeedByRank(rank) {
  const maxMovementRank = Math.max(...Object.keys(MOVEMENT_SPEED_BY_RANK).map(Number));
  const boundedRank = normalizeRank(rank, maxMovementRank);
  return boundedRank ? (MOVEMENT_SPEED_BY_RANK[boundedRank] ?? 0) : 0;
}

export function getBaseStressByRank(actorType, rank) {
  const boundedRank = normalizeRank(rank);
  if (!boundedRank) return 0;

  const stress = getCharacterDefaults(actorType).stress;
  if (Number.isFinite(Number(stress.firstRank)) && boundedRank === 1) {
    return Number(stress.firstRank);
  }

  const rankOffset = Number(stress.rankOffset) || 0;
  const effectiveRank = Math.max(boundedRank - rankOffset, 0);
  return Math.max(effectiveRank * (Number(stress.perRank) || 0), 0);
}

export function actorTypeSupportsAzureStress(actorType) {
  return Boolean(getCharacterDefaults(actorType).stress.supportsAzureStress);
}
