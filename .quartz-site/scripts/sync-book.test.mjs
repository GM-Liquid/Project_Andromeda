import { constants as fsConstants } from "node:fs"
import { access } from "node:fs/promises"
import { readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

import { syncBook } from "./sync-book.mjs"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(scriptDir, "..")
const repoRoot = resolve(siteRoot, "..")
const docsRepoRoot = resolve(repoRoot, "..", "Docs_Project_Andromeda")

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

test("syncBook preserves line breaks in character sheet examples", { concurrency: false }, async () => {
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

test("syncBook injects chapter 03 gear catalogs from JSON sources instead of authored markdown tables", { concurrency: false }, async () => {
  const sourceChapter = await readFile(
    resolve(repoRoot, "Книга правил v0.4", "Способности и снаряжение.md"),
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

  assert.match(
    generated,
    /^\| Название \| Ранг \| Стойкость \| Контроль \| Воля \| Силовой щит \| Скорость \| Частота использования \| Цена в действиях \| Длительность \| Краткое описание \| Полное описание \| Цена \|$/m,
  )
  assert.match(
    generated,
    /^\| Тип \| Название \| Ранг \| Навык \| Урон \| Частота использования \| Цена в действиях \| Дальность \| Цели \| Зона \| Защита \| Длительность \| Краткое описание \| Полное описание \| Цена \|$/m,
  )
  assert.match(
    generated,
    /^\| Название \| Ранг \| Краткое описание \| Полное описание \| Частота использования \| Навык \| Цена в действиях \| Дальность \| Цели \| Зона \| Защита \| Длительность \| Цена в кредитах \|$/m,
  )
  assert.match(generated, /^\|.*КД-2.*\|$/m)
  assert.match(
    generated,
    /^\| Абразив \| 1 \| Создайте облако сверхострой пыли, ранящее существ в зоне\. \| Создайте облако сверхострой пыли\. Требуется концентрация\. Проверка Мощи против Стойкости каждого существа, которое впервые за ход оказывается в зоне\. При успехе цель получает 2 урона\. \| 1\/сцену \| Мощь \| Основное \|  \| Каждое существо в зоне \|  \| Стойкость \| 10 минут \| 100 \|$/m,
  )
  assert.match(
    generated,
    /^\|.*Виброклинок.*\|.*Ближний бой.*\|.*Урон: 5\..*\|$/m,
  )
  assert.match(
    generated,
    /^\|.*Распад.*\|.*Мощь.*\|.*310.*\|$/m,
  )
})

test("syncBook injects concept abilities from the shared gear catalog source", { concurrency: false }, async () => {
  const quartzConceptPath = resolve(siteRoot, "data", "temporary", "concept-abilities.json")
  const quartzConceptBackupPath = resolve(
    siteRoot,
    "data",
    "temporary",
    "concept-abilities.json.codex-backup",
  )
  const docsConceptPath = resolve(docsRepoRoot, "data", "gear", "catalog", "concept-abilities.json")
  const docsConceptBackupPath = resolve(
    docsRepoRoot,
    "data",
    "gear",
    "catalog",
    "concept-abilities.json.codex-backup",
  )
  const quartzConceptExists = await pathExists(quartzConceptPath)
  const docsConceptExists = await pathExists(docsConceptPath)

  const conceptCatalog = [
    {
      id: "testovyi-kontsept",
      name: "Тестовый концепт",
      type: "ability",
      rank: 1,
      skill: "Мистика",
      properties: [],
      description: "Полное описание тестовой концепт-способности.",
      shortDescription: "Краткое описание тестовой концепт-способности.",
      tags: [],
      finalCost: 777,
      status: "legacy",
      usage: {
        frequency: "1/сцену",
        actions: "Основное",
        range: "15 м",
        targets: "2 цели",
        area: "",
        defense: "Стойкость",
        duration: "2 раунда",
      },
      quartz: {
        previewDescription: "Краткое описание тестовой концепт-способности.",
        fullDescription: "Полное описание тестовой концепт-способности.",
        skill: "Старый навык",
        frequency: "1/сессию",
        actions: "Реакция",
        range: "30 м",
        targets: "1 цель",
        area: "",
        defense: "Воля",
        duration: "1 мин",
        credits: "",
      },
    },
  ]

  if (quartzConceptExists) {
    await rename(quartzConceptPath, quartzConceptBackupPath)
  }

  if (docsConceptExists) {
    await rename(docsConceptPath, docsConceptBackupPath)
  }

  await writeFile(docsConceptPath, `${JSON.stringify(conceptCatalog, null, 2)}\n`, "utf8")

  try {
    const { generatedFiles } = await syncBook()
    const chapter03Path = generatedFiles.find((filePath) =>
      filePath.endsWith("03-sposobnosti-i-snaryazhenie.md"),
    )

    assert.ok(chapter03Path, "expected the abilities and equipment chapter to be generated")

    const chapter03 = await readFile(resolve(chapter03Path), "utf8")

    assert.match(chapter03, /^## Концепт-способности$/m)
    assert.match(
      chapter03,
      /^\|.*Тестовый концепт.*\|.*Мистика.*\|.*Основное.*\|.*15 м.*\|.*2 цели.*\|.*Стойкость.*\|.*2 раунда.*\|.*777.*\|$/m,
    )
    assert.doesNotMatch(chapter03, /Старый навык/u)
  } finally {
    await rm(docsConceptPath, { force: true })

    if (docsConceptExists) {
      await rename(docsConceptBackupPath, docsConceptPath)
    }

    if (quartzConceptExists) {
      await rename(quartzConceptBackupPath, quartzConceptPath)
    } else {
      await rm(quartzConceptBackupPath, { force: true })
    }
  }
})

test("syncBook injects the concept abilities catalog into chapter 03 instead of chapter 04", { concurrency: false }, async () => {
  const sourceChapter = await readFile(
    resolve(repoRoot, "Книга правил v0.4", "Способности и снаряжение.md"),
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
    /^\| Название \| Ранг \| Краткое описание \| Полное описание \| Частота использования \| Навык \| Цена в действиях \| Дальность \| Цели \| Зона \| Защита \| Длительность \| Цена в кредитах \|$/m,
  )
  assert.match(chapter03, /^\|.*Болевой шок.*\|$/m)
  assert.doesNotMatch(chapter04, /^## Концепт-способности$/m)
})
