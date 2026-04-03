import { Root, Content, List, ListItem, Table, TableCell } from "mdast"
import { toString } from "mdast-util-to-string"
import { QuartzTransformerPlugin } from "../types"
import { FullSlug, transformLink } from "../../util/path"
import {
  buildAbilityCatalogHtml as buildAbilityCatalogHtmlImpl,
  buildRulebookCatalogHtml,
  detectRulebookCatalogKind,
  isAbilityCatalogTable as isAbilityCatalogTableImpl,
} from "./rulebookCatalog"

export { buildRulebookCatalogHtml, detectRulebookCatalogKind } from "./rulebookCatalog"

const cardsDirective = ":::cards"
const closingDirective = ":::"
const abilityCatalogClass = "rulebook-ability-catalog"

type AbilityCatalogField =
  | "name"
  | "rank"
  | "description"
  | "previewDescription"
  | "fullDescription"
  | "frequency"
  | "skill"
  | "credits"
  | "actions"

type AbilityCatalogColumns = {
  name: number
  rank: number
  frequency: number
  skill: number
  credits: number
  actions: number
  description?: number
  previewDescription?: number
  fullDescription?: number
}
type AbilityCatalogFilterField = "rank" | "frequency" | "skill" | "actions"
type AbilityCatalogSortValue =
  | "title-asc"
  | "rank-asc"
  | "credits-asc"
  | "actions-asc"
  | "frequency-desc"

type AbilityCatalogEntry = {
  id: string
  name: string
  rank: string
  previewDescription: string
  fullDescription: string
  frequency: string
  skill: string
  credits: string
  actions: string
  rankSort: number
  frequencySort: number
  creditsSort: number
  actionsSort: number
}

const abilityCatalogHeaderAliases: Record<AbilityCatalogField, string[]> = {
  name: ["название"],
  rank: ["ранг"],
  description: ["описание"],
  previewDescription: ["краткое описание"],
  fullDescription: ["полное описание"],
  frequency: ["частота использования", "частота"],
  skill: ["навык", "используемый навык"],
  credits: ["цена", "цена:", "цена в кредитах"],
  actions: ["цена в действиях", "действие для активации", "действия"],
}

const abilityCatalogRankOptions = ["1", "2", "3", "4"]
const abilityCatalogFrequencyOptions = ["Неограниченно", "1/сцену", "1/сессию"]
const abilityCatalogActionOptions = ["Основное", "Маневр", "Реакция", "Свободное"]
const abilityCatalogSkillOptions = [
  "Анализ",
  "Бионика",
  "Ближний бой",
  "Доминирование",
  "Инженерия",
  "Ловкость",
  "Мощь",
  "Наблюдательность",
  "Обаяние",
  "Программирование",
  "Резонанс",
  "Сокрытие",
  "Стрельба",
]
const abilityCatalogSortOptions: Array<{ value: AbilityCatalogSortValue; label: string }> = [
  { value: "title-asc", label: "По названию" },
  { value: "rank-asc", label: "По рангу" },
  { value: "credits-asc", label: "По цене в кредитах" },
  { value: "actions-asc", label: "По цене в действиях" },
  { value: "frequency-desc", label: "По частоте" },
]

function isFence(line: string) {
  return line.trimStart().startsWith("```")
}

function quoteLines(lines: string[]) {
  if (lines.length === 0) {
    return [">"]
  }

  return lines.map((line) => (line.length === 0 ? ">" : `> ${line}`))
}

function renderSummaryCallout(bodyLines: string[]) {
  return ["> [!summary|rulebook-summary] Кратко", ...quoteLines(bodyLines), ""].join("\n")
}

function renderAccordionCallout(title: string, meta: string | undefined, bodyLines: string[]) {
  const metadata = meta?.trim()
  const marker = metadata ? `> [!note|${metadata}]- ${title}` : `> [!note]- ${title}`
  return [marker, ...quoteLines(bodyLines), ""].join("\n")
}

function transformCalloutDirectives(src: string) {
  const lines = src.split(/\r?\n/)
  const output: string[] = []
  let inFence = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

    if (isFence(line)) {
      inFence = !inFence
      output.push(line)
      continue
    }

    if (inFence) {
      output.push(line)
      continue
    }

    if (line.trim() === ":::summary") {
      const body: string[] = []
      for (index += 1; index < lines.length; index++) {
        if (lines[index].trim() === closingDirective) {
          break
        }
        body.push(lines[index])
      }

      output.push(renderSummaryCallout(body))
      continue
    }

    const accordionMatch = line
      .trim()
      .match(/^:::accordion\s+"([^"]+)"(?:\s*\|\s*(.+))?\s*$/)
    if (accordionMatch) {
      const [, title, meta] = accordionMatch
      const body: string[] = []
      for (index += 1; index < lines.length; index++) {
        if (lines[index].trim() === closingDirective) {
          break
        }
        body.push(lines[index])
      }

      output.push(renderAccordionCallout(title, meta, body))
      continue
    }

    output.push(line)
  }

  return output.join("\n")
}

function isDirectiveNode(node: Content, marker: string) {
  return node.type === "paragraph" && toString(node).trim() === marker
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function normalizeHeaderLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*:\s*$/g, "")
}

function normalizeCatalogValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function parseCatalogNumber(value: string, emptyFallback = Number.MAX_SAFE_INTEGER) {
  const normalized = value.replace(",", ".")
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : emptyFallback
}

function getFrequencySortValue(value: string) {
  switch (normalizeFrequencyLabel(value)) {
    case "Неограниченно":
      return 3
    case "1/сцену":
      return 2
    case "1/сессию":
      return 1
    default:
      return 0
  }
}

function getActionSortValue(value: string) {
  switch (normalizeActionLabel(value)) {
    case "Основное":
      return 1
    case "Маневр":
      return 2
    case "Реакция":
      return 3
    case "Свободное":
      return 4
    default:
      return parseCatalogNumber(value)
  }
}

function normalizeFrequencyLabel(value: string) {
  const normalized = normalizeCatalogValue(value)
  if (!normalized) return ""

  if (normalized.includes("неогранич") || normalized.includes("многораз")) {
    return "Неограниченно"
  }

  if (normalized.includes("1/сцен") || normalized.includes("однораз")) {
    return "1/сцену"
  }

  if (normalized.includes("1/сесс")) {
    return "1/сессию"
  }

  return ""
}

function deriveFrequencyLabel(description: string) {
  return normalizeFrequencyLabel(description)
}

function normalizeActionLabel(value: string) {
  const normalized = normalizeCatalogValue(value)
  if (!normalized) return ""

  if (normalized === "r" || normalized.includes("реак")) return "Реакция"
  if (normalized === "0" || normalized.includes("свобод")) return "Свободное"
  if (
    normalized === "2" ||
    normalized === "3" ||
    normalized.includes("два действия") ||
    normalized.includes("двумя действиями") ||
    normalized.includes("три действия") ||
    normalized.includes("тремя действиями") ||
    normalized.includes("маневр")
  ) {
    return "Маневр"
  }
  if (normalized === "1" || normalized.startsWith("действие") || normalized.includes("основное")) {
    return "Основное"
  }

  return ""
}

function deriveActionLabel(description: string) {
  const normalized = normalizeCatalogValue(description)

  if (normalized.startsWith("реакция")) return "Реакция"
  if (normalized.startsWith("свободное действие")) return "Свободное"
  if (normalized.startsWith("три действия") || normalized.startsWith("два действия")) return "Маневр"
  if (normalized.startsWith("действие")) return "Основное"
  return ""
}

function deriveSkillLabel(description: string) {
  const normalized = normalizeCatalogValue(description)
  const patterns: Array<[string[], string]> = [
    [["атака кинетики", "проверка кинетики"], "Кинетика"],
    [["атака стихийности", "проверка стихийности"], "Стихийность"],
    [["атака псионики", "проверка псионики"], "Псионика"],
    [["атака биомантии", "проверка биомантии"], "Биомантия"],
    [["атака предвидения", "проверка предвидения"], "Предвидение"],
    [["атака тела", "проверка тела"], "Тело"],
    [["атака ближнего боя", "проверка ближнего боя"], "Ближний бой"],
  ]

  for (const [candidates, value] of patterns) {
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      return value
    }
  }

  return ""
}

function buildDescriptionPreview(description: string, maxLength = 110) {
  const normalized = description.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return ""
  }

  const sentenceMatch = normalized.match(new RegExp(`^(.{1,${maxLength}}?[.!?](?=\\s|$))`, "u"))
  if (sentenceMatch && sentenceMatch[1].length >= 40) {
    return sentenceMatch[1]
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  let preview = normalized.slice(0, maxLength - 1)
  const lastSpace = preview.lastIndexOf(" ")
  if (lastSpace >= Math.floor(maxLength * 0.6)) {
    preview = preview.slice(0, lastSpace)
  }

  return `${preview.trimEnd()}…`
}

function resolveAbilityCatalogColumns(headers: string[]): AbilityCatalogColumns | null {
  const normalizedHeaders = headers.map(normalizeHeaderLabel)
  const findColumn = (aliases: string[]) =>
    normalizedHeaders.findIndex((header) => aliases.some((alias) => header === alias))

  const columns: AbilityCatalogColumns = {
    name: findColumn(abilityCatalogHeaderAliases.name),
    rank: findColumn(abilityCatalogHeaderAliases.rank),
    frequency: findColumn(abilityCatalogHeaderAliases.frequency),
    skill: findColumn(abilityCatalogHeaderAliases.skill),
    credits: findColumn(abilityCatalogHeaderAliases.credits),
    actions: findColumn(abilityCatalogHeaderAliases.actions),
  }

  if (Object.values(columns).some((columnIndex) => columnIndex === -1)) {
    return null
  }

  const description = findColumn(abilityCatalogHeaderAliases.description)
  const previewDescription = findColumn(abilityCatalogHeaderAliases.previewDescription)
  const fullDescription = findColumn(abilityCatalogHeaderAliases.fullDescription)

  if (description !== -1) {
    columns.description = description
  }
  if (previewDescription !== -1) {
    columns.previewDescription = previewDescription
  }
  if (fullDescription !== -1) {
    columns.fullDescription = fullDescription
  }

  if (
    columns.description === undefined &&
    columns.previewDescription === undefined &&
    columns.fullDescription === undefined
  ) {
    return null
  }

  return columns
}

export function isAbilityCatalogTable(headers: string[]) {
  return isAbilityCatalogTableImpl(headers)
}

function readTableCell(cell: TableCell | undefined) {
  if (!cell) {
    return ""
  }

  return toString(cell).replace(/\s+/g, " ").trim()
}

function collectTableRows(table: Table) {
  return table.children.map((row) => row.children.map((cell) => readTableCell(cell)))
}

export function buildAbilityCatalogEntries(headers: string[], rows: string[][]): AbilityCatalogEntry[] {
  const columns = resolveAbilityCatalogColumns(headers)
  if (!columns) {
    return []
  }

  return rows.map((row, index) => {
    const legacyDescription =
      columns.description !== undefined ? (row[columns.description] ?? "").trim() : ""
    const rawPreviewDescription =
      columns.previewDescription !== undefined ? (row[columns.previewDescription] ?? "").trim() : ""
    const rawFullDescription =
      columns.fullDescription !== undefined ? (row[columns.fullDescription] ?? "").trim() : ""
    const fullDescription = rawFullDescription || legacyDescription || rawPreviewDescription
    const previewSource = legacyDescription || fullDescription
    const previewDescription = rawPreviewDescription || buildDescriptionPreview(previewSource)
    const frequency =
      normalizeFrequencyLabel((row[columns.frequency] ?? "").trim()) ||
      deriveFrequencyLabel(fullDescription)
    const skill = (row[columns.skill] ?? "").trim() || deriveSkillLabel(fullDescription)
    const actions =
      normalizeActionLabel((row[columns.actions] ?? "").trim()) || deriveActionLabel(fullDescription)
    const credits = (row[columns.credits] ?? "").trim()
    const rank = (row[columns.rank] ?? "").trim()
    const name = (row[columns.name] ?? "").trim()

    return {
      id: `ability-${index + 1}`,
      name,
      rank,
      previewDescription,
      fullDescription,
      frequency,
      skill,
      credits,
      actions,
      rankSort: parseCatalogNumber(rank),
      frequencySort: getFrequencySortValue(frequency),
      creditsSort: parseCatalogNumber(credits),
      actionsSort: getActionSortValue(actions),
    }
  })
}

function renderAbilityCatalogValue(value: string) {
  return value ? escapeHtml(value) : "—"
}

function renderAbilityCatalogPrice(value: string) {
  return value ? `${escapeHtml(value)} кр` : "—"
}

function renderAbilityCatalogMetaChips(entry: AbilityCatalogEntry) {
  const values = [entry.frequency, entry.skill].filter(Boolean)
  if (values.length === 0) {
    return ""
  }

  return `
    <div class="${abilityCatalogClass}__meta-chips">
      ${values
        .map(
          (value) => `
            <span class="${abilityCatalogClass}__meta-chip">${escapeHtml(value)}</span>
          `,
        )
        .join("")}
    </div>
  `
}

function renderAbilityCatalogChevronIcon(className: string) {
  return `
    <svg
      class="${className}"
      viewBox="0 0 16 16"
      focusable="false"
    >
      <path
        d="M4 6.25 8 10.25 12 6.25"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      />
    </svg>
  `
}

function renderAbilityCatalogToggleIndicator() {
  return `
    <span class="${abilityCatalogClass}__toggle-indicator" aria-hidden="true">
      ${renderAbilityCatalogChevronIcon(`${abilityCatalogClass}__toggle-icon`)}
    </span>
  `
}

export function serializeAbilityCatalogData(entries: AbilityCatalogEntry[]) {
  return encodeURIComponent(JSON.stringify(entries))
}

function sortCatalogValues(values: string[], field: AbilityCatalogField) {
  const uniqueValues = [...new Set(values.filter(Boolean))]

  if (field === "rank") {
    return uniqueValues.sort((left, right) => parseCatalogNumber(left, 0) - parseCatalogNumber(right, 0))
  }

  if (field === "credits" || field === "actions") {
    return uniqueValues.sort((left, right) => parseCatalogNumber(left, 0) - parseCatalogNumber(right, 0))
  }

  if (field === "frequency") {
    return uniqueValues.sort((left, right) => getFrequencySortValue(right) - getFrequencySortValue(left))
  }

  return uniqueValues.sort((left, right) => left.localeCompare(right, "ru"))
}

function buildAbilityCatalogSkillValues(entries: AbilityCatalogEntry[]) {
  return sortCatalogValues([...abilityCatalogSkillOptions, ...entries.map((entry) => entry.skill)], "skill")
}

function renderAbilityCatalogDropdownTrigger(label: string) {
  return `
    <button
      type="button"
      class="${abilityCatalogClass}__dropdown-trigger"
      data-dropdown-trigger
      aria-expanded="false"
    >
      <span class="${abilityCatalogClass}__dropdown-trigger-label" data-dropdown-label>${escapeHtml(label)}</span>
      ${renderAbilityCatalogChevronIcon(`${abilityCatalogClass}__dropdown-icon`)}
    </button>
  `
}

function renderAbilityCatalogFilterDropdown(
  label: string,
  field: AbilityCatalogFilterField,
  values: string[],
) {
  if (values.length === 0) {
    return ""
  }

  return `
    <div class="${abilityCatalogClass}__filter-group ${abilityCatalogClass}__dropdown-group" data-filter-dropdown="${field}">
      <span class="${abilityCatalogClass}__filter-label">${escapeHtml(label)}</span>
      ${renderAbilityCatalogDropdownTrigger("Все")}
      <div class="${abilityCatalogClass}__dropdown-menu" data-dropdown-menu hidden>
        ${values
          .map(
            (value) => `
              <label class="${abilityCatalogClass}__dropdown-option">
                <input
                  type="checkbox"
                  class="${abilityCatalogClass}__dropdown-checkbox"
                  data-filter-field="${field}"
                  value="${escapeHtml(value)}"
                />
                <span class="${abilityCatalogClass}__dropdown-option-label">
                  ${escapeHtml(value)}
                </span>
              </label>
            `,
          )
          .join("")}
      </div>
    </div>
  `
}

function renderAbilityCatalogSortDropdown() {
  const activeLabel = abilityCatalogSortOptions[0]?.label ?? ""

  return `
    <div class="${abilityCatalogClass}__filter-group ${abilityCatalogClass}__dropdown-group" data-filter-dropdown="sort">
      <span class="${abilityCatalogClass}__filter-label">Сортировка</span>
      <input type="hidden" value="title-asc" data-catalog-sort />
      ${renderAbilityCatalogDropdownTrigger(activeLabel)}
      <div class="${abilityCatalogClass}__dropdown-menu" data-dropdown-menu hidden>
        ${abilityCatalogSortOptions
          .map(
            (option, index) => `
              <button
                type="button"
                class="${abilityCatalogClass}__dropdown-option ${abilityCatalogClass}__dropdown-option--button${
                  index === 0 ? " is-active" : ""
                }"
                data-sort-option
                data-sort-value="${option.value}"
                aria-pressed="${index === 0 ? "true" : "false"}"
              >
                <span class="${abilityCatalogClass}__dropdown-option-label">
                  ${escapeHtml(option.label)}
                </span>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `
}

function renderAbilityCatalogCreditsDropdown() {
  return `
    <div class="${abilityCatalogClass}__filter-group ${abilityCatalogClass}__dropdown-group" data-filter-dropdown="credits">
      <span class="${abilityCatalogClass}__filter-label">Цена в кредитах</span>
      ${renderAbilityCatalogDropdownTrigger("Все")}
      <div class="${abilityCatalogClass}__dropdown-menu ${abilityCatalogClass}__dropdown-menu--credits" data-dropdown-menu hidden>
        <label class="${abilityCatalogClass}__credits-field">
          <span class="${abilityCatalogClass}__credits-label">От</span>
          <input
            type="number"
            inputmode="numeric"
            placeholder="0"
            data-catalog-credits-min
          />
        </label>
        <label class="${abilityCatalogClass}__credits-field">
          <span class="${abilityCatalogClass}__credits-label">До</span>
          <input
            type="number"
            inputmode="numeric"
            placeholder="0"
            data-catalog-credits-max
          />
        </label>
      </div>
    </div>
  `
}

export function renderAbilityCatalogToolbar(entriesCount: number) {
  return `
    <div class="${abilityCatalogClass}__toolbar">
      <label class="${abilityCatalogClass}__search-shell">
        <span class="${abilityCatalogClass}__search-icon" aria-hidden="true">⌕</span>
        <input type="search" placeholder="Поиск по названию и описанию" data-catalog-search />
      </label>
      <button
        type="button"
        class="${abilityCatalogClass}__filters-toggle"
        data-catalog-filters-toggle
        aria-expanded="false"
      >
        <span class="${abilityCatalogClass}__filters-toggle-label">Фильтры</span>
        ${renderAbilityCatalogChevronIcon(`${abilityCatalogClass}__filters-toggle-icon`)}
      </button>
      <button type="button" class="${abilityCatalogClass}__reset" data-catalog-reset>
        Reset
      </button>
      <p class="${abilityCatalogClass}__count" data-catalog-count>
        Показано: ${entriesCount}
      </p>
    </div>
  `
}

export function renderAbilityCatalogFiltersPanel(entries: AbilityCatalogEntry[]) {
  const ranks = abilityCatalogRankOptions
  const frequencies = abilityCatalogFrequencyOptions
  const skills = buildAbilityCatalogSkillValues(entries)
  const actions = abilityCatalogActionOptions

  return `
    <div class="${abilityCatalogClass}__filters-panel" data-catalog-filters-panel hidden>
      <div class="${abilityCatalogClass}__filters-grid">
        ${renderAbilityCatalogSortDropdown()}
        ${renderAbilityCatalogFilterDropdown("Ранг", "rank", ranks)}
        ${renderAbilityCatalogFilterDropdown("Частота использования", "frequency", frequencies)}
        ${renderAbilityCatalogFilterDropdown("Навык", "skill", skills)}
        ${renderAbilityCatalogFilterDropdown("Цена в действиях", "actions", actions)}
        ${renderAbilityCatalogCreditsDropdown()}
      </div>
    </div>
  `
}

export function renderAbilityCatalogRows(entries: AbilityCatalogEntry[], expandedEntries = new Set<string>()) {
  return entries
    .map(
      (entry) => `
        <tr
          class="${abilityCatalogClass}__summary-row${expandedEntries.has(entry.id) ? " is-expanded" : ""}"
          data-entry-summary="${entry.id}"
          data-entry-expanded="${expandedEntries.has(entry.id) ? "true" : "false"}"
          tabindex="0"
        >
          <td data-column="rank">${renderAbilityCatalogValue(entry.rank)}</td>
          <td data-column="name">
            <div class="${abilityCatalogClass}__name-block">
              <strong>${escapeHtml(entry.name)}</strong>
              ${renderAbilityCatalogMetaChips(entry)}
            </div>
          </td>
          <td data-column="price">${renderAbilityCatalogPrice(entry.credits)}</td>
          <td data-column="description">
            <div class="${abilityCatalogClass}__description-cell">
              <p class="${abilityCatalogClass}__description-preview">${renderAbilityCatalogValue(entry.previewDescription)}</p>
              ${renderAbilityCatalogToggleIndicator()}
            </div>
          </td>
        </tr>
        <tr class="${abilityCatalogClass}__detail-row${expandedEntries.has(entry.id) ? " is-expanded" : ""}" data-entry-detail="${entry.id}" ${
          expandedEntries.has(entry.id) ? "" : "hidden"
        }>
          <td colspan="4">
            <div class="${abilityCatalogClass}__detail-body">
              <span class="${abilityCatalogClass}__detail-label">Описание</span>
              <p>${renderAbilityCatalogValue(entry.fullDescription)}</p>
            </div>
          </td>
        </tr>
      `,
    )
    .join("")
}

export function buildAbilityCatalogHtml(headers: string[], rows: string[][]) {
  return buildAbilityCatalogHtmlImpl(headers, rows)
}

function parseCardLink(raw: string) {
  const internal = raw.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/)
  if (internal) {
    return {
      href: internal[1],
      title: internal[2] ?? internal[1],
      external: false,
    }
  }

  const markdown = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
  if (markdown) {
    return {
      href: markdown[2],
      title: markdown[1],
      external: /^https?:\/\//i.test(markdown[2]),
    }
  }

  return null
}

function flattenCardItems(nodes: Content[]) {
  return nodes
    .filter((node): node is List => node.type === "list")
    .flatMap((node) => node.children)
}

function renderCardItem(item: ListItem, fileSlug: FullSlug, allSlugs: FullSlug[]) {
  const [firstChild, ...rest] = item.children
  if (!firstChild) {
    return null
  }

  const link = parseCardLink(toString(firstChild).trim())
  if (!link) {
    return null
  }

  const description = rest
    .map((child) => toString(child).trim())
    .filter(Boolean)
    .join(" ")

  const href = link.external
    ? link.href
    : transformLink(fileSlug, link.href, {
        strategy: "shortest",
        allSlugs,
      })

  return `
    <article class="editorial-card">
      <p class="editorial-card-eyebrow">Раздел книги</p>
      <h3><a href="${escapeHtml(String(href))}">${escapeHtml(link.title)}</a></h3>
      <p>${escapeHtml(description)}</p>
      <span class="editorial-card-arrow" aria-hidden="true">→</span>
    </article>
  `
}

function renderCardsGrid(nodes: Content[], fileSlug: FullSlug, allSlugs: FullSlug[]) {
  const cards = flattenCardItems(nodes)
    .map((item) => renderCardItem(item, fileSlug, allSlugs))
    .filter((card): card is string => Boolean(card))

  if (cards.length === 0) {
    return null
  }

  return {
    type: "html",
    value: `<section class="editorial-cards">${cards.join("")}</section>`,
  } as Content
}

function renderAbilityCatalogTable(table: Table, context: { heading?: string; label?: string } = {}) {
  const [headerRow, ...bodyRows] = collectTableRows(table)
  if (!headerRow) {
    return null
  }

  let effectiveHeaderRow = headerRow
  let effectiveBodyRows = bodyRows
  let catalogKind = detectRulebookCatalogKind(effectiveHeaderRow, context)

  if (
    !catalogKind &&
    effectiveBodyRows.length > 0 &&
    effectiveHeaderRow.every((cell) => cell.trim().length === 0)
  ) {
    const promotedHeaderRow = effectiveBodyRows[0]
    const promotedCatalogKind = detectRulebookCatalogKind(promotedHeaderRow, context)
    if (promotedCatalogKind) {
      effectiveHeaderRow = promotedHeaderRow
      effectiveBodyRows = effectiveBodyRows.slice(1)
      catalogKind = promotedCatalogKind
    }
  }

  if (!catalogKind) {
    return null
  }

  return {
    type: "html",
    value:
      catalogKind === "abilities"
        ? buildAbilityCatalogHtml(effectiveHeaderRow, effectiveBodyRows)
        : buildRulebookCatalogHtml(catalogKind, effectiveHeaderRow, effectiveBodyRows),
  } as Content
}

export const RulebookBlocks: QuartzTransformerPlugin = () => {
  return {
    name: "RulebookBlocks",
    textTransform(_ctx, src) {
      return transformCalloutDirectives(src)
    },
    markdownPlugins(ctx) {
      return [
        () => {
          return (tree: Root, file) => {
            const nextChildren: Content[] = []
            let currentHeading = ""
            let previousLabel = ""

            for (let index = 0; index < tree.children.length; index++) {
              const node = tree.children[index]

              if (node.type === "heading") {
                currentHeading = toString(node).trim()
                previousLabel = ""
                nextChildren.push(node)
                continue
              }

              if (node.type === "table") {
                const renderedTable = renderAbilityCatalogTable(node, {
                  heading: currentHeading,
                  label: previousLabel,
                })
                if (renderedTable) {
                  nextChildren.push(renderedTable)
                  continue
                }
              }

              if (!isDirectiveNode(node, cardsDirective)) {
                const textContent = toString(node).trim()
                if (textContent) {
                  previousLabel = textContent
                }
                nextChildren.push(node)
                continue
              }

              const collected: Content[] = []
              let closingIndex = index + 1
              while (closingIndex < tree.children.length) {
                const candidate = tree.children[closingIndex]
                if (isDirectiveNode(candidate, closingDirective)) {
                  break
                }
                collected.push(candidate)
                closingIndex += 1
              }

              if (closingIndex >= tree.children.length) {
                nextChildren.push(node, ...collected)
                break
              }

              const rendered = renderCardsGrid(
                collected,
                file.data.slug!,
                ctx.allSlugs,
              )

              if (rendered) {
                nextChildren.push(rendered)
              } else {
                nextChildren.push(node, ...collected, tree.children[closingIndex])
              }

              index = closingIndex
            }

            tree.children = nextChildren
          }
        },
      ]
    },
  }
}

