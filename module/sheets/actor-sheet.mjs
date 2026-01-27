/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

import { MODULE_ID, debugLog } from '../config.mjs';
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
  getItemTabLabel
} from '../helpers/item-config.mjs';
function getRankLabel(rank) {
  const mode = game.settings.get(MODULE_ID, 'worldType');
  const base = mode === 'stellar' ? 'MY_RPG.RankNumeric' : 'MY_RPG.RankGradient';
  return game.i18n.localize(`${base}.Rank${rank}`);
}

export class ProjectAndromedaActorSheet extends ActorSheet {
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
            } catch (_) {
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


  activateListeners(html) {
    super.activateListeners(html);
    const $html = html instanceof jQuery ? html : $(html);
    $html.find('textarea.rich-editor').each((i, el) => this.initializeRichEditor(el));
    $html
      .find('.stress-cell')
      .on('click', this._onStressCellClick.bind(this))
      .on('contextmenu', this._onStressCellRightClick.bind(this));
    $html.find('.rollable').on('click', this._onRoll.bind(this));

    $html.on('click', '.item-create', this._onItemCreate.bind(this));
    $html.on('click', '.item-edit', this._onItemEdit.bind(this));
    $html.on('click', '.item-delete', this._onItemDelete.bind(this));
    $html.on('click', '.item-chat', this._onItemChat.bind(this));
    $html.on('click', '.item-roll', this._onItemRoll.bind(this));
    $html.on('click', '.item-quantity-step', this._onItemQuantityStep.bind(this));
    $html.on('change', '.item-equip-checkbox', this._onItemEquipChange.bind(this));

    $html
      .find('input[name^="system.skills."]')
      .on('change', async (ev) => {
        const input = ev.currentTarget;
        const validatedValue = this.validateNumericInput(input);
        await this.actor.update({ [input.name]: validatedValue }, { render: false });
        const rankClass = 'rank' + getColorRank(validatedValue, 'skill');
        input.classList.remove('rank1', 'rank2', 'rank3', 'rank4');
        input.classList.add(rankClass);
      });

    $html.on('click', '.ability-step', this._onAbilityStep.bind(this));
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
    if (this.actor.type === 'npc') {
      return `systems/project-andromeda/templates/actor/actor-npc-sheet.hbs`;
    }
    return `systems/project-andromeda/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = context.data;
    context.system = foundry.utils.duplicate(actorData.system ?? {});
    context.flags = actorData.flags;
    context.isCharacter = actorData.type === 'character';
    context.isNpc = actorData.type === 'npc';

    if (context.isCharacter || context.isNpc) {
      this._prepareCharacterData(context);
    }

    const worldType = game.settings.get(MODULE_ID, 'worldType');

    context.rollData = context.actor.getRollData();
    context.itemTabs = ITEM_TABS.map((tab) => ({
      key: tab.key,
      label: game.i18n.localize(getItemTabLabel(tab.key, worldType))
    }));

    const itemGroups = this._buildItemGroups();
    context.itemGroups = itemGroups.reduce((acc, group) => {
      (acc[group.tab] ??= []).push(group);
      return acc;
    }, {});
    context.itemControls = this._getItemControlLabels();

    return context;
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
      const abilityLabel = game.i18n.localize(CONFIG.ProjectAndromeda.abilities[abilityKey]) ?? abilityKey;
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
    const stressValue = Number(stress.value) || 0;
    const stressMax = Number(stress.max) || 0;
    const marked = this._normalizeStressMarked(stress.marked, stressMax);
    context.system.stress.marked = marked;
    context.system.stressTrack = Array.from({ length: Math.max(stressMax, 0) }, (_, index) => {
      const isMarked = marked.includes(index);
      return {
        index,
        filled: index < stressValue && !isMarked,
        marked: isMarked,
        ariaLabel: game.i18n.format('MY_RPG.Stress.CellAria', { index: index + 1 })
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
    const next =
      index < current
        ? index
        : Math.min(index + 1, max);
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

  _stepAbilityDie(current, step) {
    const normalized = normalizeAbilityDie(current);
    const dieValues = ABILITY_DIE_STEPS.map((abilityStep) => abilityStep.value);
    const index = dieValues.indexOf(normalized);
    const clampedIndex = Math.max(
      0,
      Math.min(
        (index === -1 ? 0 : index) + Math.sign(step || 0),
        dieValues.length - 1
      )
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

  _updateAbilityDisplays(root, abilityKey) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const abilityKeys = abilityKey ? [abilityKey] : Object.keys(this.actor.system?.abilities ?? {});
    const rankClasses = ['rank1', 'rank2', 'rank3', 'rank4'];

    for (const key of abilityKeys) {
      const dieValue = this._getAbilityDieValue(key);
      const rankClass = 'rank' + getColorRank(dieValue, 'ability');
      const $container = $root.find(`[data-ability-key="${key}"]`);

      $container.find('.ability-die-value')
        .text(getAbilityDieLabel(dieValue))
        .removeClass(rankClasses.join(' '))
        .addClass(rankClass);

      $container
        .find(`input[name="system.abilities.${key}.value"]`)
        .val(dieValue);

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
      if (bonusDetails.total) {
        if (bonusDetails.sources?.length) {
          for (const source of bonusDetails.sources) {
            parts.push({
              label: this._formatBonusSourceLabel(source),
              value: source.bonus
            });
          }
        } else {
          parts.push({
            label: game.i18n.localize('MY_RPG.RollFlavor.EquipmentBonus'),
            value: bonusDetails.total
          });
        }
      }
    } else if (ability) {
      dieValue = dieValue ?? this._getAbilityDieValue(ability);
    }

    const rollFormula = dieValue ? getAbilityDieRoll(dieValue) : getAbilityDieRoll(ABILITY_DIE_STEPS[0].value);
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
   * Update derived fields on the sheet (speed, defenses, stress)
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
  }

  _updateStressTrack(root, options = {}) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const stress = this.actor.system.stress || { value: 0, max: 0 };
    const value =
      typeof options === 'number'
        ? options
        : typeof options?.value === 'number'
          ? options.value
          : Number(stress.value) || 0;
    const marked = Array.isArray(options?.marked)
      ? this._normalizeStressMarked(options.marked, Number(stress.max) || 0)
      : this._normalizeStressMarked(stress.marked, Number(stress.max) || 0);
    const $track = $root.find('.stress-track');
    if (!$track.length) return;
    $track.find('.stress-cell').each((i, el) => {
      const isMarked = marked.includes(i);
      const filled = i < value && !isMarked;
      el.classList.toggle('filled', filled);
      el.classList.toggle('marked', isMarked);
      el.setAttribute('aria-pressed', filled ? 'true' : 'false');
    });
  }

  _normalizeStressMarked(marked, max) {
    const limit = Number.isFinite(max) ? max : null;
    const source = Array.isArray(marked) ? marked : [];
    const normalized = source
      .map((value) => Number(value))
      .filter((value) =>
        Number.isInteger(value) && value >= 0 && (limit === null || value < limit));
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
      const items = config.types.flatMap((type) => this.actor.itemTypes?.[type] ?? []);
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
    const quantity = config.showQuantity ? Math.max(Number(system.quantity) || 0, 0) : 1;
    const badges = this._getItemBadges(item, config);
    const summary = this._getItemSummary(item, config);
    return {
      id: item.id,
      uuid: item.uuid,
      name: item.name || game.i18n.localize('MY_RPG.ItemGroups.Unnamed'),
      img: item.img || 'icons/svg/item-bag.svg',
      groupKey: config.key,
      showQuantity: Boolean(config.showQuantity),
      quantity,
      showEquip: Boolean(config.allowEquip),
      exclusive: Boolean(config.exclusive),
      equipped: config.allowEquip ? Boolean(system.equipped) : false,
      badges,
      summary,
      hasBadges: badges.length > 0,
      hasSummary: Boolean(summary),
      canRoll: Boolean(config.canRoll)
    };
  }

  _getItemBadges(item, config) {
    const builder = ITEM_BADGE_BUILDERS[config.key];
    if (!builder) return [];
    return builder(item, {
      t: game.i18n,
      getRankLabel,
      worldType: game.settings.get(MODULE_ID, 'worldType'),
      skillLabel: this._skillLabel.bind(this),
      formatSkillBonus: this._formatSkillBonus.bind(this),
      formatDamage: this._formatDamage.bind(this)
    });
  }

  _getItemSummary(item, config) {
    const system = item.system ?? {};
    return system.description || '';
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
      $target.data('itemId') ??
      $row.data('itemId') ??
      rowEl?.dataset?.itemId ??
      undefined;
    const groupKey =
      $target.data('groupKey') ??
      $row.data('groupKey') ??
      rowEl?.dataset?.groupKey ??
      undefined;
    const item = this.actor.items.get(itemId);
    const config = this._getGroupConfig(groupKey);
    return { item, $row, groupKey, config, itemId };
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const $target = $(event.currentTarget);
    const groupKey = $target.data('groupKey') || $target.closest('[data-item-group]').data('itemGroup');
    const type = $target.data('type');
    let config = type
      ? getItemGroupConfigs().find((entry) => entry.types.includes(type))
      : null;
    if (!config) config = this._getGroupConfig(groupKey);
    if (!config) return;
    const name = this._getDefaultItemName(config);
    // DEBUG-LOG
    debugLog('Actor sheet item create', { actor: this.actor.uuid, type: config.types[0] });
    await this.actor.createEmbeddedDocuments('Item', [
      { name, type: config.types[0], system: {} }
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
    debugLog('Actor sheet item delete', { actor: this.actor.uuid, itemId: item.id, type: item.type });
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
    const system = item.system ?? {};
    const skillKey = system.skill || '';
    const skillValue = Number(this.actor.system?.skills?.[skillKey]?.value) || 0;
    const parts = [];

    parts.push({
      label: game.i18n.format('MY_RPG.RollFlavor.SkillValue', { skill: this._skillLabel(skillKey) }),
      value: skillValue
    });

    if (item.type === 'cartridge' || item.type === 'implant') {
      const itemBonus = Number(system.skillBonus) || 0;
      if (itemBonus) {
        parts.push({
          label: this._formatBonusSourceLabel({
            type: item.type,
            name: item.name || game.i18n.localize(`TYPES.Item.${item.type}`),
            quantity: Number(system.quantity) || 0
          }),
          value: itemBonus
        });
      }

      const roll = await new Roll('1d10 + @skill + @itemBonus', {
        skill: skillValue,
        itemBonus
      }).roll({ async: true });

      const flavorLabel = game.i18n.format('MY_RPG.ItemRoll.Flavor', {
        item: item.name || game.i18n.localize(`TYPES.Item.${item.type}`),
        skill: this._skillLabel(skillKey)
      });
      const flavor = this._buildRollFlavor(flavorLabel, parts);

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
        skill: skillKey,
        skillValue,
        itemBonus
      });
      return;
    }

    if (item.type === 'weapon') {
      const bonusDetails = this._getSkillBonusDetails(skillKey);
      let modifier = skillValue + (bonusDetails.total || 0);
      if (bonusDetails.total) {
        if (bonusDetails.sources?.length) {
          for (const source of bonusDetails.sources) {
            parts.push({
              label: this._formatBonusSourceLabel(source),
              value: source.bonus
            });
          }
        } else {
          parts.push({
            label: game.i18n.localize('MY_RPG.RollFlavor.EquipmentBonus'),
            value: bonusDetails.total
          });
        }
      }

      const roll = await new Roll('1d10 + @mod', { mod: modifier }).roll({ async: true });

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
        skill: skillKey,
        skillValue,
        modifier
      });
    }
  }

  _buildItemChatContent(item, config) {
    const system = item.system ?? {};
    const lines = [];
    const name = this._escapeHTML(item.name || game.i18n.localize(`TYPES.Item.${item.type}`));
    lines.push(`<strong>${name}</strong>`);
    const meta = [];
    if (config.showQuantity) {
      const quantity = Math.max(Number(system.quantity) || 0, 0);
      meta.push(`${game.i18n.localize('MY_RPG.Inventory.Quantity')}: ${quantity}`);
    }
    meta.push(...this._getItemBadges(item, config));
    if (config.allowEquip && system.equipped) {
      const equipKey = config.key === 'armor'
        ? 'MY_RPG.ArmorTable.EquippedLabel'
        : 'MY_RPG.WeaponsTable.EquippedLabel';
      meta.push(game.i18n.localize(equipKey));
    }
    if (meta.length) lines.push(meta.join('<br>'));
    const summary = this._getItemSummary(item, config);
    if (summary) lines.push(summary);
    return lines.filter(Boolean).join('<br><br>');
  }

  async _onItemQuantityStep(event) {
    event.preventDefault();
    const step = Number(event.currentTarget.dataset.step) || 0;
    if (!step) return;
    const { item, $row, config } = this._getItemContextFromEvent(event);
    if (!item || !$row || !config?.showQuantity) return;
    const system = item.system ?? {};
    const current = Math.max(Number(system.quantity) || 0, 0);
    const next = Math.max(current + step, 0);
    if (next === current) return;
    await item.update({ 'system.quantity': next }, { diff: false });
    // DEBUG-LOG
    debugLog('Actor sheet item quantity', { actor: this.actor.uuid, itemId: item.id, quantity: next });
    $row.find('.item-quantity-value').text(next);
    if (config && (config.key === 'armor' || config.key === 'weapons')) {
      this.actor.prepareData();
      this._refreshDerived(this.element);
    }
  }

  async _onItemEquipChange(event) {
    const checkbox = event.currentTarget;
    const { item, $row, groupKey, config } = this._getItemContextFromEvent(event);
    if (!item || !$row || !config?.allowEquip) return;
    const checked = Boolean(checkbox.checked);
    const updates = [{ _id: item.id, 'system.equipped': checked }];
    if (config.exclusive && checked) {
      const groupType = config.types?.[0] ?? item.type;
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
    debugLog('Actor sheet item equip', { actor: this.actor.uuid, itemId: item.id, group: groupKey, equipped: checked });
    this.actor.prepareData();
    this._refreshDerived(this.element);
    const $group = $row.closest('[data-item-group]');
    if (config.exclusive && $group.length) {
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

  _skillLabel(skillKey) {
    if (!skillKey) return game.i18n.localize('MY_RPG.WeaponsTable.SkillNone');
    const configKey = CONFIG.ProjectAndromeda.skills?.[skillKey];
    return configKey ? game.i18n.localize(configKey) : skillKey;
  }

  _weaponEffectHtml(item) {
    const source = item ?? {};
    const system = source.system ?? source;
    const lines = [
      `${game.i18n.localize('MY_RPG.WeaponsTable.SkillLabel')}: ${this._skillLabel(
        system.skill
      )}`,
      `${game.i18n.localize('MY_RPG.WeaponsTable.DamageLabel')}: ${this._formatDamage(system.skillBonus)}`
    ];
    if (system.equipped) {
      lines.push(game.i18n.localize('MY_RPG.WeaponsTable.EquippedLabel'));
    }
    let html = lines.join('<br>');
    const description = system.description ?? system.desc ?? '';
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
    if (phys)
      lines.push(
        `${game.i18n.localize('MY_RPG.ArmorItem.BonusPhysicalLabel')}: ${phys}`
      );
    if (azure)
      lines.push(
        `${game.i18n.localize('MY_RPG.ArmorItem.BonusMagicalLabel')}: ${azure}`
      );
    if (mental)
      lines.push(
        `${game.i18n.localize('MY_RPG.ArmorItem.BonusPsychicLabel')}: ${mental}`
      );
    if (shield)
      lines.push(
        `${game.i18n.localize('MY_RPG.ArmorItem.ShieldLabel')}: ${shield}`
      );
    if (speed)
      lines.push(
        `${game.i18n.localize('MY_RPG.ArmorItem.BonusSpeedLabel')}: ${speed}`
      );
    let html = lines.join('<br>');
    const description = system.description ?? system.desc ?? '';
    if (description) html += `<br><br>${description}`;
    return html;
  }
}
