import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const scriptPath = new URL("./abilityCatalog.inline.ts", import.meta.url)
const scriptSource = readFileSync(scriptPath, "utf8")

test("ability catalog client no longer depends on sort controls", () => {
  assert.doesNotMatch(scriptSource, /data-catalog-sort/)
  assert.doesNotMatch(scriptSource, /data-sort-option/)
  assert.doesNotMatch(scriptSource, /\bsortEntries\s*\(/)
})

test("ability catalog client supports multi-valued defense filters", () => {
  assert.match(scriptSource, /Array\.isArray\(entryFilterValue\)/)
  assert.match(scriptSource, /entryFilterValue\.some\(\(value\) => values\.has\(value\)\)/)
})

test("ability catalog client rerenders ability values for the selected character rank", () => {
  assert.match(scriptSource, /data-catalog-character-rank/)
  assert.match(scriptSource, /applyCharacterRank\(entry, selectedRank\)/)
  assert.match(scriptSource, /previewDescription: scaled\.previewDescription/)
  assert.match(scriptSource, /fullDescription: scaled\.fullDescription/)
  assert.match(scriptSource, /detailTags: scaled\.detailTags/)
})

test("artifact catalog rerenders keep the price column hidden", () => {
  assert.match(scriptSource, /catalog\.dataset\.catalogKind !== "artifacts"/)
  assert.match(scriptSource, /renderRows\(nextEntries, expandedEntries, showPrice\)/)
})
