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

test("ability catalog neutralizes generic markdown table wrappers so the shell does not scroll unnecessarily", () => {
  assert.match(styleSource, /\.rulebook-ability-catalog\s+\.table-container\s*\{[\s\S]*overflow-x:\s*visible;/)
  assert.match(styleSource, /\.rulebook-ability-catalog\s+\.table-container\s*>\s*table\s*\{[\s\S]*margin:\s*0;/)
  assert.match(styleSource, /\.rulebook-ability-catalog\s+\.table-container\s*>\s*table\s*\{[\s\S]*padding:\s*0;/)
})

test("ability catalog balances left and right outer spacing for table rows", () => {
  assert.match(styleSource, /thead th:first-child,\s*tbody td:first-child\s*\{[\s\S]*padding-left:\s*1\.1rem;/)
  assert.match(styleSource, /&__description-cell\s*\{[\s\S]*padding-inline-end:\s*0\.35rem;/)
})

test("ability catalog styles the expanded detail tag grid separately from the description copy", () => {
  assert.match(styleSource, /&__detail-tags\s*\{[\s\S]*display:\s*flex;/)
  assert.match(styleSource, /&__detail-tag\s*\{[\s\S]*display:\s*inline-flex;/)
  assert.match(styleSource, /&__detail-tag-label\s*\{[\s\S]*font-weight:\s*700;/)
  assert.match(styleSource, /&__detail-tag-value\s*\{[\s\S]*color:\s*var\(--dark\);/)
})
