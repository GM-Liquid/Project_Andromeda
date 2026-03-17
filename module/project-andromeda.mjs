// Import document classes.
import { ProjectAndromedaActor } from './documents/actor.mjs';
import { ProjectAndromedaItem } from './documents/item.mjs';
// Import sheet classes.
import { ProjectAndromedaActorSheet } from './sheets/actor-sheet.mjs';
import { ITEM_SHEET_CLASSES } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import {
  LEGACY_EQUIPMENT_TYPE_MIGRATION_SETTING,
  LEGACY_EQUIPMENT_TYPE_MIGRATION_VERSION,
  MODULE_ID,
  PROJECT_ANDROMEDA,
  debugLog,
  registerSystemSettings
} from './config.mjs';
import {
  ITEM_SUPERTYPE_LABELS,
  ITEM_TYPE_CONFIGS,
  isEquipmentLikeType,
  normalizeEquipmentSubtype
} from './helpers/item-config.mjs';
import { SessionStatsService } from './helpers/session-stats.mjs';
import {
  ensureActorItemLibraryLink,
  getLibraryItemUuid,
  getLibrarySyncOptionKey,
  hasOnlyLocalItemChanges,
  isLibrarySyncManagedType,
  migrateActorItemsToLibrary,
  runItemLibraryMigrationIfNeeded,
  syncActorItemToLibrary,
  syncActorLibraryStructure,
  syncLibraryItemToActors,
  unlinkLibraryItemFromActors
} from './helpers/item-library-sync.mjs';
import './helpers/handlebars-helpers.mjs';

const ITEM_SUPERTYPE_ORDER = ['equipment', 'environment', 'traits', 'other'];
const ITEM_LIBRARY_SYNC_OPTION_KEY = getLibrarySyncOptionKey();
const ENVIRONMENT_ITEM_TYPES = new Set(
  ITEM_TYPE_CONFIGS.filter((config) => config.supertype === 'environment').map(
    (config) => config.type
  )
);
const ENVIRONMENT_ITEM_SOURCE_FLAG = 'environmentTokenSourceUuid';
const ENVIRONMENT_PROXY_ACTOR_FLAG = 'isEnvironmentTokenProxy';
const ENVIRONMENT_TOKEN_ACTOR_TYPE = 'npc';
const HERO_POINT_INPUT_SELECTOR = 'input[name="system.momentOfGlory"]';
const OBSOLETE_CARTRIDGE_ITEM_FIELDS = ['runeType'];
const LEGACY_EQUIPMENT_TYPES = new Set(['cartridge', 'implant', 'equipment-consumable']);
const LIBRARY_ITEM_UUID_FLAG = 'libraryItemUuid';
const LIBRARY_ACTOR_ID_FLAG = 'libraryActorId';
const LIBRARY_ACTOR_ITEM_ID_FLAG = 'libraryActorItemId';

function getSessionStatsService() {
  return game.projectAndromeda?.sessionStats ?? null;
}

function scheduleSessionPresenceEvaluation(delayMs = 250) {
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  sessionStats.schedulePresenceEvaluation(delayMs);
}

function getContextMessage(li) {
  const messageId =
    li?.data?.('messageId') ?? li?.attr?.('data-message-id') ?? li?.[0]?.dataset?.messageId ?? '';
  if (!messageId) return null;
  return game.messages?.get(messageId) ?? null;
}

function getMessageActor(message) {
  const actorId = String(message?.speaker?.actor ?? '').trim();
  if (!actorId) return null;
  return game.actors?.get(actorId) ?? null;
}

function getMessageRolls(message) {
  return Array.isArray(message?.rolls) ? message.rolls : message?.roll ? [message.roll] : [];
}

function getActorHeroPoints(actor) {
  return Math.max(Number(actor?.system?.momentOfGlory) || 0, 0);
}

function getMomentOfGloryFlag(message) {
  return (
    message?.getFlag?.(MODULE_ID, 'momentOfGlory') ?? message?.flags?.[MODULE_ID]?.momentOfGlory
  );
}

function syncHeroPointInputs(actor, nextValue = null) {
  const value = nextValue ?? getActorHeroPoints(actor);
  for (const app of Object.values(actor?.apps ?? {})) {
    const element = app?.element?.[0] ?? app?.element;
    if (!element) continue;
    if (typeof element.querySelector === 'function') {
      const input = element.querySelector(HERO_POINT_INPUT_SELECTOR);
      if (input) input.value = `${value}`;
      continue;
    }
    if (typeof element.find === 'function') {
      element.find(HERO_POINT_INPUT_SELECTOR).val(value);
    }
  }
}

function isPrimaryActiveGM() {
  const activeGMs = (game.users?.filter((user) => user.isGM && user.active) ?? []).sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );
  if (!activeGMs.length) return false;
  return activeGMs[0]?.id === game.user?.id;
}

function canGrantHeroPoint(message, actor) {
  if (!message || !actor || actor.type !== 'character') return false;

  if (game.user?.isGM) {
    return isPrimaryActiveGM();
  }

  const activeGMs = game.users?.some((user) => user.isGM && user.active) ?? false;
  if (activeGMs) return false;

  const messageUserId = String(message?.user?.id ?? message?.user ?? '').trim();
  return Boolean(messageUserId && messageUserId === game.user?.id && actor.isOwner);
}

function rollHasExtremeResult(roll) {
  for (const die of roll?.dice ?? []) {
    const faces = Number(die?.faces);
    if (!Number.isFinite(faces) || faces < 1) continue;

    for (const result of die?.results ?? []) {
      if (result?.discarded || result?.active === false) continue;
      const value = Number(result?.result);
      if (!Number.isFinite(value)) continue;
      if (value === 1 || value === faces) return true;
    }
  }

  return false;
}

function messageHasExtremeResult(message) {
  return getMessageRolls(message).some((roll) => rollHasExtremeResult(roll));
}

async function grantHeroPointForExtremeRoll(message) {
  const actor = getMessageActor(message);
  if (!canGrantHeroPoint(message, actor)) return;
  const momentOfGloryFlag = getMomentOfGloryFlag(message);
  if (Number(momentOfGloryFlag?.spent) > 0) return;
  if (!messageHasExtremeResult(message)) return;

  const nextHeroPoints = getActorHeroPoints(actor) + 1;
  await actor.update({ 'system.momentOfGlory': nextHeroPoints }, { render: false });
  syncHeroPointInputs(actor, nextHeroPoints);
}

function getRollMomentOfGloryBonus(roll) {
  let maxFaces = 0;
  for (const die of roll?.dice ?? []) {
    const faces = Number(die?.faces);
    if (!Number.isFinite(faces) || faces < 1) continue;
    maxFaces = Math.max(maxFaces, faces);
  }
  return maxFaces > 0 ? maxFaces / 2 : 0;
}

function formatMomentOfGloryBonus(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  if (Number.isInteger(numeric)) return `${numeric}`;
  return `${Number(numeric.toFixed(2))}`;
}

function cloneRollWithMomentOfGloryBonus(sourceRoll, bonus) {
  const rollData =
    typeof sourceRoll?.toJSON === 'function'
      ? foundry.utils.deepClone(sourceRoll.toJSON())
      : foundry.utils.deepClone(sourceRoll);
  const RollClass = sourceRoll?.constructor?.fromData ? sourceRoll.constructor : Roll;
  const clonedRoll = RollClass.fromData(rollData);
  if (!bonus) return clonedRoll;

  const operatorTerm = new foundry.dice.terms.OperatorTerm({ operator: '+' });
  operatorTerm._evaluated = true;
  const numericTerm = new foundry.dice.terms.NumericTerm({ number: bonus });
  numericTerm._evaluated = true;

  clonedRoll.terms.push(operatorTerm, numericTerm);
  clonedRoll.resetFormula();
  clonedRoll._evaluated = true;
  clonedRoll._total = (Number(sourceRoll?.total) || 0) + bonus;
  return clonedRoll;
}

function canUseMomentOfGloryBonus(message) {
  if (!message) return false;
  const rolls = getMessageRolls(message);
  const hasRoll = Boolean(rolls.length);
  if (!hasRoll) return false;
  const hasEligibleDice = rolls.some((roll) => getRollMomentOfGloryBonus(roll) > 0);
  if (!hasEligibleDice) return false;
  const actor = getMessageActor(message);
  if (!actor) return false;
  return Boolean(game.user?.isGM || actor.isOwner);
}

async function applyMomentOfGloryBonusToMessage(message, actor) {
  const sourceRolls = getMessageRolls(message);
  if (!sourceRolls.length) {
    throw new Error('No roll data found on the source message.');
  }

  const enhancedRolls = [];
  let totalBonus = 0;
  for (const roll of sourceRolls) {
    const bonus = getRollMomentOfGloryBonus(roll);
    totalBonus += bonus;
    enhancedRolls.push(cloneRollWithMomentOfGloryBonus(roll, bonus));
  }
  if (totalBonus <= 0) return { spent: false, totalBonus: 0 };

  const currentHeroPoints = getActorHeroPoints(actor);
  if (!currentHeroPoints) return { spent: false };
  const nextHeroPoints = currentHeroPoints - 1;
  await actor.update({ 'system.momentOfGlory': nextHeroPoints }, { render: false });

  const flags = foundry.utils.deepClone(message.flags ?? {});
  flags[MODULE_ID] ??= {};
  flags[MODULE_ID].momentOfGlory = {
    spent: 1,
    bonus: totalBonus,
    actorId: actor.id,
    sourceMessageId: message.id,
    timestamp: Date.now()
  };

  try {
    await ChatMessage.create({
      user: game.user?.id,
      speaker: foundry.utils.deepClone(message.speaker ?? {}),
      flavor: message.flavor ?? '',
      rolls: enhancedRolls,
      style: message.style,
      type: message.type,
      whisper: Array.from(message.whisper ?? []),
      blind: Boolean(message.blind),
      flags
    });
  } catch (error) {
    await actor.update({ 'system.momentOfGlory': currentHeroPoints }, { render: false });
    throw error;
  }

  syncHeroPointInputs(actor, nextHeroPoints);

  return { spent: true, nextHeroPoints, totalBonus };
}

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
    if (config.legacy) continue;
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

function hasItemLibrarySyncOption(options = {}) {
  return Boolean(options?.[ITEM_LIBRARY_SYNC_OPTION_KEY]);
}

async function handleActorOwnedItemCreate(item, options = {}) {
  if (hasItemLibrarySyncOption(options) || !isLibrarySyncManagedType(item?.type)) return;

  const result = await ensureActorItemLibraryLink(item);
  debugLog('Actor item linked to library', {
    actor: item?.parent?.uuid ?? null,
    itemId: item?.id ?? null,
    libraryItemId: result.libraryItem?.id ?? null,
    createdLibraryItem: result.created,
    linked: result.linked
  });
}

async function handleActorOwnedItemUpdate(item, changed, options = {}) {
  if (hasItemLibrarySyncOption(options) || !isLibrarySyncManagedType(item?.type)) return;
  if (hasOnlyLocalItemChanges(changed)) return;

  const libraryItem = await syncActorItemToLibrary(item);
  debugLog('Actor item synced to library', {
    actor: item?.parent?.uuid ?? null,
    itemId: item?.id ?? null,
    libraryItemId: libraryItem?.id ?? null
  });
}

async function handleWorldItemUpdate(item, changed, options = {}) {
  if (hasItemLibrarySyncOption(options) || !isLibrarySyncManagedType(item?.type)) return;
  if (hasOnlyLocalItemChanges(changed)) return;

  const updatedCopies = await syncLibraryItemToActors(item);
  debugLog('Library item synced to actor items', {
    itemId: item?.id ?? null,
    updatedCopies
  });
}

async function handleWorldItemDelete(item, options = {}) {
  if (hasItemLibrarySyncOption(options) || !isLibrarySyncManagedType(item?.type)) return;

  const unlinkedCopies = await unlinkLibraryItemFromActors(item);
  debugLog('Library item unlinked from actor items', {
    itemId: item?.id ?? null,
    unlinkedCopies
  });
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

function buildEnvironmentTokenItemData(item, sourceUuid) {
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
  if (itemData._id) delete itemData._id;
  return itemData;
}

async function getOrCreateEnvironmentProxyActor() {
  const existingActor =
    game.actors?.find(
      (actor) =>
        actor.type === ENVIRONMENT_TOKEN_ACTOR_TYPE &&
        actor.getFlag(MODULE_ID, ENVIRONMENT_PROXY_ACTOR_FLAG)
    ) ?? null;
  if (existingActor) return existingActor;

  const actorName =
    `${game.i18n.localize('MY_RPG.ItemTypeGroups.Environment')} ${game.i18n.localize('TYPES.Actor.npc')}`.trim();
  const tokenImage = 'icons/svg/hazard.svg';
  return Actor.create({
    name: actorName || game.i18n.localize('TYPES.Actor.npc'),
    type: ENVIRONMENT_TOKEN_ACTOR_TYPE,
    img: tokenImage,
    prototypeToken: {
      name: actorName || game.i18n.localize('TYPES.Actor.npc'),
      actorLink: false,
      texture: { src: tokenImage }
    },
    flags: {
      [MODULE_ID]: {
        [ENVIRONMENT_PROXY_ACTOR_FLAG]: true
      }
    }
  });
}

function isLegacyEquipmentType(type) {
  return LEGACY_EQUIPMENT_TYPES.has(String(type ?? '').trim());
}

function getMigratedEquipmentSystemData(item) {
  const systemData = foundry.utils.deepClone(item?.system ?? {});
  const legacySubtype = normalizeEquipmentSubtype(
    systemData.equipmentSubtype,
    item?.type ?? 'equipment'
  );
  const hasStoredRequiresRoll = typeof systemData.requiresRoll === 'boolean';
  const hasConfiguredSkill = Boolean(String(systemData.skill ?? '').trim());
  const requiresRoll = hasStoredRequiresRoll
    ? systemData.requiresRoll
    : legacySubtype === 'cartridge' || legacySubtype === 'implant' || hasConfiguredSkill;

  systemData.rank = String(systemData.rank ?? '');
  systemData.requiresRoll = Boolean(requiresRoll);
  systemData.skill = String(systemData.skill ?? '');
  if (!systemData.requiresRoll) {
    systemData.skill = '';
  }

  delete systemData.equipmentSubtype;
  delete systemData.skillBonus;
  return systemData;
}

function needsEquipmentSystemNormalization(item) {
  if (!isEquipmentLikeType(item?.type)) return false;

  const nextSystemData = getMigratedEquipmentSystemData(item);
  return !foundry.utils.isEmpty(foundry.utils.diffObject(item?.system ?? {}, nextSystemData));
}

function buildEquipmentSystemNormalizationUpdate(item) {
  return {
    _id: item.id,
    system: getMigratedEquipmentSystemData(item)
  };
}

function buildLegacyEquipmentCreateData(item, { mappedLibraryUuid = '' } = {}) {
  const data = foundry.utils.deepClone(item?.toObject?.() ?? {});
  delete data._id;
  data.type = 'equipment';
  data.system = getMigratedEquipmentSystemData(item);

  if (mappedLibraryUuid) {
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`,
      mappedLibraryUuid
    );
  }

  return data;
}

function buildActorItemMigrationMapKey(actorId, itemId) {
  return `${String(actorId ?? '').trim()}:${String(itemId ?? '').trim()}`;
}

function getWorldItemMigrationMapKey(item) {
  return String(item?.uuid ?? '').trim();
}

function getMappedLibraryUuid(item, worldUuidMap) {
  const currentLibraryUuid = getLibraryItemUuid(item);
  if (!currentLibraryUuid) return '';
  return worldUuidMap.get(currentLibraryUuid) ?? currentLibraryUuid;
}

function getLibraryActorId(item) {
  return String(item?.getFlag?.(MODULE_ID, LIBRARY_ACTOR_ID_FLAG) ?? '').trim();
}

function getLibraryActorItemId(item) {
  return String(item?.getFlag?.(MODULE_ID, LIBRARY_ACTOR_ITEM_ID_FLAG) ?? '').trim();
}

async function migrateLegacyEquipmentTypes() {
  if (!game.user?.isGM) return null;

  const migrationContext = {
    source: 'legacy-equipment-type-migration'
  };
  const createDeleteOptions = {
    render: false,
    [ITEM_LIBRARY_SYNC_OPTION_KEY]: migrationContext
  };
  const updateOptions = {
    diff: false,
    ...createDeleteOptions
  };

  const worldItemsSnapshot = Array.from(game.items ?? []);
  const legacyWorldItems = worldItemsSnapshot.filter((item) => isLegacyEquipmentType(item.type));
  const normalizedWorldUpdates = worldItemsSnapshot
    .filter((item) => item.type === 'equipment' && needsEquipmentSystemNormalization(item))
    .map((item) => buildEquipmentSystemNormalizationUpdate(item));

  const worldUuidMap = new Map();
  const migratedLegacyWorldItemIds = [];
  let worldItemsRecreated = 0;
  for (const item of legacyWorldItems) {
    const createdItem = await Item.create(
      buildLegacyEquipmentCreateData(item),
      createDeleteOptions
    );
    if (!createdItem) continue;
    worldUuidMap.set(getWorldItemMigrationMapKey(item), createdItem.uuid);
    migratedLegacyWorldItemIds.push(item.id);
    worldItemsRecreated += 1;
  }

  if (normalizedWorldUpdates.length) {
    await Item.updateDocuments(normalizedWorldUpdates, updateOptions);
  }

  const actorItemIdMap = new Map();
  let actorItemsRecreated = 0;
  let actorItemsDeleted = 0;
  let actorItemsNormalized = 0;

  for (const actor of game.actors ?? []) {
    const actorItemsSnapshot = Array.from(actor.items ?? []);
    const legacyActorItems = actorItemsSnapshot.filter((item) => isLegacyEquipmentType(item.type));
    const normalizedActorUpdates = actorItemsSnapshot
      .filter((item) => item.type === 'equipment' && needsEquipmentSystemNormalization(item))
      .map((item) => buildEquipmentSystemNormalizationUpdate(item));

    if (legacyActorItems.length) {
      const createdItems = await actor.createEmbeddedDocuments(
        'Item',
        legacyActorItems.map((item) =>
          buildLegacyEquipmentCreateData(item, {
            mappedLibraryUuid: getMappedLibraryUuid(item, worldUuidMap)
          })
        ),
        createDeleteOptions
      );

      createdItems.forEach((createdItem, index) => {
        const sourceItem = legacyActorItems[index];
        if (!createdItem || !sourceItem) return;
        actorItemIdMap.set(
          buildActorItemMigrationMapKey(actor.id, sourceItem.id),
          String(createdItem.id ?? '').trim()
        );
      });

      actorItemsRecreated += createdItems.length;
      const migratedLegacyActorItemIds = legacyActorItems
        .slice(0, createdItems.length)
        .map((item) => item.id);
      actorItemsDeleted += migratedLegacyActorItemIds.length;

      await actor.deleteEmbeddedDocuments('Item', migratedLegacyActorItemIds, createDeleteOptions);
    }

    if (normalizedActorUpdates.length) {
      await actor.updateEmbeddedDocuments('Item', normalizedActorUpdates, updateOptions);
      actorItemsNormalized += normalizedActorUpdates.length;
    }
  }

  let actorLibraryLinksUpdated = 0;
  if (worldUuidMap.size) {
    for (const actor of game.actors ?? []) {
      const linkUpdates = [];
      for (const item of actor.items ?? []) {
        const currentLibraryUuid = getLibraryItemUuid(item);
        if (!currentLibraryUuid) continue;

        const mappedLibraryUuid = worldUuidMap.get(currentLibraryUuid);
        if (!mappedLibraryUuid || mappedLibraryUuid === currentLibraryUuid) continue;

        linkUpdates.push({
          _id: item.id,
          [`flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`]: mappedLibraryUuid
        });
      }

      if (!linkUpdates.length) continue;
      await actor.updateEmbeddedDocuments('Item', linkUpdates, createDeleteOptions);
      actorLibraryLinksUpdated += linkUpdates.length;
    }
  }

  const libraryMetadataUpdates = [];
  if (actorItemIdMap.size) {
    for (const item of game.items ?? []) {
      const actorId = getLibraryActorId(item);
      const actorItemId = getLibraryActorItemId(item);
      if (!actorId || !actorItemId) continue;

      const migratedActorItemId = actorItemIdMap.get(
        buildActorItemMigrationMapKey(actorId, actorItemId)
      );
      if (!migratedActorItemId || migratedActorItemId === actorItemId) continue;

      libraryMetadataUpdates.push({
        _id: item.id,
        [`flags.${MODULE_ID}.${LIBRARY_ACTOR_ID_FLAG}`]: actorId,
        [`flags.${MODULE_ID}.${LIBRARY_ACTOR_ITEM_ID_FLAG}`]: migratedActorItemId
      });
    }
  }

  if (libraryMetadataUpdates.length) {
    await Item.updateDocuments(libraryMetadataUpdates, createDeleteOptions);
  }

  if (migratedLegacyWorldItemIds.length) {
    await Item.deleteDocuments(migratedLegacyWorldItemIds, createDeleteOptions);
  }

  const totalUpdates =
    worldItemsRecreated +
    normalizedWorldUpdates.length +
    actorItemsRecreated +
    actorItemsNormalized +
    actorLibraryLinksUpdated +
    libraryMetadataUpdates.length;

  const summary = {
    worldItemsRecreated,
    worldItemsDeleted: migratedLegacyWorldItemIds.length,
    worldItemsNormalized: normalizedWorldUpdates.length,
    actorItemsRecreated,
    actorItemsDeleted,
    actorItemsNormalized,
    actorLibraryLinksUpdated,
    libraryMetadataUpdated: libraryMetadataUpdates.length,
    totalUpdates
  };

  if (totalUpdates > 0) {
    debugLog('Migrating legacy equipment item types', summary);
  }

  return summary;
}

async function runLegacyEquipmentTypeMigrationIfNeeded() {
  const currentVersion =
    Number(game.settings.get(MODULE_ID, LEGACY_EQUIPMENT_TYPE_MIGRATION_SETTING)) || 0;
  if (currentVersion >= LEGACY_EQUIPMENT_TYPE_MIGRATION_VERSION) return null;

  const summary = await migrateLegacyEquipmentTypes();
  await game.settings.set(
    MODULE_ID,
    LEGACY_EQUIPMENT_TYPE_MIGRATION_SETTING,
    LEGACY_EQUIPMENT_TYPE_MIGRATION_VERSION
  );
  return summary;
}

function hasObsoleteCartridgeData(item) {
  return Boolean(
    (item?.isCartridge ||
      (isEquipmentLikeType(item?.type) &&
        normalizeEquipmentSubtype(item?.system?.equipmentSubtype, item?.type) === 'cartridge')) &&
      OBSOLETE_CARTRIDGE_ITEM_FIELDS.some((field) =>
        foundry.utils.hasProperty(item.system ?? {}, field)
      )
  );
}

function buildObsoleteCartridgeFieldRemoval(item) {
  const update = { _id: item.id };
  for (const field of OBSOLETE_CARTRIDGE_ITEM_FIELDS) {
    if (!foundry.utils.hasProperty(item.system ?? {}, field)) continue;
    update[`system.-=${field}`] = null;
  }
  return update;
}

async function purgeObsoleteCartridgeData() {
  if (!game.user?.isGM) return;

  const worldUpdates = [];
  for (const item of game.items ?? []) {
    if (!hasObsoleteCartridgeData(item)) continue;
    worldUpdates.push(buildObsoleteCartridgeFieldRemoval(item));
  }

  const actorUpdates = new Map();
  for (const actor of game.actors ?? []) {
    const updates = [];
    for (const item of actor.items ?? []) {
      if (!hasObsoleteCartridgeData(item)) continue;
      updates.push(buildObsoleteCartridgeFieldRemoval(item));
    }
    if (updates.length) actorUpdates.set(actor, updates);
  }

  const totalUpdates =
    worldUpdates.length +
    Array.from(actorUpdates.values()).reduce((sum, updates) => sum + updates.length, 0);
  if (!totalUpdates) return;

  debugLog('Purging obsolete cartridge data', { totalUpdates });

  if (worldUpdates.length) {
    await Item.updateDocuments(worldUpdates, { render: false });
  }

  for (const [actor, updates] of actorUpdates.entries()) {
    await actor.updateEmbeddedDocuments('Item', updates, { render: false });
  }
}

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  const sessionStats = new SessionStatsService();

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.projectAndromeda = {
    ProjectAndromedaActor,
    ProjectAndromedaItem,
    debugLog,
    migrateLegacyEquipmentTypes,
    migrateActorItemsToLibrary,
    sessionStats
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

Hooks.on('getChatLogEntryContext', (_html, options) => {
  options.push({
    name: 'MY_RPG.MomentOfGloryBonus.ContextLabel',
    icon: '<i class="fas fa-dice"></i>',
    condition: (li) => {
      const message = getContextMessage(li);
      return canUseMomentOfGloryBonus(message);
    },
    callback: async (li) => {
      const message = getContextMessage(li);
      if (!message) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryBonus.Errors.NoMessage'));
        return;
      }
      const actor = getMessageActor(message);
      if (!actor) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryBonus.Errors.NoActor'));
        return;
      }
      if (!(game.user?.isGM || actor.isOwner)) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryBonus.Errors.NoPermission'));
        return;
      }
      if ((Number(actor.system?.momentOfGlory) || 0) <= 0) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryBonus.Errors.NoPoints'));
        return;
      }

      try {
        const result = await applyMomentOfGloryBonusToMessage(message, actor);
        if (!result?.spent) {
          const errorKey = result?.totalBonus === 0 ? 'NoDice' : 'NoPoints';
          ui.notifications.warn(game.i18n.localize(`MY_RPG.MomentOfGloryBonus.Errors.${errorKey}`));
          return;
        }
        ui.notifications.info(
          game.i18n.format('MY_RPG.MomentOfGloryBonus.Success', {
            bonus: formatMomentOfGloryBonus(result.totalBonus),
            value: result.nextHeroPoints
          })
        );
      } catch (error) {
        debugLog('Moment of Glory bonus failed', {
          messageId: message.id,
          actorId: actor.id,
          error
        });
        ui.notifications.error(game.i18n.localize('MY_RPG.MomentOfGloryBonus.Errors.Failed'));
      }
    }
  });
});

Hooks.on('createChatMessage', (message) => {
  const sessionStats = getSessionStatsService();
  if (sessionStats) {
    void sessionStats.recordRoll(message);
  }
  void grantHeroPointForExtremeRoll(message);
});

Hooks.on('updateActor', (actor, changes) => {
  if (!foundry.utils.hasProperty(changes, 'system.momentOfGlory')) return;
  syncHeroPointInputs(actor);
});

Hooks.on('updateActor', (actor, changes, options) => {
  if (!isPrimaryActiveGM()) return;
  if (hasItemLibrarySyncOption(options)) return;

  const changedName = foundry.utils.hasProperty(changes, 'name');
  const changedOwnership = foundry.utils.hasProperty(changes, 'ownership');
  if (!changedName && !changedOwnership) return;

  void syncActorLibraryStructure(actor).catch((error) => {
    debugLog('Actor library folder sync failed on actor update', {
      actor: actor?.uuid ?? null,
      error
    });
  });
});

Hooks.on('createCombat', () => {
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  void sessionStats.recordCombatEvent('encounter-start');
});

Hooks.on('deleteCombat', () => {
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  void sessionStats.recordCombatEvent('encounter-end');
});

Hooks.on('combatRound', () => {
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  void sessionStats.recordCombatEvent('round-advance');
});

Hooks.on('combatTurn', () => {
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  void sessionStats.recordCombatEvent('turn-advance');
});

Hooks.on('userConnected', () => {
  scheduleSessionPresenceEvaluation();
});

Hooks.on('userDisconnected', () => {
  scheduleSessionPresenceEvaluation();
});

Hooks.on('updateUser', (_user, changes) => {
  const changedActive = foundry.utils.hasProperty(changes, 'active');
  const changedRole = foundry.utils.hasProperty(changes, 'role');
  if (!changedActive && !changedRole) return;
  scheduleSessionPresenceEvaluation();
});

Hooks.on('createItem', (item, options) => {
  if (!isPrimaryActiveGM()) return;
  if (item?.parent?.documentName !== 'Actor') return;

  void handleActorOwnedItemCreate(item, options).catch((error) => {
    debugLog('Actor item library link failed on create', {
      actor: item?.parent?.uuid ?? null,
      itemId: item?.id ?? null,
      error
    });
  });
});

Hooks.on('updateItem', (item, changed, options) => {
  if (!isPrimaryActiveGM()) return;

  if (item?.parent?.documentName === 'Actor') {
    void handleActorOwnedItemUpdate(item, changed, options).catch((error) => {
      debugLog('Actor item library sync failed on update', {
        actor: item?.parent?.uuid ?? null,
        itemId: item?.id ?? null,
        error
      });
    });
    return;
  }

  if (item?.parent) return;

  void handleWorldItemUpdate(item, changed, options).catch((error) => {
    debugLog('Library item sync to actors failed on update', {
      itemId: item?.id ?? null,
      error
    });
  });
});

Hooks.on('deleteItem', (item, options) => {
  if (!isPrimaryActiveGM()) return;
  if (item?.parent) return;

  void handleWorldItemDelete(item, options).catch((error) => {
    debugLog('Library item unlink failed on delete', {
      itemId: item?.id ?? null,
      error
    });
  });
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

  const sourceUuid = getEnvironmentItemSourceUuid(item);
  const proxyActor = await getOrCreateEnvironmentProxyActor();
  if (!proxyActor) return;
  const tokenName = item.name || game.i18n.localize(`TYPES.Item.${item.type}`);
  const tokenImage = item.img || proxyActor.prototypeToken?.texture?.src || 'icons/svg/hazard.svg';

  const tokenDocument = await proxyActor.getTokenDocument({
    x,
    y,
    hidden: Boolean(data.hidden),
    actorLink: false,
    name: tokenName,
    texture: { src: tokenImage }
  });
  const tokenData = tokenDocument?.toObject ? tokenDocument.toObject() : tokenDocument;
  if (!tokenData) return;
  tokenData.flags ??= {};
  tokenData.flags[MODULE_ID] ??= {};
  tokenData.flags[MODULE_ID][ENVIRONMENT_ITEM_SOURCE_FLAG] = sourceUuid;
  tokenData.delta ??= {};
  tokenData.delta.flags ??= {};
  tokenData.delta.flags[MODULE_ID] ??= {};
  tokenData.delta.flags[MODULE_ID][ENVIRONMENT_ITEM_SOURCE_FLAG] = sourceUuid;
  tokenData.delta.items = [buildEnvironmentTokenItemData(item, sourceUuid)];

  await droppedCanvas.scene.createEmbeddedDocuments('Token', [tokenData]);

  // DEBUG-LOG
  debugLog('Environment item token dropped', {
    itemUuid: item.uuid,
    proxyActorId: proxyActor.id,
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

  const sessionStats = getSessionStatsService();
  if (sessionStats) {
    sessionStats.initialize();
    if (game.user?.isGM) {
      await sessionStats.recoverStateOnReady();
    }
  }

  if (isPrimaryActiveGM()) {
    await runLegacyEquipmentTypeMigrationIfNeeded();
    await purgeObsoleteCartridgeData();
    await runItemLibraryMigrationIfNeeded();
  } else {
    await purgeObsoleteCartridgeData();
  }
});
