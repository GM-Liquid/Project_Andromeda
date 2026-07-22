import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const stylePath = new URL("./abilityCatalog.scss", import.meta.url)
const styleSource = readFileSync(stylePath, "utf8")

test("ability catalog dropdown menus keep the hidden attribute effective", () => {
  assert.match(
    styleSource,
    /&__dropdown-menu\[hidden\]\s*\{\s*display:\s*none;\s*\}/,
  )
})

test("ability catalog dropdown menus do not force horizontal scrolling", () => {
  assert.match(styleSource, /&__dropdown-menu\s*\{[\s\S]*overflow-y:\s*auto;/)
  assert.match(styleSource, /&__dropdown-menu\s*\{[\s\S]*overflow-x:\s*hidden;/)
  assert.match(styleSource, /&__dropdown-option\s*\{[\s\S]*box-sizing:\s*border-box;/)
})

test("ability catalog resets global checkbox offsets and boxes credit inputs correctly", () => {
  assert.match(styleSource, /\.rulebook-ability-catalog input\.rulebook-ability-catalog__dropdown-checkbox\s*\{[\s\S]*margin-inline:\s*0\s+0\.2rem;/)
  assert.match(styleSource, /\.rulebook-ability-catalog input\.rulebook-ability-catalog__dropdown-checkbox\s*\{[\s\S]*transform:\s*none;/)
  assert.match(styleSource, /&__credits-field\s*\{[\s\S]*min-width:\s*0;/)
  assert.match(styleSource, /&__credits-field[\s\S]*input\s*\{[\s\S]*min-width:\s*0;/)
  assert.match(styleSource, /&__credits-field[\s\S]*input\s*\{[\s\S]*box-sizing:\s*border-box;/)
})

test("ability catalog lays the card list out with flex gaps instead of a real table", () => {
  // The card stack is a flex column; its gap is the only source of row spacing,
  // so it never appears inside an expanded entry. No <table> wrappers remain.
  assert.match(
    styleSource,
    /&__table,\s*&__list\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*var\(--ability-catalog-row-gap\);/,
  )
  assert.match(styleSource, /&__table-shell\s*\{[\s\S]*overflow-x:\s*auto;/)
  assert.doesNotMatch(styleSource, /\.table-container/)
})

test("ability catalog aligns header and summary columns and insets the description cell", () => {
  assert.match(
    styleSource,
    /&__head,\s*&__summary-row\s*\{[\s\S]*grid-template-columns:\s*var\(--ability-catalog-columns\);/,
  )
  assert.match(styleSource, /&__description-cell\s*\{[\s\S]*padding-inline-end:\s*0\.35rem;/)
})

test("ability catalog separates cards, centers ranks, and uses the compact disclosure icon", () => {
  assert.match(styleSource, /--ability-catalog-row-gap:\s*0\.55rem;/)
  // Each entry is one rounded card whose inner corners are clipped square.
  assert.match(
    styleSource,
    /&__card\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*border-radius:\s*var\(--ability-catalog-rect-radius\);[\s\S]*background:\s*var\(--ability-catalog-card\);/,
  )
  assert.match(styleSource, /\[data-column="rank"\]\s*\{[\s\S]*text-align:\s*center;/)
  assert.match(styleSource, /&__toggle-icon\s*\{[\s\S]*width:\s*0\.72rem;/)
  assert.match(styleSource, /&__toggle-indicator\s*\{[\s\S]*width:\s*1\.375rem;/)
})

test("ability catalog highlights reset with the approved amber outline treatment", () => {
  assert.match(styleSource, /--ability-catalog-reset:\s*#c77a26;/)
  assert.match(styleSource, /&__reset\s*\{[\s\S]*border-color:\s*var\(--ability-catalog-reset\);/)
  assert.match(styleSource, /&__reset\s*\{[\s\S]*background:\s*var\(--ability-catalog-reset-surface\);/)
})

test("ability catalog styles the expanded fact block separately from the description copy", () => {
  assert.match(styleSource, /&__detail-facts\s*\{[\s\S]*display:\s*grid;[\s\S]*border-bottom:/)
  assert.match(styleSource, /&__detail-fact-line\s*\{[\s\S]*font-weight:\s*400;/)
  assert.match(styleSource, /&__detail-fact-label\s*\{[\s\S]*font-weight:\s*800;/)
  assert.match(styleSource, /&__detail-fact-value\s*\{[\s\S]*color:\s*var\(--dark\);[\s\S]*font-weight:\s*400;/)
  assert.match(styleSource, /&__detail-copy\s*\{[\s\S]*color:\s*var\(--dark\);/)
})

test("artifact catalogs use a three-column summary grid", () => {
  assert.match(
    styleSource,
    /&\[data-catalog-kind='artifacts'\]\s*\{[\s\S]*--ability-catalog-columns:\s*2\.5rem 12\.75rem minmax\(0, 1fr\);/,
  )
})
