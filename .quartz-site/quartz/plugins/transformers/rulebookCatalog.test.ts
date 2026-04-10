import assert from "node:assert/strict"
import test from "node:test"

import { buildAbilityCatalogHtml, buildRulebookCatalogHtml } from "./rulebookCatalog"

const abilityHeaders = [
  "Название",
  "Ранг",
  "Краткое описание",
  "Полное описание",
  "Частота использования",
  "Навык",
  "Цена в действиях",
  "Дальность",
  "Цели",
  "Зона",
  "Защита",
  "Длительность",
  "Цена в кредитах",
]

const equipmentHeaders = [
  "Тип",
  "Название",
  "Ранг",
  "Навык",
  "Урон",
  "Частота использования",
  "Цена в действиях",
  "Дальность",
  "Цели",
  "Зона",
  "Защита",
  "Длительность",
  "Краткое описание",
  "Полное описание",
  "Цена",
]

const detailedArmorHeaders = [
  "Название",
  "Ранг",
  "Стойкость",
  "Контроль",
  "Воля",
  "Силовой щит",
  "Скорость",
  "Частота использования",
  "Цена в действиях",
  "Длительность",
  "Краткое описание",
  "Полное описание",
  "Цена",
]

const weaponHeaders = ["Тип", "Название", "Цена", "Ранг", "Навык", "Урон", "Описание"]
const armorHeaders = ["Название", "Ранг", "Описание", "Цена:"]

function getSummaryRow(html: string) {
  return (
    [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)]
      .map((match) => match[0])
      .find((row) => row.includes('class="rulebook-ability-catalog__summary-row"')) ?? ""
  )
}

function countMetaChips(summaryRow: string) {
  return [...summaryRow.matchAll(/rulebook-ability-catalog__meta-chip"/g)].length
}

test("buildAbilityCatalogHtml defaults the active sort to rank", () => {
  const html = buildAbilityCatalogHtml(abilityHeaders, [
    [
      "Альфа",
      "2",
      "Краткое описание.",
      "Полное описание.",
      "1/сцену",
      "Кинетика",
      "1",
      "30 м",
      "1 цель",
      "",
      "Стойкость",
      "1 мин",
      "100",
    ],
  ])

  assert.match(html, /<input type="hidden" value="rank-asc" data-catalog-sort \/>/)
  assert.match(html, /data-sort-value="rank-asc"[\s\S]*?aria-pressed="true"/)
})

test("buildAbilityCatalogHtml keeps an empty preview when the split description columns are present", () => {
  const html = buildAbilityCatalogHtml(abilityHeaders, [
    [
      "Блэкаут",
      "1",
      "",
      "Полное описание для проверки.",
      "1/сцену",
      "",
      "1",
      "",
      "",
      "",
      "",
      "",
      "100",
    ],
  ])

  const summaryRow = getSummaryRow(html)
  assert.notEqual(summaryRow, "")
  assert.ok(summaryRow.includes(">—<"))
  assert.ok(!summaryRow.includes("Полное описание для проверки."))
})

test("catalog summaries keep only the requested meta chips in collapsed rows", () => {
  const abilityHtml = buildAbilityCatalogHtml(abilityHeaders, [
    [
      "Структурный голод",
      "2",
      "Ближайшие твёрдые поверхности хватают цель.",
      "Ближайшие твёрдые поверхности хватают цель. При успехе цель получает урон и её скорость = 0 на 1 мин.",
      "1/сцену",
      "Кинетика",
      "Основное",
      "30 м",
      "1 цель",
      "",
      "Стойкость",
      "1 мин",
      "320",
    ],
  ])
  const equipmentHtml = buildRulebookCatalogHtml("equipment", equipmentHeaders, [
    [
      "Оружие",
      "Проекционный модуль «Искра-30»",
      "2",
      "Стихийность",
      "6",
      "Неограниченно",
      "Основное",
      "30 м",
      "1 цель",
      "",
      "Воля",
      "",
      "Выпускаешь струю пламени в цель.",
      "Выпускаешь струю пламени в цель. Атака Стихийности +6 против Воли.",
      "900",
    ],
  ])
  const armorHtml = buildRulebookCatalogHtml("armor", detailedArmorHeaders, [
    [
      "КД-2",
      "1",
      "2",
      "1",
      "",
      "3",
      "",
      "",
      "",
      "",
      "Базовая общевойсковая броня.",
      "Базовая общевойсковая броня для прямого боя и первого размена под огнем.",
      "600",
    ],
  ])

  const abilitySummaryRow = getSummaryRow(abilityHtml)
  const equipmentSummaryRow = getSummaryRow(equipmentHtml)
  const armorSummaryRow = getSummaryRow(armorHtml)

  assert.equal(countMetaChips(abilitySummaryRow), 2)
  assert.match(abilitySummaryRow, /1\/сцену/u)
  assert.match(abilitySummaryRow, /Кинетика/u)
  assert.doesNotMatch(abilitySummaryRow, /Основное/u)
  assert.match(abilityHtml, /rulebook-ability-catalog__detail-tag-label">Активация<\/span>/u)

  assert.equal(countMetaChips(equipmentSummaryRow), 1)
  assert.match(equipmentSummaryRow, /Стихийность/u)
  assert.doesNotMatch(equipmentSummaryRow, />6</u)
  assert.match(equipmentHtml, /rulebook-ability-catalog__detail-tag-label">Урон<\/span>/u)
  assert.match(equipmentHtml, /rulebook-ability-catalog__detail-tag-value">6<\/span>/u)

  assert.equal(countMetaChips(armorSummaryRow), 2)
  assert.match(armorSummaryRow, /Стойкость 2/u)
  assert.match(armorSummaryRow, /Контроль 1/u)
  assert.doesNotMatch(armorSummaryRow, /Силовой щит/u)
  assert.match(armorHtml, /rulebook-ability-catalog__detail-tag-label">Силовой щит<\/span>/u)
  assert.match(armorHtml, /rulebook-ability-catalog__detail-tag-value">3<\/span>/u)
})

test("buildAbilityCatalogHtml renders filled detail tags before the full description", () => {
  const html = buildAbilityCatalogHtml(abilityHeaders, [
    [
      "Структурный голод",
      "2",
      "Ближайшие твёрдые поверхности хватают цель.",
      "Ближайшие твёрдые поверхности хватают цель. При успехе цель получает урон и её скорость = 0 на 1 мин.",
      "1/сцену",
      "Кинетика",
      "Основное",
      "30 м",
      "1 цель",
      "",
      "Стойкость",
      "1 мин",
      "320",
    ],
  ])

  assert.match(html, /rulebook-ability-catalog__detail-tags/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-label">Дальность<\/span>/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-value">30 м<\/span>/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-label">Цели<\/span>/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-value">1 цель<\/span>/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-label">Защита<\/span>/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-value">Стойкость<\/span>/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-label">Длительность<\/span>/u)
  assert.match(html, /rulebook-ability-catalog__detail-tag-value">1 мин<\/span>/u)
  assert.doesNotMatch(html, /rulebook-ability-catalog__detail-tag-label">Зона<\/span>/u)
  assert.match(
    html,
    /rulebook-ability-catalog__detail-tags[\s\S]*rulebook-ability-catalog__detail-label">Описание<\/span>[\s\S]*Ближайшие твёрдые поверхности/u,
  )
})

test("buildRulebookCatalogHtml defaults the active sort to rank for every catalog family", () => {
  const weaponHtml = buildRulebookCatalogHtml("weapons", weaponHeaders, [
    ["Стрелковое", "Игла", "780", "2", "Стрельба", "+4", "Точная винтовка."],
  ])
  const armorHtml = buildRulebookCatalogHtml("armor", armorHeaders, [
    ["ОЗК", "1", "Облегченная броня. Стойкость 3, Контроль 4, Воля 2", "100"],
  ])
  const equipmentHtml = buildRulebookCatalogHtml("equipment", armorHeaders, [
    ["Керезников", "1", "Ускоритель реакции для пользователя.", "160"],
  ])

  for (const html of [weaponHtml, armorHtml, equipmentHtml]) {
    assert.match(html, /<input type="hidden" value="rank-asc" data-catalog-sort \/>/)
    assert.match(html, /data-sort-value="rank-asc"[\s\S]*?aria-pressed="true"/)
  }
})
