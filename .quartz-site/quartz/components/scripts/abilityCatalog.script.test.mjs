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
