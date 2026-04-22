import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { extractSkillTitles } from "../../../scripts/skills-reference-source.mjs"
import { buildRulebookCatalogHtml } from "./rulebookCatalog"

const combinedEquipmentHeaders = [
  "Тип",
  "Название",
  "Ранг",
  "Навык",
  "Урон",
  "Описание",
  "Цена",
]

const skillsSourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "Книга правил v0.4",
  "Глава 3. Навыки.md",
)

test("equipment skill filter uses only current chapter 03 skills", () => {
  const chapterSource = readFileSync(skillsSourcePath, "utf8")
  const currentSkills = extractSkillTitles(chapterSource)
  const html = buildRulebookCatalogHtml("equipment", combinedEquipmentHeaders, [
    [
      "Имплант",
      "Керезников",
      "1",
      "",
      "",
      "Ускоритель реакции для пользователя.",
      "160",
    ],
    [
      "Стрелковое",
      "Игла",
      "2",
      "Стрельба",
      "4",
      "Точная снайперская винтовка.",
      "780",
    ],
  ])
  const skillStart = html.indexOf('data-filter-dropdown="skill"')

  assert.notEqual(skillStart, -1)

  const skillBlock = html.slice(skillStart)

  assert.ok(skillBlock.includes('value="Без навыка"'))
  for (const skill of currentSkills) {
    assert.ok(skillBlock.includes(`value="${skill}"`), `expected skill filter to include ${skill}`)
  }

  for (const outdatedSkill of [
    "Кинетика",
    "Псионика",
    "Стихийность",
    "Биомантия",
    "Бионика",
    "Предвидение",
    "Программирование",
    "Тело",
  ]) {
    assert.equal(
      skillBlock.includes(`value="${outdatedSkill}"`),
      false,
      `expected skill filter to exclude ${outdatedSkill}`,
    )
  }
})
