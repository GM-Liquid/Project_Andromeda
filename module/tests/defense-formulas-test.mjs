import { debugLog } from '../config.mjs';
import { ProjectAndromedaActor } from '../documents/actor.mjs';
import { getAbilityDieNumeric } from '../helpers/utils.mjs';

const TEST_DEFENSE_TRANSLATIONS = {
  en: {
    defenses: {
      PhysicalLabel: 'Endurance',
      MagicalLabel: 'Fortitude',
      PsychicLabel: 'Will'
    },
    armorItem: {
      BonusPhysicalLabel: 'Bonus to Endurance',
      BonusMagicalLabel: 'Bonus to Fortitude',
      BonusPsychicLabel: 'Bonus to Will'
    },
    temp: {
      BonusPhysicalLabel: 'Temp. Endurance',
      BonusMagicalLabel: 'Temp. Fortitude',
      BonusPsychicLabel: 'Temp. Will'
    }
  },
  ru: {
    defenses: {
      PhysicalLabel: 'Выдержка',
      MagicalLabel: 'Стойкость',
      PsychicLabel: 'Воля'
    },
    armorItem: {
      BonusPhysicalLabel: 'Бонус к Выдержке',
      BonusMagicalLabel: 'Бонус к Стойкости',
      BonusPsychicLabel: 'Бонус к Воле'
    },
    temp: {
      BonusPhysicalLabel: 'Врем. Выдержка',
      BonusMagicalLabel: 'Врем. Стойкость',
      BonusPsychicLabel: 'Врем. Воля'
    }
  }
};

function getAbilityValue(system, key) {
  return getAbilityDieNumeric(system?.abilities?.[key]?.value);
}

function getQuarterDefense(system, firstAbility, secondAbility) {
  const total = getAbilityValue(system, firstAbility) + getAbilityValue(system, secondAbility);
  return Math.round(total / 4);
}

function applyDefenseLabelOverrides() {
  const language = game.i18n?.lang ?? 'en';
  const translations = TEST_DEFENSE_TRANSLATIONS[language] ?? TEST_DEFENSE_TRANSLATIONS.en;
  const root = game.i18n?.translations?.MY_RPG;
  if (!root) return;

  foundry.utils.mergeObject((root.Defenses ??= {}), translations.defenses, {
    insertKeys: true,
    overwrite: true
  });
  foundry.utils.mergeObject((root.ArmorItem ??= {}), translations.armorItem, {
    insertKeys: true,
    overwrite: true
  });
  foundry.utils.mergeObject((root.Temp ??= {}), translations.temp, {
    insertKeys: true,
    overwrite: true
  });

  debugLog('Applied test defense labels', { language, translations });
}

ProjectAndromedaActor.prototype._calcDefPhys = function (system, itemTotals = {}) {
  const itemBonus = Number(itemTotals?.armor?.physical) || 0;
  const tempBonus = Number(system?.tempphys) || 0;
  return getQuarterDefense(system, 'con', 'int') + itemBonus + tempBonus;
};

ProjectAndromedaActor.prototype._calcDefAzure = function (system, itemTotals = {}) {
  const itemBonus = Number(itemTotals?.armor?.azure) || 0;
  const tempBonus = Number(system?.tempazure) || 0;
  return getQuarterDefense(system, 'con', 'spi') + itemBonus + tempBonus;
};

ProjectAndromedaActor.prototype._calcDefMent = function (system, itemTotals = {}) {
  const itemBonus = Number(itemTotals?.armor?.mental) || 0;
  const tempBonus = Number(system?.tempmental) || 0;
  return getQuarterDefense(system, 'spi', 'int') + itemBonus + tempBonus;
};

ProjectAndromedaActor.prototype._calcStressMax = function (system) {
  const rank = Math.max(Number(system?.currentRank) || 0, 0);
  return Math.max(0, rank * 4);
};

ProjectAndromedaActor.prototype._calcGmStressMax = function (system) {
  const rank = Math.max(Number(system?.currentRank) || 0, 0);
  return Math.max(0, rank * 4);
};

ProjectAndromedaActor.prototype._calcEliteStressMax = function (system) {
  const rank = Math.max(Number(system?.currentRank) || 0, 0);
  return Math.max(0, rank * 10);
};

Hooks.once('setup', applyDefenseLabelOverrides);

debugLog('Loaded test defense and stress formula overrides');
