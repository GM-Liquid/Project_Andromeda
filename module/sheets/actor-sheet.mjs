/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

import { GM_HERO_POOL_SETTING, MODULE_ID, debugLog } from '../config.mjs';
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
  ABILITY_DIE_STEPS,
  getAbilityDieLabel,
  getAbilityDieRoll,
  getColorRank,
  normalizeAbilityDie
} from '../helpers/utils.mjs';
import {
  ITEM_TABS,
  ITEM_BADGE_BUILDERS,
  getItemGroupConfigByKey,
  getItemGroupConfigs,
  getItemTypeConfig,
  getItemTabLabel
} from '../helpers/item-config.mjs';
function getRankLabel(rank) {
  return game.i18n.localize(`MY_RPG.RankNumeric.Rank${rank}`);
}

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

export class ProjectAndromedaActorSheet extends ActorSheet {
  /** @override */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
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
    const scrollContainer = this.element.find('.sheet-scrollable');
    const scrollPos = scrollContainer.scrollTop();
    await super._render(force, options);

    this.element.find('.sheet-scrollable').scrollTop(scrollPos);
  }
  validateNumericInput(input) {
    let val = parseInt(input.value, 10);
    const isAbility = input.name.includes('system.abilities.');
    const labelKey = isAbility ? 'MY_RPG.NumericWarning.Attribute' : 'MY_RPG.NumericWarning.Skill';
    const label = game.i18n.localize(labelKey);
    const minVal = 0;

    if (isNaN(val)) {
      val = minVal;
    }
    if (val < minVal) {
      ui.notifications.warn(
        game.i18n.format('MY_RPG.NumericWarning.Min', {
          label: label,
          min: minVal
        })
      );
      val = minVal;
    }
    input.value = val;
    return val;
  }

  initializeRichEditor(element) {
    if (!element._tinyMCEInitialized) {
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
        content_style:
          'body { margin: 0; padding: 5px; font-family: inherit; font-size: inherit; color: #1b1210; } p { margin: 0; }',
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

    const resize = () => {
      element.style.height = 'auto';
      const minHeight = Number.parseFloat(window.getComputedStyle(element).minHeight) || 0;
      element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`;
    };

    resize();

    if (!element.dataset.hasAutoResizeHandler) {
      element.dataset.hasAutoResizeHandler = 'true';
      element.addEventListener('input', resize);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    const $html = html instanceof jQuery ? html : $(html);
    const derivedInputSelector = [
      "input[name='system.currentRank']",
      "input[name='system.temphealth']",
      "input[name='system.tempphys']",
      "input[name='system.tempazure']",
      "input[name='system.tempmental']",
      "input[name='system.tempspeed']"
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
    $html.on('click', '.item-chat', this._onItemChat.bind(this));
    $html.on('click', '.item-roll', this._onItemRoll.bind(this));
    $html.on('click', '.item-quantity-step', this._onItemQuantityStep.bind(this));
    $html.on('change', '.item-equip-checkbox', this._onItemEquipChange.bind(this));

    $html.find('input[name^="system.skills."]').on('change', async (ev) => {
      const input = ev.currentTarget;
      const validatedValue = this.validateNumericInput(input);
      await this.actor.update({ [input.name]: validatedValue }, { render: false });
      const rankClass = 'rank' + getColorRank(validatedValue, 'skill');
      input.classList.remove('rank1', 'rank2', 'rank3', 'rank4');
      input.classList.add(rankClass);
    });

    $html.find(derivedInputSelector).on('change', this._onDerivedInputChange.bind(this));
    $html.on('click', '.ability-step', this._onAbilityStep.bind(this));
    $html.on('change', '.shared-hero-pool-input', this._onSharedHeroPoolChange.bind(this));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['project-andromeda', 'sheet', 'actor', 'project-andromeda-hex-tabs'],
      width: 800,
      height: 1000,
      resizable: false,
      tabs: [
        {
          navSelector: '.sheet-tabs-hex',
          contentSelector: '.sheet-body',
          initial: 'features',
          controlSelector: 'a.hex-button'
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

    if (isSupportedCharacterActorType(actorData.type)) {
      this._prepareCharacterData(context);
    }

    this._preparePersonalityData(context);

    context.rollData = context.actor.getRollData();
    context.itemTabs = ITEM_TABS.map((tab) => ({
      key: tab.key,
      label: game.i18n.localize(getItemTabLabel(tab.key))
    }));

    const itemGroups = this._buildItemGroups();
    context.personalityValueGroup =
      itemGroups.find((group) => group.key === 'personalityValues') ?? null;
    context.itemGroups = itemGroups
      .filter((group) => group.key !== 'personalityValues')
      .reduce((acc, group) => {
      (acc[group.tab] ??= []).push(group);
      return acc;
      }, {});
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
      archetype: String(rawBiography.archetype ?? ''),
      appearance: String(rawBiography.appearance ?? ''),
      backstory: String(rawBiography.backstory ?? rawBiography.story ?? '')
    };
  }

  _prepareCharacterData(context) {
    const abilityOrder = ['con', 'int', 'spi'];
    context.system.skills ??= {};

    const sortedAbilities = {};
    for (const abilityKey of abilityOrder) {
      const ability = context.system.abilities?.[abilityKey];
      if (!ability) continue;
      const normalizedValue = normalizeAbilityDie(ability.value);
      sortedAbilities[abilityKey] = {
        ...foundry.utils.duplicate(ability),
        value: normalizedValue,
        label: game.i18n.localize(CONFIG.ProjectAndromeda.abilities[abilityKey]) ?? abilityKey,
        rankClass: 'rank' + getColorRank(normalizedValue, 'ability'),
        dieLabel: getAbilityDieLabel(normalizedValue)
      };
    }
    context.system.abilities = sortedAbilities;

    const skillOrderByAbility = {
      con: ['moshch', 'lovkost', 'sokrytie', 'strelba', 'blizhniy_boy'],
      int: ['nablyudatelnost', 'analiz', 'programmirovanie', 'inzheneriya'],
      spi: ['dominirovanie', 'rezonans', 'bionika', 'obayanie']
    };

    const sortedSkills = {};
    const skillColumns = [];
    for (const abilityKey of abilityOrder) {
      const columnSkills = [];
      const abilityLabel =
        game.i18n.localize(CONFIG.ProjectAndromeda.abilities[abilityKey]) ?? abilityKey;
      const abilityAbbreviation =
        game.i18n.localize(CONFIG.ProjectAndromeda.abilityAbbreviations[abilityKey]) ?? abilityKey;
      for (const key of skillOrderByAbility[abilityKey] ?? []) {
        const skill = context.system.skills[key];
        if (!skill) continue;
        skill.label = game.i18n.localize(CONFIG.ProjectAndromeda.skills[key]) ?? key;
        skill.rankClass = 'rank' + getColorRank(skill.value, 'skill');
        skill.key = key;
        sortedSkills[key] = skill;
        columnSkills.push(skill);
      }
      skillColumns.push({
        key: abilityKey,
        label: abilityLabel,
        abbreviation: abilityAbbreviation,
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

  _buildTrackData({ max, value, marked = [], ariaKey, allowMarked = false }) {
    const boundedMax = Math.max(Number(max) || 0, 0);
    const boundedValue = Math.min(Math.max(Number(value) || 0, 0), boundedMax);
    const markedCells = allowMarked ? this._normalizeStressMarked(marked, boundedMax) : [];
    return Array.from({ length: boundedMax }, (_, index) => {
      const isMarked = allowMarked && markedCells.includes(index);
      return {
        index,
        filled: index < boundedValue && !isMarked,
        marked: isMarked,
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

  _stepAbilityDie(current, step) {
    const normalized = normalizeAbilityDie(current);
    const dieValues = ABILITY_DIE_STEPS.map((abilityStep) => abilityStep.value);
    const index = dieValues.indexOf(normalized);
    const clampedIndex = Math.max(
      0,
      Math.min((index === -1 ? 0 : index) + Math.sign(step || 0), dieValues.length - 1)
    );
    return dieValues[clampedIndex];
  }

  _getAbilityDieValue(abilityKey) {
    if (!abilityKey) return ABILITY_DIE_STEPS[0].value;
    const ability = this.actor.system?.abilities?.[abilityKey];
    return normalizeAbilityDie(ability?.value);
  }

  async _onAbilityStep(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const step = Number(button.dataset.step) || 0;
    if (!step) return;
    const container = button.closest('[data-ability-key]');
    const abilityKey = container?.dataset?.abilityKey;
    if (!abilityKey) return;

    const current = this.actor.system?.abilities?.[abilityKey]?.value;
    const next = this._stepAbilityDie(current, step);
    if (next === normalizeAbilityDie(current)) return;

    await this.actor.update({ [`system.abilities.${abilityKey}.value`]: next }, { render: false });
    this.actor.prepareData();
    this._updateAbilityDisplays(this.element, abilityKey);
    this._refreshDerived(this.element);
  }

  _coerceNonNegativeIntegerInput(input) {
    let value = parseInt(input?.value, 10);
    if (Number.isNaN(value) || value < 0) value = 0;
    if (input) input.value = value;
    return value;
  }

  async _onDerivedInputChange(event) {
    const input = event.currentTarget;
    if (!input?.name) return;

    const nextValue = this._coerceNonNegativeIntegerInput(input);
    await this.actor.update({ [input.name]: nextValue }, { render: false });
    this.actor.prepareData();
    this._refreshDerived(this.element);
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

  _updateAbilityDisplays(root, abilityKey) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const abilityKeys = abilityKey ? [abilityKey] : Object.keys(this.actor.system?.abilities ?? {});
    const rankClasses = ['rank1', 'rank2', 'rank3', 'rank4'];

    for (const key of abilityKeys) {
      const dieValue = this._getAbilityDieValue(key);
      const rankClass = 'rank' + getColorRank(dieValue, 'ability');
      const $container = $root.find(`[data-ability-key="${key}"]`);

      $container
        .find('.ability-die-value')
        .text(getAbilityDieLabel(dieValue))
        .removeClass(rankClasses.join(' '))
        .addClass(rankClass);

      $container.find(`input[name="system.abilities.${key}.value"]`).val(dieValue);

      const $header = $root.find(`th[data-ability="${key}"]`);
      $header.removeClass(rankClasses.join(' ')).addClass(rankClass);
    }
  }

  async _onRoll(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const { skill, ability, label } = el.dataset;

    let modifier = 0;
    let dieValue = ability ? this._getAbilityDieValue(ability) : null;
    const parts = [];

    if (!dieValue && !ability) {
      dieValue = ABILITY_DIE_STEPS[0].value;
    }

    if (skill) {
      const skillData = this.actor.system.skills?.[skill] || {};
      const skillValue = parseInt(skillData.value) || 0;
      modifier = skillValue;
      parts.push({
        label: game.i18n.format('MY_RPG.RollFlavor.SkillValue', { skill: this._skillLabel(skill) }),
        value: skillValue
      });
      const abKey = skillData.ability;
      if (abKey) {
        dieValue = this._getAbilityDieValue(abKey);
      }
      const bonusDetails = this._getSkillBonusDetails(skill);
      modifier += bonusDetails.total;
      this._appendBonusParts(parts, bonusDetails);
    } else if (ability) {
      dieValue = dieValue ?? this._getAbilityDieValue(ability);
    }

    const rollFormula = dieValue
      ? getAbilityDieRoll(dieValue)
      : getAbilityDieRoll(ABILITY_DIE_STEPS[0].value);
    const roll = await new Roll(`${rollFormula} + @mod`, { mod: modifier }).roll({
      async: true
    });
    const flavor = this._buildRollFlavor(label, parts);
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
      rollMode: game.settings.get('core', 'rollMode')
    });
  }

  /**
   * Update derived fields on the sheet (speed, defenses, stress, force shield)
   * after an in-place change without re-rendering the sheet.
   */
  _refreshDerived(html) {
    const s = this.actor.system || {};
    const $root = html instanceof jQuery ? html : $(html ?? this.element);
    const setVal = (name, val) => {
      $root.find(`input[name="${name}"]`).val(val ?? 0);
    };

    // Speed
    setVal('system.speed.value', s?.speed?.value);
    // Defenses
    setVal('system.defenses.physical', s?.defenses?.physical);
    setVal('system.defenses.azure', s?.defenses?.azure);
    setVal('system.defenses.mental', s?.defenses?.mental);

    this._updateStressTrack($root);
    this._updateForceShieldTrack($root);
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
      chat: game.i18n.localize('MY_RPG.ItemControls.Chat'),
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
    const summary = this._getItemSummary(item, displayConfig);
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
      badges,
      summary,
      hasBadges: badges.length > 0,
      hasSummary: Boolean(summary),
      canRoll: Boolean(displayConfig.canRoll)
    };
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
      isMixedGroup: (groupConfig?.types?.length ?? 0) > 1
    };
  }

  _getItemKindBadgeLabel(item) {
    return game.i18n.localize(`TYPES.Item.${item.type}`);
  }

  _getItemBadges(item, config) {
    const badges = [];
    if (config?.isMixedGroup && config?.key !== 'equipment') {
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
    const rowEl = targetEl?.closest ? targetEl.closest('[data-item-id]') : null;
    const $row = rowEl ? $(rowEl) : $target.closest('[data-item-id]');
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
    let config = type ? getItemGroupConfigs().find((entry) => entry.types.includes(type)) : null;
    if (!config) config = this._getGroupConfig(groupKey);
    if (!config) return;
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

  async _onItemChat(event) {
    event.preventDefault();
    const { item, config, itemId } = this._getItemContextFromEvent(event);
    if (!item || !config) {
      // DEBUG-LOG
      debugLog('Actor sheet item chat failed - missing context', {
        actor: this.actor.uuid,
        itemId: itemId ?? null,
        hasConfig: Boolean(config)
      });
      return;
    }
    const content = this._buildItemChatContent(item, config);
    if (!content) return;
    // DEBUG-LOG
    debugLog('Actor sheet item chat', { actor: this.actor.uuid, itemId: item.id, type: item.type });
    await ChatMessage.create(
      {
        content,
        speaker: ChatMessage.getSpeaker({ actor: this.actor })
      },
      {}
    );
  }

  async _onItemRoll(event) {
    event.preventDefault();
    const { item, itemId } = this._getItemContextFromEvent(event);
    if (!item) {
      // DEBUG-LOG
      debugLog('Actor sheet item roll failed - missing item', {
        actor: this.actor.uuid,
        itemId: itemId ?? null
      });
      return;
    }
    const typeConfig = getItemTypeConfig(item.type);
    const system = item.system ?? {};
    const skillKey = system.skill || '';
    if (this._isSkillRollItem(item, typeConfig) && !skillKey) {
      ui.notifications.warn(game.i18n.localize('MY_RPG.WeaponsTable.SkillNone'));
      return;
    }
    const skillData = this.actor.system?.skills?.[skillKey] ?? {};
    const skillValue = Number(skillData.value) || 0;
    const parts = [];

    parts.push({
      label: game.i18n.format('MY_RPG.RollFlavor.SkillValue', {
        skill: this._skillLabel(skillKey)
      }),
      value: skillValue
    });

    if (this._isSkillRollItem(item, typeConfig)) {
      const modifier = skillValue;
      const abilityKey = this._getSkillAbilityKey(skillKey);
      const dieValue = this._getAbilityDieValue(abilityKey);
      const rollFormula = getAbilityDieRoll(dieValue);

      const roll = await new Roll(`${rollFormula} + @mod`, {
        mod: modifier
      }).roll({ async: true });

      const flavorLabel = game.i18n.format('MY_RPG.ItemRoll.Flavor', {
        item: item.name || game.i18n.localize(`TYPES.Item.${item.type}`),
        skill: this._skillLabel(skillKey)
      });
      let flavor = this._buildRollFlavor(flavorLabel, parts);
      const traitRollNote = this._getTraitRollNote(item, typeConfig);
      if (traitRollNote) {
        flavor += `<div class="myrpg-roll-note">${traitRollNote}</div>`;
      }

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor,
        rollMode: game.settings.get('core', 'rollMode')
      });

      // DEBUG-LOG
      debugLog('Actor sheet item roll', {
        actor: this.actor.uuid,
        itemId: item.id,
        type: item.type,
        ability: abilityKey ?? null,
        rollFormula,
        skill: skillKey,
        skillValue,
        modifier
      });
      return;
    }

    if (item.type === 'weapon') {
      const bonusDetails = this._getSkillBonusDetails(skillKey);
      const modifier = skillValue + (bonusDetails.total || 0);
      const abilityKey = this._getSkillAbilityKey(skillKey);
      const dieValue = this._getAbilityDieValue(abilityKey);
      const rollFormula = getAbilityDieRoll(dieValue);
      this._appendBonusParts(parts, bonusDetails);

      const roll = await new Roll(`${rollFormula} + @mod`, { mod: modifier }).roll({ async: true });

      const flavorLabel = game.i18n.format('MY_RPG.ItemRoll.Flavor', {
        item: item.name || game.i18n.localize(`TYPES.Item.${item.type}`),
        skill: this._skillLabel(skillKey)
      });

      let flavor = this._buildRollFlavor(flavorLabel, parts);
      const weaponDetails = this._weaponEffectHtml(item);
      if (weaponDetails) {
        flavor += `<div class="myrpg-roll-note">${weaponDetails}</div>`;
      }

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor,
        rollMode: game.settings.get('core', 'rollMode')
      });

      // DEBUG-LOG
      debugLog('Actor sheet weapon roll', {
        actor: this.actor.uuid,
        itemId: item.id,
        type: item.type,
        ability: abilityKey ?? null,
        rollFormula,
        skill: skillKey,
        skillValue,
        modifier
      });
    }
  }

  _buildItemChatContent(item, config) {
    const displayConfig = this._getItemDisplayConfig(item, config);
    const system = item.system ?? {};
    const lines = [];
    const name = this._escapeHTML(item.name || game.i18n.localize(`TYPES.Item.${item.type}`));
    lines.push(`<strong>${name}</strong>`);
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
    const damage = Number(value);
    if (!Number.isFinite(damage)) return '0';
    return `${damage}`;
  }

  _appendBonusParts(parts, bonusDetails) {
    if (!bonusDetails?.total) return;
    if (bonusDetails.sources?.length) {
      for (const source of bonusDetails.sources) {
        parts.push({
          label: this._formatBonusSourceLabel(source),
          value: source.bonus
        });
      }
      return;
    }

    parts.push({
      label: game.i18n.localize('MY_RPG.RollFlavor.EquipmentBonus'),
      value: bonusDetails.total
    });
  }

  _getSkillBonusDetails(skillKey) {
    if (!skillKey) return { total: 0, sources: [] };
    const bonuses = this.actor.system?.cache?.itemTotals?.skillBonuses ?? {};
    const entry = bonuses?.[skillKey];
    if (!entry) return { total: 0, sources: [] };
    if (typeof entry === 'number') {
      return { total: this._normalizeSkillBonus(entry), sources: [] };
    }

    const total = this._normalizeSkillBonus(entry?.total);
    const sources = Array.isArray(entry?.sources)
      ? entry.sources
          .map((source) => ({
            type: source?.type,
            name: source?.name,
            quantity: source?.quantity,
            bonus: this._normalizeSkillBonus(source?.bonus)
          }))
          .filter((source) => source.bonus)
      : [];

    return { total, sources };
  }

  _formatBonusSourceLabel(source) {
    const typeKeyMap = {
      weapon: 'MY_RPG.RollFlavor.SourceWeapon',
      cartridge: 'MY_RPG.RollFlavor.SourceCartridge',
      implant: 'MY_RPG.RollFlavor.SourceImplant'
    };

    const quantity = Number(source?.quantity) || 0;
    const baseName = source?.name || game.i18n.localize('MY_RPG.RollFlavor.UnknownSource');
    const nameWithQuantity =
      quantity > 1
        ? game.i18n.format('MY_RPG.RollFlavor.SourceWithQuantity', { name: baseName, quantity })
        : baseName;
    const key = typeKeyMap[source?.type] ?? 'MY_RPG.RollFlavor.SourceItem';
    return game.i18n.format(key, { name: nameWithQuantity });
  }

  _buildRollFlavor(label, parts = []) {
    const safeLabel = this._escapeHTML(label ?? '');
    const rollParts = (parts ?? []).filter(
      (part) => part && part.label && part.value !== undefined && part.value !== null
    );
    if (!rollParts.length) return safeLabel;

    const modifiersTitle = this._escapeHTML(game.i18n.localize('MY_RPG.RollFlavor.Modifiers'));
    const rows = rollParts
      .map((part) => {
        const partLabel = this._escapeHTML(part.label);
        const value = this._formatSkillBonus(part.value);
        return `<div class="myrpg-roll-part"><span class="myrpg-roll-part__label">${partLabel}</span><span class="myrpg-roll-part__value">${value}</span></div>`;
      })
      .join('');

    return `<div class="myrpg-roll-flavor"><div class="myrpg-roll-flavor__header">${safeLabel}</div><div class="myrpg-roll-flavor__modifiers"><div class="myrpg-roll-flavor__title">${modifiersTitle}</div>${rows}</div></div>`;
  }

  _getTotalSkillBonus(skillKey) {
    const details = this._getSkillBonusDetails(skillKey);
    return details.total;
  }

  _getSkillAbilityKey(skillKey) {
    if (!skillKey) return '';
    const actorSkillAbility = String(this.actor.system?.skills?.[skillKey]?.ability ?? '')
      .trim()
      .toLowerCase();
    if (actorSkillAbility === 'con' || actorSkillAbility === 'int' || actorSkillAbility === 'spi') {
      return actorSkillAbility;
    }

    const skillAbilityFallback = {
      moshch: 'con',
      lovkost: 'con',
      sokrytie: 'con',
      strelba: 'con',
      blizhniy_boy: 'con',
      nablyudatelnost: 'int',
      analiz: 'int',
      programmirovanie: 'int',
      inzheneriya: 'int',
      dominirovanie: 'spi',
      rezonans: 'spi',
      bionika: 'spi',
      obayanie: 'spi'
    };

    return skillAbilityFallback[skillKey] ?? '';
  }

  _skillLabel(skillKey) {
    if (!skillKey) return game.i18n.localize('MY_RPG.WeaponsTable.SkillNone');
    const configKey = CONFIG.ProjectAndromeda.skills?.[skillKey];
    return configKey ? game.i18n.localize(configKey) : skillKey;
  }

  _weaponEffectHtml(item) {
    const source = item ?? {};
    const system = source.system ?? source;
    const lines = [
      `${game.i18n.localize('MY_RPG.WeaponsTable.SkillLabel')}: ${this._skillLabel(system.skill)}`,
      `${game.i18n.localize('MY_RPG.WeaponsTable.DamageLabel')}: ${this._formatDamage(system.skillBonus)}`
    ];
    let html = lines.join('<br>');
    const description = this._formatItemDescription(system.description ?? system.desc ?? '');
    if (description) html += `<br><br>${description}`;
    return html;
  }

  _armorEffectHtml(item) {
    const source = item ?? {};
    const system = source.system ?? source;
    const lines = [];
    const phys = Number(system.itemPhys) || 0;
    const azure = Number(system.itemAzure) || 0;
    const mental = Number(system.itemMental) || 0;
    const shield = Number(system.itemShield) || 0;
    const speed = Number(system.itemSpeed) || 0;
    if (phys) lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusPhysicalLabel')}: ${phys}`);
    if (azure) lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusMagicalLabel')}: ${azure}`);
    if (mental)
      lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusPsychicLabel')}: ${mental}`);
    if (shield) lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.ShieldLabel')}: ${shield}`);
    if (speed) lines.push(`${game.i18n.localize('MY_RPG.ArmorItem.BonusSpeedLabel')}: ${speed}`);
    let html = lines.join('<br>');
    const description = this._formatItemDescription(system.description ?? system.desc ?? '');
    if (description) html += `<br><br>${description}`;
    return html;
  }
}
