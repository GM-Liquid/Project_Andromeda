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
    /\*\*Имя:\*\* \*Имя вашего персонажа\* {2}\n\*\*Ранг:\*\* 2 {2}\n\*\*Архетип:\*\* \*Стрелок\*/u,
  )
  assert.match(
    generated,
    /\*\*Ценности:\*\* {2}\n[ \t]*"Никого не бросать" {2}\n[ \t]*"Истина важнее комфорта" {2}\n\*\*Характеристики:\*\*/u,
  )
})

test("syncBook injects chapter 03 gear catalogs from JSON sources instead of authored markdown tables", async () => {
  const sourceChapter = await readFile(
    resolve("..", "Книга правил v0.4", "Способности и снаряжение.md"),
    "utf8",
  )

  assert.doesNotMatch(
    sourceChapter,
    /^\|.*(?:Название|Тип|Краткое описание).*\|$/m,
  )

  const { generatedFiles } = await syncBook()
  const chapterPath = generatedFiles.find((filePath) =>
    filePath.endsWith("03-sposobnosti-i-snaryazhenie.md"),
  )

  assert.ok(chapterPath, "expected the abilities and equipment chapter to be generated")

  const generated = await readFile(resolve(chapterPath), "utf8")

  assert.match(generated, /^\| Название \| Ранг \| Стойкость \| Контроль \| Воля \| Описание \| Цена \|$/m)
  assert.match(generated, /^\| Тип \| Название \| Ранг \| Навык \| Урон \| Описание \| Цена \|$/m)
  assert.match(generated, /^\| Название \| Ранг \| Полное описание \| Частота использования \| Навык \| Цена в действиях \| Цена в кредитах \|$/m)
  assert.match(generated, /^\|.*КД-2.*\|$/m)
  assert.match(generated, /^\|.*Распад.*\|$/m)
})

test("syncBook injects the temporary concept abilities catalog into chapter 03 instead of chapter 04", async () => {
  const sourceChapter = await readFile(
    resolve("..", "Книга правил v0.4", "Способности и снаряжение.md"),
    "utf8",
  )

  assert.doesNotMatch(sourceChapter, /^## Концепт-способности$/m)

  const { generatedFiles } = await syncBook()
  const chapter03Path = generatedFiles.find((filePath) =>
    filePath.endsWith("03-sposobnosti-i-snaryazhenie.md"),
  )
  const chapter04Path = generatedFiles.find((filePath) => filePath.endsWith("04-boy.md"))

  assert.ok(chapter03Path, "expected the abilities and equipment chapter to be generated")
  assert.ok(chapter04Path, "expected the combat chapter to be generated")

  const chapter03 = await readFile(resolve(chapter03Path), "utf8")
  const chapter04 = await readFile(resolve(chapter04Path), "utf8")

  assert.match(chapter03, /^## Концепт-способности$/m)
  assert.match(
    chapter03,
    /Временный каталог идей и устаревших версий способностей/u,
  )
  assert.match(
    chapter03,
    /^\| Название \| Ранг \| Полное описание \| Частота использования \| Навык \| Цена в действиях \| Цена в кредитах \|$/m,
  )
  assert.match(chapter03, /^\|.*Болевой шок.*\|$/m)
  assert.doesNotMatch(chapter04, /^## Концепт-способности$/m)
})
