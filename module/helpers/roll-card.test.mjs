import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSkillCheckRollFlavorFromData } from './roll-card.mjs';

const translations = {
  'MY_RPG.SkillCheck.Outcomes.Failure': 'Failure',
  'MY_RPG.SkillCheck.Outcomes.SuccessWithCost': 'Success with a cost',
  'MY_RPG.SkillCheck.Outcomes.Success': 'Success',
  'MY_RPG.SkillCheck.Outcomes.CriticalSuccess': 'Critical success',
  'MY_RPG.SkillCheck.OutcomeLabel': 'Outcome',
  'MY_RPG.SkillCheck.OutcomeDamageLabel': 'Damage',
  'MY_RPG.SkillCheck.RolledOutcome': 'Rolled',
  'MY_RPG.SkillCheck.ShiftWord': 'shift',
  'MY_RPG.SkillCheck.ShiftUp': 'Shift up',
  'MY_RPG.SkillCheck.ShiftDown': 'Shift down',
  'MY_RPG.SkillCheck.EffectsLabel': 'Effects',
  'MY_RPG.SkillCheck.RollDetails': 'Roll details',
  'MY_RPG.SkillCheck.ActivatedDescription': 'Description',
  'MY_RPG.SkillCheck.RollFormula': 'Formula',
  'MY_RPG.SkillCheck.RollTotal': 'Check total',
  'MY_RPG.SkillCheck.SkillRankLabel': 'Skill rank',
  'MY_RPG.SkillCheck.DamageProfile': 'Damage profile'
};

globalThis.game = {
  i18n: {
    localize(key) {
      return translations[key] ?? key;
    },
    format(key, data = {}) {
      if (key === 'MY_RPG.SkillCheck.SkillRank') return `Skill rank: ${data.rank}`;
      return translations[key] ?? key;
    }
  }
};

test('skill check roll card prioritizes recalculated outcome and outcome damage', () => {
  const html = buildSkillCheckRollFlavorFromData(
    {
      label: 'Rolling Blade',
      rank: 2,
      parts: [{ label: 'Skill (Melee)', value: 3 }],
      damageProfile: '0/1/2/4'
    },
    17
  );

  assert.match(html, /myrpg-roll-card--criticalsuccess/);
  assert.match(html, /<div class="myrpg-roll-card__outcome">Critical success<\/div>/);
  assert.match(
    html,
    /<div class="myrpg-roll-card__damage"><strong>4<\/strong><span>Damage<\/span>/
  );
  assert.match(html, /Skill rank: 2/);
  assert.match(html, /<summary>Roll details<\/summary>/);
  assert.match(html, /Damage profile/);
});

test('skill check roll card omits the damage block when no damage profile is present', () => {
  const html = buildSkillCheckRollFlavorFromData(
    {
      label: 'Rolling Stealth',
      rank: 1,
      parts: [{ label: 'Skill (Stealth)', value: 2 }]
    },
    10
  );

  assert.match(html, /myrpg-roll-card--successwithcost/);
  assert.match(html, /Success with a cost/);
  assert.doesNotMatch(html, /myrpg-roll-card__damage/);
});

test('a stored shift recalculates outcome, damage, and step-effect activation', () => {
  const html = buildSkillCheckRollFlavorFromData(
    {
      label: 'Rolling Blade',
      rank: 3,
      shift: 1,
      parts: [{ label: 'Skill (Melee)', value: 2 }],
      damageProfile: '0/1/2/4',
      stepEffects: [
        { text: 'Knockback', minOutcome: 'Success' },
        { text: 'Stun', minOutcome: 'CriticalSuccess' }
      ]
    },
    // total 10 = success with a cost; +1 shift -> success
    10
  );

  assert.match(html, /myrpg-roll-card--success/);
  assert.match(html, /<div class="myrpg-roll-card__outcome">Success<\/div>/);
  assert.match(html, /<div class="myrpg-roll-card__damage"><strong>2<\/strong>/);
  assert.match(html, /Rolled: Success with a cost · shift \+1/);
  // Knockback unlocks at Success (active), Stun only at Critical (locked).
  assert.match(
    html,
    /myrpg-roll-card__effect--on"><span class="myrpg-roll-card__effect-icon">✓<\/span><span class="myrpg-roll-card__effect-text">Knockback/
  );
  assert.match(
    html,
    /myrpg-roll-card__effect"><span class="myrpg-roll-card__effect-icon">🔒<\/span><span class="myrpg-roll-card__effect-text">Stun/
  );
});

test('shifting cannot move the outcome past the top of the ladder', () => {
  const html = buildSkillCheckRollFlavorFromData(
    {
      label: 'Rolling Blade',
      rank: 3,
      shift: 5,
      damageProfile: '0/1/2/4'
    },
    17
  );

  assert.match(html, /myrpg-roll-card--criticalsuccess/);
  assert.match(html, /<div class="myrpg-roll-card__damage"><strong>4<\/strong>/);
});

test('skill check roll card renders activation description before collapsed roll details', () => {
  const html = buildSkillCheckRollFlavorFromData(
    {
      label: 'Rolling Pulse Field',
      rank: 3,
      parts: [{ label: 'Skill (Tech)', value: 4 }],
      note: 'Creates a short-range protective pulse.'
    },
    14
  );

  assert.match(
    html,
    /<section class="myrpg-roll-card__note-section"><div class="myrpg-roll-card__note-title">Description<\/div>/
  );
  assert.match(html, /Creates a short-range protective pulse\./);
  assert.ok(html.indexOf('myrpg-roll-card__note-section') < html.indexOf('<details'));
  assert.match(html, /<summary>Roll details<\/summary>/);
});
