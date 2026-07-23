// Import document classes.
import { ProjectAndromedaActor } from './documents/actor.mjs';
import { ProjectAndromedaCombat } from './documents/combat.mjs';
import { ProjectAndromedaItem } from './documents/item.mjs';
// Import sheet classes.
import {
  FoundryActorSheet,
  ProjectAndromedaActorSheet,
  promptForActorTypeSelection,
  updateActorDocumentType
} from './sheets/actor-sheet.mjs';
import { FoundryItemSheet, ITEM_SHEET_CLASSES } from './sheets/item-sheet.mjs';
// Import application classes.
import { GmToolsApp } from './apps/gm-tools.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import {
  getFoundryActorSheetsCollection,
  getFoundryItemSheetsCollection
} from './helpers/foundry-compat.mjs';
import { renderAndromedaCombatTracker } from './helpers/combat-tracker.mjs';
import {
  GEAR_CATALOG_AUTO_SYNC_STATE_SETTING,
  GM_HERO_POOL_SETTING,
  LEGACY_EQUIPMENT_TYPE_MIGRATION_SETTING,
  LEGACY_EQUIPMENT_TYPE_MIGRATION_VERSION,
  LEGACY_TRAIT_TYPE_MIGRATION_SETTING,
  LEGACY_TRAIT_TYPE_MIGRATION_VERSION,
  MODULE_ID,
  PACK_LINK_MIGRATION_SETTING,
  PACK_LINK_MIGRATION_VERSION,
  PROJECT_ANDROMEDA,
  WEAPON_TYPE_MIGRATION_SETTING,
  WEAPON_TYPE_MIGRATION_VERSION,
  V05_MIGRATION_SETTING,
  V05_MIGRATION_VERSION,
  debugLog,
  registerSystemSettings
} from './config.mjs';
import {
  DEFAULT_ITEM_USAGE_FREQUENCY,
  ITEM_SUPERTYPE_LABELS,
  ITEM_TYPE_CONFIGS,
  LEGACY_EQUIPMENT_TYPES as LEGACY_EQUIPMENT_TYPE_LIST,
  LEGACY_TRAIT_TYPES as LEGACY_TRAIT_TYPE_LIST,
  isEquipmentLikeType,
  normalizeUsageFrequency
} from './helpers/item-config.mjs';
import {
  MINION_ACTOR_TYPE,
  SUPPORTED_ACTOR_TYPES,
  isGmCharacterActorType,
  isPlayerCharacterActorType
} from './helpers/actor-types.mjs';
import {
  ARCHETYPE_ITEM_TYPE,
  ARCHETYPE_RANK_SYNC_OPTION,
  ARCHETYPE_SWAP_OPTION,
  clearArchetypeEffects,
  syncArchetypeAbilityToRank,
  syncArchetypeTraitGrant
} from './helpers/archetype.mjs';
import { SessionStatsService } from './helpers/session-stats.mjs';
import { buildSkillCheckRollFlavorFromData } from './helpers/roll-card.mjs';
import {
  getSkillCheckOutcomeKey,
  normalizeOutcomeShift,
  shiftOutcomeKey
} from './helpers/skill-check.mjs';
import {
  cleanupLibraryLinkOnActorItemDelete,
  ensureActorItemLibraryLink,
  getLibraryItemUuid,
  getLibrarySyncOptionKey,
  hasOnlyLocalItemChanges,
  isLibrarySyncManagedType,
  mergeDuplicateLibraryItems,
  migrateActorItemsToLibrary,
  migrateActorLinksToCompendium,
  migrateCatalogWeaponsToWeaponType,
  refreshCompendiumLinkedActorItems,
  removeManagedItemFolderIfEmpty,
  removeOrphanCatalogWorldItems,
  runItemLibraryMigrationIfNeeded,
  syncActorItemToLibrary,
  syncActorLibraryStructure,
  syncLibraryItemToActors,
  unlinkLibraryItemFromActors
} from './helpers/item-library-sync.mjs';
import { getSceneActorTokens, getTokenIsolationPlan } from './helpers/token-isolation.mjs';
import { runStartupTasks } from './helpers/startup-tasks.mjs';
import { migrateWorldV04ToV05 } from './helpers/v05-migration.mjs';

const ITEM_SUPERTYPE_ORDER = ['equipment', 'environment', 'traits', 'other'];
const ITEM_LIBRARY_SYNC_OPTION_KEY = getLibrarySyncOptionKey();
const ENVIRONMENT_ITEM_TYPES = new Set(
  ITEM_TYPE_CONFIGS.filter((config) => config.supertype === 'environment').map(
    (config) => config.type
  )
);
const ENVIRONMENT_ITEM_SOURCE_FLAG = 'environmentTokenSourceUuid';
const ENVIRONMENT_PROXY_ACTOR_FLAG = 'isEnvironmentTokenProxy';
const ENVIRONMENT_TOKEN_ACTOR_TYPE = MINION_ACTOR_TYPE;
const HERO_POINT_INPUT_SELECTOR = 'input[name="system.momentOfGlory"]';
const SHARED_HERO_POOL_INPUT_SELECTOR = '.shared-hero-pool-input';
// Highlight Point economy (rulebook §"Очки Свершений"): each hero gains 1 at the
// start of a session and can hold no more than 3 at once.
const HERO_POINT_MAX = 3;
const HERO_POINT_SESSION_GRANT = 1;
const SESSION_HOOK_STARTED = 'projectAndromeda.sessionStarted';
const SESSION_HOOK_ENDED = 'projectAndromeda.sessionEnded';
const OBSOLETE_CARTRIDGE_ITEM_FIELDS = ['runeType'];
const LEGACY_EQUIPMENT_TYPES = new Set(LEGACY_EQUIPMENT_TYPE_LIST);
const LEGACY_TRAIT_TYPES = new Set(LEGACY_TRAIT_TYPE_LIST);
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

function isDomElement(value) {
  return Boolean(value && typeof value === 'object' && value.nodeType === 1);
}

function isSelectElement(value) {
  return Boolean(isDomElement(value) && String(value.tagName || '').toUpperCase() === 'SELECT');
}

function getContextTargetElement(target) {
  if (isDomElement(target)) return target;
  if (isDomElement(target?.[0])) return target[0];
  if (typeof target?.get === 'function') {
    const element = target.get(0);
    if (isDomElement(element)) return element;
  }
  return null;
}

function getContextTargetDataValue(target, datasetKey, attributeName) {
  const directValue =
    target?.data?.(datasetKey) ??
    target?.attr?.(attributeName) ??
    target?.[0]?.dataset?.[datasetKey] ??
    target?.[0]?.getAttribute?.(attributeName);
  if (directValue != null && `${directValue}`.trim()) {
    return `${directValue}`.trim();
  }

  const element = getContextTargetElement(target);
  if (!element) return '';

  const datasetValue = element.dataset?.[datasetKey];
  if (datasetValue?.trim()) return datasetValue.trim();

  const attributeValue = element.getAttribute?.(attributeName);
  if (attributeValue?.trim()) return attributeValue.trim();

  return '';
}

function getContextMessage(target) {
  const messageId = getContextTargetDataValue(target, 'messageId', 'data-message-id');
  if (!messageId) return null;
  return game.messages?.get(messageId) ?? null;
}

function getContextActor(target) {
  const messageId =
    getContextTargetDataValue(target, 'documentId', 'data-document-id') ||
    getContextTargetDataValue(target, 'entryId', 'data-entry-id');
  if (!messageId) return null;
  return game.actors?.get(messageId) ?? null;
}

function getMessageActor(message) {
  const actorId = String(message?.speaker?.actor ?? '').trim();
  if (!actorId) return null;
  return game.actors?.get(actorId) ?? null;
}

function getMessageRolls(message) {
  return Array.isArray(message?.rolls) ? message.rolls : message?.roll ? [message.roll] : [];
}

function getSharedGmHeroPool() {
  return Math.max(Number(game.settings.get(MODULE_ID, GM_HERO_POOL_SETTING)) || 0, 0);
}

function getActorHeroPoints(actor) {
  if (isGmCharacterActorType(actor?.type)) {
    return getSharedGmHeroPool();
  }
  return Math.max(Number(actor?.system?.momentOfGlory) || 0, 0);
}

function getMomentOfGloryFlag(message) {
  return (
    message?.getFlag?.(MODULE_ID, 'momentOfGlory') ?? message?.flags?.[MODULE_ID]?.momentOfGlory
  );
}

function syncHeroPointInputs(actor, nextValue = null) {
  if (isGmCharacterActorType(actor?.type)) {
    syncSharedHeroPointInputs(nextValue);
    return;
  }
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

function syncSharedHeroPointInputs(nextValue = null) {
  const value = nextValue ?? getSharedGmHeroPool();
  for (const actor of game.actors ?? []) {
    if (!isGmCharacterActorType(actor?.type)) continue;
    for (const app of Object.values(actor?.apps ?? {})) {
      const element = app?.element?.[0] ?? app?.element;
      if (!element) continue;
      if (typeof element.querySelector === 'function') {
        const input = element.querySelector(SHARED_HERO_POOL_INPUT_SELECTOR);
        if (input) input.value = `${value}`;
        continue;
      }
      if (typeof element.find === 'function') {
        element.find(SHARED_HERO_POOL_INPUT_SELECTOR).val(value);
      }
    }
  }
}

async function updateActorHeroPoints(actor, nextValue) {
  const value = Math.max(Number(nextValue) || 0, 0);
  if (isGmCharacterActorType(actor?.type)) {
    await game.settings.set(MODULE_ID, GM_HERO_POOL_SETTING, value);
    syncSharedHeroPointInputs(value);
    return value;
  }

  const cappedValue = Math.min(value, HERO_POINT_MAX);
  await actor.update({ 'system.momentOfGlory': cappedValue }, { render: false });
  syncHeroPointInputs(actor, cappedValue);
  return cappedValue;
}

function isPrimaryActiveGM() {
  const activeGMs = (game.users?.filter((user) => user.isGM && user.active) ?? []).sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );
  if (!activeGMs.length) return false;
  return activeGMs[0]?.id === game.user?.id;
}

function canSpendHeroPoints(actor) {
  if (!actor) return false;
  if (isGmCharacterActorType(actor.type)) {
    return Boolean(game.user?.isGM);
  }
  return Boolean(game.user?.isGM || actor.isOwner);
}

function getPlayerCharacterActors() {
  return (game.actors ?? []).filter((actor) => isPlayerCharacterActorType(actor?.type));
}

// Grants +1 Highlight Point (capped at HERO_POINT_MAX) to every player character when a
// session starts. Runs once on the primary active GM to avoid duplicate world writes.
async function grantSessionStartHeroPoints(session) {
  if (!isPrimaryActiveGM()) return;
  const sessionStats = getSessionStatsService();
  const grantClaimed = await sessionStats?.claimSessionStartHeroPointGrant(session?.id);
  if (!grantClaimed) return;

  for (const actor of getPlayerCharacterActors()) {
    const current = getActorHeroPoints(actor);
    if (current >= HERO_POINT_MAX) continue;
    await updateActorHeroPoints(actor, current + HERO_POINT_SESSION_GRANT);
  }
}

// Clears unspent Highlight Points from player characters when a session ends, since
// unused points do not carry over to the next session.
async function clearSessionHeroPoints() {
  if (!isPrimaryActiveGM()) return;
  for (const actor of getPlayerCharacterActors()) {
    if (getActorHeroPoints(actor) <= 0) continue;
    await updateActorHeroPoints(actor, 0);
  }
}

function getMessageSkillCheck(message) {
  return (
    message?.getFlag?.(MODULE_ID, 'skillCheck') ?? message?.flags?.[MODULE_ID]?.skillCheck ?? null
  );
}

function canShiftSkillCheckOutcome(message) {
  if (!getMessageSkillCheck(message)) return false;
  return Boolean(message?.isAuthor || game.user?.isGM);
}

async function applySkillCheckOutcomeShift(message, delta) {
  const skillCheck = getMessageSkillCheck(message);
  if (!skillCheck) return;
  const total = Number(getMessageRolls(message)[0]?.total);
  if (!Number.isFinite(total)) return;

  const rolledOutcome = getSkillCheckOutcomeKey(total);
  const currentShift = Number(skillCheck.shift) || 0;
  const nextShift = normalizeOutcomeShift(rolledOutcome, currentShift + (Number(delta) || 0));
  if (nextShift === currentShift) return;

  const flags = foundry.utils.deepClone(message.flags ?? {});
  flags[MODULE_ID] ??= {};
  flags[MODULE_ID].skillCheck = { ...skillCheck, shift: nextShift, outcome: rolledOutcome };
  const flavor =
    buildSkillCheckRollFlavorFromData(flags[MODULE_ID].skillCheck, total) || message.flavor;

  await message.update({ flavor, flags });
}

function getChatMessageRenderRoot(html) {
  if (!html) return null;
  // Foundry v13 passes a raw HTMLElement; v12 passes a jQuery object.
  if (typeof html.querySelector === 'function') return html;
  if (html[0] && typeof html[0].querySelector === 'function') return html[0];
  return null;
}

function wireSkillCheckShiftControls(message, html) {
  const root = getChatMessageRenderRoot(html);
  const card = root?.querySelector?.('[data-skill-check-card]');
  if (!card) return;
  const buttons = card.querySelectorAll('.myrpg-roll-card__shift');
  if (!buttons.length) return;

  const allowed = canShiftSkillCheckOutcome(message);
  for (const button of buttons) {
    if (!allowed) {
      button.setAttribute('disabled', 'disabled');
      continue;
    }
    if (button.dataset.skillShiftBound === '1') continue;
    button.dataset.skillShiftBound = '1';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = Number(button.dataset.skillShiftStep) || 0;
      void applySkillCheckOutcomeShift(message, delta).catch((error) => {
        debugLog('Skill check outcome shift failed', { messageId: message?.id, error });
      });
    });
  }
}

// Resolves the current effective outcome (rolled result + any applied shift) for a
// skill-check message, or null if the message is not an improvable skill check.
function getSkillCheckImproveState(message) {
  const skillCheck = getMessageSkillCheck(message);
  if (!skillCheck) return null;
  const total = Number(getMessageRolls(message)[0]?.total);
  if (!Number.isFinite(total)) return null;
  const rolledOutcome = getSkillCheckOutcomeKey(total);
  const currentShift = Number(skillCheck.shift) || 0;
  const currentOutcome = shiftOutcomeKey(rolledOutcome, currentShift);
  return { skillCheck, total, rolledOutcome, currentShift, currentOutcome };
}

function canUseMomentOfGloryImprove(message) {
  if (!message) return false;
  // A Highlight Point may only improve a single check once (rulebook §"Очки Свершений").
  if (Number(getMomentOfGloryFlag(message)?.spent) > 0) return false;
  const state = getSkillCheckImproveState(message);
  if (!state) return false;
  // The outcome cannot rise above a critical success.
  if (state.currentOutcome === 'CriticalSuccess') return false;
  const actor = getMessageActor(message);
  if (!actor) return false;
  if (!canSpendHeroPoints(actor)) return false;
  return getActorHeroPoints(actor) > 0;
}

// Spends 1 Highlight Point to raise the check outcome by one step, in place on the
// original message (no reroll, no new chat card).
async function applyMomentOfGloryImproveOutcome(message, actor) {
  const state = getSkillCheckImproveState(message);
  if (!state) return { spent: false, noCheck: true };
  if (Number(getMomentOfGloryFlag(message)?.spent) > 0) return { spent: false, alreadyUsed: true };

  const nextShift = normalizeOutcomeShift(state.rolledOutcome, state.currentShift + 1);
  if (nextShift === state.currentShift) return { spent: false, maxed: true };

  const currentHeroPoints = getActorHeroPoints(actor);
  if (!currentHeroPoints) return { spent: false };
  const nextHeroPoints = currentHeroPoints - 1;
  await updateActorHeroPoints(actor, nextHeroPoints);

  const flags = foundry.utils.deepClone(message.flags ?? {});
  flags[MODULE_ID] ??= {};
  flags[MODULE_ID].skillCheck = {
    ...state.skillCheck,
    shift: nextShift,
    outcome: state.rolledOutcome
  };
  flags[MODULE_ID].momentOfGlory = {
    spent: 1,
    action: 'improve',
    actorId: actor.id,
    sourceMessageId: message.id,
    timestamp: Date.now()
  };
  const flavor =
    buildSkillCheckRollFlavorFromData(flags[MODULE_ID].skillCheck, state.total) || message.flavor;

  try {
    await message.update({ flavor, flags });
  } catch (error) {
    await updateActorHeroPoints(actor, currentHeroPoints);
    throw error;
  }

  return { spent: true, nextHeroPoints };
}

function buildItemTypeOptions({ selectElement, allowedTypes }) {
  if (!isSelectElement(selectElement)) return;

  const currentValue = String(selectElement.value ?? '').trim();
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

function buildActorTypeOptions({ selectElement, allowedTypes }) {
  if (!isSelectElement(selectElement)) return;

  const currentValue = String(selectElement.value ?? '').trim();
  const availableTypes = SUPPORTED_ACTOR_TYPES.filter((type) => allowedTypes.has(type));
  if (!availableTypes.length) return;

  const fragment = document.createDocumentFragment();

  for (const type of availableTypes) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = game.i18n.localize(`TYPES.Actor.${type}`);
    if (type === currentValue) option.selected = true;
    fragment.append(option);
  }

  selectElement.replaceChildren(fragment);

  setTimeout(() => {
    if (currentValue && availableTypes.includes(currentValue)) {
      selectElement.value = currentValue;
      return;
    }

    const firstType = availableTypes[0];
    if (firstType) {
      selectElement.value = firstType;
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

function shouldCustomizeActorTypeDialog(dialog, selectElement, actorTypes) {
  const documentName =
    dialog?.documentName ?? dialog?.options?.documentName ?? dialog?.object?.documentName ?? '';
  if (documentName && documentName !== 'Actor') return false;

  const optionValues = Array.from(selectElement.options)
    .map((option) => option.value)
    .filter(Boolean);

  if (!optionValues.length) {
    return documentName === 'Actor';
  }

  return optionValues.some((value) => actorTypes.has(value));
}

function isEnvironmentItem(item) {
  return Boolean(item?.type && ENVIRONMENT_ITEM_TYPES.has(item.type));
}

function hasItemLibrarySyncOption(options = {}) {
  return Boolean(options?.[ITEM_LIBRARY_SYNC_OPTION_KEY]);
}

function updateDocumentTypeSelectOptions(dialog, selectElement) {
  if (!isSelectElement(selectElement)) return;

  const allowedActorTypes = new Set(game.documentTypes?.Actor ?? []);
  if (
    allowedActorTypes.size &&
    shouldCustomizeActorTypeDialog(dialog, selectElement, allowedActorTypes)
  ) {
    buildActorTypeOptions({ selectElement, allowedTypes: allowedActorTypes });
    return;
  }

  const allowedItemTypes = new Set(game.documentTypes?.Item ?? []);
  if (!allowedItemTypes.size) return;
  if (!shouldCustomizeItemTypeDialog(dialog, selectElement, allowedItemTypes)) return;

  buildItemTypeOptions({ selectElement, allowedTypes: allowedItemTypes });
}

function pushUniqueContextOption(options, entry) {
  if (!Array.isArray(options) || !entry?.name) return;
  if (options.some((option) => option?.name === entry.name)) return;
  options.push(entry);
}

function registerGmToolsSceneControl(controls) {
  if (!game.user?.isGM) return;

  const tool = {
    name: 'andromeda-gm-tools',
    title: game.i18n.localize('MY_RPG.GmTools.Title'),
    icon: 'fa-solid fa-toolbox',
    button: true,
    visible: true,
    onClick: () => GmToolsApp.show(),
    onChange: () => GmToolsApp.show()
  };

  // Foundry v13+: `controls` is a record keyed by control name and each
  // control's `tools` is itself a record.
  if (controls && !Array.isArray(controls)) {
    const tokenControl = controls.tokens ?? controls.token;
    if (!tokenControl?.tools) return;
    tool.order = Object.keys(tokenControl.tools).length;
    tokenControl.tools[tool.name] = tool;
    return;
  }

  // Foundry v12: `controls` is an array of control groups whose `tools` is an array.
  const tokenControl = Array.isArray(controls)
    ? controls.find((control) => control.name === 'token' || control.name === 'tokens')
    : null;
  if (!Array.isArray(tokenControl?.tools)) return;
  tokenControl.tools.push(tool);
}

function registerActorDirectoryContextOptions(options) {
  pushUniqueContextOption(options, {
    name: 'MY_RPG.ActorTypeChange.Context',
    icon: '<i class="fas fa-shapes"></i>',
    condition: (target) => {
      if (!game.user?.isGM) return false;
      return Boolean(getContextActor(target));
    },
    callback: async (target) => {
      const actor = getContextActor(target);
      if (!actor) return;

      const nextType = await promptForActorTypeSelection(actor, {
        title: game.i18n.format('MY_RPG.ActorTypeChange.TitleWithName', {
          name: actor.name || game.i18n.localize('MY_RPG.KeyInfo.Name')
        })
      });
      if (!nextType) return;
      await updateActorDocumentType(actor, nextType);
    }
  });
}

function registerChatMessageContextOptions(options) {
  pushUniqueContextOption(options, {
    name: 'MY_RPG.MomentOfGloryImprove.ContextLabel',
    icon: '<i class="fas fa-arrow-up"></i>',
    condition: (target) => {
      const message = getContextMessage(target);
      return canUseMomentOfGloryImprove(message);
    },
    callback: async (target) => {
      const message = getContextMessage(target);
      if (!message) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryImprove.Errors.NoMessage'));
        return;
      }
      const actor = getMessageActor(message);
      if (!actor) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryImprove.Errors.NoActor'));
        return;
      }
      if (!canSpendHeroPoints(actor)) {
        ui.notifications.warn(
          game.i18n.localize('MY_RPG.MomentOfGloryImprove.Errors.NoPermission')
        );
        return;
      }
      if (getActorHeroPoints(actor) <= 0) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryImprove.Errors.NoPoints'));
        return;
      }

      try {
        const result = await applyMomentOfGloryImproveOutcome(message, actor);
        if (!result?.spent) {
          let errorKey = 'NoPoints';
          if (result?.noCheck) errorKey = 'NoCheck';
          else if (result?.alreadyUsed) errorKey = 'AlreadyUsed';
          else if (result?.maxed) errorKey = 'Maxed';
          ui.notifications.warn(
            game.i18n.localize(`MY_RPG.MomentOfGloryImprove.Errors.${errorKey}`)
          );
          return;
        }
        ui.notifications.info(
          game.i18n.format('MY_RPG.MomentOfGloryImprove.Success', {
            value: result.nextHeroPoints
          })
        );
      } catch (error) {
        debugLog('Highlight Point improve failed', {
          messageId: message.id,
          actorId: actor.id,
          error
        });
        ui.notifications.error(game.i18n.localize('MY_RPG.MomentOfGloryImprove.Errors.Failed'));
      }
    }
  });
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

async function handleActorOwnedItemDelete(item, options = {}) {
  if (hasItemLibrarySyncOption(options) || !isLibrarySyncManagedType(item?.type)) return;

  const result = await cleanupLibraryLinkOnActorItemDelete(item);
  debugLog('Actor item library link cleaned up on delete', {
    actor: item?.parent?.uuid ?? null,
    itemId: item?.id ?? null,
    updated: result?.updated ?? false,
    deleted: result?.deleted ?? false
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
  // A manual delete from the Items directory should also drop its per-character folder
  // once that folder is left empty.
  const folderRemoved = await removeManagedItemFolderIfEmpty(item?.folder?.id);
  debugLog('Library item unlinked from actor items', {
    itemId: item?.id ?? null,
    unlinkedCopies,
    folderRemoved
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

function isEnvironmentTokenProxyActor(actor) {
  return Boolean(
    actor?.getFlag?.(MODULE_ID, ENVIRONMENT_PROXY_ACTOR_FLAG) ??
      actor?.flags?.[MODULE_ID]?.[ENVIRONMENT_PROXY_ACTOR_FLAG]
  );
}

const TOKEN_ISOLATION_FLAG = 'tokenIsolated';

function isTokenIsolated(token) {
  return Boolean(
    token?.getFlag?.(MODULE_ID, TOKEN_ISOLATION_FLAG) ??
      token?.flags?.[MODULE_ID]?.[TOKEN_ISOLATION_FLAG]
  );
}

async function applyTokenIsolationPlan(plan) {
  for (const { token, update } of plan) {
    const changes = { ...update };
    if (!update.actorLink) changes[`flags.${MODULE_ID}.${TOKEN_ISOLATION_FLAG}`] = true;
    await token.update(changes);
  }
}
async function isolateActorTokensOnScene(createdToken) {
  if (!isPrimaryActiveGM()) return;

  const actor = createdToken?.baseActor ?? game.actors?.get(createdToken?.actorId);
  if (!actor || isEnvironmentTokenProxyActor(actor)) return;

  const plan = getTokenIsolationPlan({
    scene: createdToken.parent,
    actor,
    createdToken
  });
  if (!plan.length) return;

  await applyTokenIsolationPlan(plan);

  debugLog('Scene token isolation updated', {
    actor: actor.uuid ?? actor.id,
    scene: createdToken.parent?.id ?? null,
    tokenCount: plan.length,
    isolated: plan.some(({ update }) => !update.actorLink)
  });
}

async function initializeSceneTokenIsolation() {
  if (!isPrimaryActiveGM()) return;

  for (const scene of game.scenes?.contents ?? []) {
    const actorIds = new Set(
      (scene.tokens?.contents ?? []).map((token) => String(token.actorId ?? '').trim()).filter(Boolean)
    );

    for (const actorId of actorIds) {
      const actor = game.actors?.get(actorId);
      if (!actor || isEnvironmentTokenProxyActor(actor)) continue;

      const tokens = getSceneActorTokens(scene, actorId);
      if (tokens.length === 1 && isTokenIsolated(tokens[0])) continue;

      const plan = getTokenIsolationPlan({
        scene,
        actor,
        createdToken: tokens.length === 1 ? tokens[0] : null
      });
      await applyTokenIsolationPlan(plan);

      if (tokens.length > 1) {
        for (const token of tokens) {
          if (!isTokenIsolated(token)) {
            await token.update({ [`flags.${MODULE_ID}.${TOKEN_ISOLATION_FLAG}`]: true });
          }
        }
      }
    }
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
    game.actors?.find((actor) => actor.getFlag(MODULE_ID, ENVIRONMENT_PROXY_ACTOR_FLAG)) ?? null;
  if (existingActor) return existingActor;

  const actorName =
    `${game.i18n.localize('MY_RPG.ItemTypeGroups.Environment')} ${game.i18n.localize(`TYPES.Actor.${ENVIRONMENT_TOKEN_ACTOR_TYPE}`)}`.trim();
  const tokenImage = 'icons/svg/hazard.svg';
  return Actor.create({
    name: actorName || game.i18n.localize(`TYPES.Actor.${ENVIRONMENT_TOKEN_ACTOR_TYPE}`),
    type: ENVIRONMENT_TOKEN_ACTOR_TYPE,
    img: tokenImage,
    prototypeToken: {
      name: actorName || game.i18n.localize(`TYPES.Actor.${ENVIRONMENT_TOKEN_ACTOR_TYPE}`),
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

function isLegacyTraitType(type) {
  return LEGACY_TRAIT_TYPES.has(String(type ?? '').trim());
}

function isCurrentTraitType(type) {
  const normalizedType = String(type ?? '').trim();
  return normalizedType.startsWith('trait') && !isLegacyTraitType(normalizedType);
}

function getMigratedEquipmentSystemData(item) {
  const systemData = foundry.utils.deepClone(item?.system ?? {});
  const itemType = String(item?.type ?? '').trim();
  const hasStoredRequiresRoll = typeof systemData.requiresRoll === 'boolean';
  const hasConfiguredSkill = Boolean(String(systemData.skill ?? '').trim());
  const requiresRoll = hasStoredRequiresRoll
    ? systemData.requiresRoll
    : itemType === 'cartridge' || itemType === 'implant' || hasConfiguredSkill;

  systemData.rank = String(systemData.rank ?? '');
  systemData.requiresRoll = Boolean(requiresRoll);
  systemData.skill = String(systemData.skill ?? '');
  systemData.skillBonus = Number(systemData.skillBonus ?? 0) || 0;
  systemData.usageFrequency = normalizeUsageFrequency(
    systemData.usageFrequency ?? DEFAULT_ITEM_USAGE_FREQUENCY
  );
  systemData.activationCost = String(
    systemData.activationCost ?? systemData.activationType ?? 'passive'
  ).trim();
  systemData.activationType = systemData.activationCost || 'passive';
  systemData.range = String(systemData.range ?? '');
  systemData.duration = String(systemData.duration ?? '');
  systemData.area = String(systemData.area ?? '');
  systemData.defense = String(systemData.defense ?? '');
  systemData.targets = String(systemData.targets ?? '');
  if (!systemData.requiresRoll) {
    systemData.skill = '';
  }

  delete systemData.equipmentSubtype;
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

function getMigratedTraitSystemData(item) {
  const systemData = foundry.utils.deepClone(item?.system ?? {});
  systemData.usageFrequency = normalizeUsageFrequency(
    systemData.usageFrequency ?? DEFAULT_ITEM_USAGE_FREQUENCY
  );
  systemData.activationCost = String(
    systemData.activationCost ?? systemData.activationType ?? 'passive'
  ).trim();
  systemData.activationType = systemData.activationCost || 'passive';
  systemData.range = String(systemData.range ?? '');
  systemData.duration = String(systemData.duration ?? '');
  systemData.area = String(systemData.area ?? '');
  systemData.defense = String(systemData.defense ?? '');
  systemData.targets = String(systemData.targets ?? '');
  systemData.requiresRoll = Boolean(systemData.requiresRoll);
  systemData.skill = String(systemData.skill ?? '');
  if (!systemData.requiresRoll) {
    systemData.skill = '';
  }
  return systemData;
}

function needsTraitSystemNormalization(item) {
  if (!isCurrentTraitType(item?.type)) return false;

  const nextSystemData = getMigratedTraitSystemData(item);
  return !foundry.utils.isEmpty(foundry.utils.diffObject(item?.system ?? {}, nextSystemData));
}

function buildTraitSystemNormalizationUpdate(item) {
  return {
    _id: item.id,
    system: getMigratedTraitSystemData(item)
  };
}

function buildLegacyTraitCreateData(item, { mappedLibraryUuid = '' } = {}) {
  const data = foundry.utils.deepClone(item?.toObject?.() ?? {});
  delete data._id;
  data.type = 'trait';
  data.system = getMigratedTraitSystemData(item);

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

// Shared engine for the one-time legacy item-type migrations. Legacy items (world
// and actor-owned) are recreated under the unified type, links to migrated world
// sources are repointed, library metadata follows recreated actor items, and the
// remaining items of the current type get their system data normalized in place.
async function migrateLegacyItemTypes({
  source,
  debugLabel,
  isLegacyItem,
  needsNormalization,
  buildNormalizationUpdate,
  buildCreateData
}) {
  if (!game.user?.isGM) return null;

  const createDeleteOptions = {
    render: false,
    [ITEM_LIBRARY_SYNC_OPTION_KEY]: { source }
  };
  const updateOptions = {
    diff: false,
    ...createDeleteOptions
  };

  const worldItemsSnapshot = Array.from(game.items ?? []);
  const legacyWorldItems = worldItemsSnapshot.filter((item) => isLegacyItem(item));
  const normalizedWorldUpdates = worldItemsSnapshot
    .filter((item) => needsNormalization(item))
    .map((item) => buildNormalizationUpdate(item));

  const worldUuidMap = new Map();
  const migratedLegacyWorldItemIds = [];
  let worldItemsRecreated = 0;
  for (const item of legacyWorldItems) {
    const createdItem = await Item.create(buildCreateData(item), createDeleteOptions);
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
    const legacyActorItems = actorItemsSnapshot.filter((item) => isLegacyItem(item));
    const normalizedActorUpdates = actorItemsSnapshot
      .filter((item) => needsNormalization(item))
      .map((item) => buildNormalizationUpdate(item));

    if (legacyActorItems.length) {
      const createdItems = await actor.createEmbeddedDocuments(
        'Item',
        legacyActorItems.map((item) =>
          buildCreateData(item, {
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
    debugLog(debugLabel, summary);
  }

  return summary;
}

function migrateLegacyEquipmentTypes() {
  return migrateLegacyItemTypes({
    source: 'legacy-equipment-type-migration',
    debugLabel: 'Migrating legacy equipment item types',
    isLegacyItem: (item) => isLegacyEquipmentType(item.type),
    needsNormalization: (item) =>
      item.type === 'equipment' && needsEquipmentSystemNormalization(item),
    buildNormalizationUpdate: buildEquipmentSystemNormalizationUpdate,
    buildCreateData: buildLegacyEquipmentCreateData
  });
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

function migrateLegacyTraitTypes() {
  return migrateLegacyItemTypes({
    source: 'legacy-trait-type-migration',
    debugLabel: 'Migrating legacy trait item types',
    isLegacyItem: (item) => isLegacyTraitType(item.type),
    needsNormalization: (item) =>
      isCurrentTraitType(item.type) && needsTraitSystemNormalization(item),
    buildNormalizationUpdate: buildTraitSystemNormalizationUpdate,
    buildCreateData: buildLegacyTraitCreateData
  });
}

async function runLegacyTraitTypeMigrationIfNeeded() {
  const currentVersion =
    Number(game.settings.get(MODULE_ID, LEGACY_TRAIT_TYPE_MIGRATION_SETTING)) || 0;
  if (currentVersion >= LEGACY_TRAIT_TYPE_MIGRATION_VERSION) return null;

  const summary = await migrateLegacyTraitTypes();
  await game.settings.set(
    MODULE_ID,
    LEGACY_TRAIT_TYPE_MIGRATION_SETTING,
    LEGACY_TRAIT_TYPE_MIGRATION_VERSION
  );
  return summary;
}

function hasObsoleteCartridgeData(item) {
  return Boolean(
    (item?.isCartridge || item?.type === 'cartridge') &&
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

function getGearCatalogAutoSyncState() {
  const state = game.settings.get(MODULE_ID, GEAR_CATALOG_AUTO_SYNC_STATE_SETTING) ?? {};
  return {
    sourceHash: String(state?.sourceHash ?? '').trim(),
    systemVersion: String(state?.systemVersion ?? '').trim()
  };
}

async function setGearCatalogAutoSyncState(nextState) {
  await game.settings.set(MODULE_ID, GEAR_CATALOG_AUTO_SYNC_STATE_SETTING, {
    sourceHash: String(nextState?.sourceHash ?? '').trim(),
    systemVersion: String(nextState?.systemVersion ?? '').trim()
  });
}

// One-time migration: repoint actor items that still link to world catalog items
// (or carry a gear-catalog key) at the shipped compendium pack. Non-destructive.
async function runPackLinkMigrationIfNeeded() {
  const currentVersion = Number(game.settings.get(MODULE_ID, PACK_LINK_MIGRATION_SETTING)) || 0;
  if (currentVersion >= PACK_LINK_MIGRATION_VERSION) return null;

  const summary = await migrateActorLinksToCompendium();
  await game.settings.set(MODULE_ID, PACK_LINK_MIGRATION_SETTING, PACK_LINK_MIGRATION_VERSION);
  debugLog('Pack link migration completed', summary);
  return summary;
}

// One-time migration: convert actor items linked to a catalog entry that is now a
// `weapon` (it used to be imported as `equipment`) into real `weapon` items. Skipped
// without marking complete when the pack is unavailable, so it retries on a later load.
async function runWeaponTypeMigrationIfNeeded() {
  const currentVersion = Number(game.settings.get(MODULE_ID, WEAPON_TYPE_MIGRATION_SETTING)) || 0;
  if (currentVersion >= WEAPON_TYPE_MIGRATION_VERSION) return null;

  const summary = await migrateCatalogWeaponsToWeaponType();
  if (!summary?.packAvailable) {
    debugLog('Weapon type migration deferred (gear-library pack unavailable)');
    return summary;
  }

  await game.settings.set(MODULE_ID, WEAPON_TYPE_MIGRATION_SETTING, WEAPON_TYPE_MIGRATION_VERSION);
  debugLog('Weapon type migration completed', summary);
  return summary;
}

// Refresh actor items linked to the compendium catalog from the shipped pack, but
// only when the system version changed (i.e. on a centralized system update). On an
// unchanged version, re-entering the world leaves character-sheet items untouched.
async function runCompendiumPackRefreshIfNeeded() {
  if (!isPrimaryActiveGM()) return null;

  const previousState = getGearCatalogAutoSyncState();
  const currentSystemVersion = String(game.system?.version ?? '').trim();

  if (
    previousState.systemVersion &&
    currentSystemVersion &&
    currentSystemVersion === previousState.systemVersion
  ) {
    debugLog('Compendium pack refresh skipped (system version unchanged)', {
      currentSystemVersion
    });
    return null;
  }

  const result = await refreshCompendiumLinkedActorItems();
  await setGearCatalogAutoSyncState({
    sourceHash: previousState.sourceHash,
    systemVersion: currentSystemVersion
  });

  debugLog('Compendium pack refresh completed', { currentSystemVersion, result });
  return result;
}

async function runV05MigrationIfNeeded() {
  const currentVersion = Number(game.settings.get(MODULE_ID, V05_MIGRATION_SETTING)) || 0;
  if (currentVersion >= V05_MIGRATION_VERSION) return null;
  const summary = await migrateWorldV04ToV05();
  if (!summary?.packAvailable) {
    debugLog('0.4 to 0.5 migration deferred (gear-library pack unavailable or outdated)');
    return summary;
  }
  await game.settings.set(MODULE_ID, V05_MIGRATION_SETTING, V05_MIGRATION_VERSION);
  return summary;
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
    GmToolsApp,
    openGmTools: () => GmToolsApp.show(),
    debugLog,
    migrateLegacyEquipmentTypes,
    migrateLegacyTraitTypes,
    mergeDuplicateLibraryItems,
    migrateActorItemsToLibrary,
    migrateActorLinksToCompendium,
    migrateCatalogWeaponsToWeaponType,
    refreshCompendiumLinkedActorItems,
    removeOrphanCatalogWorldItems,
    sessionStats,
    syncSharedHeroPointInputs
  };

  // Add custom constants for configuration.
  CONFIG.ProjectAndromeda = PROJECT_ANDROMEDA;

  registerSystemSettings();

  // Define custom Document classes
  CONFIG.Actor.documentClass = ProjectAndromedaActor;
  CONFIG.Combat.documentClass = ProjectAndromedaCombat;
  CONFIG.Item.documentClass = ProjectAndromedaItem;

  CONFIG.Combat.initiative = {
    formula: null,
    decimals: 0
  };

  // Register sheet application classes
  const actorSheets = getFoundryActorSheetsCollection();
  const itemSheets = getFoundryItemSheetsCollection();
  actorSheets.unregisterSheet('core', FoundryActorSheet);
  actorSheets.registerSheet(MODULE_ID, ProjectAndromedaActorSheet, {
    makeDefault: true,
    label: 'MY_RPG.SheetLabels.Actor'
  });
  itemSheets.unregisterSheet('core', FoundryItemSheet);
  const sheetLabels = {
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
    itemSheets.registerSheet(MODULE_ID, SheetClass, {
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
  updateDocumentTypeSelectOptions(dialog, selectElement);
});

Hooks.on('renderApplicationV2', (application, element) => {
  renderAndromedaCombatTracker(application, element);
  const selectElement = isDomElement(element) ? element.querySelector('select[name="type"]') : null;
  if (!selectElement) return;
  updateDocumentTypeSelectOptions(application, selectElement);
});

Hooks.on('renderCombatTracker', (application, html) => {
  renderAndromedaCombatTracker(application, html);
});

Hooks.on('getSceneControlButtons', (controls) => {
  registerGmToolsSceneControl(controls);
});

Hooks.on('getActorDirectoryEntryContext', (_html, options) => {
  registerActorDirectoryContextOptions(options);
});

Hooks.on('getActorContextOptions', (_application, options) => {
  registerActorDirectoryContextOptions(options);
});

Hooks.on('getChatLogEntryContext', (_html, options) => {
  registerChatMessageContextOptions(options);
});

Hooks.on('getChatMessageContextOptions', (_application, options) => {
  registerChatMessageContextOptions(options);
});

Hooks.on('createChatMessage', (message) => {
  const sessionStats = getSessionStatsService();
  if (sessionStats) {
    void sessionStats.recordRoll(message);
  }
});

// "Improve outcome" updates the roll message in place rather than posting a new card,
// so the spent Highlight Point is recorded from the flag the update stamps on.
Hooks.on('updateChatMessage', (message, changes) => {
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  const momentOfGlory = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.momentOfGlory`);
  const skillCheck = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.skillCheck`);
  if (!momentOfGlory && !skillCheck) return;
  void sessionStats.recordMessageUpdate(message, { skillCheck, momentOfGlory });
});

// Foundry v13 renders chat messages through renderChatMessageHTML; v12 uses renderChatMessage.
Hooks.on('renderChatMessageHTML', (message, html) => {
  wireSkillCheckShiftControls(message, html);
});

Hooks.on('renderChatMessage', (message, html) => {
  wireSkillCheckShiftControls(message, html);
});

// Keep the stored Highlight Point total within [0, HERO_POINT_MAX] no matter the
// source of the update (sheet input, programmatic spend, session grant).
Hooks.on('preUpdateActor', (actor, changes) => {
  if (isGmCharacterActorType(actor?.type)) return;
  const raw = foundry.utils.getProperty(changes, 'system.momentOfGlory');
  if (raw === undefined) return;
  const clamped = Math.min(Math.max(Math.floor(Number(raw) || 0), 0), HERO_POINT_MAX);
  if (clamped !== raw) {
    foundry.utils.setProperty(changes, 'system.momentOfGlory', clamped);
  }
});

Hooks.on('updateActor', (actor, changes) => {
  if (!foundry.utils.hasProperty(changes, 'system.momentOfGlory')) return;
  if (isGmCharacterActorType(actor?.type)) return;
  syncHeroPointInputs(actor);
});

// Rank changes may come from macros, imports, or modules rather than the sheet.
// Keep the embedded signature ability on the matching archetype version in every case.
Hooks.on('updateActor', (actor, changes, options) => {
  if (!foundry.utils.hasProperty(changes, 'system.currentRank')) return;
  if (options?.[ARCHETYPE_RANK_SYNC_OPTION]) return;
  void syncArchetypeAbilityToRank(actor, { render: false }).catch((error) => {
    debugLog('Archetype signature ability rank sync failed', {
      actor: actor?.uuid ?? null,
      error
    });
  });
});

// Highlight Point economy: each player character gains 1 at the start of a session
// (capped at HERO_POINT_MAX) and loses any unspent points when the session ends.
Hooks.on(SESSION_HOOK_STARTED, (session) => {
  void grantSessionStartHeroPoints(session);
});

Hooks.on(SESSION_HOOK_ENDED, () => {
  void clearSessionHeroPoints();
});

Hooks.on('updateActor', (actor, changes, options) => {
  if (!isPrimaryActiveGM()) return;
  if (hasItemLibrarySyncOption(options)) return;

  const changedOwnership = foundry.utils.hasProperty(changes, 'ownership');
  if (!changedOwnership) return;

  void syncActorLibraryStructure(actor).catch((error) => {
    debugLog('Actor library sync failed on actor update', {
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

// Editing the Heat trigger on an owned archetype updates the separate trait it
// granted to that character. The stable association remains the grant flag.
Hooks.on('updateItem', (item, changes, _options, userId) => {
  if (game.userId !== userId) return;
  if (item?.type !== ARCHETYPE_ITEM_TYPE) return;
  if (item?.parent?.documentName !== 'Actor') return;
  const changedPaths = Object.keys(foundry.utils.flattenObject(changes ?? {}));
  if (!changedPaths.some((path) => path.startsWith('system.trait'))) return;
  void syncArchetypeTraitGrant(item.parent, item, { render: false }).catch((error) => {
    debugLog('Archetype signature trait sync failed', {
      actor: item.parent?.uuid ?? null,
      archetype: item.uuid ?? null,
      error
    });
  });
});

Hooks.on('deleteItem', (item, options) => {
  if (!isPrimaryActiveGM()) return;
  if (item?.parent?.documentName === 'Actor') {
    void handleActorOwnedItemDelete(item, options).catch((error) => {
      debugLog('Actor item library sync failed on delete', {
        actor: item?.parent?.uuid ?? null,
        itemId: item?.id ?? null,
        error
      });
    });
    return;
  }
  if (item?.parent) return;

  void handleWorldItemDelete(item, options).catch((error) => {
    debugLog('Library item unlink failed on delete', {
      itemId: item?.id ?? null,
      error
    });
  });
});

// When a player character's archetype is removed, revert what it granted: delete its
// signature ability and trait, reset its skill rank, and reset defenses to rank default.
// Only the user performing the delete runs this, and drop-replace swaps suppress it.
Hooks.on('deleteItem', (item, options, userId) => {
  if (game.userId !== userId) return;
  if (options?.[ARCHETYPE_SWAP_OPTION]) return;
  if (item?.type !== ARCHETYPE_ITEM_TYPE) return;
  const actor = item?.parent;
  if (!actor || actor.documentName !== 'Actor') return;

  void clearArchetypeEffects(actor, item)
    .then(() => {
      // clearArchetypeEffects updates with { render: false }; the sheet already
      // re-rendered on the item deletion with stale skill/defense values, so refresh
      // it once the reverted data is in place.
      if (actor.sheet?.rendered) actor.sheet.render(false);
    })
    .catch((error) => {
      debugLog('Archetype effect cleanup failed on delete', {
        actor: actor?.uuid ?? null,
        itemId: item?.id ?? null,
        error
      });
    });
});

Hooks.on('createToken', (token) => {
  void isolateActorTokensOnScene(token).catch((error) => {
    debugLog('Scene token isolation failed', {
      token: token?.uuid ?? token?.id ?? null,
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

  const reportStartupError = ({ name, error }) => {
    console.error(`[Project Andromeda] Startup task failed: ${name}`, error);
    if (game.user?.isGM) {
      ui.notifications?.error?.(game.i18n.localize('MY_RPG.Startup.Failed'));
    }
  };

  await runStartupTasks(
    [
      {
        name: 'session stats recovery',
        continueOnError: true,
        run: async () => {
          const sessionStats = getSessionStatsService();
          if (!sessionStats) return;
          sessionStats.initialize();
          if (game.user?.isGM) await sessionStats.recoverStateOnReady();
        }
      },
      {
        name: 'scene token isolation',
        continueOnError: true,
        run: initializeSceneTokenIsolation
      }
    ],
    { onError: reportStartupError }
  );

  // World migrations and cleanups run once, on the primary active GM only, so two
  // connected GMs never execute the same document writes concurrently.
  if (isPrimaryActiveGM()) {
    await runStartupTasks(
      [
        { name: 'legacy equipment migration', run: runLegacyEquipmentTypeMigrationIfNeeded },
        { name: 'legacy trait migration', run: runLegacyTraitTypeMigrationIfNeeded },
        { name: 'obsolete cartridge cleanup', run: purgeObsoleteCartridgeData },
        { name: 'item library migration', run: runItemLibraryMigrationIfNeeded },
        { name: 'pack link migration', run: runPackLinkMigrationIfNeeded },
        { name: 'weapon type migration', run: runWeaponTypeMigrationIfNeeded },
        { name: 'compendium pack refresh', run: runCompendiumPackRefreshIfNeeded },
        { name: '0.4 to 0.5 migration', run: runV05MigrationIfNeeded }
      ],
      { onError: reportStartupError }
    );
  }
});
