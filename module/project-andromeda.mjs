// Import document classes.
import { ProjectAndromedaActor } from './documents/actor.mjs';
import { ProjectAndromedaItem } from './documents/item.mjs';
// Import sheet classes.
import { ProjectAndromedaActorSheet } from './sheets/actor-sheet.mjs';
import { ITEM_SHEET_CLASSES } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { MODULE_ID, PROJECT_ANDROMEDA, debugLog, registerSystemSettings } from './config.mjs';
import { ITEM_SUPERTYPE_LABELS, ITEM_TYPE_CONFIGS } from './helpers/item-config.mjs';
import { runLegacyItemMigration } from './helpers/migrations.mjs';
import './helpers/handlebars-helpers.mjs';

const ITEM_SUPERTYPE_ORDER = ['equipment', 'environment', 'traits', 'other'];

function buildItemTypeOptions({ select, allowedTypes }) {
  console.log('[buildItemTypeOptions] Called with:', { select: !!select, allowedTypes: allowedTypes.size });
  const selectElement = select.get(0);
  console.log('[buildItemTypeOptions] selectElement found:', !!selectElement);
  if (!selectElement) return;
  
  const currentValue = select.val();
  console.log('[buildItemTypeOptions] currentValue:', currentValue);
  
  const groupLabels = new Map();
  const orderedLabels = [];

  for (const groupKey of ITEM_SUPERTYPE_ORDER) {
    const labelKey = ITEM_SUPERTYPE_LABELS[groupKey];
    const label = labelKey ? game.i18n.localize(labelKey) : groupKey;
    groupLabels.set(groupKey, label);
    orderedLabels.push(label);
  }

  console.log('[buildItemTypeOptions] orderedLabels:', orderedLabels);

  const options = [];
  const unknownTypes = new Set(allowedTypes);

  for (const config of ITEM_TYPE_CONFIGS) {
    if (!allowedTypes.has(config.type)) continue;
    unknownTypes.delete(config.type);
    const groupKey = config.supertype ?? 'other';
    const groupLabel = groupLabels.get(groupKey) ?? groupLabels.get('other') ?? groupKey;
    options.push({
      value: config.type,
      label: game.i18n.localize(`TYPES.Item.${config.type}`),
      group: groupLabel,
      selected: config.type === currentValue
    });
  }

  if (unknownTypes.size) {
    const fallbackGroupLabel = groupLabels.get('other') ?? 'other';
    for (const type of unknownTypes) {
      options.push({
        value: type,
        label: game.i18n.localize(`TYPES.Item.${type}`),
        group: fallbackGroupLabel,
        selected: type === currentValue
      });
    }
  }

  console.log('[buildItemTypeOptions] options:', options.length, 'items');

  const grouped = foundry.applications.fields.prepareSelectOptionGroups({
    options,
    groups: orderedLabels,
    blank: false,
    sort: false
  });

  console.log('[buildItemTypeOptions] grouped result:', grouped);

  const fragment = document.createDocumentFragment();

  for (const group of grouped) {
    console.log('[buildItemTypeOptions] Processing group:', group.label, 'options:', group.options?.length ?? 0);
    if (!group.options?.length) continue;
    const groupElement = document.createElement('optgroup');
    groupElement.label = group.label;
    for (const optionData of group.options) {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      if (optionData.selected) option.selected = true;
      if (optionData.disabled) option.disabled = true;
      groupElement.append(option);
    }
    fragment.append(groupElement);
  }

  console.log('[buildItemTypeOptions] About to replaceChildren');
  selectElement.replaceChildren(fragment);
  console.log('[buildItemTypeOptions] replaceChildren complete, select HTML:', selectElement.innerHTML);

  // Restore selection after re-rendering
  setTimeout(() => {
    console.log('[buildItemTypeOptions] setTimeout callback running');
    if (currentValue && allowedTypes.has(currentValue)) {
      const option = selectElement.querySelector(`option[value="${currentValue}"]`);
      if (option) {
        option.selected = true;
      } else {
        const firstSelectable = selectElement.querySelector('option:not(:disabled)');
        if (firstSelectable) {
          firstSelectable.selected = true;
        }
      }
    } else {
      const firstSelectable = selectElement.querySelector('option:not(:disabled)');
      if (firstSelectable) {
        firstSelectable.selected = true;
      } else {
        selectElement.selectedIndex = 0;
      }
    }
  }, 50);
}

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  console.log('[Project Andromeda] Init hook firing');
  
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

/* -------------------------------------------- */
/*  renderDialog Hook for Item Creation Dialog  */
/* -------------------------------------------- */

Hooks.on('renderDialog', (dialog, html) => {
  console.log('[renderDialog] Hook fired, dialog title:', dialog.title);
  
  // Check if this is the item creation dialog by looking for type selector
  const select = html.find('select[name="type"]');
  if (!select.length) {
    console.log('[renderDialog] Not an item creation dialog (no type select), skipping');
    return;
  }
  
  console.log('[renderDialog] Found type select, this is an item creation dialog');
  
  // Get the allowed types from the game
  const allowedTypes = new Set(game.documentTypes?.Item ?? []);
  console.log('[renderDialog] allowedTypes:', allowedTypes.size);
  
  if (!allowedTypes.size) {
    console.log('[renderDialog] No allowed types, skipping');
    return;
  }
  
  console.log('[renderDialog] Calling buildItemTypeOptions');
  buildItemTypeOptions({ select, allowedTypes });
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
