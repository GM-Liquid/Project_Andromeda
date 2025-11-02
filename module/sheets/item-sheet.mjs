import { MODULE_ID, RUNE_TYPE_KEYS, debugLog } from '../config.mjs';

function buildRankOptions(selected) {
  const worldType = game.settings.get(MODULE_ID, 'worldType');
  const baseKey = worldType === 'stellar' ? 'MY_RPG.RankNumeric' : 'MY_RPG.RankGradient';
  const selectedNumber = Number(selected) || 0;
  const options = [
    {
      value: '',
      label: game.i18n.localize('MY_RPG.Rank.Unspecified'),
      selected: !selectedNumber
    }
  ];

  for (let rank = 1; rank <= 5; rank += 1) {
    options.push({
      value: String(rank),
      label: game.i18n.localize(`${baseKey}.Rank${rank}`),
      selected: selectedNumber === rank
    });
  }

  return options;
}

function buildRuneTypeOptions(selected) {
  const normalized = selected || 'Spell';
  return RUNE_TYPE_KEYS.map((value) => ({
    value,
    label: game.i18n.localize(`MY_RPG.RuneTypes.${value}`),
    selected: normalized === value
  }));
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

export class ProjectAndromedaItemSheet extends ItemSheet {
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
      if (!(area instanceof HTMLTextAreaElement) || area.dataset.hasShortcutHandler) continue;

      area.dataset.hasShortcutHandler = 'true';

      area.addEventListener('keydown', (event) => {
        if (event.altKey || (!event.ctrlKey && !event.metaKey)) return;

        const key = event.key?.toLowerCase();
        const tagName = key === 'b' ? 'strong' : key === 'i' ? 'em' : key === 'u' ? 'u' : null;
        if (!tagName) return;

        const { selectionStart, selectionEnd, value } = area;
        if (selectionStart == null || selectionEnd == null || selectionStart === selectionEnd) return;

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
  }

  async getData(options) {
    const sheetData = await super.getData(options);
    const itemData = sheetData.item ?? sheetData.document ?? this.item;
    sheetData.system = sheetData.system ?? itemData?.system ?? {};
    sheetData.config = CONFIG.ProjectAndromeda ?? {};
    sheetData.worldType = game.settings.get(MODULE_ID, 'worldType');

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
    data.runeTypeOptions = buildRuneTypeOptions(data.system.runeType);
    data.showRuneType = data.worldType === 'unity';
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
    return data;
  }
}

export class ProjectAndromedaGearSheet extends ProjectAndromedaItemSheet {
  get template() {
    return 'systems/project-andromeda/templates/item/gear-sheet.hbs';
  }

  async getData(options) {
    const data = await super.getData(options);
    data.rankOptions = buildRankOptions(data.system.rank);
    return data;
  }
}
