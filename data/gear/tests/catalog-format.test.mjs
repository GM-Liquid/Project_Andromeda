import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, "..", "..", "..")
const catalogRoot = resolve(repoRoot, "data", "gear", "catalog")
const catalogNames = [
  "abilities",
  "armor",
  "catalog-manifest",
  "concept-abilities",
  "equipment",
]

test("gear catalogs use canonical two-space JSON formatting", async () => {
  const offenders = []

  for (const catalogName of catalogNames) {
    const path = resolve(catalogRoot, `${catalogName}.json`)
    const source = await readFile(path, "utf8")
    const normalized = `${JSON.stringify(JSON.parse(source), null, 2)}\n`

    if (source !== normalized) {
      offenders.push(catalogName)
    }
  }

  assert.deepEqual(offenders, [])
})
