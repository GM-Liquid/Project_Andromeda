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
  assert.match(template, /item-row__name[\s\S]*item-row__label[\s\S]*item-row__toggle/);
  assert.match(template, /item-row__summary-grid/);
  assert.match(template, /item-row__roll/);
  assert.match(template, /item-row__detail/);
  assert.match(template, /item-row__detail-grid/);
  assert.match(template, /item-row__detail-effect/);
  assert.match(template, /item-row__toggle/);
  assert.match(actorSheet, /_onItemRowToggle/);
  assert.match(actorSheet, /_getItemRollSummary/);
  assert.match(stylesheet, /\.project-andromeda \.item-group__columns \{/);
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group__columns \{[\s\S]*background:\s*var\(--andromeda-color-panel,\s*var\(--andromeda-fallback-panel\)\);/
  );
  assert.match(stylesheet, /\.project-andromeda \.item-row__summary-grid \{/);
  assert.match(stylesheet, /\.project-andromeda \.item-row__detail-grid \{/);
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group__column-actions \{[\s\S]*justify-content:\s*center;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-group__create \{[\s\S]*width:\s*var\(--andromeda-item-create-width\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__toggle \{[\s\S]*display:\s*none;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row--expanded \.item-row__toggle \{[\s\S]*display:\s*inline-flex;/
  );
  assert.equal(english.MY_RPG.ItemTableColumns.Name, 'Name');
  assert.equal(english.MY_RPG.ItemTableColumns.Skill, 'Skill');
  assert.equal(english.MY_RPG.ItemTableColumns.Roll, 'Roll');
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
    /\.project-andromeda \{[\s\S]*--andromeda-item-create-width:\s*calc\(4 \* 1\.45rem \+ 3 \* 0\.2rem\);[\s\S]*--andromeda-item-table-columns:\s*minmax\(0,\s*1\.9fr\)\s+minmax\(6\.5rem,\s*0\.78fr\)\s+minmax\(5\.7rem,\s*0\.66fr\)\s+8\.2rem;/
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
});
