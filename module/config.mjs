import { PROJECT_ANDROMEDA } from './helpers/config.mjs';

export const MODULE_ID = 'project-andromeda';
export const RUNE_TYPE_KEYS = ['Spell', 'Creature', 'Item', 'Portal', 'Domain', 'Saga'];

export function registerSystemSettings() {
  game.settings.register(MODULE_ID, 'legacyItemMigrationComplete', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, 'debugMode', {
    name: 'MY_RPG.Settings.DebugMode.Name',
    hint: 'MY_RPG.Settings.DebugMode.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });
}

export function debugLog(message, ...args) {
  try {
    const enabled = game?.settings?.get?.(MODULE_ID, 'debugMode');
    if (!enabled) return;
  } catch (error) {
    return;
  }

  const prefix = '[Project Andromeda]';
  if (args.length) {
    console.debug(prefix, message, ...args);
  } else {
    console.debug(prefix, message);
  }
}

export { PROJECT_ANDROMEDA };
