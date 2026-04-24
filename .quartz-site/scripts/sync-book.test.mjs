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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getSectionBody(document, heading) {
  const headingPattern = new RegExp(`^## ${escapeRegExp(heading)}$`, "mu")
  const match = headingPattern.exec(document)

  if (!match) {
    return ""
  }

  const sectionStart = match.index + match[0].length + 1
  const nextHeadingMatch = /^## /m.exec(document.slice(sectionStart))
  const sectionEnd = nextHeadingMatch
    ? sectionStart + nextHeadingMatch.index
    : document.length

  return document.slice(sectionStart, sectionEnd)
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

test("syncBook injects chapter 04 gear catalogs from JSON sources instead of authored markdown tables", { concurrency: false }, async () => {
  const sourceChapter = await readFile(
    resolve(repoRoot, "Книга правил v0.4", "Глава 4. Способности и снаряжение.md"),
    "utf8",
  )

  assert.doesNotMatch(
    sourceChapter,
    /^\|.*(?:Название|Тип|Краткое описание).*\|$/m,
  )

  const { generatedFiles } = await syncBook()
  const chapterPath = generatedFiles.find((filePath) =>
    filePath.endsWith("04-sposobnosti-i-snaryazhenie.md"),
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
  assert.match(generated, /^## Снаряжение$/m)
  assert.match(generated, /^## Способности$/m)
})

test("syncBook keeps chapter 04 equipment and abilities sections populated when catalogs are draft-only", { concurrency: false }, async () => {
  const { generatedFiles } = await syncBook()
  const chapterPath = generatedFiles.find((filePath) =>
    filePath.endsWith("04-sposobnosti-i-snaryazhenie.md"),
  )

  assert.ok(chapterPath, "expected the abilities and equipment chapter to be generated")

  const generated = await readFile(resolve(chapterPath), "utf8")
  const equipmentCatalog = JSON.parse(
    await readFile(resolve(repoRoot, "data", "gear", "catalog", "equipment.json"), "utf8"),
  )
  const abilitiesCatalog = JSON.parse(
    await readFile(resolve(repoRoot, "data", "gear", "catalog", "abilities.json"), "utf8"),
  )
  const equipmentEntry = equipmentCatalog.find((item) => item.status !== "deprecated")
  const abilityEntry = abilitiesCatalog.find((item) => item.status !== "deprecated")

  assert.ok(equipmentEntry, "expected at least one visible equipment entry")
  assert.ok(abilityEntry, "expected at least one visible ability entry")

  const equipmentSection = getSectionBody(generated, "Снаряжение")
  const abilitiesSection = getSectionBody(generated, "Способности")

  assert.match(equipmentSection, new RegExp(escapeRegExp(equipmentEntry.name), "u"))
  assert.match(abilitiesSection, new RegExp(escapeRegExp(abilityEntry.name), "u"))
})

test("syncBook leaves concept abilities unpublished even when the shared gear catalog source provides them", { concurrency: false }, async () => {
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
    const chapter04Path = generatedFiles.find((filePath) =>
      filePath.endsWith("04-sposobnosti-i-snaryazhenie.md"),
    )

    assert.ok(chapter04Path, "expected the abilities and equipment chapter to be generated")

    const chapter04 = await readFile(resolve(chapter04Path), "utf8")

    assert.match(chapter04, /^## Способности$/m)
    assert.doesNotMatch(chapter04, /^## Концепт-способности$/m)
    assert.doesNotMatch(chapter04, /Тестовый концепт/u)
    assert.doesNotMatch(
      chapter04,
      /Временный каталог идей и устаревших версий способностей/u,
    )
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

test("syncBook keeps concept abilities out of both chapter 04 and chapter 06", { concurrency: false }, async () => {
  const sourceChapter = await readFile(
    resolve(repoRoot, "Книга правил v0.4", "Глава 4. Способности и снаряжение.md"),
    "utf8",
  )

  assert.doesNotMatch(sourceChapter, /^## Концепт-способности$/m)

  const { generatedFiles } = await syncBook()
  const chapter04Path = generatedFiles.find((filePath) =>
    filePath.endsWith("04-sposobnosti-i-snaryazhenie.md"),
  )
  const chapter06Path = generatedFiles.find((filePath) => filePath.endsWith("06-boy.md"))

  assert.ok(chapter04Path, "expected the abilities and equipment chapter to be generated")
  assert.ok(chapter06Path, "expected the combat chapter to be generated")

  const chapter04 = await readFile(resolve(chapter04Path), "utf8")
  const chapter06 = await readFile(resolve(chapter06Path), "utf8")

  assert.doesNotMatch(chapter04, /^## Концепт-способности$/m)
  assert.doesNotMatch(
    chapter04,
    /Временный каталог идей и устаревших версий способностей/u,
  )
  assert.doesNotMatch(chapter04, /^\|.*Болевой шок.*\|$/m)
  assert.doesNotMatch(chapter06, /^## Концепт-способности$/m)
})
