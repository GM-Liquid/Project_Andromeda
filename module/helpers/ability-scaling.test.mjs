import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAbilityRankScaling,
  scaleAbilityCatalogEntry,
  scaleAbilityDamageProfile
} from './ability-scaling.mjs';

test('standalone damage-line utility still supports anchor and custom profiles', () => {
  assert.equal(scaleAbilityDamageProfile('1/2/3/5', 1, 3), '4/6/9/14');
  assert.equal(scaleAbilityDamageProfile('2/5/8/12', 2, 4), '4/10/16/24');
});

test('catalog entry resolves every explicitly marked value from its owner-rank rows', () => {
  const entry = {
    description:
      'Атакуйте цель в пределах 10 м и круге радиусом 5 м. Урон: 1/2/3/5. Сдвиньте её на 2/3/5/10 м и восстановите 2 ячейки стресса.',
    mechanics: {
      effects: [
        {
          conditions: {
            range: { type: 'meters', value: 10, scale: 'range' },
            area: { type: 'circle', value: 5, scale: 'area' }
          },
          outcomes: [
            { key: 'damage', value: '1/2/3/5', scale: 'damage' },
            { key: 'moveTarget', distance: '2/3/5/10', scale: 'movement' },
            { key: 'restoreStress', amount: 2, scale: 'stress' }
          ]
        }
      ]
    },
    scaling: {
      range: { parameter: 'Дальность, м', values: [10, 30, 100, 300] },
      area: { parameter: 'Радиус области, м', values: [5, 15, 50, 150] },
      damage: {
        parameter: 'Урон',
        values: ['1/2/3/5', '2/4/6/9', '4/6/9/14', '7/10/13/19']
      },
      movement: {
        parameter: 'Перемещение цели, м',
        values: ['2/3/5/10', '5/10/15/30', '15/35/50/100', '50/100/150/300']
      },
      stress: { parameter: 'Восстановление стресса', values: [2, 4, 6, 8] }
    }
  };

  const scaled = scaleAbilityCatalogEntry(entry, 4);
  const [effect] = scaled.mechanics.effects;
  assert.equal(effect.conditions.range.value, 300);
  assert.equal(effect.conditions.area.value, 150);
  assert.equal(effect.outcomes[0].value, '7/10/13/19');
  assert.equal(effect.outcomes[1].distance, '50/100/150/300');
  assert.equal(effect.outcomes[2].amount, 8);
  assert.match(scaled.description, /300 м/u);
  assert.match(scaled.description, /радиусом 150 м/u);
  assert.match(scaled.description, /7\/10\/13\/19/u);
  assert.match(scaled.description, /50\/100\/150\/300 м/u);
  assert.match(scaled.description, /8 ячейки/u);
});

test('unmarked numeric fields remain constant even when they resemble a known ladder', () => {
  const entry = {
    description: 'Выберите 2 цели в пределах 10 м. Урон: 1/2/3/5.',
    mechanics: {
      effects: [
        {
          conditions: { range: { type: 'meters', value: 10 }, targets: 2 },
          outcomes: [{ key: 'damage', value: '1/2/3/5' }]
        }
      ]
    },
    scaling: {}
  };

  const scaled = scaleAbilityCatalogEntry(entry, 4);
  assert.deepEqual(scaled.mechanics, entry.mechanics);
  assert.equal(scaled.description, entry.description);
});

test('explicit descriptionByRank remains a supported presentation override', () => {
  const entry = {
    description: 'Урон: 1/2/3/5.',
    descriptionByRank: { 4: 'Особое описание четвёртого ранга.' },
    mechanics: {
      effects: [{ outcomes: [{ key: 'damage', value: '1/2/3/5', scale: 'damage' }] }]
    },
    scaling: {
      damage: {
        parameter: 'Урон',
        values: ['1/2/3/5', '2/4/6/9', '4/6/9/14', '9/9/9/9']
      }
    }
  };

  const scaled = buildAbilityRankScaling(entry)['4'];
  assert.equal(scaled.mechanics.effects[0].outcomes[0].value, '9/9/9/9');
  assert.equal(scaled.description, 'Особое описание четвёртого ранга.');
});
