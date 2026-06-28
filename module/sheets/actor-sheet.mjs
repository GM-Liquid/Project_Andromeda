/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

import { GM_HERO_POOL_SETTING, MODULE_ID, debugLog } from '../config.mjs';
import { getFoundryActorSheetClass } from '../helpers/foundry-compat.mjs';
import {
  isEliteActorType,
  isGmCharacterActorType,
  isPlayerCharacterActorType,
  isSupportedCharacterActorType,
  normalizeActorType,
  SUPPORTED_ACTOR_TYPES,
  supportsAzureStress
} from '../helpers/actor-types.mjs';
import {
  ARCHETYPE_BASELINE_RANK,
  getNextSkillAdvancement,
  getSkillCheckOutcomeKey,
  normalizeCharacterRank,
  normalizeSkill,
  normalizeSkillRank,
  normalizeSkillValue,
  SKILL_CHECK_FORMULA
} from '../helpers/skill-check.mjs';
import {
  ITEM_ACTIVATION_TYPE_LABEL_KEYS,
  ITEM_TABS,
  ITEM_BADGE_BUILDERS,
  ITEM_DEFENSE_LABEL_KEYS,
  ITEM_DURATION_LABEL_KEYS,
  ITEM_TARGET_LABEL_KEYS,
  ITEM_USAGE_FREQUENCY_LABEL_KEYS,
  getItemGroupConfigByKey,
  getItemGroupConfigs,
  getItemTypeConfig,
  getItemTabLabel
} from '../helpers/item-config.mjs';
import {
  findGearLibraryUuidBySyncId,
  getGearLibraryPack,
  isLibrarySyncManagedType,
  setLibraryItemLinkOnData
} from '../helpers/item-library-sync.mjs';
import {
  ARCHETYPE_GRANT_FLAG,
  ARCHETYPE_ITEM_TYPE,
  ARCHETYPE_SWAP_OPTION,
  clearArchetypeEffects,
  getArchetypeSkillKey,
  getSkillRankBonus
} from '../helpers/archetype.mjs';
import { formatDamageProfile, hasDamageProfileValue } from '../helpers/damage-profile.mjs';
import { hasStepEffects, normalizeStepEffects } from '../helpers/step-effects.mjs';
import { buildSkillCheckRollFlavor } from '../helpers/roll-card.mjs';

export const FoundryActorSheet = getFoundryActorSheetClass();

// Open the shipped gear-library compendium and, when possible, expand + scroll to the
// folder that holds the requested group's catalog. Expanding the folder is best-effort
// (the pack still opens if the layout differs across Foundry versions).
async function openGearLibraryCatalogSection(folderName) {
  const pack = getGearLibraryPack();
  if (!pack) {
    ui.notifications?.warn(game.i18n.localize('MY_RPG.ItemDialogs.CompendiumMissing'));
    return;
  }

  const folder =
    folderName && pack.folders ? pack.folders.find((entry) => entry.name === folderName) : null;

  if (folder) {
    // Use a self-removing listener rather than Hooks.once: a different compendium
    // rendering first must not consume the one-shot before our pack opens.
    const hookId = Hooks.on('renderCompendium', (app, html) => {
      if (app?.collection?.metadata?.id !== pack.metadata?.id) return;
      Hooks.off('renderCompendium', hookId);
      const root = html?.[0] ?? html;
      const folderEl = root?.querySelector?.(`[data-folder-id="${folder.id}"]`);
      if (!folderEl) return;
      folderEl.classList.remove('collapsed');
      (folderEl.querySelector('.folder-header') ?? folderEl).scrollIntoView?.({ block: 'start' });
    });
  }

  pack.render(true);
}

function getRankLabel(rank) {
  return game.i18n.localize(`MY_RPG.RankNumeric.Rank${rank}`);
}

function getHudRankClass(rank) {
  const numeric = Number(rank) || 0;
  if (numeric <= 0) return 'rank0';
  if (numeric >= 4) return 'rank4';
  return `rank${numeric}`;
}

const ADVANCEMENT_STATES = ['available', 'insufficient', 'capped'];
const ACTOR_SHEET_MIN_WIDTH = 730;
const TEMPORARY_PARAMETER_PATHS = new Set([
  'system.temphealth',
  'system.tempfortitude',
  'system.tempcontrol',
  'system.tempwill',
  'system.tempspeed'
]);

function getSharedGmHeroPool() {
  return Math.max(Number(game.settings.get(MODULE_ID, GM_HERO_POOL_SETTING)) || 0, 0);
}

function getActorTypeOptions(selectedType = '') {
  return SUPPORTED_ACTOR_TYPES.map((type) => ({
    value: type,
    label: game.i18n.localize(`TYPES.Actor.${type}`),
    selected: type === selectedType
  }));
}

export async function promptForActorTypeSelection(actor, { title } = {}) {
  const currentType = normalizeActorType(actor?.type);
  const options = getActorTypeOptions(currentType)
    .map(
      (option) =>
        `<option value="${option.value}" ${option.selected ? 'selected' : ''}>${option.label}</option>`
    )
    .join('');

  const content = `
    <form>
      <div class="form-group">
        <label>${game.i18n.localize('MY_RPG.ActorTypeChange.Label')}</label>
        <select name="actor-type">${options}</select>
      </div>
    </form>
  `;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    new Dialog({
      title: title ?? game.i18n.localize('MY_RPG.ActorTypeChange.Title'),
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('MY_RPG.ActorTypeChange.Save'),
          callback: (html) => finish(String(html.find('[name="actor-type"]').val() || '').trim())
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('MY_RPG.ActorTypeChange.Cancel'),
          callback: () => finish(null)
        }
      },
      default: 'save',
      close: () => finish(null)
    }).render(true);
  });
}

export async function updateActorDocumentType(actor, nextType) {
  const normalizedType = String(nextType ?? '').trim();
  if (!actor || !SUPPORTED_ACTOR_TYPES.includes(normalizedType) || actor.type === normalizedType) {
    return false;
  }

  await actor.update({ type: normalizedType }, { diff: false });
  return true;
}

function isActorUuidHeaderButton(button, actorName = '') {
  const headerClass = String(button?.class ?? '')
    .trim()
    .toLowerCase();
  const label = String(button?.label ?? '').trim();
  const normalizedActorName = String(actorName ?? '').trim();

  if (!headerClass && !label) return false;

  if (
    headerClass.includes('copyuuid') ||
    headerClass.includes('copy-uuid') ||
    headerClass.includes('document-id') ||
    headerClass.includes('documentid') ||
    headerClass.includes('uuid-link')
  ) {
    return true;
  }

  return (
    Boolean(normalizedActorName) &&
    label === normalizedActorName &&
    (headerClass.includes('uuid') ||
      headerClass.includes('document') ||
      headerClass.includes('copy'))
  );
}

function getUiThemeValue(variableName, fallback) {
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

export class ProjectAndromedaActorSheet extends FoundryActorSheet {
  constructor(...args) {
    super(...args);
    this._expandedItemIds = new Set();
    this._editMode = false;
  }

  /** @override */
  _getHeaderButtons() {
    const buttons = super
      ._getHeaderButtons()
      .filter((button) => !isActorUuidHeaderButton(button, this.actor?.name));
    if (!game.user?.isGM) return buttons;

    buttons.unshift({
      class: 'change-actor-type',
      icon: 'fas fa-shapes',
      label: game.i18n.localize('MY_RPG.ActorTypeChange.Button'),
      onclick: () => this._onChangeActorTypeClick()
    });

    return buttons;
  }

  /** @override */
  async _render(force = false, options = {}) {
    const paneScrollPos = this.element.find('.sheet-scrollable').scrollTop() ?? 0;
    const railSkillsScrollPos = this.element.find('.andromeda-rail-skills-scroll').scrollTop() ?? 0;
    await super._render(force, options);

    this._syncSheetEditModeHeaderButton();
    this._applySheetEditMode(this.element);
    this.element.find('.sheet-scrollable').scrollTop(paneScrollPos);
    this.element.find('.andromeda-rail-skills-scroll').scrollTop(railSkillsScrollPos);
  }

  /** @override */
  async _onDropItem(event, data) {
    if (!this.actor?.isOwner) return false;

    const item = await Item.implementation.fromDropData(data);
    if (!item) return false;
    const itemData = item.toObject();

    // Reordering within the same actor — defer to core sorting.
    if (this.actor.uuid === item.parent?.uuid) {
      return this._onSortItem(event, itemData);
    }

    const sourceUuid = String(data?.uuid ?? '').trim();

    // Dropping an archetype applies its bonuses (skill, defenses, signature ability)
    // and keeps the archetype on the sheet instead of creating a plain item.
    if (item.type === ARCHETYPE_ITEM_TYPE) {
      return this._onDropArchetype(itemData, sourceUuid);
    }

    // Dropping a library source (a compendium catalog item or a world Item) of a
    // managed type: link the new actor item to that source so the library-sync
    // hook reuses it instead of creating a folderless world duplicate.
    if (sourceUuid && !item.parent && isLibrarySyncManagedType(item.type)) {
      setLibraryItemLinkOnData(itemData, sourceUuid);
    }

    return this._onDropItemCreate(itemData, event);
  }

  // Apply an archetype to a player character: replace any existing archetype and the
  // ability it previously granted, then create the new archetype (compendium-linked),
  // grant its signature ability from the pack, and start the archetype skill at rank 2.
  async _onDropArchetype(itemData, sourceUuid) {
    if (!isPlayerCharacterActorType(this.actor.type)) {
      ui.notifications?.warn(game.i18n.localize('MY_RPG.Archetype.PlayerOnly'));
      return false;
    }

    // Remove the current archetype and revert its effects before applying the new
    // one. The delete is flagged as a swap so the deleteItem hook does not also run
    // cleanup (we control ordering here so the new skill/defenses are not clobbered).
    const existing = this.actor.items.filter((item) => item.type === ARCHETYPE_ITEM_TYPE);
    for (const old of existing) {
      await clearArchetypeEffects(this.actor, old);
    }
    if (existing.length) {
      await this.actor.deleteEmbeddedDocuments(
        'Item',
        existing.map((item) => item.id),
        { [ARCHETYPE_SWAP_OPTION]: true }
      );
    }

    if (sourceUuid) setLibraryItemLinkOnData(itemData, sourceUuid);
    const [createdArchetype] = await this.actor.createEmbeddedDocuments('Item', [itemData]);

    // Grant the signature ability from the gear-library pack (compendium-linked).
    const abilitySyncId = String(createdArchetype?.system?.abilitySyncId ?? '').trim();
    if (abilitySyncId) {
      const abilityUuid = await findGearLibraryUuidBySyncId(abilitySyncId);
      const abilitySource = abilityUuid ? await fromUuid(abilityUuid) : null;
      if (abilitySource) {
        const abilityData = abilitySource.toObject();
        delete abilityData._id;
        setLibraryItemLinkOnData(abilityData, abilityUuid);
        abilityData.flags = abilityData.flags ?? {};
        abilityData.flags[MODULE_ID] = {
          ...(abilityData.flags[MODULE_ID] ?? {}),
          [ARCHETYPE_GRANT_FLAG]: createdArchetype.id
        };
        await this.actor.createEmbeddedDocuments('Item', [abilityData]);
      } else {
        ui.notifications?.warn(game.i18n.localize('MY_RPG.Archetype.AbilityMissing'));
      }
    }

    // Start the archetype skill one rank above the base (rank 2) if it is lower.
    const skillKey = String(createdArchetype?.system?.skill ?? '').trim();
    const currentSkillRank = Number(this.actor.system?.skills?.[skillKey]?.rank) || 0;
    if (skillKey && currentSkillRank < ARCHETYPE_BASELINE_RANK) {
      await this.actor.update(
        { [`system.skills.${skillKey}.rank`]: ARCHETYPE_BASELINE_RANK },
        { render: false }
      );
    }

    this.render(false);
    return createdArchetype;
  }
  initializeRichEditor(element) {
    if (!element._tinyMCEInitialized) {
      const editorFontFamily = getUiThemeValue('--andromeda-font-body', 'inherit');
      const editorTextColor = getUiThemeValue('--andromeda-color-text', 'inherit');
      tinymce.init({
        target: element,
        inline: false,
        menubar: false,
        branding: false,
        statusbar: false,
        // Remove deprecated/absent plugins for TinyMCE 6 in Foundry v12
        plugins: 'autoresize',
        toolbar: false,
        // contextmenu plugin removed in TinyMCE 6
        valid_elements: 'p,strong/b,em/i,strike/s,br',
        content_style: [
          'body {',
          '  margin: 0;',
          '  padding: 5px;',
          `  font-family: ${editorFontFamily};`,
          '  font-size: inherit;',
          `  color: ${editorTextColor};`,
          '  background: transparent;',
          '}',
          'p { margin: 0; }'
        ].join(' '),
        autoresize_min_height: 40,
        autoresize_bottom_margin: 0,
        width: '100%',
        setup: (editor) => {
          const dispatch = () => {
            editor.save();
            element.dispatchEvent(new Event('input', { bubbles: true }));
          };

          // Keep plain-text paste without relying on removed paste plugin
          editor.on('paste', (e) => {
            try {
              const cd = e.clipboardData || window.clipboardData;
              if (!cd) return;
              const text = cd.getData('text/plain');
              if (!text) return;
              e.preventDefault();
              editor.insertContent(text.replace(/\n/g, '<br>'));
              dispatch();
            } catch {
              // Fall back to default paste if anything goes wrong
            }
          });

          editor.on('KeyUp', dispatch);
          editor.on('Change', dispatch);
        }
      });
      element._tinyMCEInitialized = true;
    }
  }

  initializeAutoResizeTextarea(element) {
    if (!(element instanceof HTMLTextAreaElement)) return;

    const resize = () => this.resizeAutoResizeTextarea(element);

    resize();

    if (!element.dataset.hasAutoResizeHandler) {
      element.dataset.hasAutoResizeHandler = 'true';
      element.addEventListener('input', resize);
    }
  }

  resizeAutoResizeTextarea(element) {
    if (!(element instanceof HTMLTextAreaElement)) return;

    element.style.height = 'auto';
    element.style.overflowY = 'hidden';
    const minHeight = Number.parseFloat(window.getComputedStyle(element).minHeight) || 0;
    element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`;
  }

  refreshAutoResizeTextareas(root = this.element) {
    const $root = root instanceof jQuery ? root : $(root);
    const refresh = () => {
      window.requestAnimationFrame(() => {
        $root
          .find('textarea.auto-resize-textarea')
          .each((i, el) => this.resizeAutoResizeTextarea(el));
      });
    };

    refresh();
    setTimeout(refresh, 0);
  }

  activateListeners(html) {
    super.activateListeners(html);
    const $html = html instanceof jQuery ? html : $(html);
    const derivedInputSelector = [
      "input[name='system.progressPoints']",
      "input[name='system.currentRank']",
      "input[name='system.stress.value']",
      "input[name='system.temphealth']",
      "input[name='system.tempfortitude']",
      "input[name='system.tempcontrol']",
      "input[name='system.tempwill']",
      "input[name='system.tempspeed']",
      "input[name^='system.defenses.']"
    ].join(', ');
    $html.find('textarea.rich-editor').each((i, el) => this.initializeRichEditor(el));
    $html
      .find('textarea.auto-resize-textarea')
      .each((i, el) => this.initializeAutoResizeTextarea(el));
    $html.on('click', '.stress-cell', this._onStressCellClick.bind(this));
    $html.on('contextmenu', '.stress-cell', this._onStressCellRightClick.bind(this));
    $html.on('click', '.force-shield-cell', this._onForceShieldCellClick.bind(this));
    $html.on('contextmenu', '.force-shield-cell', this._onForceShieldCellContextMenu.bind(this));
    $html.find('.rollable').on('click', this._onRoll.bind(this));

    $html.on('click', '.item-create', this._onItemCreate.bind(this));
    $html.on('click', '.item-edit', this._onItemEdit.bind(this));
    $html.on('click', '.item-delete', this._onItemDelete.bind(this));
    $html.on('click', '.item-activate', this._onItemActivate.bind(this));
    $html.on('click', '.item-roll', this._onItemRoll.bind(this));
    $html.on('click', '.item-quantity-step', this._onItemQuantityStep.bind(this));
    $html.on('change', '.item-equip-checkbox', this._onItemEquipChange.bind(this));
    $html.on('click', '[data-item-summary-toggle]', this._onItemRowToggle.bind(this));
    $html.on('keydown', '[data-item-summary-toggle]', this._onItemRowToggleKeydown.bind(this));

    $html.find('input[name^="system.skills."]').on('change', async (ev) => {
      const input = ev.currentTarget;
      const isRank = input.name.endsWith('.rank');
      const skillKey = input.name.split('.')[2] ?? '';
      const validatedValue = isRank
        ? normalizeSkillRank(
            input.value,
            this.actor.system?.currentRank,
            getSkillRankBonus(this.actor, skillKey)
          )
        : normalizeSkillValue(input.value);
      input.value = validatedValue;
      await this.actor.update({ [input.name]: validatedValue }, { render: false });
      this.actor.prepareData();
      this._refreshDerived(this.element);
      this._refreshSkillRows(this.element);
      this._refreshAdvancementHints(this.element);
    });

    $html.find(derivedInputSelector).on('change', this._onDerivedInputChange.bind(this));
    $html.on('click', '.skill-advance', this._onSkillAdvance.bind(this));
    $html.on('change', '.shared-hero-pool-input', this._onSharedHeroPoolChange.bind(this));
    $html.on('click', '.andromeda-tab', () => this.refreshAutoResizeTextareas($html));
    this._applySheetEditMode($html);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['project-andromeda', 'sheet', 'actor'],
      width: 860,
      height: 780,
      minWidth: ACTOR_SHEET_MIN_WIDTH,
      resizable: true,
      tabs: [
        {
          navSelector: '.andromeda-sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'abilities',
          controlSelector: 'a.andromeda-tab'
        }
      ]
    });
  }

  /** @override */
  get template() {
    const templateByType = {
      playerCharacter: 'actor-player-character-sheet.hbs',
      minion: 'actor-minion-sheet.hbs',
      rankAndFile: 'actor-rank-and-file-sheet.hbs',
      elite: 'actor-elite-sheet.hbs'
    };
    const normalizedType = normalizeActorType(this.actor.type);
    const templateName =
      templateByType[normalizedType] ??
      (isGmCharacterActorType(normalizedType)
        ? 'actor-minion-sheet.hbs'
        : 'actor-player-character-sheet.hbs');
    return `systems/project-andromeda/templates/actor/${templateName}`;
  }

  /** @override */
  setPosition(position = {}) {
    const nextPosition = { ...position };
    if (Number(nextPosition.width) > 0) {
      nextPosition.width = Math.max(Number(nextPosition.width), ACTOR_SHEET_MIN_WIDTH);
    }
    return super.setPosition(nextPosition);
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = context.data;
    context.system = foundry.utils.duplicate(actorData.system ?? {});
    context.flags = actorData.flags;
    context.isPlayerCharacter = isPlayerCharacterActorType(actorData.type);
    context.isGmCharacter = isGmCharacterActorType(actorData.type);
    context.isElite = isEliteActorType(actorData.type);
    context.canUseAzureStress = supportsAzureStress(actorData.type);
    context.sharedHeroPool = context.isGmCharacter ? getSharedGmHeroPool() : 0;
    context.sheetEditMode = this._editMode;
    context.sheetModeControls = this._getSheetModeControlLabels();

    if (isSupportedCharacterActorType(actorData.type)) {
      this._prepareCharacterData(context);
    }

    context.system.currentRankClass = getHudRankClass(Number(context.system?.currentRank) || 0);

    this._preparePersonalityData(context);

    const itemGroups = this._buildItemGroups();
    context.personalityValueGroup =
      itemGroups.find((group) => group.key === 'personalityValues') ?? null;
    const itemGroupsByTab = itemGroups
      .filter((group) => group.key !== 'personalityValues')
      .reduce((acc, group) => {
        (acc[group.tab] ??= []).push(group);
        return acc;
      }, {});
    context.itemGroups = itemGroupsByTab;
    context.rollData = context.actor.getRollData();
    context.itemTabs = ITEM_TABS.map((tab) => ({
      key: tab.key,
      label: game.i18n.localize(getItemTabLabel(tab.key)),
      groups: itemGroupsByTab[tab.key] ?? [],
      isInventory: tab.key === 'inventory',
      supplies: context.system?.supplies ?? 0,
      money: context.system?.money ?? 0
    }));
    context.itemControls = this._getItemControlLabels();

    return context;
  }

  _preparePersonalityData(context) {
    const rawBiography =
      context.system?.biography && typeof context.system.biography === 'object'
        ? foundry.utils.duplicate(context.system.biography)
        : {};

    context.system.biography = {
      ...rawBiography,
      feature: String(rawBiography.feature ?? ''),
      weakness: String(rawBiography.weakness ?? ''),
      temperament: String(rawBiography.temperament ?? ''),
      archetype: String(rawBiography.archetype ?? ''),
      appearance: String(rawBiography.appearance ?? ''),
      backstory: String(rawBiography.backstory ?? rawBiography.story ?? '')
    };
  }

  _prepareCharacterData(context) {
    context.system.skills ??= {};
    context.system.temphealth ??= 0;
    context.system.tempfortitude ??= 0;
    context.system.tempcontrol ??= 0;
    context.system.tempwill ??= 0;
    context.system.tempspeed ??= 0;
    const effectiveDefenses = context.system?.effectiveDefenses ?? context.system?.defenses ?? {};
    const archetypeSkillKey = getArchetypeSkillKey(this.actor);
    context.defensesLocked = Boolean(this.actor.system?.defensesLocked);

    const sortedSkills = {};
    const skillColumns = [];
    for (const [categoryKey, category] of Object.entries(
      CONFIG.ProjectAndromeda.skillCategories ?? {}
    )) {
      const columnSkills = [];
      for (const key of category.skills ?? []) {
        const skill = context.system.skills[key];
        if (!skill) continue;
        const normalized = normalizeSkill(
          skill,
          context.system.currentRank,
          getSkillRankBonus(this.actor, key)
        );
        skill.rank = normalized.rank;
        skill.value = normalized.value;
        skill.isArchetypeSkill = key === archetypeSkillKey;
        skill.label = game.i18n.localize(CONFIG.ProjectAndromeda.skills[key]) ?? key;
        skill.rankClass = `rank${skill.rank}`;
        skill.key = key;
        skill.advancement = this._buildSkillAdvancementDisplay(context.system, key);
        sortedSkills[key] = skill;
        columnSkills.push(skill);
      }
      skillColumns.push({
        key: categoryKey,
        label: game.i18n.localize(category.label),
        defenseLabel: game.i18n.localize(category.defenseLabel),
        defensePath: `system.defenses.${category.defenseKey}`,
        defenseKey: category.defenseKey,
        defenseValue: context.system?.defenses?.[category.defenseKey] ?? 1,
        defenseEffectiveValue: effectiveDefenses[category.defenseKey] ?? 1,
        skills: columnSkills
      });
    }
    context.system.skills = sortedSkills;
    context.skillColumns = skillColumns;

    const stress = context.system.stress ?? { value: 0, max: 0 };
    const stressMax = Math.max(Number(stress.max) || 0, 0);
    const stressValue = Math.min(Math.max(Number(stress.value) || 0, 0), stressMax);
    const marked = this._normalizeStressMarked(stress.marked, stressMax);
    context.system.stress = {
      ...foundry.utils.duplicate(stress),
      max: stressMax,
      value: stressValue,
      marked
    };
    context.system.stressTrack = this._buildTrackData({
      max: stressMax,
      value: stressValue,
      marked,
      ariaKey: 'MY_RPG.Stress.CellAria',
      allowMarked: context.canUseAzureStress
    });

    const forceShield = context.system.forceShield ?? { value: 0, max: 0 };
    const forceShieldMax = Math.max(Number(forceShield.max) || 0, 0);
    const forceShieldValue = Math.min(Math.max(Number(forceShield.value) || 0, 0), forceShieldMax);
    context.system.forceShield = {
      ...foundry.utils.duplicate(forceShield),
      max: forceShieldMax,
      value: forceShieldValue
    };
    context.system.forceShieldTrack = this._buildTrackData({
      max: forceShieldMax,
      value: forceShieldValue,
      ariaKey: 'MY_RPG.ForceShield.CellAria'
    });
  }

  _getAdvancementAvailable(system = this.actor.system) {
    return Number(system?.advancement?.remaining ?? system?.advancement?.available) || 0;
  }

  _getSkillAdvancementInfo(system, skillKey) {
    const next = getNextSkillAdvancement(system?.skills?.[skillKey], system?.currentRank, {
      rankBonus: getSkillRankBonus(this.actor, skillKey)
    });
    if (!next) return { state: 'capped', cost: 0 };
    const cost = next.cost;
    const available = this._getAdvancementAvailable(system);
    return {
      state: available >= cost ? 'available' : 'insufficient',
      cost
    };
  }

  _buildAdvancementDisplay(info) {
    const state = ADVANCEMENT_STATES.includes(info?.state) ? info.state : 'insufficient';
    const cost = Math.max(Number(info?.cost) || 0, 0);
    const costLabel =
      state === 'capped'
        ? game.i18n.localize('MY_RPG.Advancement.Max')
        : game.i18n.format('MY_RPG.Advancement.CostShort', { cost });
    const titleKey =
      state === 'capped'
        ? 'MY_RPG.Advancement.RankCap'
        : state === 'available'
          ? 'MY_RPG.Advancement.CanAfford'
          : 'MY_RPG.Advancement.NeedPoints';

    return {
      state,
      costLabel,
      title: game.i18n.format(titleKey, { cost })
    };
  }

  _buildSkillAdvancementDisplay(system, skillKey) {
    return this._buildAdvancementDisplay(this._getSkillAdvancementInfo(system, skillKey));
  }

  _refreshAdvancementHints(root = this.element) {
    if (!isPlayerCharacterActorType(this.actor.type)) return;
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const stateClasses = ADVANCEMENT_STATES.map((state) => `andromeda-advancement--${state}`);

    $root.find('[data-advancement-kind][data-advancement-key]').each((_, element) => {
      const key = String(element.dataset.advancementKey ?? '');
      const display = this._buildSkillAdvancementDisplay(this.actor.system, key);

      element.classList.remove(...stateClasses);
      element.classList.add(`andromeda-advancement--${display.state}`);
      element.setAttribute('title', display.title);
      element.setAttribute('aria-label', display.title);

      if (element.classList.contains('andromeda-advancement-cost')) {
        element.textContent = display.costLabel;
      }
    });
  }

  _getSheetModeControlLabels() {
    return {
      edit: game.i18n.localize('MY_RPG.SheetMode.Edit'),
      play: game.i18n.localize('MY_RPG.SheetMode.Play'),
      title: game.i18n.localize(
        this._editMode ? 'MY_RPG.SheetMode.SwitchToPlay' : 'MY_RPG.SheetMode.SwitchToEdit'
      )
    };
  }

  _applySheetEditMode(root = this.element) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const enabled = Boolean(this._editMode);
    const $form = $root.is('form') ? $root : $root.find('form').first();
    const $modeContainers = $root.add($form);
    $modeContainers.toggleClass('andromeda-edit-mode', enabled);
    $modeContainers.toggleClass('andromeda-play-mode', !enabled);

    $root.find('.andromeda-edit-mode-toggle').each((_, button) => {
      button.classList.toggle('active', enabled);
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      button.setAttribute(
        'title',
        game.i18n.localize(
          enabled ? 'MY_RPG.SheetMode.SwitchToPlay' : 'MY_RPG.SheetMode.SwitchToEdit'
        )
      );
      const text = button.querySelector('.andromeda-edit-mode-toggle__text');
      if (text) {
        text.textContent = game.i18n.localize(
          enabled ? 'MY_RPG.SheetMode.Play' : 'MY_RPG.SheetMode.Edit'
        );
      }
      const icon = button.querySelector('.andromeda-edit-mode-toggle__thumb i');
      if (icon) {
        icon.className = `fa-solid ${enabled ? 'fa-lock-open' : 'fa-lock'}`;
      }
    });

    $root
      .find("input[name^='system.skills.'], input[name^='system.defenses.']")
      .each((_, input) => {
        input.readOnly = !enabled;
        if (enabled) {
          input.removeAttribute('tabindex');
        } else {
          input.setAttribute('tabindex', '-1');
        }
      });
    $root.find('.skill-advance').prop('disabled', !enabled);
    this._refreshDefenseInputs($root);
  }

  _syncSheetEditModeHeaderButton() {
    const $header = this.element.find('.window-header').first();
    if (!$header.length) return;

    let $button = $header.find('.andromeda-edit-mode-toggle').first();
    if (!$button.length) {
      $button = $(`
        <button type="button" class="andromeda-edit-mode-toggle" aria-pressed="false">
          <span class="andromeda-edit-mode-toggle__track" aria-hidden="true">
            <span class="andromeda-edit-mode-toggle__thumb">
              <i class="fa-solid fa-lock"></i>
            </span>
          </span>
          <span class="andromeda-edit-mode-toggle__text sr-only"></span>
        </button>
      `);
      const $title = $header.find('.window-title').first();
      if ($title.length) {
        $button.insertBefore($title);
      } else {
        $header.prepend($button);
      }
    }

    $button
      .off('.projectAndromedaEditMode')
      .on(
        'mousedown.projectAndromedaEditMode mouseup.projectAndromedaEditMode dblclick.projectAndromedaEditMode',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
        }
      )
      .on('click.projectAndromedaEditMode', this._onEditModeToggle.bind(this));
  }

  _onEditModeToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget?.blur?.();
    this._editMode = !this._editMode;
    this._applySheetEditMode(this.element);
  }

  _buildTrackData({ max, value, marked = [], ariaKey, allowMarked = false }) {
    const boundedMax = Math.max(Number(max) || 0, 0);
    const boundedValue = Math.min(Math.max(Number(value) || 0, 0), boundedMax);
    const markedCells = allowMarked ? this._normalizeStressMarked(marked, boundedMax) : [];
    return Array.from({ length: boundedMax }, (_, index) => {
      const isMarked = allowMarked && markedCells.includes(index);
      const filled = index < boundedValue && !isMarked;
      return {
        index,
        filled,
        marked: isMarked,
        stateClass: [filled ? 'filled' : '', isMarked ? 'marked' : ''].filter(Boolean).join(' '),
        ariaPressed: filled ? 'true' : 'false',
        ariaLabel: game.i18n.format(ariaKey, { index: index + 1 })
      };
    });
  }

  /**
   * Toggle stress cells without forcing a full sheet re-render.
   */
  async _onStressCellClick(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index) || 0;
    const stress = this.actor.system.stress || { value: 0, max: 0 };
    const max = Number(stress.max) || 0;
    const current = Number(stress.value) || 0;
    const next = index < current ? index : Math.min(index + 1, max);
    await this.actor.update(
      {
        'system.stress.value': next
      },
      { render: false }
    );
    this._updateStressTrack(this.element, { value: next });
  }

  async _onStressCellRightClick(event) {
    event.preventDefault();
    if (!supportsAzureStress(this.actor.type)) return;
    const index = Number(event.currentTarget.dataset.index) || 0;
    const stress = this.actor.system.stress || { value: 0, max: 0 };
    const max = Number(stress.max) || 0;
    const normalizedMarked = this._normalizeStressMarked(stress.marked, max);
    const marked = normalizedMarked.includes(index)
      ? normalizedMarked.filter((cellIndex) => cellIndex < index)
      : Array.from({ length: index + 1 }, (_, cellIndex) => cellIndex);
    await this.actor.update(
      {
        'system.stress.marked': marked,
        'system.stress.value': 0
      },
      { render: false }
    );
    this._updateStressTrack(this.element, { marked: marked, value: 0 });
  }

  async _onForceShieldCellClick(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index) || 0;
    const forceShield = this.actor.system.forceShield || { value: 0, max: 0 };
    const max = Number(forceShield.max) || 0;
    const current = Number(forceShield.value) || 0;
    const next = index < current ? index : Math.min(index + 1, max);
    await this.actor.update(
      {
        'system.forceShield.value': next
      },
      { render: false }
    );
    this._updateForceShieldTrack(this.element, { value: next });
  }

  _onForceShieldCellContextMenu(event) {
    event.preventDefault();
  }

  async _onSkillAdvance(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const skillKey = String(button.dataset.advancementKey ?? '');
    if (!skillKey) return;
    const next = getNextSkillAdvancement(
      this.actor.system?.skills?.[skillKey],
      this.actor.system?.currentRank,
      { rankBonus: getSkillRankBonus(this.actor, skillKey) }
    );
    if (!next) return;
    if (this._getAdvancementAvailable() < next.cost) {
      ui.notifications.warn(game.i18n.localize('MY_RPG.Advancement.NotEnoughPoints'));
      return;
    }

    await this.actor.update(
      {
        [`system.skills.${skillKey}.rank`]: next.rank,
        [`system.skills.${skillKey}.value`]: next.value
      },
      { render: false }
    );
    this.actor.prepareData();
    this._refreshSkillRows(this.element, skillKey);
    this._refreshDerived(this.element);
    this._refreshAdvancementHints(this.element);
  }

  _coerceNonNegativeIntegerInput(input) {
    let value = parseInt(input?.value, 10);
    if (Number.isNaN(value) || value < 0) value = 0;
    if (input) input.value = value;
    return value;
  }

  _coerceIntegerInput(input) {
    let value = parseInt(input?.value, 10);
    if (Number.isNaN(value)) value = 0;
    if (input) input.value = value;
    return value;
  }

  async _onDerivedInputChange(event) {
    const input = event.currentTarget;
    if (!input?.name) return;

    let nextValue;
    if (input.name === 'system.currentRank') {
      nextValue = normalizeCharacterRank(input.value);
    } else if (TEMPORARY_PARAMETER_PATHS.has(input.name)) {
      nextValue = this._coerceIntegerInput(input);
    } else {
      nextValue = this._coerceNonNegativeIntegerInput(input);
    }
    input.value = nextValue;
    const updates = { [input.name]: nextValue };
    if (input.name === 'system.currentRank') {
      for (const [skillKey, skill] of Object.entries(this.actor.system?.skills ?? {})) {
        const rank = normalizeSkillRank(
          skill?.rank,
          nextValue,
          getSkillRankBonus(this.actor, skillKey)
        );
        if (rank !== Number(skill?.rank)) updates[`system.skills.${skillKey}.rank`] = rank;
      }
    }
    await this.actor.update(updates, { render: false });
    this.actor.prepareData();
    this._refreshSkillRows(this.element);
    this._refreshDerived(this.element);
    this._refreshAdvancementHints(this.element);
  }

  async _onSharedHeroPoolChange(event) {
    if (!isGmCharacterActorType(this.actor.type)) return;
    const input = event.currentTarget;
    const nextValue = this._coerceNonNegativeIntegerInput(input);
    await game.settings.set(MODULE_ID, GM_HERO_POOL_SETTING, nextValue);
    game.projectAndromeda?.syncSharedHeroPointInputs?.(nextValue);
  }

  async _onChangeActorTypeClick() {
    if (!game.user?.isGM) return;
    const nextType = await promptForActorTypeSelection(this.actor, {
      title: game.i18n.format('MY_RPG.ActorTypeChange.TitleWithName', {
        name: this.actor.name || game.i18n.localize('MY_RPG.KeyInfo.Name')
      })
    });
    if (!nextType) return;
    await updateActorDocumentType(this.actor, nextType);
  }

  _refreshSkillRows(root, skillKey = '') {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const rankClasses = ['rank0', 'rank1', 'rank2', 'rank3', 'rank4'];
    const skillKeys = skillKey ? [skillKey] : Object.keys(this.actor.system?.skills ?? {});
    for (const key of skillKeys) {
      const skill = normalizeSkill(
        this.actor.system?.skills?.[key],
        this.actor.system?.currentRank,
        getSkillRankBonus(this.actor, key)
      );
      const $row = $root.find(`.andromeda-skill-row[data-skill-key="${key}"]`);
      $row.find(`input[name="system.skills.${key}.rank"]`).val(skill.rank);
      $row.find(`input[name="system.skills.${key}.value"]`).val(skill.value);
      $row
        .find('.skill-rank-input')
        .removeClass(rankClasses.join(' '))
        .addClass(`rank${skill.rank}`);
    }
  }

  async _onRoll(event) {
    event.preventDefault();
    event.currentTarget?.blur?.();
    const el = event.currentTarget;
    const { skill, label } = el.dataset;
    if (!skill) return;
    const skillData = normalizeSkill(
      this.actor.system.skills?.[skill],
      this.actor.system.currentRank,
      getSkillRankBonus(this.actor, skill)
    );
    const parts = [
      {
        label: game.i18n.format('MY_RPG.RollFlavor.SkillValue', {
          skill: this._skillLabel(skill)
        }),
        value: skillData.value
      }
    ];
    const roll = await new Roll(`${SKILL_CHECK_FORMULA} + @mod`, {
      mod: skillData.value
    }).roll();
    const outcomeKey = getSkillCheckOutcomeKey(roll.total);
    const flavor = this._buildSkillCheckFlavor(label, parts, skillData.rank, outcomeKey, {
      total: roll.total
    });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
      rollMode: game.settings.get('core', 'rollMode'),
      flags: {
        [MODULE_ID]: {
          skillCheck: { skill, rank: skillData.rank, outcome: outcomeKey, label, parts }
        }
      }
    });
  }

  /**
   * Update derived fields on the sheet (speed, defenses, stress, force shield)
   * after an in-place change without re-rendering the sheet.
   */
  _refreshDerived(html) {
    const s = this.actor.system || {};
    const $root = html instanceof jQuery ? html : $(html ?? this.element);
    const rankClasses = ['rank1', 'rank2', 'rank3', 'rank4'];
    const setVal = (name, val) => {
      $root.find(`input[name="${name}"]`).val(val ?? 0);
    };
    const setRankBadge = (rank) => {
      const rankClass = getHudRankClass(rank);
      const rankBadgeClasses = rankClasses.map((value) => `andromeda-hud__rank--${value}`);
      $root
        .find('.andromeda-hud__rank')
        .removeClass(rankBadgeClasses.join(' '))
        .addClass(`andromeda-hud__rank--${rankClass}`);
    };
    const setText = (field, val) => {
      $root.find(`[data-field="${field}"]`).text(val ?? 0);
    };
    // Speed
    setVal('system.speed.value', s?.speed?.value);
    setVal('system.progressPoints', s?.progressPoints);
    setVal('system.stress.value', s?.stress?.value);
    setVal('system.advancement.totalSpent', s?.advancement?.totalSpent);
    setText('system.advancement.totalSpent', s?.advancement?.totalSpent);
    setText('system.advancement.remaining', s?.advancement?.remaining);
    setText('system.stress.max', s?.stress?.max);
    setRankBadge(s?.currentRank);
    setVal('system.temphealth', s?.temphealth);
    setVal('system.tempfortitude', s?.tempfortitude);
    setVal('system.tempcontrol', s?.tempcontrol);
    setVal('system.tempwill', s?.tempwill);
    setVal('system.tempspeed', s?.tempspeed);
    this._refreshDefenseInputs($root);

    this._updateStressTrack($root);
    this._updateForceShieldTrack($root);
  }

  _refreshDefenseInputs(root = this.element) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const defenses = this.actor.system?.defenses ?? {};
    const effectiveDefenses = this.actor.system?.effectiveDefenses ?? defenses;
    const setVal = (name, val) => {
      $root.find(`input[name="${name}"]`).val(val ?? 0);
    };
    setVal('system.defenses.fortitude', defenses?.fortitude);
    setVal('system.defenses.control', defenses?.control);
    setVal('system.defenses.will', defenses?.will);
    $root.find('[data-defense-effective="fortitude"]').text(effectiveDefenses?.fortitude ?? 0);
    $root.find('[data-defense-effective="control"]').text(effectiveDefenses?.control ?? 0);
    $root.find('[data-defense-effective="will"]').text(effectiveDefenses?.will ?? 0);
  }

  _updateStressTrack(root, options = {}) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const stress = this.actor.system.stress || { value: 0, max: 0 };
    const max = Math.max(Number(stress.max) || 0, 0);
    const allowMarked = supportsAzureStress(this.actor.type);
    const value =
      typeof options === 'number'
        ? options
        : typeof options?.value === 'number'
          ? options.value
          : Number(stress.value) || 0;
    const boundedValue = Math.min(Math.max(Number(value) || 0, 0), max);
    const marked = allowMarked
      ? Array.isArray(options?.marked)
        ? this._normalizeStressMarked(options.marked, max)
        : this._normalizeStressMarked(stress.marked, max)
      : [];
    $root.find("input[name='system.stress.value']").val(boundedValue);
    $root.find("[data-field='system.stress.max']").text(max);
    const $track = $root.find('.stress-track');
    if (!$track.length) return;
    const cells = this._syncStressTrackCells($track, max);
    cells.forEach((el, i) => {
      const isMarked = marked.includes(i);
      const filled = i < boundedValue && !isMarked;
      el.classList.toggle('filled', filled);
      el.classList.toggle('marked', isMarked);
      el.setAttribute('aria-pressed', filled ? 'true' : 'false');
    });
  }

  _syncStressTrackCells($track, max) {
    const track = $track?.[0];
    if (!track) return [];
    track.dataset.total = String(max);
    const selector = '.stress-cell';
    const cells = Array.from(track.querySelectorAll(selector));
    while (cells.length > max) {
      cells.pop()?.remove();
    }
    while (cells.length < max) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'stress-cell health-cell';
      track.append(cell);
      cells.push(cell);
    }
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      cell.dataset.index = String(index);
      cell.setAttribute(
        'aria-label',
        game.i18n.format('MY_RPG.Stress.CellAria', { index: index + 1 })
      );
    }
    return cells;
  }

  _updateForceShieldTrack(root, options = {}) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const forceShield = this.actor.system.forceShield || { value: 0, max: 0 };
    const max = Math.max(Number(forceShield.max) || 0, 0);
    const value =
      typeof options === 'number'
        ? options
        : typeof options?.value === 'number'
          ? options.value
          : Number(forceShield.value) || 0;
    const boundedValue = Math.min(Math.max(Number(value) || 0, 0), max);
    const $track = $root.find('.force-shield-track');
    if (!$track.length) return;
    const cells = this._syncForceShieldTrackCells($track, max);
    cells.forEach((el, i) => {
      const filled = i < boundedValue;
      el.classList.toggle('filled', filled);
      el.classList.remove('marked');
      el.setAttribute('aria-pressed', filled ? 'true' : 'false');
    });
  }

  _syncForceShieldTrackCells($track, max) {
    const track = $track?.[0];
    if (!track) return [];
    track.dataset.total = String(max);
    const selector = '.force-shield-cell';
    const cells = Array.from(track.querySelectorAll(selector));
    while (cells.length > max) {
      cells.pop()?.remove();
    }
    while (cells.length < max) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'force-shield-cell health-cell';
      track.append(cell);
      cells.push(cell);
    }
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      cell.dataset.index = String(index);
      cell.setAttribute(
        'aria-label',
        game.i18n.format('MY_RPG.ForceShield.CellAria', { index: index + 1 })
      );
    }
    return cells;
  }

  _normalizeStressMarked(marked, max) {
    const limit = Number.isFinite(max) ? max : null;
    const source = Array.isArray(marked) ? marked : [];
    const normalized = source
      .map((value) => Number(value))
      .filter(
        (value) => Number.isInteger(value) && value >= 0 && (limit === null || value < limit)
      );
    return [...new Set(normalized)];
  }

  _getItemControlLabels() {
    return {
      edit: game.i18n.localize('MY_RPG.ItemControls.Edit'),
      delete: game.i18n.localize('MY_RPG.ItemControls.Delete'),
      roll: game.i18n.localize('MY_RPG.ItemControls.Roll'),
      equip: game.i18n.localize('MY_RPG.ItemControls.Equip'),
      equipAria: game.i18n.localize('MY_RPG.ItemControls.EquipAria'),
      quantity: game.i18n.localize('MY_RPG.ItemControls.Quantity'),
      quantityIncrease: game.i18n.localize('MY_RPG.ItemControls.QuantityIncrease'),
      quantityDecrease: game.i18n.localize('MY_RPG.ItemControls.QuantityDecrease')
    };
  }

  _buildItemGroups() {
    const groupConfigs = getItemGroupConfigs();
    return groupConfigs.map((config) => {
      const items = config.types
        .flatMap((type) => this.actor.itemTypes?.[type] ?? [])
        .filter((item) => (typeof config.filter === 'function' ? config.filter(item) : true))
        .sort((left, right) => {
          const leftSort = Number(left?.sort) || 0;
          const rightSort = Number(right?.sort) || 0;
          if (leftSort !== rightSort) return leftSort - rightSort;
          return String(left?.name ?? '').localeCompare(String(right?.name ?? ''));
        });
      const preparedItems = items.map((item) => this._prepareItemForDisplay(item, config));
      return {
        key: config.key,
        type: config.types[0],
        types: config.types,
        tab: config.tab,
        icon: config.icon,
        label: game.i18n.localize(config.labelKey),
        empty: game.i18n.localize(config.emptyKey),
        createLabel: game.i18n.localize(config.createKey),
        newNameKey: config.newNameKey,
        showQuantity: Boolean(config.showQuantity),
        allowEquip: Boolean(config.allowEquip),
        exclusive: Boolean(config.exclusive),
        isSimple: config.key === 'personalityValues',
        items: preparedItems,
        count: preparedItems.length
      };
    });
  }

  _prepareItemForDisplay(item, config) {
    const system = item.system ?? {};
    const displayConfig = this._getItemDisplayConfig(item, config);
    const quantity = displayConfig.showQuantity ? Math.max(Number(system.quantity) || 0, 0) : 1;
    const badges = this._getItemBadges(item, displayConfig);
    const detailRows = this._buildItemDetailRows(item, displayConfig);
    const detailEffect = this._getItemSummary(item, displayConfig);
    return {
      id: item.id,
      uuid: item.uuid,
      name: item.name || game.i18n.localize('MY_RPG.ItemGroups.Unnamed'),
      img: item.img || 'icons/svg/item-bag.svg',
      groupKey: config.key,
      typeLabel: game.i18n.localize(`TYPES.Item.${item.type}`),
      showQuantity: Boolean(displayConfig.showQuantity),
      quantity,
      showEquip: Boolean(displayConfig.allowEquip),
      exclusive: Boolean(displayConfig.exclusive),
      equipped: displayConfig.allowEquip ? Boolean(system.equipped) : false,
      skillLabel: system.skill ? this._skillLabel(system.skill) : '—',
      checkSummary: this._getItemCheckSummary(item, displayConfig),
      activationSummary: this._getItemActivationSummary(item),
      activationShortSummary: this._getItemActivationShortSummary(item),
      hasCooldown: this._hasItemCooldown(item, displayConfig),
      cooldownUsed: this._isItemCooldownUsed(item),
      rollSummary: this._getItemRollSummary(item, displayConfig),
      detailRows,
      detailEffect,
      isExpanded: this._expandedItemIds.has(item.id),
      badges,
      hasBadges: badges.length > 0,
      hasDetails: detailRows.length > 0 || Boolean(detailEffect),
      canRoll: Boolean(displayConfig.canRoll),
      hasActivationControl: this._hasItemActivationControl(item, displayConfig),
      activationControlTitle: this._getItemActivationControlTitle(item, displayConfig),
      activationControlDefaultTitle: this._getItemActivationControlDefaultTitle(
        item,
        displayConfig
      ),
      activationControlIcon: this._getItemActivationControlIcon(item, displayConfig),
      activationControlDefaultIcon: this._getItemActivationControlDefaultIcon(item, displayConfig)
    };
  }

  _getItemCheckSummary(item, displayConfig = null) {
    const skillKey = String(item?.system?.skill ?? '').trim();
    const rollSummary = this._getItemRollSummary(item, displayConfig);
    if (!skillKey || rollSummary === '—') return '—';
    return `${this._skillLabel(skillKey)} ${rollSummary}`;
  }

  _getItemActivationSummary(item) {
    const system = item?.system ?? {};
    const activationCostValue = String(system.activationCost ?? system.activationType ?? '').trim();
    const normalized = activationCostValue || 'passive';
    return this._formatMappedValue(normalized, ITEM_ACTIVATION_TYPE_LABEL_KEYS);
  }

  _getItemActivationShortSummary(item) {
    const system = item?.system ?? {};
    const activationCostValue = String(system.activationCost ?? system.activationType ?? '').trim();
    const normalized = activationCostValue || 'passive';
    return this._formatMappedValue(normalized, {
      passive: 'MY_RPG.ActivationTypesShort.Passive',
      action: 'MY_RPG.ActivationTypesShort.Action',
      maneuver: 'MY_RPG.ActivationTypesShort.Maneuver',
      freeAction: 'MY_RPG.ActivationTypesShort.FreeAction',
      reaction: 'MY_RPG.ActivationTypesShort.Reaction'
    });
  }

  _hasItemActivationControl(item, displayConfig = null) {
    return Boolean(
      item &&
      (displayConfig?.canRoll ||
        this._hasItemCooldown(item, displayConfig) ||
        this._hasItemActivationCost(item, displayConfig))
    );
  }

  _getItemActivationControlTitle(item, displayConfig = null) {
    if (this._hasItemCooldown(item, displayConfig) && this._isItemCooldownUsed(item)) {
      return game.i18n.localize('MY_RPG.ItemControls.ClearCooldown');
    }
    return this._getItemActivationControlDefaultTitle(item, displayConfig);
  }

  _getItemActivationControlDefaultTitle(item, displayConfig = null) {
    if (displayConfig?.canRoll && this._hasItemCooldown(item, displayConfig)) {
      return game.i18n.localize('MY_RPG.ItemControls.RollAndMark');
    }
    return game.i18n.localize(
      displayConfig?.canRoll ? 'MY_RPG.ItemControls.Roll' : 'MY_RPG.ItemControls.Activate'
    );
  }

  _getItemActivationControlIcon(item, displayConfig = null) {
    return this._getItemActivationControlDefaultIcon(item, displayConfig);
  }

  _getItemActivationControlDefaultIcon(item, displayConfig = null) {
    if (!item) return '';
    return displayConfig?.canRoll ? 'fa-solid fa-dice-d10' : 'fa-solid fa-bolt';
  }

  _hasItemCooldown(item, displayConfig = null) {
    if (displayConfig?.key !== 'abilities') return false;
    const frequency = String(item?.system?.usageFrequency ?? '').trim();
    return Boolean(frequency && frequency !== 'passive');
  }

  _hasItemActivationCost(item, displayConfig = null) {
    if (displayConfig?.key !== 'abilities' && displayConfig?.key !== 'equipment') return false;
    const activationCost = String(
      item?.system?.activationCost ?? item?.system?.activationType ?? ''
    ).trim();
    return Boolean(activationCost && activationCost !== 'passive');
  }

  _isItemCooldownUsed(item) {
    return Number(item?.system?.cooldown?.used) > 0;
  }

  _isSkillRollItem(item, typeConfig = null) {
    const config = typeConfig ?? getItemTypeConfig(item?.type) ?? {};
    return (
      Boolean(item?.system?.requiresRoll) &&
      (item?.type === 'equipment' || config.supertype === 'traits')
    );
  }

  _getItemDisplayConfig(item, groupConfig = null) {
    const typeConfig = getItemTypeConfig(item?.type) ?? {};
    return {
      ...(groupConfig ?? {}),
      badgeGroupKey: typeConfig.badgeGroupKey ?? groupConfig?.key ?? typeConfig.groupKey ?? '',
      showQuantity: typeConfig.showQuantity ?? groupConfig?.showQuantity ?? false,
      allowEquip: typeConfig.allowEquip ?? groupConfig?.allowEquip ?? false,
      exclusive: typeConfig.exclusive ?? groupConfig?.exclusive ?? false,
      canRoll:
        this._isSkillRollItem(item, typeConfig) ||
        (typeConfig.canRoll ?? groupConfig?.canRoll ?? false),
      isMixedGroup: (groupConfig?.types?.length ?? 0) > 1,
      showKindBadge: groupConfig?.showKindBadge ?? (groupConfig?.types?.length ?? 0) > 1
    };
  }

  _getItemKindBadgeLabel(item) {
    return game.i18n.localize(`TYPES.Item.${item.type}`);
  }

  _getItemBadges(item, config) {
    const badges = [];
    if (config?.showKindBadge && config?.key !== 'equipment') {
      const kindBadge = this._getItemKindBadgeLabel(item);
      if (kindBadge) badges.push(kindBadge);
    }

    const builder = ITEM_BADGE_BUILDERS[config?.badgeGroupKey ?? config?.key];
    if (!builder) return badges;

    return badges.concat(
      builder(item, {
        t: game.i18n,
        getRankLabel,
        skillLabel: this._skillLabel.bind(this),
        formatSkillBonus: this._formatSkillBonus.bind(this),
        formatDamage: this._formatDamage.bind(this)
      })
    );
  }

  _getItemSummary(item) {
    const system = item.system ?? {};
    return this._formatItemDescription(system.description);
  }

  _getItemRollSummary(item, displayConfig = null) {
    const skillKey = String(item?.system?.skill ?? '').trim();
    const canRoll = Boolean(displayConfig?.canRoll ?? this._getItemDisplayConfig(item).canRoll);
    if (!canRoll || !skillKey) return '—';

    const skillValue = Number(this.actor.system?.skills?.[skillKey]?.value) || 0;
    return `${SKILL_CHECK_FORMULA} + ${skillValue}`;
  }

  _buildItemDetailRows(item, displayConfig = null) {
    if (displayConfig?.key === 'personalityValues') return [];

    const system = item?.system ?? {};
    const rows = [];
    const primaryRow = [];
    const activationCostValue = String(system.activationCost ?? system.activationType ?? '').trim();
    const activationCost =
      activationCostValue && activationCostValue !== 'passive'
        ? this._formatMappedValue(activationCostValue, ITEM_ACTIVATION_TYPE_LABEL_KEYS)
        : '';
    if (activationCost) {
      primaryRow.push({
        label: game.i18n.localize('MY_RPG.ItemFields.ActivationCost'),
        value: activationCost
      });
    }

    const defense = this._formatMappedValue(system.defense, ITEM_DEFENSE_LABEL_KEYS);
    if (defense) {
      primaryRow.push({
        label: game.i18n.localize('MY_RPG.ItemFields.Defense'),
        value: defense
      });
    }

    if (primaryRow.length) rows.push(primaryRow);

    const secondaryEntries = [];
    this._pushItemDetailEntry(
      secondaryEntries,
      'MY_RPG.ItemFields.Range',
      this._formatRangeValue(system.range)
    );
    this._pushItemDetailEntry(
      secondaryEntries,
      'MY_RPG.ItemFields.Duration',
      this._formatMappedValue(system.duration, ITEM_DURATION_LABEL_KEYS)
    );
    this._pushItemDetailEntry(
      secondaryEntries,
      'MY_RPG.ItemFields.Area',
      this._formatAreaValue(system.area)
    );
    this._pushItemDetailEntry(
      secondaryEntries,
      'MY_RPG.ItemFields.Targets',
      this._formatMappedValue(system.targets, ITEM_TARGET_LABEL_KEYS)
    );
    this._pushItemDetailEntry(
      secondaryEntries,
      'MY_RPG.AbilityConfig.Skill',
      system.skill ? this._skillLabel(system.skill) : ''
    );
    this._pushItemDetailEntry(
      secondaryEntries,
      'MY_RPG.ItemFields.RequiresRoll',
      this._shouldShowRequiresRoll(item, displayConfig)
        ? game.i18n.localize(system.requiresRoll ? 'MY_RPG.Inventory.Yes' : 'MY_RPG.Inventory.No')
        : ''
    );
    this._pushItemDetailEntry(
      secondaryEntries,
      'MY_RPG.ItemFields.UsageFrequency',
      String(system.usageFrequency ?? '').trim() &&
        String(system.usageFrequency).trim() !== 'passive'
        ? this._formatMappedValue(system.usageFrequency, ITEM_USAGE_FREQUENCY_LABEL_KEYS)
        : ''
    );

    const rank = Number(system.rank) || 0;
    if (rank) {
      this._pushItemDetailEntry(secondaryEntries, 'MY_RPG.ItemFields.Rank', getRankLabel(rank));
    }

    if (displayConfig?.showQuantity && Number(system.quantity) > 1) {
      this._pushItemDetailEntry(
        secondaryEntries,
        'MY_RPG.Inventory.Quantity',
        `${Math.max(Number(system.quantity) || 0, 0)}`
      );
    }

    const damage = system.skillBonus;
    if (hasDamageProfileValue(damage)) {
      this._pushItemDetailEntry(
        secondaryEntries,
        'MY_RPG.WeaponsTable.DamageLabel',
        this._formatDamage(damage)
      );
    }

    if (item?.type === 'armor') {
      this._pushItemDetailEntry(
        secondaryEntries,
        'MY_RPG.ArmorItem.BonusFortitudeLabel',
        this._formatNumericDetail(system.itemFortitude)
      );
      this._pushItemDetailEntry(
        secondaryEntries,
        'MY_RPG.ArmorItem.BonusControlLabel',
        this._formatNumericDetail(system.itemControl)
      );
      this._pushItemDetailEntry(
        secondaryEntries,
        'MY_RPG.ArmorItem.BonusWillLabel',
        this._formatNumericDetail(system.itemWill)
      );
      this._pushItemDetailEntry(
        secondaryEntries,
        'MY_RPG.ArmorItem.ShieldLabel',
        this._formatNumericDetail(system.itemShield)
      );
      this._pushItemDetailEntry(
        secondaryEntries,
        'MY_RPG.ArmorItem.BonusSpeedLabel',
        this._formatSignedDetail(system.itemSpeed)
      );
    }

    for (let index = 0; index < secondaryEntries.length; index += 2) {
      rows.push(secondaryEntries.slice(index, index + 2));
    }

    return rows;
  }

  _pushItemDetailEntry(entries, labelKey, value) {
    if (!value) return;
    entries.push({
      label: game.i18n.localize(labelKey),
      value
    });
  }

  _formatMappedValue(value, labels) {
    const normalized = String(value ?? '').trim();
    const labelKey = labels?.[normalized];
    if (labelKey) return game.i18n.localize(labelKey);
    return normalized;
  }

  _formatRangeValue(value) {
    const normalized = String(value ?? '').trim();
    if (normalized === 'melee') return game.i18n.localize('MY_RPG.ItemRanges.Melee');
    if (normalized === 'self') return game.i18n.localize('MY_RPG.ItemRanges.Self');
    return normalized;
  }

  _formatAreaValue(value) {
    const normalized = String(value ?? '').trim();
    const match = /^([a-z]+)\s+(.+)$/i.exec(normalized);
    if (!match) return normalized;
    const [, areaType, rest] = match;
    const localizedType = game.i18n.localize(`MY_RPG.ItemAreaTypes.${areaType}`);
    return localizedType === `MY_RPG.ItemAreaTypes.${areaType}`
      ? normalized
      : `${localizedType} ${rest}`;
  }

  _formatNumericDetail(value) {
    const numeric = Number(value) || 0;
    return numeric ? `${numeric}` : '';
  }

  _formatSignedDetail(value) {
    const numeric = Number(value) || 0;
    if (!numeric) return '';
    return numeric > 0 ? `+${numeric}` : `${numeric}`;
  }

  _shouldShowRequiresRoll(item, displayConfig = null) {
    if (item?.type === 'weapon') return true;
    if (displayConfig?.key === 'abilities' || displayConfig?.key === 'equipment') return true;
    return Boolean(item?.system?.requiresRoll);
  }

  _getTraitRollNote(item, typeConfig = null) {
    const config = typeConfig ?? getItemTypeConfig(item?.type) ?? {};
    if (config.supertype !== 'traits') return '';
    const system = item?.system ?? {};
    return this._formatItemDescription(system.description ?? system.desc ?? '');
  }

  _formatItemDescription(value) {
    const rawText = String(value ?? '')
      .replace(/\r\n?/g, '\n')
      .trim();
    if (!rawText) return '';
    const hasHtmlMarkup = /<\/?[a-z][^>]*>/i.test(rawText);
    if (hasHtmlMarkup) return rawText;
    return this._escapeHTML(rawText).replace(/\n/g, '<br>');
  }

  _escapeHTML(value) {
    const text = value ?? '';
    if (foundry?.utils?.escapeHTML) {
      return foundry.utils.escapeHTML(text);
    }
    if (globalThis.TextEditor?.encodeHTML) {
      return TextEditor.encodeHTML(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _getDefaultItemName(config) {
    if (config?.newNameKey) {
      return game.i18n.localize(config.newNameKey);
    }
    const typeKey = config?.type ?? config?.types?.[0];
    const typeLabel = typeKey
      ? game.i18n.localize(`TYPES.Item.${typeKey}`)
      : game.i18n.localize('MY_RPG.Inventory.Name');
    return game.i18n.format('MY_RPG.ItemControls.NewItemFallback', { type: typeLabel });
  }

  _getDefaultItemNameForType(type, fallbackConfig = null) {
    const fallbackTypes = Array.isArray(fallbackConfig?.createTypes)
      ? fallbackConfig.createTypes
      : Array.isArray(fallbackConfig?.types)
        ? fallbackConfig.types
        : [];
    if (fallbackConfig && fallbackTypes.includes(type)) {
      return this._getDefaultItemName(fallbackConfig);
    }

    const groupConfig = getItemGroupConfigs().find(
      (config) => config.types.length === 1 && config.types[0] === type
    );
    if (groupConfig) return this._getDefaultItemName(groupConfig);
    if (type) return this._getDefaultItemName({ type });
    return this._getDefaultItemName(fallbackConfig);
  }

  _getGroupConfig(groupKey) {
    if (!groupKey) return null;
    return getItemGroupConfigByKey(groupKey);
  }

  _getItemContextFromEvent(event) {
    const targetEl = event?.currentTarget;
    const $target = $(targetEl);
    const rowEl = targetEl?.closest ? targetEl.closest('.item-row[data-item-id]') : null;
    const $row = rowEl ? $(rowEl) : $target.closest('.item-row[data-item-id]');
    if (!$row?.length) return {};
    const itemId =
      $target.data('itemId') ?? $row.data('itemId') ?? rowEl?.dataset?.itemId ?? undefined;
    const groupKey =
      $target.data('groupKey') ?? $row.data('groupKey') ?? rowEl?.dataset?.groupKey ?? undefined;
    const item = this.actor.items.get(itemId);
    const config = this._getGroupConfig(groupKey);
    const displayConfig = item ? this._getItemDisplayConfig(item, config) : config;
    return { item, $row, groupKey, config, displayConfig, itemId };
  }

  async _promptForItemType(config) {
    const types = Array.isArray(config?.createTypes)
      ? config.createTypes.filter(Boolean)
      : Array.isArray(config?.types)
        ? config.types.filter(Boolean)
        : [];
    if (types.length <= 1) return types[0] ?? '';

    const options = types
      .map((type) => {
        const value = this._escapeHTML(type);
        const label = this._escapeHTML(game.i18n.localize(`TYPES.Item.${type}`));
        return `<option value="${value}">${label}</option>`;
      })
      .join('');

    const content = `
      <form>
        <div class="form-group">
          <select name="item-type">${options}</select>
        </div>
      </form>
    `;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      new Dialog({
        title: game.i18n.localize(config.createKey),
        content,
        buttons: {
          create: {
            icon: '<i class="fas fa-plus"></i>',
            label: game.i18n.localize('MY_RPG.AbilityConfig.Save'),
            callback: (html) => finish(String(html.find('[name="item-type"]').val() || '').trim())
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('MY_RPG.AbilityConfig.Cancel'),
            callback: () => finish(null)
          }
        },
        default: 'create',
        close: () => finish(null)
      }).render(true);
    });
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const $target = $(event.currentTarget);
    const groupKey =
      $target.data('groupKey') || $target.closest('[data-item-group]').data('itemGroup');
    const type = $target.data('type');
    let config = this._getGroupConfig(groupKey);
    if (!config && type) {
      config = getItemGroupConfigs().find((entry) => entry.types.includes(type)) ?? null;
    }
    if (!config) return;

    // Groups backed by the shipped catalog let the user pick a ready compendium entry
    // or author a new one; groups without a catalog go straight to authoring.
    if (config.compendiumFolder && getGearLibraryPack()) {
      const mode = await this._promptItemCreationMode(config);
      if (!mode) return;
      if (mode === 'browse') {
        await openGearLibraryCatalogSection(config.compendiumFolder);
        return;
      }
    }

    await this._createGroupItem(config);
  }

  async _promptItemCreationMode(config) {
    const sectionLabel = game.i18n.localize(config.labelKey);
    const content = `<p class="item-create-mode">${this._escapeHTML(
      game.i18n.format('MY_RPG.ItemDialogs.CreateModePrompt', { section: sectionLabel })
    )}</p>`;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      new Dialog({
        title: game.i18n.localize(config.createKey),
        content,
        buttons: {
          create: {
            icon: '<i class="fas fa-plus"></i>',
            label: game.i18n.localize('MY_RPG.ItemDialogs.CreateNew'),
            callback: () => finish('create')
          },
          browse: {
            icon: '<i class="fas fa-book-open"></i>',
            label: game.i18n.localize('MY_RPG.ItemDialogs.BrowseCompendium'),
            callback: () => finish('browse')
          }
        },
        default: 'create',
        close: () => finish(null)
      }).render(true);
    });
  }

  async _createGroupItem(config) {
    const selectedType = await this._promptForItemType(config);
    if (!selectedType) return;
    const name = this._getDefaultItemNameForType(selectedType, config);
    const systemData = foundry.utils.deepClone(config.createData ?? {});
    // DEBUG-LOG
    debugLog('Actor sheet item create', { actor: this.actor.uuid, type: selectedType });
    await this.actor.createEmbeddedDocuments('Item', [
      { name, type: selectedType, system: systemData }
    ]);
  }

  async _onItemEdit(event) {
    event.preventDefault();
    const { item, itemId } = this._getItemContextFromEvent(event);
    if (!item) {
      // DEBUG-LOG
      debugLog('Actor sheet item edit failed - missing item', {
        actor: this.actor.uuid,
        itemId: itemId ?? null
      });
      return;
    }
    // DEBUG-LOG
    debugLog('Actor sheet item edit', { actor: this.actor.uuid, itemId: item.id });
    item.sheet?.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const { item, itemId } = this._getItemContextFromEvent(event);
    if (!item) {
      // DEBUG-LOG
      debugLog('Actor sheet item delete failed - missing item', {
        actor: this.actor.uuid,
        itemId: itemId ?? null
      });
      return;
    }
    const typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    const title = game.i18n.format('MY_RPG.ItemDialogs.DeleteTitle', { type: typeLabel });
    const safeName = this._escapeHTML(item.name || typeLabel);
    const content = `<p>${game.i18n.format('MY_RPG.ItemDialogs.DeleteContent', { name: safeName })}</p>`;
    const confirmed = await Dialog.confirm({ title, content });
    if (!confirmed) return;
    // DEBUG-LOG
    debugLog('Actor sheet item delete', {
      actor: this.actor.uuid,
      itemId: item.id,
      type: item.type
    });
    await item.delete();
  }

  async _onItemRoll(event) {
    event.preventDefault();
    event.currentTarget?.blur?.();
    const { item, itemId } = this._getItemContextFromEvent(event);
    if (!item) {
      // DEBUG-LOG
      debugLog('Actor sheet item roll failed - missing item', {
        actor: this.actor.uuid,
        itemId: itemId ?? null
      });
      return;
    }
    await this._rollItem(item, itemId, { includeItemContent: true });
  }

  async _onItemActivate(event) {
    event.preventDefault();
    event.currentTarget?.blur?.();
    const { item, $row, displayConfig, itemId } = this._getItemContextFromEvent(event);
    if (!item || !$row) {
      // DEBUG-LOG
      debugLog('Actor sheet item activation failed - missing item', {
        actor: this.actor.uuid,
        itemId: itemId ?? null
      });
      return;
    }

    const hasCooldown = this._hasItemCooldown(item, displayConfig);
    if (hasCooldown && this._isItemCooldownUsed(item)) {
      await this._setItemCooldownUsed(item, $row, false);
      return;
    }

    if (displayConfig?.canRoll) {
      const rolled = await this._rollItem(item, itemId, {
        includeItemContent: true,
        displayConfig
      });
      if (!rolled) return;
    } else {
      await this._sendItemActivationChat(item, displayConfig);
    }

    if (hasCooldown) {
      await this._setItemCooldownUsed(item, $row, true);
    }
  }

  async _rollItem(item, _itemId = null, { includeItemContent = false, displayConfig = null } = {}) {
    if (!item) return false;
    const typeConfig = getItemTypeConfig(item.type);
    const system = item.system ?? {};
    const skillKey = system.skill || '';
    const canRoll = this._isSkillRollItem(item, typeConfig) || item.type === 'weapon';
    if (!canRoll) return false;
    if (!skillKey) {
      ui.notifications.warn(game.i18n.localize('MY_RPG.WeaponsTable.SkillNone'));
      return false;
    }
    const skillData = normalizeSkill(
      this.actor.system?.skills?.[skillKey],
      this.actor.system?.currentRank,
      getSkillRankBonus(this.actor, skillKey)
    );
    const parts = [
      {
        label: game.i18n.format('MY_RPG.RollFlavor.SkillValue', {
          skill: this._skillLabel(skillKey)
        }),
        value: skillData.value
      }
    ];
    const roll = await new Roll(`${SKILL_CHECK_FORMULA} + @mod`, {
      mod: skillData.value
    }).roll();
    const outcomeKey = getSkillCheckOutcomeKey(roll.total);
    const flavorLabel = game.i18n.format('MY_RPG.ItemRoll.Flavor', {
      item: item.name || game.i18n.localize(`TYPES.Item.${item.type}`),
      skill: this._skillLabel(skillKey)
    });
    const damageProfile = hasDamageProfileValue(system.skillBonus) ? system.skillBonus : null;
    const stepEffects = hasStepEffects(system.stepEffects)
      ? normalizeStepEffects(system.stepEffects)
      : [];
    const itemContent = includeItemContent
      ? this._buildItemChatContent(item, displayConfig, { includeName: false })
      : '';
    const rollNote =
      item.type === 'weapon'
        ? this._weaponRollNoteHtml(item)
        : itemContent || this._getTraitRollNote(item, typeConfig);
    const flavor = this._buildSkillCheckFlavor(flavorLabel, parts, skillData.rank, outcomeKey, {
      total: roll.total,
      damageProfile,
      stepEffects,
      note: rollNote
    });

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
      rollMode: game.settings.get('core', 'rollMode'),
      flags: {
        [MODULE_ID]: {
          skillCheck: {
            skill: skillKey,
            rank: skillData.rank,
            outcome: outcomeKey,
            shift: 0,
            label: flavorLabel,
            parts,
            damageProfile,
            stepEffects,
            note: rollNote
          }
        }
      }
    });

    debugLog('Actor sheet item roll', {
      actor: this.actor.uuid,
      itemId: item.id,
      type: item.type,
      rollFormula: SKILL_CHECK_FORMULA,
      skill: skillKey,
      skillRank: skillData.rank,
      skillValue: skillData.value
    });
    return true;
  }

  async _sendItemActivationChat(item, displayConfig = null) {
    const content = this._buildItemChatContent(item, displayConfig);
    if (!content) return;
    await ChatMessage.create(
      {
        content,
        speaker: ChatMessage.getSpeaker({ actor: this.actor })
      },
      {}
    );
  }

  _buildItemChatContent(item, config, { includeName = true } = {}) {
    const displayConfig = this._getItemDisplayConfig(item, config);
    const system = item.system ?? {};
    const lines = [];
    const name = this._escapeHTML(item.name || game.i18n.localize(`TYPES.Item.${item.type}`));
    if (includeName) lines.push(`<strong>${name}</strong>`);
    const meta = [];
    if (displayConfig.showQuantity) {
      const quantity = Math.max(Number(system.quantity) || 0, 0);
      meta.push(`${game.i18n.localize('MY_RPG.Inventory.Quantity')}: ${quantity}`);
    }
    meta.push(...this._getItemBadges(item, displayConfig));
    if (displayConfig.allowEquip && system.equipped) {
      const equipKey =
        config.key === 'armor'
          ? 'MY_RPG.ArmorTable.EquippedLabel'
          : 'MY_RPG.WeaponsTable.EquippedLabel';
      meta.push(game.i18n.localize(equipKey));
    }
    if (meta.length) lines.push(meta.join('<br>'));
    const summary = this._getItemSummary(item, displayConfig);
    if (summary) lines.push(summary);
    return lines.filter(Boolean).join('<br><br>');
  }

  async _onItemQuantityStep(event) {
    event.preventDefault();
    const step = Number(event.currentTarget.dataset.step) || 0;
    if (!step) return;
    const { item, $row, config, displayConfig } = this._getItemContextFromEvent(event);
    if (!item || !$row || !displayConfig?.showQuantity) return;
    const system = item.system ?? {};
    const current = Math.max(Number(system.quantity) || 0, 0);
    const next = Math.max(current + step, 0);
    if (next === current) return;
    await item.update({ 'system.quantity': next }, { diff: false });
    // DEBUG-LOG
    debugLog('Actor sheet item quantity', {
      actor: this.actor.uuid,
      itemId: item.id,
      quantity: next
    });
    $row.find('.item-quantity-value').text(next);
    if (config && (config.key === 'armor' || config.key === 'weapons')) {
      this.actor.prepareData();
      this._refreshDerived(this.element);
    }
  }

  async _onItemEquipChange(event) {
    const checkbox = event.currentTarget;
    const { item, $row, groupKey, displayConfig } = this._getItemContextFromEvent(event);
    if (!item || !$row || !displayConfig?.allowEquip) return;
    const checked = Boolean(checkbox.checked);
    const updates = [{ _id: item.id, 'system.equipped': checked }];
    if (displayConfig.exclusive && checked) {
      const groupType = item.type;
      const others = this.actor.itemTypes?.[groupType] ?? [];
      for (const other of others) {
        if (other.id === item.id) continue;
        if (other.system?.equipped) {
          updates.push({ _id: other.id, 'system.equipped': false });
        }
      }
    }
    await this.actor.updateEmbeddedDocuments('Item', updates, { render: false });
    // DEBUG-LOG
    debugLog('Actor sheet item equip', {
      actor: this.actor.uuid,
      itemId: item.id,
      group: groupKey,
      equipped: checked
    });
    this.actor.prepareData();
    this._refreshDerived(this.element);
    const $group = $row.closest('[data-item-group]');
    if (displayConfig.exclusive && $group.length) {
      $group.find('.item-row').each((_, el) => {
        const id = el.dataset.itemId;
        const doc = this.actor.items.get(id);
        const isEquipped = Boolean(doc?.system?.equipped);
        el.classList.toggle('item-row--equipped', isEquipped);
        const input = el.querySelector('.item-equip-checkbox');
        if (input) input.checked = isEquipped;
      });
    } else {
      $row.toggleClass('item-row--equipped', checked);
    }
  }

  async _setItemCooldownUsed(item, $row, used) {
    const normalizedUsed = Boolean(used);
    await item.update({ 'system.cooldown.used': normalizedUsed ? 1 : 0 }, { render: false });
    $row.toggleClass('item-row--cooldown-used', normalizedUsed);
    const button = $row[0]?.querySelector('.item-activate');
    if (button) {
      button.classList.toggle('item-activate--used', normalizedUsed);
      const defaultTitle =
        button.dataset.defaultTitle || game.i18n.localize('MY_RPG.ItemControls.Activate');
      button.setAttribute(
        'title',
        normalizedUsed ? game.i18n.localize('MY_RPG.ItemControls.ClearCooldown') : defaultTitle
      );
      button.setAttribute('aria-pressed', normalizedUsed ? 'true' : 'false');
      const icon = button.querySelector('i');
      if (icon) {
        icon.className = button.dataset.defaultIcon || '';
      }
      const label = button.querySelector('.sr-only');
      if (label) {
        label.textContent = normalizedUsed
          ? game.i18n.localize('MY_RPG.ItemControls.ClearCooldown')
          : defaultTitle;
      }
    }
    debugLog('Actor sheet item cooldown', {
      actor: this.actor.uuid,
      itemId: item.id,
      used: normalizedUsed ? 1 : 0
    });
  }

  _onItemRowToggleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this._onItemRowToggle(event);
  }

  _onItemRowToggle(event) {
    event.currentTarget?.blur?.();
    const target = event.target && typeof event.target.closest === 'function' ? event.target : null;
    if (
      target?.closest(
        '.item-edit, .item-delete, .item-roll, .item-activate, .item-quantity-step, .item-equip-toggle, .item-equip-checkbox'
      )
    ) {
      return;
    }

    const { item, $row } = this._getItemContextFromEvent(event);
    if (!item || !$row?.length) return;
    const nextExpanded = !this._expandedItemIds.has(item.id);
    if (nextExpanded) {
      this._expandedItemIds.add(item.id);
    } else {
      this._expandedItemIds.delete(item.id);
    }
    this._applyItemRowExpandedState($row, nextExpanded);
  }

  _applyItemRowExpandedState($row, expanded) {
    $row.toggleClass('item-row--expanded', expanded);
    $row.find('.item-row__detail').prop('hidden', !expanded);
    $row.find('[data-item-summary-toggle]').attr('aria-expanded', expanded ? 'true' : 'false');
  }

  _normalizeSkillBonus(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  _formatSkillBonus(value) {
    const bonus = this._normalizeSkillBonus(value);
    if (bonus > 0) return `+${bonus}`;
    return `${bonus}`;
  }

  _formatDamage(value) {
    return formatDamageProfile(value);
  }

  _buildSkillCheckFlavor(label, parts, skillRank, outcomeKey, options = {}) {
    return buildSkillCheckRollFlavor({
      label,
      parts,
      skillRank,
      outcomeKey,
      shift: options.shift ?? 0,
      total: options.total ?? null,
      damageProfile: options.damageProfile ?? null,
      stepEffects: options.stepEffects ?? [],
      note: options.note ?? ''
    });
  }

  _skillLabel(skillKey) {
    if (!skillKey) return game.i18n.localize('MY_RPG.WeaponsTable.SkillNone');
    const configKey = CONFIG.ProjectAndromeda.skills?.[skillKey];
    return configKey ? game.i18n.localize(configKey) : skillKey;
  }

  _weaponRollNoteHtml(item) {
    const source = item ?? {};
    const system = source.system ?? source;
    const description = this._formatItemDescription(system.description ?? system.desc ?? '');
    return description;
  }

  _armorEffectHtml(item) {
    const source = item ?? {};
    const system = source.system ?? source;
    const lines = [];
    const fortitude = Number(system.itemFortitude) || 0;
    const control = Number(system.itemControl) || 0;
    const will = Number(system.itemWill) || 0;
    const shield = Number(system.itemShield) || 0;
    const speed = Number(system.itemSpeed) || 0;
    if (fortitude) {
      lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusFortitudeLabel')}: ${fortitude}`);
    }
    if (control) {
      lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusControlLabel')}: ${control}`);
    }
    if (will) lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusWillLabel')}: ${will}`);
    if (shield) lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.ShieldLabel')}: ${shield}`);
    if (speed) lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusSpeedLabel')}: ${speed}`);
    let html = lines.join('<br>');
    const description = this._formatItemDescription(system.description ?? system.desc ?? '');
    if (description) html += `<br><br>${description}`;
    return html;
  }
}
