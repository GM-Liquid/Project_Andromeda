// Import document classes.
import { ProjectAndromedaActor } from './documents/actor.mjs';
import { ProjectAndromedaItem } from './documents/item.mjs';
// Import sheet classes.
import { ProjectAndromedaActorSheet } from './sheets/actor-sheet.mjs';
import { ITEM_SHEET_CLASSES } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { MODULE_ID, PROJECT_ANDROMEDA, debugLog, registerSystemSettings } from './config.mjs';
import { ITEM_TYPE_CONFIGS } from './helpers/item-config.mjs';
import { runLegacyItemMigration } from './helpers/migrations.mjs';
import './helpers/handlebars-helpers.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.projectAndromeda = {
    ProjectAndromedaActor,
    ProjectAndromedaItem,
    debugLog
  };

  // Add custom constants for configuration.
  CONFIG.ProjectAndromeda = PROJECT_ANDROMEDA;

  registerSystemSettings();

  // Define custom Document classes
  CONFIG.Actor.documentClass = ProjectAndromedaActor;
  CONFIG.Item.documentClass = ProjectAndromedaItem;

  // systems/project-andromeda/project-andromeda.mjs — в хуке init
  CONFIG.Combat.initiative = {
    // Initiative rolls use the Body die
    formula: '@abilities.con.roll',
    decimals: 2
  };

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet(MODULE_ID, ProjectAndromedaActorSheet, {
    makeDefault: true,
    label: 'MY_RPG.SheetLabels.Actor'
  });
  Items.unregisterSheet('core', ItemSheet);
  const sheetLabels = {
    cartridge: 'MY_RPG.SheetLabels.ItemAbility',
    implant: 'MY_RPG.SheetLabels.ItemMod',
    armor: 'MY_RPG.SheetLabels.ItemArmor',
    weapon: 'MY_RPG.SheetLabels.ItemWeapon',
    generic: 'MY_RPG.SheetLabels.ItemGeneric'
  };
  const sheetMap = ITEM_TYPE_CONFIGS.reduce((acc, config) => {
    const sheetKey = config.sheet ?? 'generic';
    const entry = acc.get(sheetKey) ?? { types: [], label: sheetLabels[sheetKey] };
    entry.types.push(config.type);
    acc.set(sheetKey, entry);
    return acc;
  }, new Map());

  for (const [sheetKey, entry] of sheetMap.entries()) {
    const SheetClass = ITEM_SHEET_CLASSES[sheetKey];
    if (!SheetClass) continue;
    Items.registerSheet(MODULE_ID, SheetClass, {
      types: entry.types,
      makeDefault: true,
      label: entry.label
    });
  }

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

Hooks.once('ready', async function () {
  // DEBUG-LOG
  debugLog('Project Andromeda system ready', {
    version: game.system.version,
    userId: game.user?.id,
    isGM: game.user?.isGM ?? false
  });

  if (!game.user.isGM) return;
  await runLegacyItemMigration();
  if (game.settings.get(MODULE_ID, 'worldTypeChosen')) return;

  const content = `<p>${game.i18n.localize('MY_RPG.WorldMode.DialogContent')}</p>`;
  new Dialog({
    title: game.i18n.localize('MY_RPG.WorldMode.DialogTitle'),
    content,
    buttons: {
      unity: {
        label: game.i18n.localize('MY_RPG.WorldMode.Unity'),
        callback: () => {
          game.settings.set(MODULE_ID, 'worldType', 'unity');
          game.settings.set(MODULE_ID, 'worldTypeChosen', true);
        }
      },
      stellar: {
        label: game.i18n.localize('MY_RPG.WorldMode.Stellar'),
        callback: () => {
          game.settings.set(MODULE_ID, 'worldType', 'stellar');
          game.settings.set(MODULE_ID, 'worldTypeChosen', true);
        }
      }
    },
    default: 'unity'
  }).render(true);
});
