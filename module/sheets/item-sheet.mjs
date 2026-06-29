import { MODULE_ID, debugLog } from '../config.mjs';
import { getFoundryItemSheetClass } from '../helpers/foundry-compat.mjs';
import {
  ARCHETYPE_DEFENSE_LABEL_KEYS,
  DEFAULT_ITEM_USAGE_FREQUENCY,
  ITEM_DEFENSE_LABEL_KEYS,
  ITEM_DURATION_LABEL_KEYS,
  ITEM_ACTIVATION_TYPE_LABEL_KEYS,
  ITEM_TARGET_LABEL_KEYS,
  ITEM_USAGE_FREQUENCY_LABEL_KEYS,
  getItemTypeConfig,
  isPersonalityValueItem,
  normalizeUsageFrequency
} from '../helpers/item-config.mjs';
import { STEP_EFFECT_THRESHOLDS } from '../helpers/step-effects.mjs';

export const FoundryItemSheet = getFoundryItemSheetClass();

// Item types that carry a damage profile / roll outcome and therefore support step
// effects. Besides the equipment-like types this also covers ability content:
// sheet-authored abilities (`trait`), catalog/signature abilities
// (`trait-source-ability`), and genomes (`trait-genome`).
const STEP_EFFECT_ITEM_TYPES = new Set([
  'weapon',
  'equipment',
  'equipment-consumable',
  'implant',
  'cartridge',
  'trait',
  'trait-source-ability',
  'trait-genome'
]);

const DEFAULT_STEP_EFFECT_THRESHOLD = 'Success';

function buildStepEffectThresholdOptions(selected) {
  const normalized = STEP_EFFECT_THRESHOLDS.includes(selected)
    ? selected
    : DEFAULT_STEP_EFFECT_THRESHOLD;
  return STEP_EFFECT_THRESHOLDS.map((key) => ({
    value: key,
    label: game.i18n.localize(`MY_RPG.SkillCheck.Outcomes.${key}`),
    selected: key === normalized
  }));
}

// Raw (unfiltered) rows so blank authoring rows survive between renders.
function buildStepEffectRows(value) {
  const list = Array.isArray(value) ? value : [];
  return list.map((effect, index) => ({
    index,
    text: String(effect?.text ?? ''),
    thresholdOptions: buildStepEffectThresholdOptions(effect?.minOutcome)
  }));
}

function buildRankOptions(selected) {
  const selectedNumber = Number(selected) || 0;
  const options = [
    {
      value: '',
      label: game.i18n.localize('MY_RPG.Rank.Unspecified'),
      selected: !selectedNumber
    }
  ];

  for (let rank = 1; rank <= 4; rank += 1) {
    options.push({
      value: String(rank),
      label: game.i18n.localize(`MY_RPG.RankNumeric.Rank${rank}`),
      selected: selectedNumber === rank
    });
  }

  return options;
}

function buildSkillOptions(selected) {
  const skills = CONFIG.ProjectAndromeda?.skills ?? {};
  const options = [
    {
      value: '',
      label: game.i18n.localize('MY_RPG.WeaponsTable.SkillNoneOption'),
      selected: !selected
    }
  ];

  for (const [key, labelKey] of Object.entries(skills)) {
    options.push({
      value: key,
      label: game.i18n.localize(labelKey),
      selected: key === selected
    });
  }

  return options;
}

function buildUsageFrequencyOptions(selected) {
  const normalized = normalizeUsageFrequency(selected || DEFAULT_ITEM_USAGE_FREQUENCY);
  return Object.entries(ITEM_USAGE_FREQUENCY_LABEL_KEYS).map(([value, labelKey]) => ({
    value,
    label: game.i18n.localize(labelKey),
    selected: normalized === value
  }));
}

function buildActivationTypeOptions(selected) {
  return buildSelectOptions(selected || 'passive', ITEM_ACTIVATION_TYPE_LABEL_KEYS);
}

function buildSelectOptions(selected, labelKeys, blankLabelKey = '') {
  const options = [];
  if (blankLabelKey) {
    options.push({
      value: '',
      label: game.i18n.localize(blankLabelKey),
      selected: !selected
    });
  }

  for (const [value, labelKey] of Object.entries(labelKeys)) {
    options.push({
      value,
      label: game.i18n.localize(labelKey),
      selected: value === selected
    });
  }

  return options;
}

function getFieldOptions(field, data) {
  if (field.type === 'usageFrequency') {
    return data.usageFrequencyOptions;
  }
  if (field.type === 'activationCost') {
    return data.activationCostOptions;
  }
  if (field.type === 'skill') {
    return data.skillOptions;
  }
  if (field.type === 'defense') {
    return data.defenseOptions;
  }
  if (field.type === 'archetypeDefense') {
    return data.archetypeDefenseOptions;
  }
  if (field.type === 'duration') {
    return data.durationOptions;
  }
  if (field.type === 'targets') {
    return data.targetOptions;
  }
  return [];
}

function shouldDisplayField(field, systemData) {
  if (!field?.showWhenPath) return true;
  return Boolean(foundry.utils.getProperty(systemData, field.showWhenPath));
}

function autoResizeDescriptionArea(area) {
  if (!(area instanceof HTMLTextAreaElement)) return;

  area.style.height = 'auto';

  const minHeight = Number.parseFloat(window.getComputedStyle(area).minHeight) || 0;
  area.style.height = `${Math.max(area.scrollHeight, minHeight)}px`;
}

// These select types map their value directly to an option value (plain string
// equality, no normalization), so when several fields of the same type share one
// option list (e.g. an archetype's strong/medium/weak defenses) the `selected`
// flag must be recomputed per field from that field's own value.
const PER_FIELD_SELECTED_TYPES = new Set([
  'skill',
  'defense',
  'archetypeDefense',
  'duration',
  'targets'
]);

function buildRenderableItemFields(data, itemFields = []) {
  return itemFields
    .filter((field) => shouldDisplayField(field, data.system))
    .map((field) => {
      const value = foundry.utils.getProperty(data.system, field.path) ?? '';
      const hasOptions = [
        'usageFrequency',
        'activationCost',
        'skill',
        'defense',
        'archetypeDefense',
        'duration',
        'targets'
      ].includes(field.type);
      let options = getFieldOptions(field, data);
      if (hasOptions && PER_FIELD_SELECTED_TYPES.has(field.type)) {
        options = options.map((option) => ({
          ...option,
          selected: String(option.value) === String(value)
        }));
      }
      return {
        ...field,
        value,
        checked: Boolean(value),
        hasMin: field.min !== undefined && field.min !== null,
        inputType: field.type === 'number' ? 'number' : 'text',
        isRank: field.type === 'rank',
        isCheckbox: field.type === 'checkbox',
        hasOptions,
        options
      };
    });
}

function getFilteredItemFields(data, excludedPaths = []) {
  const hidden = new Set(excludedPaths);
  return (data.itemConfig?.fields ?? []).filter((field) => !hidden.has(field.path));
}

export class ProjectAndromedaItemSheet extends FoundryItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['project-andromeda', 'sheet', 'item'],
      width: 620,
      height: 600
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    const root = html?.[0];
    if (!root) return;

    const descriptionAreas = root.querySelectorAll('[data-description-editor]');

    for (const area of descriptionAreas) {
      if (!(area instanceof HTMLTextAreaElement)) continue;

      autoResizeDescriptionArea(area);

      if (!area.dataset.hasAutoResizeHandler) {
        area.dataset.hasAutoResizeHandler = 'true';
        area.addEventListener('input', () => autoResizeDescriptionArea(area));
      }

      if (area.dataset.hasShortcutHandler) continue;

      area.dataset.hasShortcutHandler = 'true';

      area.addEventListener('keydown', (event) => {
        if (event.altKey || (!event.ctrlKey && !event.metaKey)) return;

        const key = event.key?.toLowerCase();
        const tagName = key === 'b' ? 'strong' : key === 'i' ? 'em' : key === 'u' ? 'u' : null;
        if (!tagName) return;

        const { selectionStart, selectionEnd, value } = area;
        if (selectionStart == null || selectionEnd == null || selectionStart === selectionEnd)
          return;

        event.preventDefault();

        const openingTag = `<${tagName}>`;
        const closingTag = `</${tagName}>`;
        const before = value.slice(0, selectionStart);
        const selected = value.slice(selectionStart, selectionEnd);
        const after = value.slice(selectionEnd);

        area.value = `${before}${openingTag}${selected}${closingTag}${after}`;

        const newSelectionStart = selectionStart + openingTag.length;
        const newSelectionEnd = newSelectionStart + selected.length;
        setTimeout(() => area.setSelectionRange(newSelectionStart, newSelectionEnd), 0);

        area.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    this._activateStepEffectControls(root);

    setTimeout(() => {
      for (const area of descriptionAreas) {
        autoResizeDescriptionArea(area);
      }
    }, 0);
  }

  _activateStepEffectControls(root) {
    const addButton = root.querySelector('[data-step-effect-add]');
    if (addButton && !addButton.dataset.stepEffectBound) {
      addButton.dataset.stepEffectBound = '1';
      addButton.addEventListener('click', (event) => {
        event.preventDefault();
        void this._addStepEffect(root);
      });
    }

    for (const button of root.querySelectorAll('[data-step-effect-remove]')) {
      if (button.dataset.stepEffectBound) continue;
      button.dataset.stepEffectBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        void this._removeStepEffect(root, Number(button.dataset.stepEffectIndex));
      });
    }

    // The step-effect inputs are intentionally unnamed (see step-effects.hbs): Foundry's
    // form serialization expands indexed names like `system.stepEffects.0.text` into a
    // numeric-keyed object that overwrites the stored array and makes the rows vanish.
    // Instead we persist them ourselves as a proper array, and stop the change event so
    // the framework's submit-on-change does not also fire a redundant full re-render.
    for (const input of root.querySelectorAll(
      '[data-step-effect-text], [data-step-effect-threshold]'
    )) {
      if (input.dataset.stepEffectBound) continue;
      input.dataset.stepEffectBound = '1';
      input.addEventListener('change', (event) => {
        event.stopPropagation();
        void this._persistStepEffects(root);
      });
    }
  }

  async _persistStepEffects(root) {
    await this.item.update(
      { 'system.stepEffects': this._collectStepEffects(root) },
      { render: false }
    );
  }

  _collectStepEffects(root) {
    return Array.from(root.querySelectorAll('[data-step-effect-row]')).map((row) => ({
      text: row.querySelector('[data-step-effect-text]')?.value ?? '',
      minOutcome:
        row.querySelector('[data-step-effect-threshold]')?.value ?? DEFAULT_STEP_EFFECT_THRESHOLD
    }));
  }

  async _addStepEffect(root) {
    const effects = this._collectStepEffects(root);
    effects.push({ text: '', minOutcome: DEFAULT_STEP_EFFECT_THRESHOLD });
    await this.item.update({ 'system.stepEffects': effects });
  }

  async _removeStepEffect(root, index) {
    const effects = this._collectStepEffects(root);
    if (!Number.isInteger(index) || index < 0 || index >= effects.length) return;
    effects.splice(index, 1);
    await this.item.update({ 'system.stepEffects': effects });
  }

  async getData(options) {
    const sheetData = await super.getData(options);
    const itemData = sheetData.item ?? sheetData.document ?? this.item;
    sheetData.system = sheetData.system ?? itemData?.system ?? {};
    sheetData.config = CONFIG.ProjectAndromeda ?? {};
    sheetData.itemConfig = getItemTypeConfig(this.item?.type);
    // Personality complications are `trait` items too, but they are narrative and
    // never rolled, so they must not surface the step-effects authoring section.
    sheetData.showStepEffects =
      STEP_EFFECT_ITEM_TYPES.has(this.item?.type) && !isPersonalityValueItem(this.item);
    sheetData.stepEffects = sheetData.showStepEffects
      ? buildStepEffectRows(sheetData.system.stepEffects)
      : [];

    if (game.settings.get(MODULE_ID, 'debugMode')) {
      // DEBUG-LOG
      debugLog('Preparing item sheet data', {
        type: this.item.type,
        itemId: this.item.id
      });
      this.item.logDebugState('Item sheet snapshot');
    }

    return sheetData;
  }
}

export class ProjectAndromedaCartridgeSheet extends ProjectAndromedaItemSheet {
  get template() {
    return 'systems/project-andromeda/templates/item/cartridge-sheet.hbs';
  }

  async getData(options) {
    const data = await super.getData(options);
    data.rankOptions = buildRankOptions(data.system.rank);
    data.skillOptions = buildSkillOptions(data.system.skill);
    data.usageFrequencyOptions = buildUsageFrequencyOptions(data.system.usageFrequency);
    data.activationCostOptions = buildActivationTypeOptions(
      data.system.activationCost ?? data.system.activationType
    );
    data.defenseOptions = buildSelectOptions(
      data.system.defense,
      ITEM_DEFENSE_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.durationOptions = buildSelectOptions(
      data.system.duration,
      ITEM_DURATION_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.targetOptions = buildSelectOptions(
      data.system.targets,
      ITEM_TARGET_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.metadataFields = buildRenderableItemFields(
      data,
      getFilteredItemFields(data, ['rank', 'skill'])
    );
    return data;
  }
}

export class ProjectAndromedaImplantSheet extends ProjectAndromedaItemSheet {
  get template() {
    return 'systems/project-andromeda/templates/item/implant-sheet.hbs';
  }

  async getData(options) {
    const data = await super.getData(options);
    data.rankOptions = buildRankOptions(data.system.rank);
    data.skillOptions = buildSkillOptions(data.system.skill);
    data.usageFrequencyOptions = buildUsageFrequencyOptions(data.system.usageFrequency);
    data.activationCostOptions = buildActivationTypeOptions(
      data.system.activationCost ?? data.system.activationType
    );
    data.defenseOptions = buildSelectOptions(
      data.system.defense,
      ITEM_DEFENSE_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.durationOptions = buildSelectOptions(
      data.system.duration,
      ITEM_DURATION_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.targetOptions = buildSelectOptions(
      data.system.targets,
      ITEM_TARGET_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.metadataFields = buildRenderableItemFields(
      data,
      getFilteredItemFields(data, ['rank', 'skill'])
    );
    return data;
  }
}

export class ProjectAndromedaArmorSheet extends ProjectAndromedaItemSheet {
  get template() {
    return 'systems/project-andromeda/templates/item/armor-sheet.hbs';
  }

  async getData(options) {
    const data = await super.getData(options);
    data.rankOptions = buildRankOptions(data.system.rank);
    data.skillOptions = buildSkillOptions(data.system.skill);
    data.usageFrequencyOptions = buildUsageFrequencyOptions(data.system.usageFrequency);
    data.activationCostOptions = buildActivationTypeOptions(
      data.system.activationCost ?? data.system.activationType
    );
    data.defenseOptions = buildSelectOptions(
      data.system.defense,
      ITEM_DEFENSE_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.durationOptions = buildSelectOptions(
      data.system.duration,
      ITEM_DURATION_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.targetOptions = buildSelectOptions(
      data.system.targets,
      ITEM_TARGET_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.metadataFields = buildRenderableItemFields(data, getFilteredItemFields(data, ['rank']));
    return data;
  }
}

export class ProjectAndromedaWeaponSheet extends ProjectAndromedaItemSheet {
  get template() {
    return 'systems/project-andromeda/templates/item/weapon-sheet.hbs';
  }

  async getData(options) {
    const data = await super.getData(options);
    data.skillOptions = buildSkillOptions(data.system.skill);
    data.rankOptions = buildRankOptions(data.system.rank);
    data.usageFrequencyOptions = buildUsageFrequencyOptions(data.system.usageFrequency);
    data.activationCostOptions = buildActivationTypeOptions(
      data.system.activationCost ?? data.system.activationType
    );
    data.defenseOptions = buildSelectOptions(
      data.system.defense,
      ITEM_DEFENSE_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.durationOptions = buildSelectOptions(
      data.system.duration,
      ITEM_DURATION_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.targetOptions = buildSelectOptions(
      data.system.targets,
      ITEM_TARGET_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.metadataFields = buildRenderableItemFields(
      data,
      getFilteredItemFields(data, ['rank', 'skill'])
    );
    return data;
  }
}

export class ProjectAndromedaGenericItemSheet extends ProjectAndromedaItemSheet {
  get template() {
    return 'systems/project-andromeda/templates/item/generic-sheet.hbs';
  }

  async getData(options) {
    const data = await super.getData(options);
    data.rankOptions = buildRankOptions(data.system.rank);
    data.skillOptions = buildSkillOptions(data.system.skill);
    data.usageFrequencyOptions = buildUsageFrequencyOptions(data.system.usageFrequency);
    data.activationCostOptions = buildActivationTypeOptions(
      data.system.activationCost ?? data.system.activationType
    );
    data.defenseOptions = buildSelectOptions(
      data.system.defense,
      ITEM_DEFENSE_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    // Per-field `selected` is recomputed in buildRenderableItemFields, so the base
    // list just needs the option values (the strong/medium/weak fields share it).
    data.archetypeDefenseOptions = buildSelectOptions(
      '',
      ARCHETYPE_DEFENSE_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.durationOptions = buildSelectOptions(
      data.system.duration,
      ITEM_DURATION_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    data.targetOptions = buildSelectOptions(
      data.system.targets,
      ITEM_TARGET_LABEL_KEYS,
      'MY_RPG.ItemFields.None'
    );
    const fields = isPersonalityValueItem(this.item)
      ? []
      : Array.isArray(data.itemConfig?.fields)
        ? data.itemConfig.fields
        : [];
    data.itemFields = buildRenderableItemFields(data, fields);
    return data;
  }
}

export const ITEM_SHEET_CLASSES = {
  cartridge: ProjectAndromedaCartridgeSheet,
  implant: ProjectAndromedaImplantSheet,
  armor: ProjectAndromedaArmorSheet,
  weapon: ProjectAndromedaWeaponSheet,
  generic: ProjectAndromedaGenericItemSheet
};
