import { debugLog } from '../config.mjs';
import { ProjectAndromedaActor } from '../documents/actor.mjs';

const TEST_UI_TRANSLATIONS = {
  en: {
    defenses: {
      MagicalLabel: 'Technical Protection',
      PsychicLabel: 'Magical Protection'
    },
    armorItem: {
      BonusMagicalLabel: 'Bonus to Technical Protection',
      BonusPsychicLabel: 'Bonus to Magical Protection'
    },
    temp: {
      BonusMagicalLabel: 'Temp. Tech. Protection',
      BonusPsychicLabel: 'Temp. Mag. Protection'
    },
    googleSheetsSync: {
      Headers: {
        ItemAzure: 'Technical Protection',
        ItemMental: 'Magical Protection'
      }
    }
  },
  ru: {
    defenses: {
      MagicalLabel: 'Техническая защита',
      PsychicLabel: 'Магическая защита'
    },
    armorItem: {
      BonusMagicalLabel: 'Бонус к технической защите',
      BonusPsychicLabel: 'Бонус к магической защите'
    },
    temp: {
      BonusMagicalLabel: 'Врем. тех. защита',
      BonusPsychicLabel: 'Врем. маг. защита'
    },
    googleSheetsSync: {
      Headers: {
        ItemAzure: 'Тех. защита',
        ItemMental: 'Маг. защита'
      }
    }
  }
};

function applyProtectionLabelOverrides() {
  const language = game.i18n?.lang ?? 'en';
  const translations = TEST_UI_TRANSLATIONS[language] ?? TEST_UI_TRANSLATIONS.en;
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
  foundry.utils.mergeObject((root.GoogleSheetsSync ??= {}), translations.googleSheetsSync, {
    insertKeys: true,
    overwrite: true
  });

  debugLog('Applied test protection label overrides', { language, translations });
}

Hooks.once('setup', applyProtectionLabelOverrides);

debugLog('Loaded test protection label overrides');
