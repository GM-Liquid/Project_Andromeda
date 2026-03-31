import { FullSlug, RelativeURL, joinSegments, pathToRoot } from "./path"
import { QuartzPluginData } from "../plugins/vfile"

export type RulebookEntryType = "manual" | "generated"
export type RulebookPageType = "landing" | "chapter" | "reference"

export type RulebookEntry = {
  id: string
  type: RulebookEntryType
  slug: FullSlug
  file?: string
  source?: string
  title: string
  navTitle: string
  order: number
  pageType: RulebookPageType
  summary: string
  heroImage?: string | null
  heroAlt?: string | null
  showHero?: boolean
  showToc?: boolean
  parent?: string | null
}

type RulebookFrontmatter = Partial<{
  title: string
  navTitle: string
  summary: string
  pageType: RulebookPageType
  heroImage: string | null
  heroAlt: string | null
  showHero: boolean
  showToc: boolean
}>

// @ts-ignore
import { rulebookManifest } from "../../scripts/rulebook.manifest.mjs"

const rulebookEntries = [...(rulebookManifest as RulebookEntry[])].sort(
  (left, right) => left.order - right.order,
)

export function isRulebookSlug(slug?: string): slug is FullSlug {
  return slug === "index" || (typeof slug === "string" && slug.startsWith("rulebook/"))
}

export function getRulebookEntries(): RulebookEntry[] {
  return rulebookEntries
}

export function getRulebookEntry(slug?: string): RulebookEntry | undefined {
  if (!slug) {
    return undefined
  }

  return rulebookEntries.find((entry) => entry.slug === slug)
}

export function getRulebookFirstChapter(): RulebookEntry | undefined {
  return rulebookEntries.find((entry) => entry.pageType === "chapter")
}

export function getRulebookReferenceEntry(): RulebookEntry | undefined {
  return rulebookEntries.find((entry) => entry.pageType === "reference")
}

export function getRulebookEntryMap(allFiles: QuartzPluginData[]) {
  return new Map(allFiles.map((file) => [file.slug, file]))
}

export function getRulebookNeighbors(slug?: string) {
  const currentIndex = rulebookEntries.findIndex((entry) => entry.slug === slug)
  if (currentIndex === -1) {
    return {
      previous: undefined,
      next: undefined,
    }
  }

  return {
    previous: rulebookEntries[currentIndex - 1],
    next: rulebookEntries[currentIndex + 1],
  }
}

export function getRulebookPageMeta(fileData: QuartzPluginData) {
  const entry = getRulebookEntry(fileData.slug)
  const frontmatter = (fileData.frontmatter ?? {}) as RulebookFrontmatter

  return {
    entry,
    title: frontmatter.title ?? entry?.title ?? "",
    navTitle: frontmatter.navTitle ?? entry?.navTitle ?? "",
    summary: frontmatter.summary ?? entry?.summary ?? "",
    pageType: frontmatter.pageType ?? entry?.pageType,
    heroImage: frontmatter.heroImage ?? entry?.heroImage ?? null,
    heroAlt: frontmatter.heroAlt ?? entry?.heroAlt ?? null,
    showHero: frontmatter.showHero ?? entry?.showHero ?? false,
    showToc: frontmatter.showToc ?? entry?.showToc ?? true,
  }
}

export function getRulebookPageTypeLabel(pageType?: RulebookPageType) {
  switch (pageType) {
    case "landing":
      return "Книга правил"
    case "reference":
      return "Справочник"
    case "chapter":
    default:
      return "Глава книги"
  }
}

export function resolveRulebookAsset(slug: FullSlug, assetPath?: string | null): RelativeURL | null {
  if (!assetPath) {
    return null
  }

  return joinSegments(pathToRoot(slug), assetPath) as RelativeURL
}

export function shouldRenderRulebookHero(fileData: QuartzPluginData) {
  return isRulebookSlug(fileData.slug) && getRulebookPageMeta(fileData).showHero
}

export function shouldRenderRulebookToc(fileData: QuartzPluginData) {
  if (!isRulebookSlug(fileData.slug)) {
    return false
  }

  const { showToc } = getRulebookPageMeta(fileData)
  return showToc && Array.isArray(fileData.toc) && fileData.toc.length > 0
}
