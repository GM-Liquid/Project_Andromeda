import { PROJECT_ANDROMEDA } from './helpers/config.mjs';

export const MODULE_ID = 'project-andromeda';
export const ITEM_LIBRARY_SYNC_MIGRATION_SETTING = 'itemLibrarySyncMigrationVersion';
export const ITEM_LIBRARY_SYNC_MIGRATION_VERSION = 1;

export function registerSystemSettings() {
  game.settings.register(MODULE_ID, 'debugMode', {
    name: 'MY_RPG.Settings.DebugMode.Name',
    hint: 'MY_RPG.Settings.DebugMode.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, 'sessionTrackerCurrent', {
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, 'sessionTrackerHistory', {
    scope: 'world',
    config: false,
    type: Object,
    default: []
  });

  game.settings.register(MODULE_ID, 'sessionTrackerMaxHistory', {
    name: 'MY_RPG.Settings.SessionTrackerMaxHistory.Name',
    hint: 'MY_RPG.Settings.SessionTrackerMaxHistory.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 50,
    range: {
      min: 1,
      max: 500,
      step: 1
    }
  });

  game.settings.register(MODULE_ID, ITEM_LIBRARY_SYNC_MIGRATION_SETTING, {
    scope: 'world',
    config: false,
    type: Number,
    default: 0
  });
}

export function debugLog(message, ...args) {
  try {
    const enabled = game?.settings?.get?.(MODULE_ID, 'debugMode');
    if (!enabled) return;
  } catch {
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
