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
const ENVIRONMENT_ITEM_TYPES = new Set(
  ITEM_TYPE_CONFIGS
    .filter((config) => config.supertype === 'environment')
    .map((config) => config.type)
);
const ENVIRONMENT_ITEM_SOURCE_FLAG = 'environmentTokenSourceUuid';
const ENVIRONMENT_TOKEN_ACTOR_TYPE = 'npc';

function buildItemTypeOptions({ select, allowedTypes }) {
  const selectElement = select.get(0);
  if (!selectElement) return;
  
  const currentValue = select.val();
  const groupLabels = new Map();
  const orderedLabels = [];

  for (const groupKey of ITEM_SUPERTYPE_ORDER) {
    const labelKey = ITEM_SUPERTYPE_LABELS[groupKey];
    const label = labelKey ? game.i18n.localize(labelKey) : groupKey;
    groupLabels.set(groupKey, label);
    orderedLabels.push(label);
  }

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

  const grouped = foundry.applications.fields.prepareSelectOptionGroups({
    options,
    groups: orderedLabels,
    blank: false,
    sort: false
  });

  const fragment = document.createDocumentFragment();

  for (const group of grouped) {
    // The group object has both a 'group' property (the label) and 'options' array
    const groupLabel = group.group || group.label;
    if (!group.options?.length) continue;
    
    const groupElement = document.createElement('optgroup');
    groupElement.label = groupLabel;
    
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

  selectElement.replaceChildren(fragment);

  // Restore selection after re-rendering
  setTimeout(() => {
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

function shouldCustomizeItemTypeDialog(dialog, selectElement, itemTypes) {
  const documentName =
    dialog?.documentName ?? dialog?.options?.documentName ?? dialog?.object?.documentName ?? '';
  if (documentName && documentName !== 'Item') return false;

  const optionValues = Array.from(selectElement.options)
    .map((option) => option.value)
    .filter(Boolean);

  if (!optionValues.length) {
    return documentName === 'Item';
  }

  const actorTypes = new Set(game.documentTypes?.Actor ?? []);
  if (optionValues.some((value) => actorTypes.has(value))) return false;
  return optionValues.some((value) => itemTypes.has(value));
}

function isEnvironmentItem(item) {
  return Boolean(item?.type && ENVIRONMENT_ITEM_TYPES.has(item.type));
}

async function resolveDroppedItem(data) {
  const itemClass = CONFIG.Item?.documentClass;
  if (!itemClass?.fromDropData) return null;
  try {
    const item = await itemClass.fromDropData(data);
    return item?.documentName === 'Item' ? item : null;
  } catch (error) {
    // DEBUG-LOG
    debugLog('Canvas item drop resolve failed', { data, error });
    return null;
  }
}

function getEnvironmentItemSourceUuid(item) {
  const uuid = String(item?.uuid ?? '').trim();
  if (uuid) return uuid;
  const itemId = String(item?.id ?? '').trim();
  return itemId ? `Item.${itemId}` : '';
}

function buildEnvironmentActorItemData(item, sourceUuid) {
  const itemData = {
    name: item.name,
    type: item.type,
    img: item.img,
    system: foundry.utils.deepClone(item.system ?? {}),
    flags: foundry.utils.deepClone(item.flags ?? {})
  };
  itemData.flags[MODULE_ID] ??= {};
  itemData.flags[MODULE_ID][ENVIRONMENT_ITEM_SOURCE_FLAG] = sourceUuid;
  const effects = Array.from(item.effects ?? []).map((effect) => effect.toObject());
  if (effects.length) itemData.effects = effects;
  return itemData;
}

async function syncEnvironmentActorItem(actor, item, sourceUuid) {
  const matchingItem =
    actor.items.find(
      (entry) => entry.getFlag(MODULE_ID, ENVIRONMENT_ITEM_SOURCE_FLAG) === sourceUuid
    ) ?? null;
  const itemData = buildEnvironmentActorItemData(item, sourceUuid);

  if (!matchingItem) {
    await actor.createEmbeddedDocuments('Item', [itemData], { render: false });
    return;
  }

  await matchingItem.update(itemData, { diff: false, render: false });
}

async function getOrCreateEnvironmentTokenActor(item) {
  const sourceUuid = getEnvironmentItemSourceUuid(item);
  if (!sourceUuid) return null;
  const actorName = item.name || game.i18n.localize('TYPES.Actor.npc');
  const tokenImage = item.img || 'icons/svg/hazard.svg';

  const existingActor =
    game.actors?.find(
      (actor) =>
        actor.type === ENVIRONMENT_TOKEN_ACTOR_TYPE &&
        actor.getFlag(MODULE_ID, ENVIRONMENT_ITEM_SOURCE_FLAG) === sourceUuid
    ) ?? null;

  if (existingActor) {
    const actorUpdates = {};
    if (existingActor.name !== actorName) actorUpdates.name = actorName;
    if (existingActor.prototypeToken?.name !== actorName) {
      actorUpdates['prototypeToken.name'] = actorName;
    }
    if (existingActor.img !== tokenImage) {
      actorUpdates.img = tokenImage;
      actorUpdates['prototypeToken.texture.src'] = tokenImage;
    }
    if (Object.keys(actorUpdates).length) {
      await existingActor.update(actorUpdates, { render: false });
    }
    await syncEnvironmentActorItem(existingActor, item, sourceUuid);
    return existingActor;
  }

  const actor = await Actor.create({
    name: actorName,
    type: ENVIRONMENT_TOKEN_ACTOR_TYPE,
    img: tokenImage,
    prototypeToken: {
      name: actorName,
      texture: { src: tokenImage }
    },
    flags: {
      [MODULE_ID]: {
        [ENVIRONMENT_ITEM_SOURCE_FLAG]: sourceUuid
      }
    }
  });
  if (!actor) return null;

  await syncEnvironmentActorItem(actor, item, sourceUuid);
  return actor;
}

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

/* -------------------------------------------- */
/*  renderDialog Hook for Item Creation Dialog  */
/* -------------------------------------------- */

Hooks.on('renderDialog', (dialog, html) => {
  // Check if this is the item creation dialog by looking for type selector
  const select = html.find('select[name="type"]');
  if (!select.length) return;

  const selectElement = select.get(0);
  if (!selectElement) return;

  // Get the allowed item types from the game
  const allowedTypes = new Set(game.documentTypes?.Item ?? []);
  if (!allowedTypes.size) return;

  if (!shouldCustomizeItemTypeDialog(dialog, selectElement, allowedTypes)) return;

  buildItemTypeOptions({ select, allowedTypes });
});

Hooks.on('dropCanvasData', async (droppedCanvas, data) => {
  if (!game.user?.isGM) return;
  if (data?.type !== 'Item') return;
  if (!droppedCanvas?.scene) return;

  const item = await resolveDroppedItem(data);
  if (!isEnvironmentItem(item)) return;

  const x = Number(data.x);
  const y = Number(data.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const actor = await getOrCreateEnvironmentTokenActor(item);
  if (!actor) return;

  const tokenDocument = await actor.getTokenDocument({
    x,
    y,
    hidden: Boolean(data.hidden)
  });
  const tokenData = tokenDocument?.toObject ? tokenDocument.toObject() : tokenDocument;
  if (!tokenData) return;

  await droppedCanvas.scene.createEmbeddedDocuments('Token', [tokenData]);

  // DEBUG-LOG
  debugLog('Environment item token dropped', {
    itemUuid: item.uuid,
    actorId: actor.id,
    sceneId: droppedCanvas.scene.id
  });
  return false;
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
});
