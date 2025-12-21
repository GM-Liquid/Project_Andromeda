/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

import { MODULE_ID, debugLog } from '../config.mjs';
import { ABILITY_DIE_STEPS, getColorRank, normalizeAbilityDie } from '../helpers/utils.mjs';


const ITEM_GROUP_CONFIG = [
  {
    key: 'cartridges',
    type: 'cartridge',
    tab: 'abilities',
    icon: 'fas fa-magic',
    labelKey: 'MY_RPG.ItemGroups.Cartridges',
    emptyKey: 'MY_RPG.ItemGroups.EmptyCartridges',
    createKey: 'MY_RPG.ItemGroups.CreateCartridge',
    newNameKey: 'MY_RPG.ItemGroups.NewCartridge',
    showQuantity: false,
    allowEquip: false,
    exclusive: false
  },
  {
    key: 'implants',
    type: 'implant',
    tab: 'abilities',
    icon: 'fas fa-cogs',
    labelKey: 'MY_RPG.ItemGroups.Implants',
    emptyKey: 'MY_RPG.ItemGroups.EmptyImplants',
    createKey: 'MY_RPG.ItemGroups.CreateImplant',
    newNameKey: 'MY_RPG.ItemGroups.NewImplant',
    showQuantity: false,
    allowEquip: false,
    exclusive: false
  },
  {
    key: 'weapons',
    type: 'weapon',
    tab: 'inventory',
    icon: 'fas fa-crosshairs',
    labelKey: 'MY_RPG.ItemGroups.Weapons',
    emptyKey: 'MY_RPG.ItemGroups.EmptyWeapons',
    createKey: 'MY_RPG.ItemGroups.CreateWeapon',
    newNameKey: 'MY_RPG.ItemGroups.NewWeapon',
    showQuantity: false,
    allowEquip: true,
    exclusive: false
  },
  {
    key: 'armor',
    type: 'armor',
    tab: 'inventory',
    icon: 'fas fa-shield-alt',
    labelKey: 'MY_RPG.ItemGroups.Armor',
    emptyKey: 'MY_RPG.ItemGroups.EmptyArmor',
    createKey: 'MY_RPG.ItemGroups.CreateArmor',
    newNameKey: 'MY_RPG.ItemGroups.NewArmor',
    showQuantity: false,
    allowEquip: true,
    exclusive: true
  },
  {
    key: 'gear',
    type: 'gear',
    tab: 'inventory',
    icon: 'fas fa-toolbox',
    labelKey: 'MY_RPG.ItemGroups.Gear',
    emptyKey: 'MY_RPG.ItemGroups.EmptyGear',
    createKey: 'MY_RPG.ItemGroups.CreateGear',
    newNameKey: 'MY_RPG.ItemGroups.NewGear',
    showQuantity: true,
    allowEquip: false,
    exclusive: false
  }
];

const ITEM_GROUP_CONFIG_BY_KEY = ITEM_GROUP_CONFIG.reduce((acc, config) => {
  acc[config.key] = config;
  return acc;
}, {});
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
    $html.find('.stress-cell').on('click', this._onStressCellClick.bind(this));
    $html.find('.wound-cell').on('click', this._onWoundCellClick.bind(this));
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
      .on('change', (ev) => {
        const input = ev.currentTarget;
        const validatedValue = this.validateNumericInput(input);
        this.actor.update({ [input.name]: validatedValue }).then(() => {
          this.render(false);
        });
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
      return `systems/project-andromeda/templates/actor/actor-character-sheet.hbs`;
    }
    return `systems/project-andromeda/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = context.data;
    context.system = actorData.system;
    context.flags = actorData.flags;
    context.isCharacter = actorData.type === 'character';
    context.isNpc = actorData.type === 'npc';

    if (context.isCharacter || context.isNpc) {
      this._prepareCharacterData(context);
    }

    const worldType = game.settings.get(MODULE_ID, 'worldType');
    if (worldType === 'unity') {
      context.runeMax = (Number(context.system.abilities.int?.value || 0) * 2) + 5;
    }

    context.rollData = context.actor.getRollData();

    const itemGroups = this._buildItemGroups();
    const cartridgeGroup = itemGroups.find((group) => group.key === 'cartridges');
    if (cartridgeGroup) {
      cartridgeGroup.capacity = worldType === 'unity'
        ? { value: cartridgeGroup.count, max: context.runeMax ?? 0 }
        : null;
      context.cartridgeCount = cartridgeGroup.count;
    } else {
      context.cartridgeCount = 0;
    }

    context.itemGroups = itemGroups.reduce((acc, group) => {
      (acc[group.tab] ??= []).push(group);
      return acc;
    }, {});
    context.itemControls = this._getItemControlLabels();

    return context;
  }


  _prepareCharacterData(context) {
    const isCharacter = Boolean(context.isCharacter);
    const isNpc = Boolean(context.isNpc);
    const abilityOrder = ['con', 'int', 'spi'];
    context.system.skills ??= {};

    const sortedAbilities = {};
    for (const abilityKey of abilityOrder) {
      const ability = context.system.abilities?.[abilityKey];
      if (!ability) continue;
      ability.value = normalizeAbilityDie(ability.value);
      ability.label = game.i18n.localize(CONFIG.ProjectAndromeda.abilities[abilityKey]) ?? abilityKey;
      ability.rankClass = 'rank' + getColorRank(ability.value, 'ability');
      ability.dieLabel = `d${ability.value}`;
      sortedAbilities[abilityKey] = ability;
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
    context.system.stressTrack = Array.from({ length: Math.max(stressMax, 0) }, (_, index) => ({
      index,
      filled: index < stressValue,
      ariaLabel: game.i18n.format('MY_RPG.Stress.CellAria', { index: index + 1 })
    }));

    if (isCharacter) {
      const woundState = context.system.wounds ?? { minor: false, severe: false };
      const woundDefs = [
        {
          type: 'minor',
          labelKey: 'MY_RPG.Wounds.Minor',
          abbrKey: 'MY_RPG.Wounds.MinorAbbrev',
          ariaKey: 'MY_RPG.Wounds.MinorAria'
        },
        {
          type: 'severe',
          labelKey: 'MY_RPG.Wounds.Severe',
          abbrKey: 'MY_RPG.Wounds.SevereAbbrev',
          ariaKey: 'MY_RPG.Wounds.SevereAria'
        }
      ];
      context.system.woundTrack = woundDefs.map((def) => ({
        type: def.type,
        labelKey: def.labelKey,
        abbr: game.i18n.localize(def.abbrKey),
        ariaLabel: game.i18n.localize(def.ariaKey),
        filled: Boolean(woundState?.[def.type])
      }));
    } else if (isNpc) {
      context.system.woundTrack = [];
    }
  }

  /**
   * Toggle stress and wound cells without forcing a full sheet re-render.
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
    await this.actor.update({ 'system.stress.value': next }, { render: false });
    this._updateStressTrack(this.element, next);
  }

  async _onWoundCellClick(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    if (!type) return;
    const current = Boolean(this.actor.system.wounds?.[type]);
    const update = {};
    update['system.wounds.' + type] = !current;
    await this.actor.update(update, { render: false });
    this._updateWoundTrack(this.element);
  }

  _getWoundPenalty() {
    const wounds = this.actor.system.wounds || {};
    let penalty = 0;
    if (wounds.minor) penalty += 1;
    if (wounds.severe) penalty += 2;
    return penalty;
  }

  _stepAbilityDie(current, step) {
    const normalized = normalizeAbilityDie(current);
    const index = ABILITY_DIE_STEPS.indexOf(normalized);
    const clampedIndex = Math.max(
      0,
      Math.min(
        (index === -1 ? 0 : index) + Math.sign(step || 0),
        ABILITY_DIE_STEPS.length - 1
      )
    );
    return ABILITY_DIE_STEPS[clampedIndex];
  }

  _getAbilityDieValue(abilityKey) {
    if (!abilityKey) return ABILITY_DIE_STEPS[0];
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
        .text(`d${dieValue}`)
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
      dieValue = ABILITY_DIE_STEPS[0];
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

    const woundPenalty = this._getWoundPenalty();
    if (woundPenalty) {
      modifier -= woundPenalty;
      parts.push({
        label: game.i18n.localize('MY_RPG.RollFlavor.WoundPenalty'),
        value: -woundPenalty
      });
    }

    const roll = await new Roll(`1d${dieValue ?? ABILITY_DIE_STEPS[0]} + @mod`, { mod: modifier }).roll({
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
   * Update derived fields on the sheet (speed, defenses, stress and wounds)
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
    this._updateWoundTrack($root);
  }

  _updateStressTrack(root, explicitValue) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const stress = this.actor.system.stress || { value: 0, max: 0 };
    const value =
      typeof explicitValue === 'number' ? explicitValue : Number(stress.value) || 0;
    const $track = $root.find('.stress-track');
    if (!$track.length) return;
    $track.find('.stress-cell').each((i, el) => {
      const filled = i < value;
      el.classList.toggle('filled', filled);
      el.setAttribute('aria-pressed', filled ? 'true' : 'false');
    });
  }

  _updateWoundTrack(root) {
    const $root = root instanceof jQuery ? root : $(root ?? this.element);
    const wounds = this.actor.system.wounds || { minor: false, severe: false };
    const $track = $root.find('.wound-track');
    if (!$track.length) return;
    $track.find('.wound-cell').each((_, el) => {
      const type = el.dataset.type;
      const filled = Boolean(wounds?.[type]);
      el.classList.toggle('filled', filled);
      el.setAttribute('aria-pressed', filled ? 'true' : 'false');
    });
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
    return ITEM_GROUP_CONFIG.map((config) => {
      const items = this.actor.itemTypes?.[config.type] ?? [];
      const preparedItems = items.map((item) => this._prepareItemForDisplay(item, config));
      return {
        key: config.key,
        type: config.type,
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
      equipped: Boolean(system.equipped),
      badges,
      summary,
      hasBadges: badges.length > 0,
      hasSummary: Boolean(summary),
      canRoll: config.key === 'cartridges' || config.key === 'implants'
    };
  }

  _getItemBadges(item, config) {
    const system = item.system ?? {};
    const badges = [];
    const t = game.i18n;
    switch (config.key) {
      case 'cartridges': {
        const rank = Number(system.rank) || 0;
        if (rank) {
          badges.push(`${t.localize('MY_RPG.AbilitiesTable.Rank')}: ${getRankLabel(rank)}`);
        }
        if (game.settings.get(MODULE_ID, 'worldType') === 'unity' && system.runeType) {
          const runeKey = `MY_RPG.RuneTypes.${system.runeType}`;
          badges.push(`${t.localize('MY_RPG.RunesTable.RuneType')}: ${t.localize(runeKey)}`);
        }
        badges.push(`${t.localize('MY_RPG.AbilitiesTable.Skill')}: ${this._skillLabel(system.skill)}`);
        badges.push(`${t.localize('MY_RPG.AbilitiesTable.Bonus')}: ${this._formatSkillBonus(system.skillBonus)}`);
        break;
      }
      case 'implants': {
        const rank = Number(system.rank) || 0;
        if (rank) {
          badges.push(`${t.localize('MY_RPG.ModsTable.Rank')}: ${getRankLabel(rank)}`);
        }
        badges.push(`${t.localize('MY_RPG.ModsTable.Skill')}: ${this._skillLabel(system.skill)}`);
        badges.push(`${t.localize('MY_RPG.ModsTable.Bonus')}: ${this._formatSkillBonus(system.skillBonus)}`);
        break;
      }
      case 'weapons': {
        badges.push(`${t.localize('MY_RPG.WeaponsTable.SkillLabel')}: ${this._skillLabel(system.skill)}`);
        badges.push(`${t.localize('MY_RPG.WeaponsTable.BonusLabel')}: ${this._formatSkillBonus(system.skillBonus)}`);
        break;
      }
      case 'armor': {
        const phys = Number(system.itemPhys) || 0;
        const azure = Number(system.itemAzure) || 0;
        const mental = Number(system.itemMental) || 0;
        const shield = Number(system.itemShield) || 0;
        const speed = Number(system.itemSpeed) || 0;
        if (phys) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusPhysicalLabel')}: ${phys}`);
        if (azure) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusMagicalLabel')}: ${azure}`);
        if (mental) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusPsychicLabel')}: ${mental}`);
        if (shield) badges.push(`${t.localize('MY_RPG.ArmorItem.ShieldLabel')}: ${shield}`);
        if (speed) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusSpeedLabel')}: ${speed}`);
        break;
      }
      case 'gear':
        break;
      default:
        break;
    }
    return badges;
  }

  _getItemSummary(item, config) {
    const system = item.system ?? {};
    switch (config.key) {
      case 'cartridges':
        return system.description || '';
      case 'implants':
        return system.description || '';
      case 'weapons':
        return system.description || '';
      case 'armor':
        return system.description || '';
      case 'gear':
        return system.description || '';
      default:
        return system.description || '';
    }
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
    const typeLabel = config ? game.i18n.localize(`TYPES.Item.${config.type}`) : game.i18n.localize('MY_RPG.Inventory.Name');
    return game.i18n.format('MY_RPG.ItemControls.NewItemFallback', { type: typeLabel });
  }

  _getGroupConfig(groupKey) {
    if (!groupKey) return null;
    return ITEM_GROUP_CONFIG_BY_KEY[groupKey] ?? null;
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
    let config = type ? ITEM_GROUP_CONFIG.find((c) => c.type === type) : null;
    if (!config) config = this._getGroupConfig(groupKey);
    if (!config) return;
    const name = this._getDefaultItemName(config);
    // DEBUG-LOG
    debugLog('Actor sheet item create', { actor: this.actor.uuid, type: config.type });
    await this.actor.createEmbeddedDocuments('Item', [
      { name, type: config.type, system: {} }
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

    if (item.type !== 'cartridge' && item.type !== 'implant') {
      return;
    }

    const system = item.system ?? {};
    const skillKey = system.skill || '';
    const skillValue = Number(this.actor.system?.skills?.[skillKey]?.value) || 0;
    const itemBonus = Number(system.skillBonus) || 0;
    const parts = [];

    parts.push({
      label: game.i18n.format('MY_RPG.RollFlavor.SkillValue', { skill: this._skillLabel(skillKey) }),
      value: skillValue
    });
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
      const others = this.actor.itemTypes?.[config.type] ?? [];
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
      `${game.i18n.localize('MY_RPG.WeaponsTable.BonusLabel')}: ${this._formatSkillBonus(
        system.skillBonus
      )}`
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
