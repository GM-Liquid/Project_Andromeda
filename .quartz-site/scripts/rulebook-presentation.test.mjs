import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const quartzRoot = resolve(scriptDir, "..")

test("rulebook pages pin their palette to light tokens", async () => {
  const customStyles = await readFile(
    resolve(quartzRoot, "quartz", "styles", "custom.scss"),
    "utf8",
  )

  const blockStart = customStyles.indexOf('body[data-rulebook="true"] {')
  assert.notEqual(blockStart, -1, "Expected rulebook styles block to exist")

  const pageBlockStart = customStyles.indexOf("\n  .page {", blockStart)
  assert.notEqual(
    pageBlockStart,
    -1,
    "Expected light palette overrides before nested rulebook layout styles",
  )

  const rulebookBlockHead = customStyles.slice(blockStart, pageBlockStart)
  const expectedTokens = [
    "--light: #f6f0e8;",
    "--lightgray: #ddd2c5;",
    "--gray: #a79b8d;",
    "--darkgray: #544d46;",
    "--dark: #1e1d1c;",
    "--secondary: #2d5876;",
    "--tertiary: #7ea3b8;",
    "--highlight: rgba(45, 88, 118, 0.11);",
    "--textHighlight: #fff23688;",
  ]

  for (const token of expectedTokens) {
    assert.match(
      rulebookBlockHead,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `Expected rulebook block to include ${token}`,
    )
  }
})

test("rulebook heroes keep a readable fallback background when no image is configured", async () => {
  const heroStyles = await readFile(
    resolve(quartzRoot, "quartz", "components", "styles", "rulebookHero.scss"),
    "utf8",
  )

  assert.match(
    heroStyles,
    /var\(\s*--rulebook-hero-image,\s*linear-gradient\(/,
    "Expected hero background to define a gradient fallback when no image is present",
  )
})
