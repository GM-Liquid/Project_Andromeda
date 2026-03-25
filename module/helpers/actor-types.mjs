export const PLAYER_CHARACTER_ACTOR_TYPE = 'playerCharacter';
export const MINION_ACTOR_TYPE = 'minion';
export const RANK_AND_FILE_ACTOR_TYPE = 'rankAndFile';
export const ELITE_ACTOR_TYPE = 'elite';

export const GM_CHARACTER_ACTOR_TYPES = [
  MINION_ACTOR_TYPE,
  RANK_AND_FILE_ACTOR_TYPE,
  ELITE_ACTOR_TYPE
];

export const SUPPORTED_ACTOR_TYPES = [PLAYER_CHARACTER_ACTOR_TYPE, ...GM_CHARACTER_ACTOR_TYPES];

export const LEGACY_ACTOR_TYPE_MAP = {
  character: PLAYER_CHARACTER_ACTOR_TYPE,
  npc: RANK_AND_FILE_ACTOR_TYPE,
  boss: ELITE_ACTOR_TYPE
};

export function normalizeActorType(actorType) {
  const normalized = String(actorType ?? '').trim();
  return LEGACY_ACTOR_TYPE_MAP[normalized] ?? normalized;
}

export function isSupportedCharacterActorType(actorType) {
  return SUPPORTED_ACTOR_TYPES.includes(normalizeActorType(actorType));
}

export function isPlayerCharacterActorType(actorType) {
  return normalizeActorType(actorType) === PLAYER_CHARACTER_ACTOR_TYPE;
}

export function isGmCharacterActorType(actorType) {
  return GM_CHARACTER_ACTOR_TYPES.includes(normalizeActorType(actorType));
}

export function isEliteActorType(actorType) {
  return normalizeActorType(actorType) === ELITE_ACTOR_TYPE;
}

export function supportsAzureStress(actorType) {
  const normalized = normalizeActorType(actorType);
  return (
    normalized === PLAYER_CHARACTER_ACTOR_TYPE || normalized === RANK_AND_FILE_ACTOR_TYPE
  );
}
