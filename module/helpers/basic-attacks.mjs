import { isGmCharacterActorType, isMinionActorType, normalizeActorType } from './actor-types.mjs';
import { normalizeCharacterRank, normalizeSkill } from './skill-check.mjs';

// Базовая атака (книга правил, глава 6 «Базовые атаки»): простой удар или выстрел
// без приёма. Она есть у любого существа всегда — её не покупают, она не стоит
// Накала и не зависит от архетипа, поэтому это производные записи листа, а не
// предметы: их нельзя купить, отредактировать или удалить.
export const BASIC_ATTACK_MELEE = 'melee';
export const BASIC_ATTACK_RANGED = 'ranged';
export const BASIC_ATTACK_KEYS = Object.freeze([BASIC_ATTACK_MELEE, BASIC_ATTACK_RANGED]);

// Линейка урона базовой атаки по рангу существа — примерно 0.8 стандартной.
// Урон идёт от ранга самого существа, а не от ранга навыка: вложение в боевой
// навык делает атаку точнее, но не сильнее.
const BASIC_ATTACK_DAMAGE_BY_RANK = Object.freeze({
  1: '1/2/2/4',
  2: '2/3/5/7',
  3: '3/5/7/11',
  4: '4/7/10/14'
});

// Дальность дальней базовой атаки — треть скорости своего ранга.
const BASIC_ATTACK_RANGE_BY_RANK = Object.freeze({
  1: 3,
  2: 10,
  3: 30,
  4: 100
});

// Навык задаёт сама атака: ближняя идёт от Ближнего боя, дальняя — от Стрельбы
// или Резонанса, и между ними игрок выбирает сам при каждой атаке. Поэтому у
// атаки не один навык, а список вариантов броска.
export const BASIC_ATTACK_SKILL_KEYS = Object.freeze({
  [BASIC_ATTACK_MELEE]: Object.freeze(['blizhniy_boy']),
  [BASIC_ATTACK_RANGED]: Object.freeze(['strelba', 'rezonans'])
});

const BASIC_ATTACK_DEFENSE_KEYS = Object.freeze({
  [BASIC_ATTACK_MELEE]: 'fortitude',
  [BASIC_ATTACK_RANGED]: 'control'
});

export function getBasicAttackDamageProfile(characterRank) {
  return BASIC_ATTACK_DAMAGE_BY_RANK[normalizeCharacterRank(characterRank)];
}

export function getBasicAttackRangeMeters(characterRank) {
  return BASIC_ATTACK_RANGE_BY_RANK[normalizeCharacterRank(characterRank)];
}

// Урон миньона фиксирован и лесенке не подчиняется: он равен рангу, наносится при
// любом исходе выше провала и не наносится при провале.
export function getMinionBasicAttackDamageProfile(characterRank) {
  const rank = normalizeCharacterRank(characterRank);
  return `0/${rank}/${rank}/${rank}`;
}

export function getBasicAttackDamageProfileForActorType(actorType, characterRank) {
  return isMinionActorType(actorType)
    ? getMinionBasicAttackDamageProfile(characterRank)
    : getBasicAttackDamageProfile(characterRank);
}

export function getBasicAttackSkillKeys(attackKey = '') {
  return BASIC_ATTACK_SKILL_KEYS[String(attackKey ?? '').trim()] ?? null;
}

/**
 * Check rank of a basic attack: the rank of the skill it is rolled with. The
 * character's own rank never enters the roll. Opponents have no skills, so they
 * keep their creature rank unless the GM wrote a higher skill rank into the entry.
 */
function getBasicAttackCheckRank(skillRank, characterRank, actorType) {
  return isGmCharacterActorType(actorType) ? Math.max(skillRank, characterRank) : skillRank;
}

function buildBasicAttackOption(system, actorType, skillKey, characterRank, skillRankBonuses) {
  const skill = normalizeSkill(
    system?.skills?.[skillKey],
    characterRank,
    skillRankBonuses?.[skillKey] ?? 0
  );
  return {
    skillKey,
    rank: getBasicAttackCheckRank(skill.rank, characterRank, actorType),
    skillValue: skill.value
  };
}

/**
 * Build both basic attacks for a character from plain system data. Each attack
 * carries one roll option per allowed skill: the check rank is that skill's rank
 * and the `2d8` roll adds that skill's value, so the character's own rank stays
 * out of the roll entirely. Damage and range still follow the creature's rank.
 *
 * `skillRankBonuses` maps a skill key to its rank bonus (the archetype `+1`).
 */
export function buildBasicAttacks(system = {}, actorType = '', { skillRankBonuses = {} } = {}) {
  const normalizedType = normalizeActorType(actorType);
  const characterRank = normalizeCharacterRank(system?.currentRank);
  const damageProfile = getBasicAttackDamageProfileForActorType(normalizedType, characterRank);

  return BASIC_ATTACK_KEYS.map((key) => ({
    key,
    characterRank,
    defenseKey: BASIC_ATTACK_DEFENSE_KEYS[key],
    rangeMeters: key === BASIC_ATTACK_MELEE ? null : getBasicAttackRangeMeters(characterRank),
    damageProfile,
    options: BASIC_ATTACK_SKILL_KEYS[key].map((skillKey) =>
      buildBasicAttackOption(system, normalizedType, skillKey, characterRank, skillRankBonuses)
    )
  }));
}

/**
 * Resolve one rollable basic attack: the attack plus the single skill it is rolled
 * with. An unknown or missing skill key falls back to the attack's first skill.
 */
export function getBasicAttack(
  system = {},
  actorType = '',
  attackKey = '',
  skillKey = '',
  options = {}
) {
  const normalizedKey = String(attackKey ?? '').trim();
  const attack = buildBasicAttacks(system, actorType, options).find(
    (entry) => entry.key === normalizedKey
  );
  if (!attack) return null;

  const requestedSkill = String(skillKey ?? '').trim();
  const rollOption =
    attack.options.find((entry) => entry.skillKey === requestedSkill) ?? attack.options[0];
  const { options: _skillOptions, ...rest } = attack;
  return { ...rest, ...rollOption };
}
