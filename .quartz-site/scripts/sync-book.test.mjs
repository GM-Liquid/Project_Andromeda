import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

import { syncBook } from "./sync-book.mjs"

test("syncBook preserves line breaks in character sheet examples", async () => {
  const { generatedFiles } = await syncBook()
  const chapterPath = generatedFiles.find((filePath) =>
    filePath.endsWith("02-sozdanie-personazha.md"),
  )

  assert.ok(chapterPath, "expected the character creation chapter to be generated")

  const generated = await readFile(resolve(chapterPath), "utf8")

  assert.match(
    generated,
    /\*\*Имя:\*\* \*Имя вашего персонажа\* {2}\n\*\*Ранг:\*\* 2 {2}\n\*\*Архетип:\*\* \*Стрелок\*/,
  )
  assert.match(
    generated,
    /"Истина важнее комфорта" {2}\n\*\*Характеристики:\*\*/,
  )
})
