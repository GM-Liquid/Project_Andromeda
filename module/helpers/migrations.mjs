import { MODULE_ID, RUNE_TYPE_KEYS, debugLog } from '../config.mjs';

const LEGACY_ITEM_CONFIGS = [
  {
    listKey: 'cartridgesList',
    itemType: 'cartridge',
    defaultNameKey: 'MY_RPG.ItemGroups.NewCartridge',
    buildSystem: (entry) => ({
      runeType: normalizeRuneType(entry?.runeType ?? entry?.rune ?? entry?.type ?? ''),
      skill: normalizeSkill(entry?.skill ?? entry?.skillKey ?? entry?.skillId ?? ''),
      skillBonus: normalizeNumber(entry?.skillBonus ?? entry?.bonus ?? entry?.mod ?? 0)
    })
  },
  {
    listKey: 'implantsList',
    itemType: 'implant',
    defaultNameKey: 'MY_RPG.ItemGroups.NewImplant',
    buildSystem: (entry) => ({
      skill: normalizeSkill(entry?.skill ?? entry?.skillKey ?? entry?.skillId ?? ''),
      skillBonus: normalizeNumber(entry?.skillBonus ?? entry?.bonus ?? entry?.mod ?? 0)
    })
  },
  {
    listKey: 'weaponList',
    itemType: 'weapon',
    defaultNameKey: 'MY_RPG.ItemGroups.NewWeapon',
    buildSystem: (entry) => ({
      skill: normalizeSkill(entry?.skill ?? entry?.skillKey ?? entry?.skillId ?? ''),
      skillBonus: normalizeNumber(entry?.skillBonus ?? entry?.bonus ?? entry?.mod ?? 0),
      quantity: normalizeQuantity(entry?.quantity ?? entry?.count ?? entry?.amount ?? 1)
    })
  },
  {
    listKey: 'armorList',
    itemType: 'armor',
    defaultNameKey: 'MY_RPG.ItemGroups.NewArmor',
    buildSystem: (entry) => ({
      itemPhys: normalizeNumber(entry?.itemPhys ?? entry?.phys ?? entry?.physical ?? entry?.bonusPhysical ?? 0),
      itemAzure: normalizeNumber(entry?.itemAzure ?? entry?.azure ?? entry?.magical ?? entry?.bonusMagical ?? 0),
      itemMental: normalizeNumber(entry?.itemMental ?? entry?.mental ?? entry?.psychic ?? entry?.bonusPsychic ?? 0),
      itemShield: normalizeNumber(entry?.itemShield ?? entry?.shield ?? entry?.forceShield ?? entry?.shieldBonus ?? 0),
      itemSpeed: normalizeNumber(entry?.itemSpeed ?? entry?.speed ?? entry?.speedBonus ?? 0),
      quantity: normalizeQuantity(entry?.quantity ?? entry?.count ?? 1)
    })
  },
  {
    listKey: 'inventoryList',
    itemType: 'gear',
    defaultNameKey: 'MY_RPG.ItemGroups.NewGear',
    buildSystem: (entry) => ({
      quantity: normalizeQuantity(entry?.quantity ?? entry?.count ?? entry?.amount ?? 1)
    })
  }
];

export async function runLegacyItemMigration() {
  if (!game?.user?.isGM) return;
  const alreadyMigrated = game.settings.get(MODULE_ID, 'legacyItemMigrationComplete');
  if (alreadyMigrated) return;

  const actors = game.actors?.contents ?? [];
  if (!actors.length) {
    await game.settings.set(MODULE_ID, 'legacyItemMigrationComplete', true);
    return;
  }

  ui.notifications?.info(game.i18n.localize('MY_RPG.Migrations.LegacyItems.Start'));

  let migratedActors = 0;

  try {
    for (const actor of actors) {
      const migrated = await migrateActorItems(actor);
      if (migrated) {
        migratedActors += 1;
      }
    }

    await game.settings.set(MODULE_ID, 'legacyItemMigrationComplete', true);

    const message = migratedActors
      ? game.i18n.format('MY_RPG.Migrations.LegacyItems.Complete', { count: migratedActors })
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

  if (!itemsToCreate.length && foundry.utils.isObjectEmpty(updates)) return false;

  if (itemsToCreate.length) {
    await actor.createEmbeddedDocuments('Item', itemsToCreate);
    debugLog('Legacy items converted for actor', {
      actorId: actor.id,
      created: itemsToCreate.length
    });
  }

  if (!foundry.utils.isObjectEmpty(updates)) {
    await actor.update(updates);
  }

  return itemsToCreate.length > 0 || !foundry.utils.isObjectEmpty(updates);
}

function buildItemData(entry, config, index) {
  const normalizedEntry = entry && typeof entry === 'object' ? entry : {};
  const fallbackName = buildFallbackName(config, index);
  const name = normalizeName(
    normalizedEntry.name ?? normalizedEntry.title ?? normalizedEntry.label ?? '',
    fallbackName
  );
  const img = normalizeImage(normalizedEntry.img ?? normalizedEntry.icon ?? normalizedEntry.image ?? '');
  const baseSystem = {
    description: normalizeDescription(
      normalizedEntry.description ?? normalizedEntry.notes ?? normalizedEntry.effect ?? ''
    ),
    rank: normalizeRank(
      normalizedEntry.rank ?? normalizedEntry.rankValue ?? normalizedEntry.currentRank ?? normalizedEntry.level ?? ''
    ),
    equipped: normalizeBoolean(
      normalizedEntry.equipped ??
        normalizedEntry.isEquipped ??
        normalizedEntry.active ??
        normalizedEntry.enabled ??
        normalizedEntry.isActive ??
        false
    )
  };

  const extraSystem = config.buildSystem(normalizedEntry) ?? {};
  const system = cleanObject({
    ...baseSystem,
    ...extraSystem
  });

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
  return String(value).trim();
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
