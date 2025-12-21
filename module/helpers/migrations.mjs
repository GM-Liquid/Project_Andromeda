import { MODULE_ID, RUNE_TYPE_KEYS, debugLog } from '../config.mjs';

const LEGACY_ITEM_CONFIGS = [
  {
    listKey: 'cartridgesList',
    itemType: 'cartridge',
    defaultNameKey: 'MY_RPG.ItemGroups.NewCartridge',
    buildSystem: (entry) => ({
      runeType: normalizeRuneType(
        getLegacyField(entry, ['runeType', 'rune', 'type', 'category', 'kind'], 'Spell')
      ),
      skill: normalizeSkill(
        getLegacyField(entry, ['skill', 'skillKey', 'skillId', 'skillSlug', 'skillName', 'ability'], '')
      ),
      skillBonus: normalizeNumber(
        getLegacyField(entry, ['skillBonus', 'bonus', 'bonusValue', 'mod', 'modifier', 'skillMod'], 0)
      )
    })
  },
  {
    listKey: 'implantsList',
    itemType: 'implant',
    defaultNameKey: 'MY_RPG.ItemGroups.NewImplant',
    buildSystem: (entry) => ({
      skill: normalizeSkill(
        getLegacyField(entry, ['skill', 'skillKey', 'skillId', 'skillSlug', 'skillName', 'ability'], '')
      ),
      skillBonus: normalizeNumber(
        getLegacyField(entry, ['skillBonus', 'bonus', 'bonusValue', 'mod', 'modifier', 'skillMod'], 0)
      )
    })
  },
  {
    listKey: 'weaponList',
    itemType: 'weapon',
    defaultNameKey: 'MY_RPG.ItemGroups.NewWeapon',
    buildSystem: (entry) => ({
      skill: normalizeSkill(
        getLegacyField(entry, ['skill', 'skillKey', 'skillId', 'skillSlug', 'skillName', 'ability'], '')
      ),
      skillBonus: normalizeNumber(
        getLegacyField(entry, ['skillBonus', 'bonus', 'bonusValue', 'mod', 'modifier', 'skillMod'], 0)
      ),
      quantity: normalizeQuantity(
        getLegacyField(entry, ['quantity', 'qty', 'count', 'amount', 'stack', 'charges', 'uses'], 1)
      )
    })
  },
  {
    listKey: 'armorList',
    itemType: 'armor',
    defaultNameKey: 'MY_RPG.ItemGroups.NewArmor',
    buildSystem: (entry) => ({
      itemPhys: normalizeNumber(
        getLegacyField(entry, ['itemPhys', 'phys', 'physical', 'bonusPhysical', 'armorPhys'], 0)
      ),
      itemAzure: normalizeNumber(
        getLegacyField(entry, ['itemAzure', 'azure', 'magical', 'bonusMagical', 'armorAzure'], 0)
      ),
      itemMental: normalizeNumber(
        getLegacyField(entry, ['itemMental', 'mental', 'psychic', 'bonusPsychic', 'armorMental'], 0)
      ),
      itemShield: normalizeNumber(
        getLegacyField(entry, ['itemShield', 'shield', 'forceShield', 'shieldBonus', 'armorShield'], 0)
      ),
      itemSpeed: normalizeNumber(
        getLegacyField(entry, ['itemSpeed', 'speed', 'speedBonus', 'armorSpeed'], 0)
      ),
      quantity: normalizeQuantity(
        getLegacyField(entry, ['quantity', 'qty', 'count', 'amount', 'stack', 'charges', 'uses'], 1)
      )
    })
  },
  {
    listKey: 'inventoryList',
    itemType: 'gear',
    defaultNameKey: 'MY_RPG.ItemGroups.NewGear',
    buildSystem: (entry) => ({
      quantity: normalizeQuantity(
        getLegacyField(entry, ['quantity', 'qty', 'count', 'amount', 'stack', 'charges', 'uses'], 1)
      )
    })
  }
];

const ITEM_CONFIG_BY_TYPE = LEGACY_ITEM_CONFIGS.reduce((acc, config) => {
  acc[config.itemType] = config;
  return acc;
}, {});

const LEGACY_ITEM_TYPE_MAPPINGS = {
  ability: 'cartridge',
  mod: 'implant'
};

export async function runLegacyItemMigration() {
  if (!game?.user?.isGM) return;
  const alreadyMigrated = game.settings.get(MODULE_ID, 'legacyItemMigrationComplete');
  if (alreadyMigrated) return;

  const actors = game.actors?.contents ?? [];

  ui.notifications?.info(game.i18n.localize('MY_RPG.Migrations.LegacyItems.Start'));

  let migratedActors = 0;
  let convertedWorldItems = 0;

  try {
    for (const actor of actors) {
      const migrated = await migrateActorItems(actor);
      if (migrated) {
        migratedActors += 1;
      }
    }

    convertedWorldItems = await migrateWorldItems();

    await game.settings.set(MODULE_ID, 'legacyItemMigrationComplete', true);

    const message = migratedActors || convertedWorldItems
      ? game.i18n.format('MY_RPG.Migrations.LegacyItems.CompleteDetailed', {
          actorCount: migratedActors,
          itemCount: convertedWorldItems
        })
      : game.i18n.localize('MY_RPG.Migrations.LegacyItems.CompleteNoChanges');

    ui.notifications?.info(message);
  } catch (error) {
    console.error('[Project Andromeda] Legacy item migration failed', error);
    const errorMessage = game.i18n.format('MY_RPG.Migrations.LegacyItems.Error', {
      message: error?.message ?? String(error)
    });
    ui.notifications?.error(errorMessage);
  }
}

async function migrateActorItems(actor) {
  if (!actor || actor.type === 'vehicle') return false;
  const systemData = actor.system ?? {};
  const updates = {};
  const itemsToCreate = [];

  for (const config of LEGACY_ITEM_CONFIGS) {
    const rawList = Array.isArray(systemData?.[config.listKey]) ? systemData[config.listKey] : [];
    if (!rawList.length) continue;

    rawList.forEach((entry, index) => {
      const itemData = buildItemData(entry, config, index);
      if (itemData) {
        itemsToCreate.push(itemData);
      }
    });

    updates[`system.${config.listKey}`] = [];
  }

  const hasUpdates = !isEmptyObject(updates);
  const legacyItemUpdates = buildLegacyItemTypeUpdates(actor.items ?? []);
  const hasLegacyTypeFixes = legacyItemUpdates.length > 0;
  if (!itemsToCreate.length && !hasUpdates && !hasLegacyTypeFixes) return false;

  if (itemsToCreate.length) {
    await actor.createEmbeddedDocuments('Item', itemsToCreate);
    debugLog('Legacy items converted for actor', {
      actorId: actor.id,
      created: itemsToCreate.length
    });
  }

  if (hasUpdates) {
    await actor.update(updates);
  }

  if (hasLegacyTypeFixes) {
    await actor.updateEmbeddedDocuments('Item', legacyItemUpdates);
    debugLog('Legacy embedded item types updated', {
      actorId: actor.id,
      updated: legacyItemUpdates.length
    });
  }

  return itemsToCreate.length > 0 || hasUpdates || hasLegacyTypeFixes;
}

function buildItemData(entry, config, index) {
  const normalizedEntry = normalizeLegacyEntry(entry);
  const fallbackName = buildFallbackName(config, index);
  const name = normalizeName(
    getLegacyField(normalizedEntry, ['name', 'title', 'label'], ''),
    fallbackName
  );
  const img = normalizeImage(
    getLegacyField(normalizedEntry, ['img', 'image', 'icon', 'picture', 'avatar'], '')
  );
  const system = buildSystemData(normalizedEntry, config);

  const itemData = {
    name,
    type: config.itemType,
    system
  };

  if (img) {
    itemData.img = img;
  }

  return itemData;
}

function buildSystemData(normalizedEntry, config) {
  const baseSystem = {
    description: normalizeDescription(
      getLegacyField(
        normalizedEntry,
        ['description', 'desc', 'details', 'text', 'effect', 'effects', 'notes', 'summary'],
        ''
      )
    ),
    rank: normalizeRank(
      getLegacyField(
        normalizedEntry,
        ['rank', 'rankValue', 'rankLabel', 'currentRank', 'level', 'tier', 'rarity', 'quality'],
        ''
      )
    )
  };

  if (config?.itemType !== 'weapon') {
    baseSystem.equipped = normalizeBoolean(
      getLegacyField(
        normalizedEntry,
        ['equipped', 'isEquipped', 'active', 'isActive', 'enabled', 'isEnabled', 'worn', 'wielded'],
        false
      )
    );
  }

  const extraSystem = config?.buildSystem?.(normalizedEntry) ?? {};
  return cleanObject({
    ...baseSystem,
    ...extraSystem
  });
}

function buildLegacyItemTypeUpdates(items) {
  const updates = [];
  for (const item of items) {
    const targetType = LEGACY_ITEM_TYPE_MAPPINGS[item?.type];
    if (!targetType) continue;
    const update = buildLegacyItemTypeUpdate(item, targetType);
    if (update) {
      updates.push(update);
    }
  }
  return updates;
}

function buildLegacyItemTypeUpdate(item, targetType) {
  const config = ITEM_CONFIG_BY_TYPE[targetType];
  if (!config) return null;
  const source = item?.toObject?.() ?? item;
  const normalizedEntry = normalizeLegacyEntry(source);
  const fallbackBase = item?.name ?? buildFallbackName(config, 0);
  const name = normalizeName(
    getLegacyField(normalizedEntry, ['name', 'title', 'label'], fallbackBase),
    fallbackBase
  );
  const img =
    normalizeImage(
      getLegacyField(normalizedEntry, ['img', 'image', 'icon', 'picture', 'avatar'], item?.img ?? '')
    ) || item?.img;
  const system = buildSystemData(normalizedEntry, config);
  const update = {
    _id: item?.id ?? source?._id,
    type: targetType,
    name,
    system
  };
  if (img) {
    update.img = img;
  }
  return update;
}

async function migrateWorldItems() {
  const items = game.items?.contents ?? [];
  if (!items.length) return 0;
  let updated = 0;
  for (const item of items) {
    const targetType = LEGACY_ITEM_TYPE_MAPPINGS[item?.type];
    if (!targetType) continue;
    const update = buildLegacyItemTypeUpdate(item, targetType);
    if (!update) continue;
    const { _id: _ignored, ...data } = update;
    await item.update(data);
    updated += 1;
  }
  if (updated) {
    debugLog('Legacy world item types updated', { updated });
  }
  return updated;
}

function buildFallbackName(config, index) {
  const base = config?.defaultNameKey
    ? game.i18n.localize(config.defaultNameKey)
    : game.i18n.localize('MY_RPG.ItemGroups.Unnamed');
  return `${base} #${index + 1}`;
}

function normalizeName(value, fallback) {
  const text = coerceString(value, '').trim();
  return text || fallback;
}

function normalizeDescription(value) {
  if (value == null) return '';
  const extracted = extractRichText(value);
  return coerceString(extracted, '').trim();
}

function normalizeRank(value) {
  const text = coerceString(value, '').trim();
  if (!text) return '';
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    if (numeric <= 0) return '';
    const clamped = Math.max(1, Math.min(Math.round(numeric), 5));
    return String(clamped);
  }
  return text;
}

function normalizeRuneType(value) {
  const input = coerceString(value, '').trim();
  if (!input) return 'Spell';
  const match = RUNE_TYPE_KEYS.find((key) => key.toLowerCase() === input.toLowerCase());
  return match ?? 'Spell';
}

function normalizeSkill(value) {
  return coerceString(value, '').trim();
}

function normalizeQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  const rounded = Math.max(Math.round(numeric), 0);
  return rounded > 0 ? rounded : 1;
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['true', '1', 'yes', 'on', 'enabled', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'disabled', 'inactive'].includes(normalized)) return false;
  }
  if (value == null) return fallback;
  return Boolean(value);
}

function normalizeImage(value) {
  const text = coerceString(value, '').trim();
  return text;
}

function extractRichText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((part) => coerceString(extractRichText(part), '')).join('\n');
  }
  if (typeof value === 'object') {
    if ('value' in value) return extractRichText(value.value);
    if ('text' in value) return extractRichText(value.text);
    if ('content' in value) return extractRichText(value.content);
    if ('html' in value) return extractRichText(value.html);
    if ('markdown' in value) return extractRichText(value.markdown);
  }
  return value;
}

function coerceString(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
}

function cleanObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

function isEmptyObject(value) {
  if (!value) return true;
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return false;
    }
  }
  return true;
}

function normalizeLegacyEntry(entry) {
  if (!entry || typeof entry !== 'object') return {};
  const normalized = {};
  const sources = [entry.system, entry.data, entry];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      if (key === 'system' || key === 'data') continue;
      normalized[key] = unwrapLegacyValue(value);
    }
  }
  return normalized;
}

function unwrapLegacyValue(value) {
  if (value == null) return value;
  if (typeof value !== 'object' || Array.isArray(value)) return value;
  if ('value' in value) return unwrapLegacyValue(value.value);
  if ('text' in value) return unwrapLegacyValue(value.text);
  if ('content' in value) return unwrapLegacyValue(value.content);
  return value;
}

function getLegacyField(entry, keys, fallback) {
  for (const key of keys) {
    if (entry == null) continue;
    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      const value = unwrapLegacyValue(entry[key]);
      if (value !== undefined) {
        return value;
      }
    }
  }
  return fallback;
}
