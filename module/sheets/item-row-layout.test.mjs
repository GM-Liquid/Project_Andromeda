import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('item group rows render a collapsible table summary with detail sections', () => {
  const template = readFile('templates/actor/partials/item-group-section.hbs');
  const stylesheet = readFile('css/project-andromeda.css');
  const actorSheet = readFile('module/sheets/actor-sheet.mjs');
  const english = JSON.parse(readFile('lang/en.json'));

  assert.match(template, /item-group__columns/);
  assert.doesNotMatch(template, /item-group__header/);
  assert.match(template, /item-group__column-title/);
  assert.match(template, /item-group__create/);
  assert.match(template, /item-row__name[\s\S]*item-row__label[\s\S]*item-row__actions/);
  assert.match(template, /item-row__summary-grid/);
  assert.match(template, /item-row__check/);
  assert.match(template, /item-row__activation/);
  assert.match(template, /\{\{#unless \.\.\/group\.isSimple\}\}/);
  assert.match(template, /item-row__detail/);
  assert.match(template, /item-row__detail-grid/);
  assert.match(template, /item-row__detail-effect/);
  assert.match(template, /item-row__toggle/);
  assert.match(template, /item-group--card-table/);
  assert.match(template, /item-row__card-tags/);
  assert.match(template, /item-row__detail-effect--card-table/);
  assert.match(actorSheet, /_onItemRowToggle/);
  assert.match(actorSheet, /_getItemCardTags/);
  assert.match(actorSheet, /_getItemRollSummary/);
  assert.match(actorSheet, /_onItemActivate/);
  assert.match(actorSheet, /_onItemChat/);
  assert.match(
    actorSheet,
    /_hasItemChatControl\(item, displayConfig = null\) \{[\s\S]*return Boolean\(item && !this\._hasItemActivationControl\(item, displayConfig\)\);/
  );
  assert.match(actorSheet, /closest\('\.item-row\[data-item-id\]'\)/);
  assert.match(
    template,
    /item-row__actions[\s\S]*item-row__toggle[\s\S]*item-activate item-action-control item-control[\s\S]*item-chat item-action-control item-control[\s\S]*item-edit item-control[\s\S]*item-delete item-control/
  );
  assert.match(stylesheet, /\.project-andromeda \.item-group__columns \{/);
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group__columns \{[\s\S]*background:\s*var\(--andromeda-color-panel,\s*var\(--andromeda-fallback-panel\)\);/
  );
  assert.match(stylesheet, /\.project-andromeda \.item-row__summary-grid \{/);
  assert.match(stylesheet, /\.project-andromeda \.item-row__detail-grid \{/);
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group__column-actions \{[\s\S]*justify-content:\s*stretch;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group__create \{[\s\S]*min-width:\s*var\(--andromeda-item-actions-width\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__toggle \{[\s\S]*display:\s*inline-flex;[\s\S]*width:\s*1\.45rem;[\s\S]*height:\s*1\.45rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row--expanded \.item-row__toggle-icon \{[\s\S]*transform:\s*rotate\(180deg\);/
  );
  assert.equal(english.MY_RPG.ItemControls.Chat, 'Send to chat');
  assert.equal(english.MY_RPG.ItemTableColumns.Name, 'Name');
  assert.equal(english.MY_RPG.ItemTableColumns.Check, 'Check');
  assert.equal(english.MY_RPG.ItemTableColumns.Activation, 'Activation');
  assert.equal(english.MY_RPG.ItemCards.NoRoll, 'No roll');
  assert.equal(english.MY_RPG.ItemCards.HeatTag, 'Heat {cost}');
});

test('all item groups use a compact image-led card table with contextual tags', () => {
  const stylesheet = readFile('css/project-andromeda.css');
  const actorSheet = readFile('module/sheets/actor-sheet.mjs');
  const cardTagMethodStart = actorSheet.indexOf('\n  _getItemCardTags(');
  const cardTagMethod = actorSheet.slice(
    cardTagMethodStart,
    actorSheet.indexOf('\n  _hasItemActivationControl(', cardTagMethodStart)
  );

  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group--card-table \.item-row__summary-grid \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(var\(--andromeda-item-actions-width\),\s*auto\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group--card-table \.item-row__name img \{[\s\S]*width:\s*40px;[\s\S]*height:\s*40px;/
  );
  assert.match(
    stylesheet,
    /\.item-group--card-table \{[\s\S]*border:\s*2px solid var\(--andromeda-color-text/
  );
  assert.match(stylesheet, /\.item-row__card-tag--heat/);
  assert.match(stylesheet, /\.item-row__card-check-rank/);
  assert.match(
    stylesheet,
    /\.item-group--card-table \.item-group__create--inline \{[\s\S]*display:\s*inline-flex;[\s\S]*justify-content:\s*center;[\s\S]*flex:\s*0 0 1\.2rem;[\s\S]*padding:\s*0;/
  );
  assert.match(actorSheet, /isCardTable:\s*true/);
  assert.match(actorSheet, /const isCardTableItem = true/);
  assert.match(cardTagMethod, /skillLabel:\s*check\?\.skillLabel/);
  assert.match(cardTagMethod, /rankRoman:\s*check\?\.rankRoman/);
  assert.match(cardTagMethod, /bonusLabel:\s*this\._formatSkillBonus/);
  assert.doesNotMatch(cardTagMethod, /SKILL_CHECK_FORMULA/);
});

test('item row primary controls follow roll, activation, then passive chat priority', () => {
  const actorSheet = readFile('module/sheets/actor-sheet.mjs');
  const activationStart = actorSheet.indexOf('\n  _hasItemActivationControl(');
  const activationMethods = actorSheet.slice(
    activationStart,
    actorSheet.indexOf('\n  _isItemCooldownUsed(', activationStart)
  );
  const toggleStart = actorSheet.indexOf('\n  _onItemRowToggle(event)');
  const toggleMethod = actorSheet.slice(
    toggleStart,
    actorSheet.indexOf('\n  _applyItemRowExpandedState(', toggleStart)
  );

  assert.match(
    activationMethods,
    /displayConfig\?\.canRoll[\s\S]*this\._hasItemCooldown\(item, displayConfig\)[\s\S]*this\._hasItemActivationCost\(item\)/
  );
  assert.match(
    activationMethods,
    /return displayConfig\?\.canRoll \? 'fa-solid fa-dice-d10' : 'fa-solid fa-bolt';/
  );
  assert.match(
    activationMethods,
    /const activationCost = String\([\s\S]*item\?\.system\?\.activationCost \?\? item\?\.system\?\.activationType[\s\S]*return Boolean\(activationCost && activationCost !== 'passive'\);/
  );
  assert.doesNotMatch(activationMethods, /\['abilities', 'artifacts'\]/);
  assert.match(toggleMethod, /\.item-activate, \.item-chat,/);
});

test('item tables use a tighter layout with no rail divider and no left gutter', () => {
  const stylesheet = readFile('css/project-andromeda.css');

  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-rail \{[\s\S]*border-right:\s*0;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-pane \{[\s\S]*padding:\s*12px 12px 12px 0;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \{[\s\S]*--andromeda-item-actions-width:\s*calc\(2rem \+ 3 \* 1\.45rem \+ 3 \* 0\.2rem\);[\s\S]*--andromeda-item-table-columns:\s*minmax\(0,\s*1\.85fr\)\s+minmax\(7\.6rem,\s*0\.82fr\)\s+minmax\(4\.6rem,\s*0\.42fr\)[\s\S]*minmax\(var\(--andromeda-item-actions-width\),\s*auto\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-item-tab \.item-groups,[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*10px;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group__columns \{[\s\S]*grid-template-columns:\s*var\(--andromeda-item-table-columns\);[\s\S]*gap:\s*0\.45rem;[\s\S]*font-size:\s*0\.72rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__summary-grid \{[\s\S]*grid-template-columns:\s*var\(--andromeda-item-table-columns\);[\s\S]*gap:\s*0\.45rem;[\s\S]*padding:\s*0\.55rem 0\.6rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__name img \{[\s\S]*width:\s*26px;[\s\S]*height:\s*26px;[\s\S]*flex:\s*0 0 26px;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-control \{[\s\S]*width:\s*1\.45rem;[\s\S]*height:\s*1\.45rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-action-control \{[\s\S]*width:\s*2rem;[\s\S]*border-color:\s*var\(--andromeda-color-accent\);[\s\S]*background:\s*var\(--andromeda-color-panel\);[\s\S]*color:\s*var\(--andromeda-color-accent\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__actions \{[\s\S]*flex-wrap:\s*nowrap;[\s\S]*align-items:\s*center;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group--card-table \.item-row__actions \{[\s\S]*align-self:\s*center;[\s\S]*padding-top:\s*0;/
  );
  assert.doesNotMatch(stylesheet, /\.project-andromeda \.item-control:focus,/);
  assert.match(stylesheet, /\.project-andromeda \.item-control:focus-visible,/);
});

test('generic item editor supports rank selects and long nested archetype fields', () => {
  const template = readFile('templates/item/generic-sheet.hbs');

  assert.match(template, /name="system\.rank"/);
  assert.match(template, /\{\{#if field\.isTextarea\}\}/);
  assert.match(template, /item-field--textarea/);
  assert.match(template, /name="system\.\{\{field\.path\}\}"/);
  assert.match(template, /\{\{#if field\.readonly\}\}readonly tabindex="-1"/);
  assert.match(template, /data-description-editor/);
});
