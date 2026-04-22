import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { extractSkillTitles } from "../../../scripts/skills-reference-source.mjs"

const abilityCatalogClass = "rulebook-ability-catalog"

export type RulebookCatalogKind = "abilities" | "weapons" | "armor" | "equipment"

type CatalogHeaderField =
  | "name"
  | "rank"
  | "description"
  | "previewDescription"
  | "fullDescription"
  | "frequency"
  | "skill"
  | "credits"
  | "actions"
  | "range"
  | "targets"
  | "area"
  | "defense"
  | "duration"
  | "damage"
  | "shield"
  | "speed"
  | "physicalDefense"
  | "magicalDefense"
  | "psychicDefense"

type DescriptionColumns = {
  description?: number
  previewDescription?: number
  fullDescription?: number
}

type AbilityCatalogColumns = DescriptionColumns & {
  name: number
  rank: number
  frequency: number
  skill: number
  credits: number
  actions: number
  range?: number
  targets?: number
  area?: number
  defense?: number
  duration?: number
}

type WeaponCatalogColumns = DescriptionColumns & {
  name: number
  rank: number
  credits: number
  skill: number
  damage: number
  frequency?: number
  actions?: number
  range?: number
  targets?: number
  area?: number
  defense?: number
  duration?: number
}

type SimpleCatalogColumns = DescriptionColumns & {
  name: number
  rank: number
  credits: number
}

type EquipmentCatalogColumns = SimpleCatalogColumns & {
  skill?: number
  damage?: number
  frequency?: number
  actions?: number
  range?: number
  targets?: number
  area?: number
  defense?: number
  duration?: number
}

type ArmorCatalogColumns = SimpleCatalogColumns & {
  physicalDefense?: number
  magicalDefense?: number
  psychicDefense?: number
  shield?: number
  speed?: number
  frequency?: number
  actions?: number
  duration?: number
}

type RulebookCatalogContext = {
  heading?: string
  label?: string
}

type RulebookCatalogFilterField =
  | "rank"
  | "frequency"
  | "skill"
  | "actions"
  | "damage"
  | "physicalDefense"
  | "magicalDefense"
  | "psychicDefense"

type RulebookCatalogSortOption = {
  value: string
  label: string
  sortKey: string
  direction: "asc" | "desc"
}

type RulebookCatalogFilterDefinition =
  | {
      kind: "multi"
      field: RulebookCatalogFilterField
      label: string
      values: string[]
    }
  | {
      kind: "range"
      field: "credits"
      label: string
      minLabel: string
      maxLabel: string
      unit: string
    }

type CatalogDetailTagKey = keyof typeof detailTagLabels

type CatalogDetailTag = {
  key: CatalogDetailTagKey
  label: string
  value: string
}

type RulebookCatalogEntry = {
  id: string
  name: string
  rank: string
  price: string
  previewDescription: string
  fullDescription: string
  tags: string[]
  detailTags: CatalogDetailTag[]
  filters: Partial<Record<RulebookCatalogFilterField, string>>
  sortValues: Record<string, number>
}

type RulebookCatalogModel = {
  entries: RulebookCatalogEntry[]
  filters: RulebookCatalogFilterDefinition[]
  sortOptions: RulebookCatalogSortOption[]
}

const catalogHeaderAliases: Record<CatalogHeaderField, string[]> = {
  name: ["название"],
  rank: ["ранг"],
  description: ["описание"],
  previewDescription: ["краткое описание"],
  fullDescription: ["полное описание"],
  frequency: ["частота использования", "частота"],
  skill: ["навык", "используемый навык"],
  credits: ["цена", "цена:", "цена в кредитах"],
  actions: ["цена в действиях", "действие для активации", "действия"],
  range: ["дальность", "дистанция"],
  targets: ["цели", "цель"],
  area: ["зона", "область"],
  defense: ["защита"],
  duration: ["длительность"],
  damage: ["урон"],
  shield: ["силовой щит", "щит"],
  speed: ["скорость"],
  physicalDefense: ["физическая защита", "физическая", "фз"],
  magicalDefense: ["магическая защита", "магическая", "мз"],
  psychicDefense: ["психическая защита", "психическая", "пз"],
}

const armorDefenseAliases: Record<
  "physicalDefense" | "magicalDefense" | "psychicDefense",
  string[]
> = {
  physicalDefense: [...catalogHeaderAliases.physicalDefense, "\u0441\u0442\u043e\u0439\u043a\u043e\u0441\u0442\u044c"],
  magicalDefense: [...catalogHeaderAliases.magicalDefense, "\u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c"],
  psychicDefense: [...catalogHeaderAliases.psychicDefense, "\u0432\u043e\u043b\u044f"],
}

const armorDefenseLabels = {
  physicalDefense: "\u0421\u0442\u043e\u0439\u043a\u043e\u0441\u0442\u044c",
  magicalDefense: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c",
  psychicDefense: "\u0412\u043e\u043b\u044f",
} as const

const armorDefenseSortLabels = {
  physicalDefense: "\u0421\u0442\u043e\u0439\u043a\u043e\u0441\u0442\u0438",
  magicalDefense: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044e",
  psychicDefense: "\u0412\u043e\u043b\u0435",
} as const

const detailTagLabels = {
  actions: "Активация",
  range: "Дальность",
  targets: "Цели",
  area: "Зона",
  defense: "Защита",
  duration: "Длительность",
  skill: "Навык",
  frequency: "Частота",
  damage: "Урон",
  shield: "Силовой щит",
  speed: "Скорость",
  physicalDefense: "Стойкость",
  magicalDefense: "Контроль",
  psychicDefense: "Воля",
} as const

const primaryDetailLineOrder: CatalogDetailTagKey[] = [
  "damage",
  "physicalDefense",
  "magicalDefense",
  "psychicDefense",
  "shield",
  "speed",
  "range",
  "targets",
  "area",
  "defense",
]

const secondaryDetailLineOrder: CatalogDetailTagKey[] = [
  "duration",
  "actions",
  "frequency",
  "skill",
]

const rankOptions = ["1", "2", "3", "4"]
const frequencyOptions = ["Неограниченно", "1/сцену", "1/сессию"]
const actionOptions = ["Основное", "Маневр", "Реакция", "Свободное"]
const noSkillLabel = "Без навыка"
const skillSeedValues = [
  "Анализ",
  "Ближний бой",
  "Доминирование",
  "Инженерия",
  "Ловкость",
  "Мистика",
  "Мощь",
  "Наблюдательность",
  "Обаяние",
  "Резонанс",
  "Сокрытие",
  "Стрельба",
  "Хакерство",
]

const rulebookSkillsSourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "Книга правил v0.4",
  "Глава 3. Навыки.md",
)

function loadRulebookSkillSeedValues() {
  try {
    return extractSkillTitles(readFileSync(rulebookSkillsSourcePath, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return skillSeedValues
    }

    throw error
  }
}

const rulebookSkillSeedValues = loadRulebookSkillSeedValues()

const abilitySortOptions: RulebookCatalogSortOption[] = [
  { value: "title-asc", label: "По названию", sortKey: "name", direction: "asc" },
  { value: "rank-asc", label: "По рангу", sortKey: "rank", direction: "asc" },
  { value: "credits-asc", label: "По цене в кредитах", sortKey: "credits", direction: "asc" },
  { value: "actions-asc", label: "По цене в действиях", sortKey: "actions", direction: "asc" },
  { value: "frequency-desc", label: "По частоте", sortKey: "frequency", direction: "desc" },
]

const weaponSortOptions: RulebookCatalogSortOption[] = [
  { value: "title-asc", label: "По названию", sortKey: "name", direction: "asc" },
  { value: "rank-asc", label: "По рангу", sortKey: "rank", direction: "asc" },
  { value: "price-asc", label: "По цене", sortKey: "price", direction: "asc" },
  { value: "damage-desc", label: "По урону", sortKey: "damage", direction: "desc" },
]

const armorSortOptions: RulebookCatalogSortOption[] = [
  { value: "title-asc", label: "По названию", sortKey: "name", direction: "asc" },
  { value: "rank-asc", label: "По рангу", sortKey: "rank", direction: "asc" },
  { value: "price-asc", label: "По цене", sortKey: "price", direction: "asc" },
  { value: "physical-defense-desc", label: "По физической", sortKey: "physicalDefense", direction: "desc" },
  { value: "magical-defense-desc", label: "По магической", sortKey: "magicalDefense", direction: "desc" },
  { value: "psychic-defense-desc", label: "По психической", sortKey: "psychicDefense", direction: "desc" },
]

const equipmentSortOptions: RulebookCatalogSortOption[] = [
  { value: "title-asc", label: "По названию", sortKey: "name", direction: "asc" },
  { value: "rank-asc", label: "По рангу", sortKey: "rank", direction: "asc" },
  { value: "price-asc", label: "По цене", sortKey: "price", direction: "asc" },
]

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

function findColumn(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalizeHeaderLabel)
  return normalizedHeaders.findIndex((header) => aliases.some((alias) => header === alias))
}

function resolveDescriptionColumns(headers: string[]): DescriptionColumns | null {
  const description = findColumn(headers, catalogHeaderAliases.description)
  const previewDescription = findColumn(headers, catalogHeaderAliases.previewDescription)
  const fullDescription = findColumn(headers, catalogHeaderAliases.fullDescription)

  if (description === -1 && previewDescription === -1 && fullDescription === -1) {
    return null
  }

  return {
    description: description === -1 ? undefined : description,
    previewDescription: previewDescription === -1 ? undefined : previewDescription,
    fullDescription: fullDescription === -1 ? undefined : fullDescription,
  }
}

function resolveAbilityCatalogColumns(headers: string[]): AbilityCatalogColumns | null {
  const descriptionColumns = resolveDescriptionColumns(headers)
  if (!descriptionColumns) {
    return null
  }

  const columns: AbilityCatalogColumns = {
    name: findColumn(headers, catalogHeaderAliases.name),
    rank: findColumn(headers, catalogHeaderAliases.rank),
    frequency: findColumn(headers, catalogHeaderAliases.frequency),
    skill: findColumn(headers, catalogHeaderAliases.skill),
    credits: findColumn(headers, catalogHeaderAliases.credits),
    actions: findColumn(headers, catalogHeaderAliases.actions),
    range: findColumn(headers, catalogHeaderAliases.range),
    targets: findColumn(headers, catalogHeaderAliases.targets),
    area: findColumn(headers, catalogHeaderAliases.area),
    defense: findColumn(headers, catalogHeaderAliases.defense),
    duration: findColumn(headers, catalogHeaderAliases.duration),
    ...descriptionColumns,
  }

  if (
    columns.name === -1 ||
    columns.rank === -1 ||
    columns.frequency === -1 ||
    columns.skill === -1 ||
    columns.credits === -1 ||
    columns.actions === -1
  ) {
    return null
  }

  return columns
}

function resolveWeaponCatalogColumns(headers: string[]): WeaponCatalogColumns | null {
  const descriptionColumns = resolveDescriptionColumns(headers)
  if (!descriptionColumns) {
    return null
  }

  const columns: WeaponCatalogColumns = {
    name: findColumn(headers, catalogHeaderAliases.name),
    rank: findColumn(headers, catalogHeaderAliases.rank),
    credits: findColumn(headers, catalogHeaderAliases.credits),
    skill: findColumn(headers, catalogHeaderAliases.skill),
    damage: findColumn(headers, catalogHeaderAliases.damage),
    frequency: findColumn(headers, catalogHeaderAliases.frequency),
    actions: findColumn(headers, catalogHeaderAliases.actions),
    range: findColumn(headers, catalogHeaderAliases.range),
    targets: findColumn(headers, catalogHeaderAliases.targets),
    area: findColumn(headers, catalogHeaderAliases.area),
    defense: findColumn(headers, catalogHeaderAliases.defense),
    duration: findColumn(headers, catalogHeaderAliases.duration),
    ...descriptionColumns,
  }

  if (
    columns.name === -1 ||
    columns.rank === -1 ||
    columns.credits === -1 ||
    columns.skill === -1 ||
    columns.damage === -1
  ) {
    return null
  }

  return columns
}

function resolveSimpleCatalogColumns(headers: string[]): SimpleCatalogColumns | null {
  const descriptionColumns = resolveDescriptionColumns(headers)
  if (!descriptionColumns) {
    return null
  }

  const columns: SimpleCatalogColumns = {
    name: findColumn(headers, catalogHeaderAliases.name),
    rank: findColumn(headers, catalogHeaderAliases.rank),
    credits: findColumn(headers, catalogHeaderAliases.credits),
    ...descriptionColumns,
  }

  if (columns.name === -1 || columns.rank === -1 || columns.credits === -1) {
    return null
  }

  return columns
}

function resolveArmorCatalogColumns(headers: string[]): ArmorCatalogColumns | null {
  const columns = resolveSimpleCatalogColumns(headers)
  if (!columns) {
    return null
  }

  return {
    ...columns,
    physicalDefense: findColumn(headers, armorDefenseAliases.physicalDefense),
    magicalDefense: findColumn(headers, armorDefenseAliases.magicalDefense),
    psychicDefense: findColumn(headers, armorDefenseAliases.psychicDefense),
    shield: findColumn(headers, catalogHeaderAliases.shield),
    speed: findColumn(headers, catalogHeaderAliases.speed),
    frequency: findColumn(headers, catalogHeaderAliases.frequency),
    actions: findColumn(headers, catalogHeaderAliases.actions),
    duration: findColumn(headers, catalogHeaderAliases.duration),
  }
}

function resolveEquipmentCatalogColumns(headers: string[]): EquipmentCatalogColumns | null {
  const columns = resolveSimpleCatalogColumns(headers)
  if (!columns) {
    return null
  }

  return {
    ...columns,
    skill: findColumn(headers, catalogHeaderAliases.skill),
    damage: findColumn(headers, catalogHeaderAliases.damage),
    frequency: findColumn(headers, catalogHeaderAliases.frequency),
    actions: findColumn(headers, catalogHeaderAliases.actions),
    range: findColumn(headers, catalogHeaderAliases.range),
    targets: findColumn(headers, catalogHeaderAliases.targets),
    area: findColumn(headers, catalogHeaderAliases.area),
    defense: findColumn(headers, catalogHeaderAliases.defense),
    duration: findColumn(headers, catalogHeaderAliases.duration),
  }
}

export function isAbilityCatalogTable(headers: string[]) {
  return resolveAbilityCatalogColumns(headers) !== null
}

function isWeaponCatalogTable(headers: string[]) {
  return resolveWeaponCatalogColumns(headers) !== null
}

function isSimpleCatalogTable(headers: string[]) {
  return resolveSimpleCatalogColumns(headers) !== null
}

export function detectRulebookCatalogKind(
  headers: string[],
  context: RulebookCatalogContext = {},
): RulebookCatalogKind | null {
  const contextText = normalizeCatalogValue(`${context.heading ?? ""} ${context.label ?? ""}`)

  if (isAbilityCatalogTable(headers)) {
    return "abilities"
  }

  if (isWeaponCatalogTable(headers)) {
    if (
      contextText.includes("снаряж") ||
      contextText.includes("имплант") ||
      contextText.includes("экип")
    ) {
      return "equipment"
    }

    return "weapons"
  }

  if (!isSimpleCatalogTable(headers)) {
    return null
  }

  if (
    findColumn(headers, armorDefenseAliases.physicalDefense) !== -1 ||
    findColumn(headers, armorDefenseAliases.magicalDefense) !== -1 ||
    findColumn(headers, armorDefenseAliases.psychicDefense) !== -1
  ) {
    return "armor"
  }

  if (contextText.includes("брон")) {
    return "armor"
  }

  if (
    contextText.includes("снаряж") ||
    contextText.includes("имплант") ||
    contextText.includes("экип")
  ) {
    return "equipment"
  }

  return null
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

function normalizeSkillFilterValue(value: string) {
  return value.trim() || noSkillLabel
}

function applyDescriptionCleaner(
  value: string,
  cleaner?: ((description: string) => string) | undefined,
) {
  if (!value || !cleaner) {
    return value.trim()
  }

  const cleaned = cleaner(value).trim()
  return cleaned || value.trim()
}

function buildDescriptions(
  row: string[],
  columns: DescriptionColumns,
  options: { legacyCleaner?: (description: string) => string } = {},
) {
  const legacyDescription =
    columns.description !== undefined ? (row[columns.description] ?? "").trim() : ""
  const rawPreviewDescription =
    columns.previewDescription !== undefined ? (row[columns.previewDescription] ?? "").trim() : ""
  const rawFullDescription =
    columns.fullDescription !== undefined ? (row[columns.fullDescription] ?? "").trim() : ""

  const cleanedLegacyDescription = applyDescriptionCleaner(
    legacyDescription,
    options.legacyCleaner,
  )
  const fullDescription = rawFullDescription || cleanedLegacyDescription || rawPreviewDescription
  const hasExplicitPreviewColumn = columns.previewDescription !== undefined
  const previewSource = rawPreviewDescription || cleanedLegacyDescription || fullDescription
  const previewDescription = hasExplicitPreviewColumn
    ? rawPreviewDescription
    : rawPreviewDescription || buildDescriptionPreview(previewSource)

  return {
    previewDescription,
    fullDescription: fullDescription || previewSource,
  }
}

function extractDefenseValue(value: string, aliases: string[]) {
  if (!value) {
    return ""
  }

  const pattern = new RegExp(`(?:${aliases.join("|")})\\s*[:.]?\\s*([+\\-]?\\d+)`, "iu")
  const match = value.match(pattern)
  return match?.[1] ?? ""
}

function stripArmorDefenseMarkers(description: string) {
  const defensePatterns = [
    /\b(?:\u0424\u0417|\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043a\u0430\u044f(?: \u0437\u0430\u0449\u0438\u0442\u0430)?|\u0421\u0442\u043e\u0439\u043a\u043e\u0441\u0442\u044c)\s*[:.]?\s*[+\-]?\d+\b/giu,
    /\b(?:\u041c\u0417|\u041c\u0430\u0433\u0438\u0447\u0435\u0441\u043a\u0430\u044f(?: \u0437\u0430\u0449\u0438\u0442\u0430)?|\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c)\s*[:.]?\s*[+\-]?\d+\b/giu,
    /\b(?:\u041f\u0417|\u041f\u0441\u0438\u0445\u0438\u0447\u0435\u0441\u043a\u0430\u044f(?: \u0437\u0430\u0449\u0438\u0442\u0430)?|\u0412\u043e\u043b\u044f)\s*[:.]?\s*[+\-]?\d+\b/giu,
  ]

  return defensePatterns
    .reduce((value, pattern) => value.replace(pattern, ""), description)
    .replace(/\s*[,;]\s*[,;]\s*/g, ", ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[,.;:\s]+/g, "")
    .replace(/[,.;:\s]+$/g, "")
}

function readOptionalColumnValue(row: string[], column?: number) {
  if (column === undefined || column === -1) {
    return ""
  }

  return (row[column] ?? "").trim()
}

function buildDetailTags(tags: Array<CatalogDetailTag | null | undefined>) {
  return tags.filter((tag): tag is CatalogDetailTag => Boolean(tag?.value))
}

function createDetailTag(key: CatalogDetailTagKey, value: string) {
  return value ? { key, label: detailTagLabels[key], value } : null
}

function buildOrderedDetailLine(tags: CatalogDetailTag[], order: CatalogDetailTagKey[]) {
  return order
    .map((key) => tags.find((tag) => tag.key === key))
    .filter((tag): tag is CatalogDetailTag => Boolean(tag))
}

function buildDetailFactLines(tags: CatalogDetailTag[], lineSize = 4) {
  const primaryLine = buildOrderedDetailLine(tags, primaryDetailLineOrder)
  const secondaryLine = buildOrderedDetailLine(tags, secondaryDetailLineOrder)
  const groupedKeys = new Set([...primaryDetailLineOrder, ...secondaryDetailLineOrder])
  const remainingTags = tags.filter((tag) => !groupedKeys.has(tag.key))
  const lines = [primaryLine, secondaryLine].filter((line) => line.length > 0)

  for (let index = 0; index < remainingTags.length; index += lineSize) {
    lines.push(remainingTags.slice(index, index + lineSize))
  }

  return lines
}

function sortAlphaValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => {
    if (left === noSkillLabel) {
      return right === noSkillLabel ? 0 : -1
    }

    if (right === noSkillLabel) {
      return 1
    }

    return left.localeCompare(right, "ru")
  })
}

function sortNumericValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort(
    (left, right) => parseCatalogNumber(left, 0) - parseCatalogNumber(right, 0),
  )
}

function sortFrequencyValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort(
    (left, right) => getFrequencySortValue(right) - getFrequencySortValue(left),
  )
}

function sortActionValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort(
    (left, right) => getActionSortValue(left) - getActionSortValue(right),
  )
}

function buildAbilityCatalogModel(headers: string[], rows: string[][]): RulebookCatalogModel {
  const columns = resolveAbilityCatalogColumns(headers)
  if (!columns) {
    return { entries: [], filters: [], sortOptions: abilitySortOptions }
  }

  const entries = rows.map((row, index) => {
    const descriptions = buildDescriptions(row, columns)
    const frequency =
      normalizeFrequencyLabel((row[columns.frequency] ?? "").trim()) ||
      deriveFrequencyLabel(descriptions.fullDescription)
    const skill = (row[columns.skill] ?? "").trim() || deriveSkillLabel(descriptions.fullDescription)
    const actions =
      normalizeActionLabel((row[columns.actions] ?? "").trim()) ||
      deriveActionLabel(descriptions.fullDescription)
    const range = readOptionalColumnValue(row, columns.range)
    const targets = readOptionalColumnValue(row, columns.targets)
    const area = readOptionalColumnValue(row, columns.area)
    const defense = readOptionalColumnValue(row, columns.defense)
    const duration = readOptionalColumnValue(row, columns.duration)
    const price = (row[columns.credits] ?? "").trim()
    const rank = (row[columns.rank] ?? "").trim()
    const name = (row[columns.name] ?? "").trim()

    return {
      id: `ability-${index + 1}`,
      name,
      rank,
      price,
      previewDescription: descriptions.previewDescription,
      fullDescription: descriptions.fullDescription,
      tags: [frequency, skill].filter(Boolean),
      detailTags: buildDetailTags([
        createDetailTag("range", range),
        createDetailTag("targets", targets),
        createDetailTag("area", area),
        createDetailTag("defense", defense),
        createDetailTag("duration", duration),
        createDetailTag("actions", actions),
        createDetailTag("frequency", frequency),
        createDetailTag("skill", skill),
      ]),
      filters: {
        rank,
        frequency,
        skill: normalizeSkillFilterValue(skill),
        actions,
      },
      sortValues: {
        rank: parseCatalogNumber(rank),
        credits: parseCatalogNumber(price),
        actions: getActionSortValue(actions),
        frequency: getFrequencySortValue(frequency),
      },
    } satisfies RulebookCatalogEntry
  })

  return {
    entries,
    filters: [
      { kind: "multi", field: "rank", label: "Ранг", values: rankOptions },
      {
        kind: "multi",
        field: "frequency",
        label: "Частота использования",
        values: sortFrequencyValues([
          ...frequencyOptions,
          ...entries.map((entry) => entry.filters.frequency ?? ""),
        ]),
      },
      {
        kind: "multi",
        field: "skill",
        label: "Навык",
        values: sortAlphaValues([
          noSkillLabel,
          ...rulebookSkillSeedValues,
          ...entries.map((entry) => entry.filters.skill ?? ""),
        ]),
      },
      {
        kind: "multi",
        field: "actions",
        label: "Цена в действиях",
        values: sortActionValues([
          ...actionOptions,
          ...entries.map((entry) => entry.filters.actions ?? ""),
        ]),
      },
      {
        kind: "range",
        field: "credits",
        label: "Цена в кредитах",
        minLabel: "От",
        maxLabel: "До",
        unit: "кр",
      },
    ],
    sortOptions: abilitySortOptions,
  }
}

function buildWeaponCatalogModel(headers: string[], rows: string[][]): RulebookCatalogModel {
  const columns = resolveWeaponCatalogColumns(headers)
  if (!columns) {
    return { entries: [], filters: [], sortOptions: weaponSortOptions }
  }

  const entries = rows.map((row, index) => {
    const descriptions = buildDescriptions(row, columns)
    const rank = (row[columns.rank] ?? "").trim()
    const name = (row[columns.name] ?? "").trim()
    const price = (row[columns.credits] ?? "").trim()
    const skill = (row[columns.skill] ?? "").trim()
    const damage = (row[columns.damage] ?? "").trim()
    const frequency = readOptionalColumnValue(row, columns.frequency)
    const actions = readOptionalColumnValue(row, columns.actions)
    const range = readOptionalColumnValue(row, columns.range)
    const targets = readOptionalColumnValue(row, columns.targets)
    const area = readOptionalColumnValue(row, columns.area)
    const defense = readOptionalColumnValue(row, columns.defense)
    const duration = readOptionalColumnValue(row, columns.duration)

    return {
      id: `weapon-${index + 1}`,
      name,
      rank,
      price,
      previewDescription: descriptions.previewDescription,
      fullDescription: descriptions.fullDescription,
      tags: [skill].filter(Boolean),
      detailTags: buildDetailTags([
        createDetailTag("damage", damage),
        createDetailTag("range", range),
        createDetailTag("targets", targets),
        createDetailTag("area", area),
        createDetailTag("defense", defense),
        createDetailTag("duration", duration),
        createDetailTag("actions", actions),
        createDetailTag("frequency", frequency),
        createDetailTag("skill", skill),
      ]),
      filters: {
        rank,
        skill: normalizeSkillFilterValue(skill),
        damage,
      },
      sortValues: {
        rank: parseCatalogNumber(rank),
        price: parseCatalogNumber(price),
        damage: parseCatalogNumber(damage, 0),
      },
    } satisfies RulebookCatalogEntry
  })

  return {
    entries,
    filters: [
      { kind: "multi", field: "rank", label: "Ранг", values: rankOptions },
      {
        kind: "multi",
        field: "skill",
        label: "Навык",
        values: sortAlphaValues([
          noSkillLabel,
          ...rulebookSkillSeedValues,
          ...entries.map((entry) => entry.filters.skill ?? ""),
        ]),
      },
      {
        kind: "multi",
        field: "damage",
        label: "Урон",
        values: sortNumericValues(entries.map((entry) => entry.filters.damage ?? "")),
      },
    ],
    sortOptions: weaponSortOptions,
  }
}

function buildArmorCatalogModel(headers: string[], rows: string[][]): RulebookCatalogModel {
  const columns = resolveArmorCatalogColumns(headers)
  if (!columns) {
    return { entries: [], filters: [], sortOptions: armorSortOptions }
  }

  const entries = rows.map((row, index) => {
    const rawDescription =
      columns.description !== undefined ? (row[columns.description] ?? "").trim() : ""
    const descriptions = buildDescriptions(row, columns, {
      legacyCleaner: stripArmorDefenseMarkers,
    })
    const defenseSource = rawDescription || descriptions.fullDescription
    const rank = (row[columns.rank] ?? "").trim()
    const name = (row[columns.name] ?? "").trim()
    const price = (row[columns.credits] ?? "").trim()
    const physicalDefense =
      (columns.physicalDefense !== undefined && columns.physicalDefense !== -1
        ? (row[columns.physicalDefense] ?? "").trim()
        : "") || extractDefenseValue(defenseSource, armorDefenseAliases.physicalDefense)
    const magicalDefense =
      (columns.magicalDefense !== undefined && columns.magicalDefense !== -1
        ? (row[columns.magicalDefense] ?? "").trim()
        : "") || extractDefenseValue(defenseSource, armorDefenseAliases.magicalDefense)
    const psychicDefense =
      (columns.psychicDefense !== undefined && columns.psychicDefense !== -1
        ? (row[columns.psychicDefense] ?? "").trim()
        : "") || extractDefenseValue(defenseSource, armorDefenseAliases.psychicDefense)
    const shield = readOptionalColumnValue(row, columns.shield)
    const speed = readOptionalColumnValue(row, columns.speed)
    const frequency = readOptionalColumnValue(row, columns.frequency)
    const actions = readOptionalColumnValue(row, columns.actions)
    const duration = readOptionalColumnValue(row, columns.duration)

    return {
      id: `armor-${index + 1}`,
      name,
      rank,
      price,
      previewDescription: descriptions.previewDescription,
      fullDescription: descriptions.fullDescription,
      tags: [
        physicalDefense ? `ФЗ ${physicalDefense}` : "",
        magicalDefense ? `МЗ ${magicalDefense}` : "",
        psychicDefense ? `ПЗ ${psychicDefense}` : "",
      ].filter(Boolean),
      detailTags: buildDetailTags([
        createDetailTag("physicalDefense", physicalDefense),
        createDetailTag("magicalDefense", magicalDefense),
        createDetailTag("psychicDefense", psychicDefense),
        createDetailTag("shield", shield),
        createDetailTag("speed", speed),
        createDetailTag("duration", duration),
        createDetailTag("actions", actions),
        createDetailTag("frequency", frequency),
      ]),
      filters: {
        rank,
        physicalDefense,
        magicalDefense,
        psychicDefense,
      },
      sortValues: {
        rank: parseCatalogNumber(rank),
        price: parseCatalogNumber(price),
        physicalDefense: parseCatalogNumber(physicalDefense, 0),
        magicalDefense: parseCatalogNumber(magicalDefense, 0),
        psychicDefense: parseCatalogNumber(psychicDefense, 0),
      },
    } satisfies RulebookCatalogEntry
  })

  return {
    entries,
    filters: [
      { kind: "multi", field: "rank", label: "Ранг", values: rankOptions },
      {
        kind: "multi",
        field: "physicalDefense",
        label: "Физическая",
        values: sortNumericValues(entries.map((entry) => entry.filters.physicalDefense ?? "")),
      },
      {
        kind: "multi",
        field: "magicalDefense",
        label: "Магическая",
        values: sortNumericValues(entries.map((entry) => entry.filters.magicalDefense ?? "")),
      },
      {
        kind: "multi",
        field: "psychicDefense",
        label: "Психическая",
        values: sortNumericValues(entries.map((entry) => entry.filters.psychicDefense ?? "")),
      },
    ],
    sortOptions: armorSortOptions,
  }
}

function buildEquipmentCatalogModel(headers: string[], rows: string[][]): RulebookCatalogModel {
  const columns = resolveEquipmentCatalogColumns(headers)
  if (!columns) {
    return { entries: [], filters: [], sortOptions: equipmentSortOptions }
  }

  const entries = rows.map((row, index) => {
    const descriptions = buildDescriptions(row, columns)
    const rank = (row[columns.rank] ?? "").trim()
    const name = (row[columns.name] ?? "").trim()
    const price = (row[columns.credits] ?? "").trim()
    const skill =
      columns.skill !== undefined && columns.skill !== -1
        ? (row[columns.skill] ?? "").trim() || deriveSkillLabel(descriptions.fullDescription)
        : ""
    const damage =
      columns.damage !== undefined && columns.damage !== -1
        ? (row[columns.damage] ?? "").trim()
        : ""
    const frequency = readOptionalColumnValue(row, columns.frequency)
    const actions = readOptionalColumnValue(row, columns.actions)
    const range = readOptionalColumnValue(row, columns.range)
    const targets = readOptionalColumnValue(row, columns.targets)
    const area = readOptionalColumnValue(row, columns.area)
    const defense = readOptionalColumnValue(row, columns.defense)
    const duration = readOptionalColumnValue(row, columns.duration)

    return {
      id: `equipment-${index + 1}`,
      name,
      rank,
      price,
      previewDescription: descriptions.previewDescription,
      fullDescription: descriptions.fullDescription,
      tags: [skill].filter(Boolean),
      detailTags: buildDetailTags([
        createDetailTag("damage", damage),
        createDetailTag("range", range),
        createDetailTag("targets", targets),
        createDetailTag("area", area),
        createDetailTag("defense", defense),
        createDetailTag("duration", duration),
        createDetailTag("actions", actions),
        createDetailTag("frequency", frequency),
        createDetailTag("skill", skill),
      ]),
      filters: {
        rank,
        ...(columns.skill !== undefined && columns.skill !== -1
          ? { skill: normalizeSkillFilterValue(skill) }
          : {}),
      },
      sortValues: {
        rank: parseCatalogNumber(rank),
        price: parseCatalogNumber(price),
        damage: parseCatalogNumber(damage, 0),
      },
    } satisfies RulebookCatalogEntry
  })

  const hasSkillColumn = columns.skill !== undefined && columns.skill !== -1

  return {
    entries,
    filters: [
      { kind: "multi", field: "rank", label: "Ранг", values: rankOptions },
      ...(hasSkillColumn
        ? [
            {
              kind: "multi" as const,
              field: "skill" as const,
              label: "Навык",
              values: sortAlphaValues([
                noSkillLabel,
                ...rulebookSkillSeedValues,
                ...entries.map((entry) => entry.filters.skill ?? ""),
              ]),
            },
          ]
        : []),
    ],
    sortOptions: equipmentSortOptions,
  }
}

function renderCatalogValue(value: string) {
  return value ? escapeHtml(value) : "—"
}

function renderCatalogPrice(value: string) {
  return value ? `${escapeHtml(value)} кр` : "—"
}

function renderCatalogMetaChips(entry: RulebookCatalogEntry) {
  if (entry.tags.length === 0) {
    return ""
  }

  return `
    <div class="${abilityCatalogClass}__meta-chips">
      ${entry.tags
        .map(
          (value) => `
            <span class="${abilityCatalogClass}__meta-chip">${escapeHtml(value)}</span>
          `,
        )
        .join("")}
    </div>
  `
}

function renderCatalogDetailTags(entry: RulebookCatalogEntry) {
  if (entry.detailTags.length === 0) {
    return ""
  }

  const detailLines = buildDetailFactLines(entry.detailTags)

  return `
    <div class="${abilityCatalogClass}__detail-facts">
      ${detailLines
        .map(
          (line) => `
            <div class="${abilityCatalogClass}__detail-fact-line">
              ${line
                .map(
                  (tag) => `
                    <span class="${abilityCatalogClass}__detail-fact">
                      <strong class="${abilityCatalogClass}__detail-fact-label">${escapeHtml(tag.label)}</strong>
                      <span class="${abilityCatalogClass}__detail-fact-value">${escapeHtml(tag.value)}</span>
                    </span>
                  `,
                )
                .join("")}
            </div>
          `,
        )
        .join("")}
    </div>
  `
}

function renderCatalogChevronIcon(className: string) {
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

function renderCatalogToggleIndicator() {
  return `
    <span class="${abilityCatalogClass}__toggle-indicator" aria-hidden="true">
      ${renderCatalogChevronIcon(`${abilityCatalogClass}__toggle-icon`)}
    </span>
  `
}

function serializeCatalogData(entries: RulebookCatalogEntry[]) {
  return encodeURIComponent(JSON.stringify(entries))
}

function renderCatalogDropdownTrigger(label: string) {
  return `
    <button
      type="button"
      class="${abilityCatalogClass}__dropdown-trigger"
      data-dropdown-trigger
      aria-expanded="false"
    >
      <span class="${abilityCatalogClass}__dropdown-trigger-label" data-dropdown-label>${escapeHtml(label)}</span>
      ${renderCatalogChevronIcon(`${abilityCatalogClass}__dropdown-icon`)}
    </button>
  `
}

function renderCatalogMultiFilterDropdown(
  label: string,
  field: RulebookCatalogFilterField,
  values: string[],
) {
  if (values.length === 0) {
    return ""
  }

  return `
    <div
      class="${abilityCatalogClass}__filter-group ${abilityCatalogClass}__dropdown-group"
      data-filter-dropdown="${field}"
      data-filter-kind="multi"
    >
      <span class="${abilityCatalogClass}__filter-label">${escapeHtml(label)}</span>
      ${renderCatalogDropdownTrigger("Все")}
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

function renderCatalogSortDropdown(sortOptions: RulebookCatalogSortOption[]) {
  const activeOption = sortOptions.find((option) => option.value === "rank-asc") ?? sortOptions[0]
  const activeLabel = activeOption?.label ?? "По рангу"
  const activeValue = activeOption?.value ?? "rank-asc"

  return `
    <div class="${abilityCatalogClass}__filter-group ${abilityCatalogClass}__dropdown-group" data-filter-dropdown="sort">
      <span class="${abilityCatalogClass}__filter-label">Сортировка</span>
      <input type="hidden" value="${escapeHtml(activeValue)}" data-catalog-sort />
      ${renderCatalogDropdownTrigger(activeLabel)}
      <div class="${abilityCatalogClass}__dropdown-menu" data-dropdown-menu hidden>
        ${sortOptions
          .map((option) => {
            const isActive = option.value === activeValue

            return `
              <button
                type="button"
                class="${abilityCatalogClass}__dropdown-option ${abilityCatalogClass}__dropdown-option--button${
                  isActive ? " is-active" : ""
                }"
                data-sort-option
                data-sort-value="${option.value}"
                data-sort-key="${option.sortKey}"
                data-sort-direction="${option.direction}"
                aria-pressed="${isActive ? "true" : "false"}"
              >
                <span class="${abilityCatalogClass}__dropdown-option-label">
                  ${escapeHtml(option.label)}
                </span>
              </button>
            `
          })
          .join("")}
      </div>
    </div>
  `
}

function renderCatalogRangeDropdown(filter: Extract<RulebookCatalogFilterDefinition, { kind: "range" }>) {
  return `
    <div
      class="${abilityCatalogClass}__filter-group ${abilityCatalogClass}__dropdown-group"
      data-filter-dropdown="${filter.field}"
      data-filter-kind="range"
      data-range-unit="${filter.unit}"
    >
      <span class="${abilityCatalogClass}__filter-label">${escapeHtml(filter.label)}</span>
      ${renderCatalogDropdownTrigger("Все")}
      <div class="${abilityCatalogClass}__dropdown-menu ${abilityCatalogClass}__dropdown-menu--credits" data-dropdown-menu hidden>
        <label class="${abilityCatalogClass}__credits-field">
          <span class="${abilityCatalogClass}__credits-label">${escapeHtml(filter.minLabel)}</span>
          <input
            type="number"
            inputmode="numeric"
            placeholder="0"
            data-catalog-range-min="${filter.field}"
          />
        </label>
        <label class="${abilityCatalogClass}__credits-field">
          <span class="${abilityCatalogClass}__credits-label">${escapeHtml(filter.maxLabel)}</span>
          <input
            type="number"
            inputmode="numeric"
            placeholder="0"
            data-catalog-range-max="${filter.field}"
          />
        </label>
      </div>
    </div>
  `
}

function renderCatalogToolbar(entriesCount: number) {
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
        ${renderCatalogChevronIcon(`${abilityCatalogClass}__filters-toggle-icon`)}
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

function renderCatalogFiltersPanel(
  filters: RulebookCatalogFilterDefinition[],
  sortOptions: RulebookCatalogSortOption[],
) {
  return `
    <div class="${abilityCatalogClass}__filters-panel" data-catalog-filters-panel hidden>
      <div class="${abilityCatalogClass}__filters-grid">
        ${renderCatalogSortDropdown(sortOptions)}
        ${filters
          .map((filter) =>
            filter.kind === "multi"
              ? renderCatalogMultiFilterDropdown(filter.label, filter.field, filter.values)
              : renderCatalogRangeDropdown(filter),
          )
          .join("")}
      </div>
    </div>
  `
}

function renderCatalogRows(entries: RulebookCatalogEntry[], expandedEntries = new Set<string>()) {
  return entries
    .map(
      (entry) => `
        <tr
          class="${abilityCatalogClass}__summary-row${expandedEntries.has(entry.id) ? " is-expanded" : ""}"
          data-entry-summary="${entry.id}"
          data-entry-expanded="${expandedEntries.has(entry.id) ? "true" : "false"}"
          tabindex="0"
        >
          <td data-column="rank">${renderCatalogValue(entry.rank)}</td>
          <td data-column="name">
            <div class="${abilityCatalogClass}__name-block">
              <strong>${escapeHtml(entry.name)}</strong>
              ${renderCatalogMetaChips(entry)}
            </div>
          </td>
          <td data-column="price">${renderCatalogPrice(entry.price)}</td>
          <td data-column="description">
            <div class="${abilityCatalogClass}__description-cell">
              <p class="${abilityCatalogClass}__description-preview">${renderCatalogValue(entry.previewDescription)}</p>
              ${renderCatalogToggleIndicator()}
            </div>
          </td>
        </tr>
        <tr class="${abilityCatalogClass}__detail-row${expandedEntries.has(entry.id) ? " is-expanded" : ""}" data-entry-detail="${entry.id}" ${
          expandedEntries.has(entry.id) ? "" : "hidden"
        }>
          <td colspan="4">
            <div class="${abilityCatalogClass}__detail-body">
              ${renderCatalogDetailTags(entry)}
              <div class="${abilityCatalogClass}__detail-copy">
                <p>${renderCatalogValue(entry.fullDescription)}</p>
              </div>
            </div>
          </td>
        </tr>
      `,
    )
    .join("")
}

function buildRulebookCatalogModel(kind: RulebookCatalogKind, headers: string[], rows: string[][]) {
  switch (kind) {
    case "abilities":
      return buildAbilityCatalogModel(headers, rows)
    case "weapons":
      return buildWeaponCatalogModel(headers, rows)
    case "armor":
      return buildArmorCatalogModel(headers, rows)
    case "equipment":
      return buildEquipmentCatalogModel(headers, rows)
  }
}

function localizeArmorTag(value: string) {
  return value
    .replace(/^\u0424\u0417\b/u, armorDefenseLabels.physicalDefense)
    .replace(/^\u041c\u0417\b/u, armorDefenseLabels.magicalDefense)
    .replace(/^\u041f\u0417\b/u, armorDefenseLabels.psychicDefense)
}

function localizeArmorFilterLabel(value: string) {
  switch (value) {
    case "\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043a\u0430\u044f":
      return armorDefenseLabels.physicalDefense
    case "\u041c\u0430\u0433\u0438\u0447\u0435\u0441\u043a\u0430\u044f":
      return armorDefenseLabels.magicalDefense
    case "\u041f\u0441\u0438\u0445\u0438\u0447\u0435\u0441\u043a\u0430\u044f":
      return armorDefenseLabels.psychicDefense
    default:
      return value
  }
}

function localizeArmorSortLabel(value: string) {
  switch (value) {
    case "\u041f\u043e \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043a\u043e\u0439":
      return `\u041f\u043e ${armorDefenseSortLabels.physicalDefense}`
    case "\u041f\u043e \u043c\u0430\u0433\u0438\u0447\u0435\u0441\u043a\u043e\u0439":
      return `\u041f\u043e ${armorDefenseSortLabels.magicalDefense}`
    case "\u041f\u043e \u043f\u0441\u0438\u0445\u0438\u0447\u0435\u0441\u043a\u043e\u0439":
      return `\u041f\u043e ${armorDefenseSortLabels.psychicDefense}`
    default:
      return value
  }
}

function localizeArmorCatalogModel(model: RulebookCatalogModel): RulebookCatalogModel {
  return {
    ...model,
    entries: model.entries.map((entry) => ({
      ...entry,
      tags: [
        entry.filters.physicalDefense
          ? `${armorDefenseLabels.physicalDefense} ${entry.filters.physicalDefense}`
          : "",
        entry.filters.magicalDefense
          ? `${armorDefenseLabels.magicalDefense} ${entry.filters.magicalDefense}`
          : "",
        entry.filters.psychicDefense
          ? `${armorDefenseLabels.psychicDefense} ${entry.filters.psychicDefense}`
          : "",
      ]
        .filter(Boolean)
        .map(localizeArmorTag),
    })),
    filters: model.filters.map((filter) =>
      filter.kind === "multi"
        ? {
            ...filter,
            label: localizeArmorFilterLabel(filter.label),
          }
        : filter,
    ),
    sortOptions: model.sortOptions.map((option) => ({
      ...option,
      label: localizeArmorSortLabel(option.label),
    })),
  }
}

export function buildRulebookCatalogHtml(
  kind: RulebookCatalogKind,
  headers: string[],
  rows: string[][],
) {
  const model =
    kind === "armor"
      ? localizeArmorCatalogModel(buildRulebookCatalogModel(kind, headers, rows))
      : buildRulebookCatalogModel(kind, headers, rows)

  return `
    <section class="${abilityCatalogClass}" data-catalog-kind="${kind}">
      <div class="${abilityCatalogClass}__controls">
        ${renderCatalogToolbar(model.entries.length)}
        ${renderCatalogFiltersPanel(model.filters, model.sortOptions)}
      </div>

      <div class="${abilityCatalogClass}__table-shell">
        <table>
          <thead>
            <tr>
              <th>Ранг</th>
              <th>Название</th>
              <th>Цена</th>
              <th>Описание</th>
            </tr>
          </thead>
          <tbody data-catalog-body>
            ${renderCatalogRows(model.entries)}
          </tbody>
        </table>
      </div>

      <script type="application/json" class="${abilityCatalogClass}__data">${serializeCatalogData(model.entries)}</script>
    </section>
  `
}

export function buildAbilityCatalogHtml(headers: string[], rows: string[][]) {
  return buildRulebookCatalogHtml("abilities", headers, rows)
}
