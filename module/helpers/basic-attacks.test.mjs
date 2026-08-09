import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBasicAttacks,
  getBasicAttack,
  getBasicAttackDamageProfile,
  getBasicAttackRangeMeters,
  getBasicAttackSkillKeys,
  getMinionBasicAttackDamageProfile
} from './basic-attacks.mjs';

test('every character always has exactly the two basic attacks', () => {
  const attacks = buildBasicAttacks({ currentRank: 1, skills: {} }, 'playerCharacter');

  assert.deepEqual(
    attacks.map((attack) => attack.key),
    ['melee', 'ranged']
  );
  // Без навыка базовая атака всё равно доступна: ранг проверки `1`, прибавка `0`.
  assert.deepEqual(attacks[0].options, [{ skillKey: 'blizhniy_boy', rank: 1, skillValue: 0 }]);
  assert.deepEqual(attacks[1].options, [
    { skillKey: 'strelba', rank: 1, skillValue: 0 },
    { skillKey: 'rezonans', rank: 1, skillValue: 0 }
  ]);
});

test('the check rank comes from the skill, not from the character rank', () => {
  const [melee, ranged] = buildBasicAttacks(
    {
      currentRank: 4,
      skills: {
        blizhniy_boy: { rank: 2, value: 3 },
        strelba: { rank: 1, value: 0 },
        rezonans: { rank: 3, value: 1 }
      }
    },
    'playerCharacter'
  );

  assert.deepEqual(melee.options, [{ skillKey: 'blizhniy_boy', rank: 2, skillValue: 3 }]);
  assert.deepEqual(ranged.options, [
    { skillKey: 'strelba', rank: 1, skillValue: 0 },
    { skillKey: 'rezonans', rank: 3, skillValue: 1 }
  ]);
});

test('an archetype rank bonus raises the check rank of its own skill only', () => {
  const [melee] = buildBasicAttacks(
    { currentRank: 4, skills: { blizhniy_boy: { rank: 5, value: 2 } } },
    'playerCharacter',
    { skillRankBonuses: { blizhniy_boy: 1 } }
  );
  assert.equal(melee.options[0].rank, 5);

  // Без бонуса тот же навык упирается в ранг персонажа.
  const [meleeWithoutBonus] = buildBasicAttacks(
    { currentRank: 4, skills: { blizhniy_boy: { rank: 5, value: 2 } } },
    'playerCharacter'
  );
  assert.equal(meleeWithoutBonus.options[0].rank, 4);
});

test('damage and range still follow the creature rank, not the skill rank', () => {
  assert.equal(getBasicAttackDamageProfile(1), '1/2/2/4');
  assert.equal(getBasicAttackDamageProfile(4), '4/7/10/14');
  assert.equal(getBasicAttackRangeMeters(2), 10);
  assert.equal(getBasicAttackRangeMeters(4), 100);

  const attacks = buildBasicAttacks(
    { currentRank: 3, skills: { blizhniy_boy: { rank: 1, value: 2 } } },
    'playerCharacter'
  );
  assert.equal(attacks[0].options[0].rank, 1);
  assert.equal(attacks[0].characterRank, 3);
  assert.equal(attacks[0].damageProfile, '3/5/7/11');
  assert.equal(attacks[1].rangeMeters, 30);
});

test('basic attacks target Fortitude in melee and Control at range', () => {
  const [melee, ranged] = buildBasicAttacks({ currentRank: 2 }, 'rankAndFile');
  assert.equal(melee.defenseKey, 'fortitude');
  assert.equal(melee.rangeMeters, null);
  assert.equal(ranged.defenseKey, 'control');
});

test('the ranged basic attack offers both Shooting and Resonance to choose from', () => {
  assert.deepEqual(getBasicAttackSkillKeys('melee'), ['blizhniy_boy']);
  assert.deepEqual(getBasicAttackSkillKeys('ranged'), ['strelba', 'rezonans']);
  assert.equal(getBasicAttackSkillKeys('psychic'), null);
});

test('opponents have no skills, so their check rank stays at their own rank', () => {
  const [melee, ranged] = buildBasicAttacks({ currentRank: 3 }, 'rankAndFile');
  assert.equal(melee.options[0].rank, 3);
  assert.equal(melee.options[0].skillValue, 0);
  assert.equal(ranged.options[1].rank, 3);

  // Но если ведущий всё же прописал навык в записи, он и работает.
  const [written] = buildBasicAttacks(
    { currentRank: 2, skills: { blizhniy_boy: { rank: 2, value: 3 } } },
    'elite'
  );
  assert.equal(written.options[0].skillValue, 3);
});

test('a minion deals its flat rank damage on any outcome above failure', () => {
  assert.equal(getMinionBasicAttackDamageProfile(2), '0/2/2/2');

  const [melee] = buildBasicAttacks({ currentRank: 2 }, 'minion');
  assert.equal(melee.damageProfile, '0/2/2/2');
});

test('getBasicAttack resolves one attack with the chosen skill and rejects unknown keys', () => {
  const system = {
    currentRank: 4,
    skills: { strelba: { rank: 1, value: 0 }, rezonans: { rank: 3, value: 4 } }
  };

  const resonance = getBasicAttack(system, 'playerCharacter', 'ranged', 'rezonans');
  assert.equal(resonance.skillKey, 'rezonans');
  assert.equal(resonance.rank, 3);
  assert.equal(resonance.skillValue, 4);
  assert.equal(resonance.options, undefined);

  // Навык не указан или не подходит атаке — берётся первый допустимый.
  assert.equal(getBasicAttack(system, 'playerCharacter', 'ranged').skillKey, 'strelba');
  assert.equal(
    getBasicAttack(system, 'playerCharacter', 'ranged', 'blizhniy_boy').skillKey,
    'strelba'
  );
  assert.equal(getBasicAttack(system, 'playerCharacter', 'psychic'), null);
});
