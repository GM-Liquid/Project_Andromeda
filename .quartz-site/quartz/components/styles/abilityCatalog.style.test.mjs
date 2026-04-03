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
