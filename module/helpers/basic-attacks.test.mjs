import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBasicAttacks,
  getBasicAttack,
  getBasicAttackDamageProfile,
  getBasicAttackRangeMeters,
  getMinionBasicAttackDamageProfile,
  selectRangedBasicAttackSkill
} from './basic-attacks.mjs';

test('every character always has exactly the two basic attacks', () => {
  const attacks = buildBasicAttacks({ currentRank: 1, skills: {} }, 'playerCharacter');

  assert.deepEqual(
    attacks.map((attack) => attack.key),
    ['melee', 'ranged']
  );
  // Без навыка базовая атака всё равно доступна и прибавляет `0`.
  assert.equal(attacks[0].skillValue, 0);
  assert.equal(attacks[1].skillValue, 0);
});

test('basic attack damage and range follow the character rank, not the skill rank', () => {
  assert.equal(getBasicAttackDamageProfile(1), '1/2/2/4');
  assert.equal(getBasicAttackDamageProfile(4), '4/7/10/14');
  assert.equal(getBasicAttackRangeMeters(2), 10);
  assert.equal(getBasicAttackRangeMeters(4), 100);

  const attacks = buildBasicAttacks(
    { currentRank: 3, skills: { blizhniy_boy: { rank: 1, value: 2 } } },
    'playerCharacter'
  );
  assert.equal(attacks[0].rank, 3);
  assert.equal(attacks[0].damageProfile, '3/5/7/11');
  assert.equal(attacks[1].rangeMeters, 30);
});

test('basic attacks target Fortitude in melee and Control at range', () => {
  const [melee, ranged] = buildBasicAttacks({ currentRank: 2 }, 'rankAndFile');
  assert.equal(melee.defenseKey, 'fortitude');
  assert.equal(melee.rangeMeters, null);
  assert.equal(ranged.defenseKey, 'control');
});

test('the ranged basic attack uses whichever of Shooting or Resonance is stronger', () => {
  assert.equal(selectRangedBasicAttackSkill({}), 'strelba');
  assert.equal(
    selectRangedBasicAttackSkill({ strelba: { value: 1 }, rezonans: { value: 3 } }),
    'rezonans'
  );
  // Ничья остаётся за Стрельбой.
  assert.equal(
    selectRangedBasicAttackSkill({ strelba: { value: 2 }, rezonans: { value: 2 } }),
    'strelba'
  );
});

test('a minion deals its flat rank damage on any outcome above failure', () => {
  assert.equal(getMinionBasicAttackDamageProfile(2), '0/2/2/2');

  const [melee] = buildBasicAttacks({ currentRank: 2 }, 'minion');
  assert.equal(melee.damageProfile, '0/2/2/2');
});

test('getBasicAttack resolves a single attack by key and rejects unknown keys', () => {
  const system = { currentRank: 1, skills: { rezonans: { value: 4 } } };
  assert.equal(getBasicAttack(system, 'playerCharacter', 'ranged').skillKey, 'rezonans');
  assert.equal(getBasicAttack(system, 'playerCharacter', 'psychic'), null);
});
