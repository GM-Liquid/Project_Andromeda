import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAbilityRankScaling,
  scaleAbilityCatalogEntry,
  scaleAbilityDamageProfile
} from './ability-scaling.mjs';

test('anchor damage lines and custom profiles scale by owner rank', () => {
  assert.equal(scaleAbilityDamageProfile('1/2/3/5', 1, 3), '4/6/9/14');
  assert.equal(scaleAbilityDamageProfile('2/5/8/12', 2, 4), '4/10/16/24');
});

test('catalog entry scales range, area, movement, stress and description', () => {
  const entry = {
    rank: 2,
    description:
      'Атакуйте цель в пределах 30 м и круге радиусом 15 м. Урон: 2/4/6/9. Сдвиньте её на 15 м и восстановите 4 ячейки стресса.',
    mechanics: {
      effects: [
        {
          conditions: {
            range: { type: 'meters', value: 30 },
            area: { type: 'circle', value: 15 }
          },
          outcomes: [
            { key: 'damage', value: '2/4/6/9' },
            { key: 'moveTarget', distance: 15, control: 'vector' },
            { key: 'restoreStress', amount: 4 }
          ]
        }
      ]
    }
  };

  const scaled = scaleAbilityCatalogEntry(entry, 4);
  const [effect] = scaled.mechanics.effects;
  assert.equal(effect.conditions.range.value, 300);
  assert.equal(effect.conditions.area.value, 150);
  assert.equal(effect.outcomes[0].value, '5/8/12/18');
  assert.equal(effect.outcomes[1].distance, 150);
  assert.equal(effect.outcomes[2].amount, 8);
  assert.match(scaled.description, /300 м/u);
  assert.match(scaled.description, /радиусом 150 м/u);
  assert.match(scaled.description, /5\/8\/12\/18/u);
  assert.match(scaled.description, /8 ячейки/u);
});

test('explicit future catalog scaling takes precedence over derived ladders', () => {
  const entry = {
    rank: 1,
    description: 'Урон: 1/2/3/5.',
    descriptionByRank: { 4: 'Особое описание четвёртого ранга.' },
    mechanics: {
      effects: [
        {
          conditions: {},
          outcomes: [
            {
              key: 'damage',
              value: '1/2/3/5',
              scaling: { 1: '1/2/3/5', 2: '2/4/6/9', 3: '4/6/9/14', 4: '9/9/9/9' }
            }
          ]
        }
      ]
    }
  };

  const scaled = buildAbilityRankScaling(entry)['4'];
  assert.equal(scaled.mechanics.effects[0].outcomes[0].value, '9/9/9/9');
  assert.equal(scaled.description, 'Особое описание четвёртого ранга.');
});

test('rank scaling leaves unrelated outcome profiles and off-ladder flat values unchanged', () => {
  const entry = {
    rank: 2,
    description:
      'Задайте 0/1/2/3 вопроса. Урон: 2/4/6/9. Уменьшите следующий урон на 5.',
    mechanics: {
      effects: [
        {
          outcomes: [
            { key: 'damage', value: '2/4/6/9' },
            { key: 'damageReduction', amount: 5 }
          ]
        }
      ]
    }
  };

  const scaled = scaleAbilityCatalogEntry(entry, 4);

  assert.equal(
    scaled.description,
    'Задайте 0/1/2/3 вопроса. Урон: 5/8/12/18. Уменьшите следующий урон на 5.'
  );
  assert.equal(scaled.mechanics.effects[0].outcomes[1].amount, 5);
});
