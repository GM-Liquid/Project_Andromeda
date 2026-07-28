import { isMinionActorType, normalizeActorType } from './actor-types.mjs';
import { normalizeCharacterRank, normalizeSkillValue } from './skill-check.mjs';

// Базовая атака (книга правил, глава 6 «Базовые атаки»): простой удар или выстрел
// без приёма. Она есть у любого существа всегда — её не покупают, она не стоит
// Накала и не зависит от архетипа, поэтому это производные записи листа, а не
// предметы: их нельзя купить, отредактировать или удалить.
export const BASIC_ATTACK_MELEE = 'melee';
export const BASIC_ATTACK_RANGED = 'ranged';
export const BASIC_ATTACK_KEYS = Object.freeze([BASIC_ATTACK_MELEE, BASIC_ATTACK_RANGED]);

// Линейка урона базовой атаки по рангу существа — примерно 0.8 стандартной.
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

const MELEE_SKILL_KEY = 'blizhniy_boy';
// «Стрельба или Резонанс — смотря чем вы бьёте»: берём тот навык, который у
// существа развит лучше, при равенстве — Стрельбу как более обыденный вариант.
const RANGED_SKILL_KEYS = Object.freeze(['strelba', 'rezonans']);

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

function getSkillValue(skills, skillKey) {
  return normalizeSkillValue(skills?.[skillKey]?.value);
}

export function selectRangedBasicAttackSkill(skills = {}) {
  return RANGED_SKILL_KEYS.reduce((best, skillKey) =>
    getSkillValue(skills, skillKey) > getSkillValue(skills, best) ? skillKey : best
  );
}

/**
 * Build both basic attacks for a character from plain system data. The check rank
 * is the character's own rank (not the skill rank) — the skill only contributes its
 * value to the `2d8` roll, so a character without the skill still attacks at `+0`.
 */
export function buildBasicAttacks(system = {}, actorType = '') {
  const normalizedType = normalizeActorType(actorType);
  const rank = normalizeCharacterRank(system?.currentRank);
  const skills = system?.skills ?? {};
  const damageProfile = getBasicAttackDamageProfileForActorType(normalizedType, rank);
  const rangedSkillKey = selectRangedBasicAttackSkill(skills);

  return [
    {
      key: BASIC_ATTACK_MELEE,
      rank,
      skillKey: MELEE_SKILL_KEY,
      skillValue: getSkillValue(skills, MELEE_SKILL_KEY),
      defenseKey: 'fortitude',
      rangeMeters: null,
      damageProfile
    },
    {
      key: BASIC_ATTACK_RANGED,
      rank,
      skillKey: rangedSkillKey,
      skillValue: getSkillValue(skills, rangedSkillKey),
      defenseKey: 'control',
      rangeMeters: getBasicAttackRangeMeters(rank),
      damageProfile
    }
  ];
}

export function getBasicAttack(system = {}, actorType = '', attackKey = '') {
  const normalizedKey = String(attackKey ?? '').trim();
  return (
    buildBasicAttacks(system, actorType).find((attack) => attack.key === normalizedKey) ?? null
  );
}
