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
  "Цена в кредитах",
]

const weaponHeaders = ["Тип", "Название", "Цена", "Ранг", "Навык", "Урон", "Описание"]
const armorHeaders = ["Название", "Ранг", "Описание", "Цена:"]

test("buildAbilityCatalogHtml defaults the active sort to rank", () => {
  const html = buildAbilityCatalogHtml(abilityHeaders, [
    ["Альфа", "2", "Краткое описание.", "Полное описание.", "1/сцену", "Кинетика", "1", "100"],
  ])

  assert.match(html, /<input type="hidden" value="rank-asc" data-catalog-sort \/>/)
  assert.match(html, /data-sort-value="rank-asc"[\s\S]*?aria-pressed="true"/)
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
