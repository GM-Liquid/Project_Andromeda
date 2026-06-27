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
  assert.match(html, /Critical success/);
  assert.match(html, /<span>Damage<\/span><strong>4<\/strong>/);
  assert.match(html, /<summary>Roll details<\/summary>/);
  assert.match(html, /Damage profile/);
});

test('skill check roll card omits damage metric when no damage profile is present', () => {
  const html = buildSkillCheckRollFlavorFromData(
    {
      label: 'Rolling Stealth',
      rank: 1,
      parts: [{ label: 'Skill (Stealth)', value: 2 }]
    },
    12
  );

  assert.match(html, /myrpg-roll-card--successwithcost/);
  assert.match(html, /Success with a cost/);
  assert.doesNotMatch(html, /myrpg-roll-card__metric--damage/);
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
