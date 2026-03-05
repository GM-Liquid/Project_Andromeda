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
import { SessionStatsService } from './helpers/session-stats.mjs';
import './helpers/handlebars-helpers.mjs';

const ITEM_SUPERTYPE_ORDER = ['equipment', 'environment', 'traits', 'other'];
const ENVIRONMENT_ITEM_TYPES = new Set(
  ITEM_TYPE_CONFIGS
    .filter((config) => config.supertype === 'environment')
    .map((config) => config.type)
);
const ENVIRONMENT_ITEM_SOURCE_FLAG = 'environmentTokenSourceUuid';
const ENVIRONMENT_PROXY_ACTOR_FLAG = 'isEnvironmentTokenProxy';
const ENVIRONMENT_TOKEN_ACTOR_TYPE = 'npc';

function getSessionStatsService() {
  return game.projectAndromeda?.sessionStats ?? null;
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

function canUseMomentOfGloryReroll(message) {
  if (!message) return false;
  const hasRoll = Boolean((Array.isArray(message.rolls) && message.rolls.length) || message.roll);
  if (!hasRoll) return false;
  const actor = getMessageActor(message);
  if (!actor) return false;
  return Boolean(game.user?.isGM || actor.isOwner);
}

async function rerollMessageWithMomentOfGlory(message, actor) {
  const sourceRolls = Array.isArray(message?.rolls)
    ? message.rolls
    : message?.roll
      ? [message.roll]
      : [];
  if (!sourceRolls.length) {
    throw new Error('No roll data found on the source message.');
  }

  const rerolled = [];
  for (const roll of sourceRolls) {
    rerolled.push(await roll.reroll({ async: true }));
  }

  const currentMoment = Math.max(Number(actor.system?.momentOfGlory) || 0, 0);
  if (!currentMoment) return { spent: false };
  const nextMoment = currentMoment - 1;
  await actor.update({ 'system.momentOfGlory': nextMoment }, { render: false });

  const flags = foundry.utils.deepClone(message.flags ?? {});
  flags[MODULE_ID] ??= {};
  flags[MODULE_ID].momentOfGlory = {
    spent: 1,
    actorId: actor.id,
    sourceMessageId: message.id,
    timestamp: Date.now()
  };

  try {
    await ChatMessage.create({
      user: game.user?.id,
      speaker: foundry.utils.deepClone(message.speaker ?? {}),
      flavor: message.flavor ?? '',
      rolls: rerolled,
      style: message.style,
      type: message.type,
      whisper: Array.from(message.whisper ?? []),
      blind: Boolean(message.blind),
      flags
    });
  } catch (error) {
    await actor.update({ 'system.momentOfGlory': currentMoment }, { render: false });
    throw error;
  }

  for (const app of Object.values(actor.apps ?? {})) {
    const element = app?.element?.[0] ?? app?.element;
    if (!element) continue;
    if (typeof element.querySelector === 'function') {
      const input = element.querySelector('input[name="system.momentOfGlory"]');
      if (input) input.value = `${nextMoment}`;
      continue;
    }
    if (typeof element.find === 'function') {
      element.find('input[name="system.momentOfGlory"]').val(nextMoment);
    }
  }

  return { spent: true, nextMoment };
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

  const actorName = `${game.i18n.localize('MY_RPG.ItemTypeGroups.Environment')} ${game.i18n.localize('TYPES.Actor.npc')}`.trim();
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

Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user?.isGM) return;
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;

  const tokenControls = controls.find((control) => control.name === 'token');
  if (!tokenControls?.tools) return;

  tokenControls.tools.push(
    {
      name: 'project-andromeda-session-start',
      title: 'MY_RPG.SessionTracker.Controls.Start',
      icon: 'fas fa-play',
      visible: true,
      button: true,
      onClick: () => {
        void sessionStats.startSession();
      }
    },
    {
      name: 'project-andromeda-session-end',
      title: 'MY_RPG.SessionTracker.Controls.End',
      icon: 'fas fa-flag-checkered',
      visible: true,
      button: true,
      onClick: () => {
        void sessionStats.endSession({ reason: 'manual' });
      }
    }
  );
});

Hooks.on('getChatLogEntryContext', (_html, options) => {
  options.push({
    name: 'MY_RPG.MomentOfGloryReroll.ContextLabel',
    icon: '<i class="fas fa-dice"></i>',
    condition: (li) => {
      const message = getContextMessage(li);
      return canUseMomentOfGloryReroll(message);
    },
    callback: async (li) => {
      const message = getContextMessage(li);
      if (!message) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryReroll.Errors.NoMessage'));
        return;
      }
      const actor = getMessageActor(message);
      if (!actor) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryReroll.Errors.NoActor'));
        return;
      }
      if (!(game.user?.isGM || actor.isOwner)) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryReroll.Errors.NoPermission'));
        return;
      }
      if ((Number(actor.system?.momentOfGlory) || 0) <= 0) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryReroll.Errors.NoPoints'));
        return;
      }

      try {
        const result = await rerollMessageWithMomentOfGlory(message, actor);
        if (!result?.spent) {
          ui.notifications.warn(game.i18n.localize('MY_RPG.MomentOfGloryReroll.Errors.NoPoints'));
          return;
        }
        ui.notifications.info(
          game.i18n.format('MY_RPG.MomentOfGloryReroll.Success', {
            value: result.nextMoment
          })
        );
      } catch (error) {
        debugLog('Moment of Glory reroll failed', {
          messageId: message.id,
          actorId: actor.id,
          error
        });
        ui.notifications.error(game.i18n.localize('MY_RPG.MomentOfGloryReroll.Errors.Failed'));
      }
    }
  });
});

Hooks.on('createChatMessage', (message) => {
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  void sessionStats.recordRoll(message);
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
  const sessionStats = getSessionStatsService();
  if (!sessionStats) return;
  void sessionStats.handleGMConnectivity();
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

  if (!game.user.isGM) return;
  await runLegacyItemMigration();
});
