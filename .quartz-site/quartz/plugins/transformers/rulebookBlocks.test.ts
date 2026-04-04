import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAbilityCatalogHtml,
  buildRulebookCatalogHtml,
  detectRulebookCatalogKind,
  isAbilityCatalogTable,
} from "./rulebookBlocks"

const modernHeaders = [
  "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435",
  "\u0420\u0430\u043d\u0433",
  "\u041a\u0440\u0430\u0442\u043a\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
  "\u041f\u043e\u043b\u043d\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
  "\u0427\u0430\u0441\u0442\u043e\u0442\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f",
  "\u041d\u0430\u0432\u044b\u043a",
  "\u0426\u0435\u043d\u0430 \u0432 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f\u0445",
  "\u0426\u0435\u043d\u0430 \u0432 \u043a\u0440\u0435\u0434\u0438\u0442\u0430\u0445",
]

const singleDescriptionHeaders = [
  "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435",
  "\u0420\u0430\u043d\u0433",
  "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
  "\u0427\u0430\u0441\u0442\u043e\u0442\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f",
  "\u041d\u0430\u0432\u044b\u043a",
  "\u0426\u0435\u043d\u0430 \u0432 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f\u0445",
  "\u0426\u0435\u043d\u0430 \u0432 \u043a\u0440\u0435\u0434\u0438\u0442\u0430\u0445",
]

const legacyHeaders = [
  "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435",
  "\u0420\u0430\u043d\u0433",
  "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
  "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0434\u043b\u044f \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438",
  "\u0427\u0430\u0441\u0442\u043e\u0442\u0430",
  "\u041d\u0430\u0432\u044b\u043a",
  "\u0426\u0435\u043d\u0430:",
]

const weaponHeaders = [
  "Тип",
  "Название",
  "Цена",
  "Ранг",
  "Навык",
  "Урон",
  "Описание",
]

const combinedEquipmentHeaders = [
  "Тип",
  "Название",
  "Ранг",
  "Навык",
  "Урон",
  "Описание",
  "Цена",
]

const simplePriceHeaders = ["Название", "Ранг", "Описание", "Цена:"]

function getFirstSummaryRow(html: string) {
  return (
    [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)]
      .map((match) => match[0])
      .find((row) => row.includes('class="rulebook-ability-catalog__summary-row"')) ?? ""
  )
}

test("isAbilityCatalogTable matches the supported abilities table headers", () => {
  assert.equal(isAbilityCatalogTable(modernHeaders), true)
  assert.equal(isAbilityCatalogTable(singleDescriptionHeaders), true)
  assert.equal(
    isAbilityCatalogTable([
      "\u0422\u0438\u043f",
      "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435",
      "\u041a\u043e\u043c\u0443 \u043f\u0440\u0438\u043d\u0430\u0434\u043b\u0435\u0436\u0438\u0442",
      "\u0420\u0430\u043d\u0433",
      "\u041d\u0430\u0432\u044b\u043a",
      "\u0423\u0440\u043e\u043d",
      "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
    ]),
    false,
  )
  assert.equal(isAbilityCatalogTable(legacyHeaders), true)
})

test("detectRulebookCatalogKind resolves the table family from headers and surrounding section", () => {
  assert.equal(
    detectRulebookCatalogKind(modernHeaders, { heading: "Способности", label: "Таблица способностей" }),
    "abilities",
  )
  assert.equal(
    detectRulebookCatalogKind(weaponHeaders, { heading: "Оружие", label: "Таблица оружия" }),
    "weapons",
  )
  assert.equal(
    detectRulebookCatalogKind(combinedEquipmentHeaders, {
      heading: "Снаряжение",
      label: "Таблица снаряжения",
    }),
    "equipment",
  )
  assert.equal(
    detectRulebookCatalogKind(simplePriceHeaders, { heading: "Броня", label: "Таблица брони" }),
    "armor",
  )
  assert.equal(
    detectRulebookCatalogKind(simplePriceHeaders, { heading: "Снаряжение", label: "Таблица снаряжения" }),
    "equipment",
  )
})

test("buildAbilityCatalogHtml renders the compact toolbar, new frequency label, and split descriptions", () => {
  const preview =
    "\u0421\u0436\u0438\u043c\u0430\u0435\u0442 \u0446\u0435\u043b\u044c \u0438 \u043b\u043e\u043c\u0430\u0435\u0442 \u0435\u0451 \u0433\u0440\u0430\u0432\u0438\u0442\u0430\u0446\u0438\u0435\u0439."
  const full =
    "\u0414\u0432\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f: 30 \u043c, \u0446\u0435\u043b\u044c. \u0410\u0442\u0430\u043a\u0430 \u041a\u0438\u043d\u0435\u0442\u0438\u043a\u0438 +4 \u043f\u0440\u043e\u0442\u0438\u0432 \u0424\u0417. \u041f\u0440\u0438 \u0443\u0441\u043f\u0435\u0445\u0435 \u0446\u0435\u043b\u044c \u0441\u0431\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0441 \u043d\u043e\u0433 \u0438 \u043f\u0440\u0438\u0442\u044f\u0433\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u043a \u0446\u0435\u043d\u0442\u0440\u0443."
  const html = buildAbilityCatalogHtml(modernHeaders, [
    [
      "\u0413\u0440\u0430\u0432\u0438\u0442\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439 \u043a\u043e\u043b\u043b\u0430\u043f\u0441",
      "2",
      preview,
      full,
      "1/\u0441\u0446\u0435\u043d\u0443",
      "\u041a\u0438\u043d\u0435\u0442\u0438\u043a\u0430",
      "2",
      "400",
    ],
    [
      "\u0418\u0441\u043a\u0440\u0430-30",
      "3",
      "\u0411\u044c\u0451\u0442 \u043e\u0433\u043d\u0435\u043d\u043d\u043e\u0439 \u0441\u0442\u0440\u0443\u0451\u0439 \u0432 \u0446\u0435\u043b\u044c.",
      "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435: \u0432\u044b\u043f\u0443\u0441\u043a\u0430\u0435\u0448\u044c \u0441\u0442\u0440\u0443\u044e \u043f\u043b\u0430\u043c\u0435\u043d\u0438 \u0432 \u0446\u0435\u043b\u044c \u0434\u043e 30 \u043c.",
      "\u041d\u0435\u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u043d\u043e",
      "\u0421\u0442\u0438\u0445\u0438\u0439\u043d\u043e\u0441\u0442\u044c",
      "1",
      "1100",
    ],
  ])

  const headerBlock = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? ""
  const firstSummaryRow = getFirstSummaryRow(html)

  assert.ok(html.includes("\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044e \u0438 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044e"))
  assert.ok(html.includes("data-catalog-filters-toggle"))
  assert.ok(html.includes("data-catalog-filters-panel"))
  assert.ok(html.includes("rulebook-ability-catalog__filters-toggle-icon"))
  assert.ok(html.includes("Reset"))
  assert.ok(html.includes("\u0421\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0430"))
  assert.ok(html.includes("\u0420\u0430\u043d\u0433"))
  assert.ok(html.includes("\u0427\u0430\u0441\u0442\u043e\u0442\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f"))
  assert.ok(html.includes("\u041d\u0430\u0432\u044b\u043a"))
  assert.ok(html.includes("\u0426\u0435\u043d\u0430 \u0432 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f\u0445"))
  assert.ok(html.includes("\u0426\u0435\u043d\u0430 \u0432 \u043a\u0440\u0435\u0434\u0438\u0442\u0430\u0445"))
  assert.ok(html.includes("\u0413\u0440\u0430\u0432\u0438\u0442\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439 \u043a\u043e\u043b\u043b\u0430\u043f\u0441"))
  assert.ok(html.includes("\u0418\u0441\u043a\u0440\u0430-30"))
  assert.ok(html.includes("data-catalog-count"))
  assert.ok(html.includes('data-filter-dropdown="sort"'))
  assert.ok(html.includes('data-filter-dropdown="rank"'))
  assert.ok(html.includes('data-filter-dropdown="frequency"'))
  assert.ok(html.includes('data-filter-dropdown="skill"'))
  assert.ok(html.includes('data-filter-dropdown="actions"'))
  assert.ok(html.includes('data-filter-dropdown="credits"'))
  assert.ok(html.includes("%22previewDescription%22"))
  assert.ok(html.includes("%22fullDescription%22"))
  assert.notEqual(headerBlock, "")
  assert.notEqual(firstSummaryRow, "")
  assert.ok(
    headerBlock.indexOf("\u0420\u0430\u043d\u0433") <
      headerBlock.indexOf("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435") &&
      headerBlock.indexOf("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435") <
        headerBlock.indexOf("\u0426\u0435\u043d\u0430") &&
      headerBlock.indexOf("\u0426\u0435\u043d\u0430") < headerBlock.indexOf("\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"),
  )
  assert.ok(firstSummaryRow.includes('data-entry-summary="ability-1"'))
  assert.ok(firstSummaryRow.includes('data-column="rank"'))
  assert.ok(firstSummaryRow.includes('data-column="name"'))
  assert.ok(firstSummaryRow.includes('data-column="price"'))
  assert.ok(firstSummaryRow.includes('data-column="description"'))
  assert.ok(firstSummaryRow.includes("rulebook-ability-catalog__name-block"))
  assert.ok(firstSummaryRow.includes("rulebook-ability-catalog__meta-chips"))
  assert.ok(firstSummaryRow.includes("\u003e1/\u0441\u0446\u0435\u043d\u0443\u003c"))
  assert.ok(firstSummaryRow.includes("\u003e\u041a\u0438\u043d\u0435\u0442\u0438\u043a\u0430\u003c"))
  assert.ok(firstSummaryRow.includes("\u003e400 \u043a\u0440\u003c"))
  assert.ok(firstSummaryRow.includes(preview))
  assert.ok(!firstSummaryRow.includes(full))
  assert.ok(firstSummaryRow.includes("rulebook-ability-catalog__toggle-indicator"))
  assert.ok(firstSummaryRow.includes("rulebook-ability-catalog__toggle-icon"))
  assert.ok(!firstSummaryRow.includes('data-column="frequency"'))
  assert.ok(html.includes('data-entry-detail="ability-1"'))
  assert.ok(html.includes(full))
  assert.ok(html.includes("hidden"))
})

test("buildAbilityCatalogHtml normalizes filter values and exposes the full dropdown dictionaries", () => {
  const html = buildAbilityCatalogHtml(singleDescriptionHeaders, [
    [
      "\u0421\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u043d\u044b\u0439 \u0433\u043e\u043b\u043e\u0434",
      "2",
      "\u0414\u0432\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f: \u0443\u043a\u0430\u0436\u0438 \u0446\u0435\u043b\u044c \u0432 30 \u043c. \u0410\u0442\u0430\u043a\u0430 \u041a\u0438\u043d\u0435\u0442\u0438\u043a\u0438 +1 \u043f\u0440\u043e\u0442\u0438\u0432 \u0424\u0417. \u041e\u0434\u043d\u043e\u0440\u0430\u0437\u043e\u0432\u043e\u0435.",
      "",
      "",
      "",
      "320",
    ],
  ])

  const rankStart = html.indexOf('data-filter-dropdown="rank"')
  const frequencyStart = html.indexOf('data-filter-dropdown="frequency"')
  const skillStart = html.indexOf('data-filter-dropdown="skill"')
  const actionsStart = html.indexOf('data-filter-dropdown="actions"')
  const creditsStart = html.indexOf('data-filter-dropdown="credits"')

  const rankBlock = html.slice(rankStart, frequencyStart)
  const frequencyBlock = html.slice(frequencyStart, skillStart)
  const skillBlock = html.slice(skillStart, actionsStart)
  const actionsBlock = html.slice(actionsStart, creditsStart)

  assert.ok(!frequencyBlock.includes("\u041e\u0434\u043d\u043e\u0440\u0430\u0437"))
  assert.ok(frequencyBlock.includes("1/\u0441\u0446\u0435\u043d\u0443"))
  assert.ok(frequencyBlock.includes("1/\u0441\u0435\u0441\u0441\u0438\u044e"))
  assert.ok(frequencyBlock.includes("\u041d\u0435\u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u043d\u043e"))
  assert.ok(skillBlock.includes("\u041a\u0438\u043d\u0435\u0442\u0438\u043a\u0430"))
  assert.ok(skillBlock.includes("\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435"))
  assert.ok(skillBlock.includes("\u0411\u0435\u0437 \u043d\u0430\u0432\u044b\u043a\u0430"))
  assert.ok(rankBlock.includes('value="4"'))
  assert.ok(actionsBlock.includes('value="\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435"'))
  assert.ok(actionsBlock.includes('value="\u041c\u0430\u043d\u0435\u0432\u0440"'))
  assert.ok(actionsBlock.includes('value="\u0420\u0435\u0430\u043a\u0446\u0438\u044f"'))
  assert.ok(actionsBlock.includes('value="\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u0435"'))
  assert.ok(html.includes("\u003e1/\u0441\u0446\u0435\u043d\u0443\u003c"))
})

test("buildAbilityCatalogHtml keeps backward compatibility by deriving preview from the legacy description column", () => {
  const description =
    "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435: \u0441\u043e\u0437\u0434\u0430\u0435\u0442 \u0434\u043b\u0438\u043d\u043d\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0441 \u043c\u043d\u043e\u0433\u0438\u043c\u0438 \u0434\u0435\u0442\u0430\u043b\u044f\u043c\u0438 \u0438 \u043f\u043e\u044f\u0441\u043d\u0435\u043d\u0438\u044f\u043c\u0438, \u043a\u043e\u0442\u043e\u0440\u043e\u0435 \u043d\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u0446\u0435\u043b\u0438\u043a\u043e\u043c \u043f\u043e\u043c\u0435\u0449\u0430\u0442\u044c\u0441\u044f \u0432 \u043a\u043e\u043c\u043f\u0430\u043a\u0442\u043d\u0443\u044e \u0441\u0442\u0440\u043e\u043a\u0443 \u0442\u0430\u0431\u043b\u0438\u0446\u044b \u0431\u0435\u0437 \u0441\u043e\u043a\u0440\u0430\u0449\u0435\u043d\u0438\u044f."
  const html = buildAbilityCatalogHtml(singleDescriptionHeaders, [["Alpha", "2", description, "", "", "", "400"]])
  const firstSummaryRow = getFirstSummaryRow(html)

  assert.notEqual(firstSummaryRow, "")
  assert.ok(firstSummaryRow.includes("\u2026"))
  assert.ok(!firstSummaryRow.includes("\u0431\u0435\u0437 \u0441\u043e\u043a\u0440\u0430\u0449\u0435\u043d\u0438\u044f."))
  assert.ok(html.includes(description))
})

test("buildRulebookCatalogHtml renders weapon filters and weapon tags", () => {
  const html = buildRulebookCatalogHtml("weapons", weaponHeaders, [
    ["Стрелковое", "Игла", "780", "2", "Стрельба", "+4", "Точная снайперская винтовка с бесшумным выстрелом."],
  ])
  const firstSummaryRow = getFirstSummaryRow(html)

  assert.ok(html.includes('data-filter-dropdown="rank"'))
  assert.ok(html.includes('data-filter-dropdown="skill"'))
  assert.ok(html.includes('data-filter-dropdown="damage"'))
  assert.ok(!html.includes('data-filter-dropdown="actions"'))
  assert.ok(!html.includes('data-filter-dropdown="price"'))
  assert.ok(firstSummaryRow.includes(">Стрельба<"))
  assert.ok(firstSummaryRow.includes(">+4<"))
  assert.ok(firstSummaryRow.includes(">780 кр<"))
})

test.skip("buildRulebookCatalogHtml renders armor defense tags and filters from the armor description", () => {
  const html = buildRulebookCatalogHtml("armor", simplePriceHeaders, [
    ["ОЗК", "1", "Облегченная броня. ФЗ 3, МЗ 4, ПЗ 2", "100"],
  ])
  const firstSummaryRow = getFirstSummaryRow(html)

  assert.ok(html.includes('data-filter-dropdown="rank"'))
  assert.ok(html.includes('data-filter-dropdown="physicalDefense"'))
  assert.ok(html.includes('data-filter-dropdown="magicalDefense"'))
  assert.ok(html.includes('data-filter-dropdown="psychicDefense"'))
  assert.ok(firstSummaryRow.includes(">ФЗ 3<"))
  assert.ok(firstSummaryRow.includes(">МЗ 4<"))
  assert.ok(firstSummaryRow.includes(">ПЗ 2<"))
})

test("buildRulebookCatalogHtml renders equipment as the same table shape without tags", () => {
  const html = buildRulebookCatalogHtml("equipment", simplePriceHeaders, [
    ["Керезников", "1", "Ускоритель реакции для пользователя.", "160"],
  ])
  const firstSummaryRow = getFirstSummaryRow(html)

  assert.ok(html.includes('data-filter-dropdown="rank"'))
  assert.ok(!html.includes('data-filter-dropdown="skill"'))
  assert.ok(!html.includes('data-filter-dropdown="physicalDefense"'))
  assert.ok(!firstSummaryRow.includes("rulebook-ability-catalog__meta-chips"))
  assert.ok(firstSummaryRow.includes(">160 кр<"))
})

test("buildRulebookCatalogHtml renders merged equipment with skill tags and a 'Без навыка' filter option", () => {
  const html = buildRulebookCatalogHtml("equipment", combinedEquipmentHeaders, [
    ["Имплант", "Керезников", "1", "", "", "Ускоритель реакции для пользователя.", "160"],
    ["Стрелковое", "Игла", "2", "Стрельба", "4", "Точная снайперская винтовка.", "780"],
  ])
  const summaryRows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)]
    .map((match) => match[0])
    .filter((row) => row.includes('class="rulebook-ability-catalog__summary-row"'))

  assert.equal(summaryRows.length, 2)
  assert.ok(html.includes('data-filter-dropdown="rank"'))
  assert.ok(html.includes('data-filter-dropdown="skill"'))
  assert.ok(!html.includes('data-filter-dropdown="damage"'))
  assert.ok(html.includes('value="Без навыка"'))
  assert.ok(!summaryRows[0].includes("rulebook-ability-catalog__meta-chips"))
  assert.ok(summaryRows[1].includes(">Стрельба<"))
  assert.ok(summaryRows[1].includes(">4<"))
})
