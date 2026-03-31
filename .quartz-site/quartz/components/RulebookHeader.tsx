import { FullSlug, resolveRelative } from "../util/path"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "./types"
import {
  getRulebookEntries,
  getRulebookFirstChapter,
  getRulebookPageMeta,
  isRulebookSlug,
} from "../util/rulebook"
import style from "./styles/rulebookHeader.scss"

const headerNavSlugs = new Set<FullSlug>([
  "index" as FullSlug,
  "rulebook/01-osnovnye-pravila" as FullSlug,
  "rulebook/02-sozdanie-personazha" as FullSlug,
  "rulebook/skills-reference" as FullSlug,
])

function isActive(currentSlug: FullSlug, targetSlug: FullSlug) {
  return currentSlug === targetSlug || currentSlug.startsWith(`${targetSlug}/`)
}

export default (() => {
  const RulebookHeader: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const currentSlug = fileData.slug
    if (!isRulebookSlug(currentSlug)) {
      return null
    }

    const firstChapter = getRulebookFirstChapter()
    const currentMeta = getRulebookPageMeta(fileData)
    const navEntries = getRulebookEntries().filter((entry) => headerNavSlugs.has(entry.slug))

    return (
      <div class="rulebook-header-shell">
        <div class="rulebook-header-brand">
          <a href={resolveRelative(currentSlug, "index" as FullSlug)}>
            <span class="rulebook-header-kicker">Книга правил</span>
            <strong>Project Andromeda</strong>
          </a>
        </div>
        <nav class="rulebook-header-nav" aria-label="Основные разделы книги">
          {navEntries.map((entry) => (
            <a
              key={entry.slug}
              class={isActive(currentSlug, entry.slug) ? "active" : ""}
              href={resolveRelative(currentSlug, entry.slug)}
            >
              {entry.navTitle}
            </a>
          ))}
        </nav>
        {firstChapter && currentMeta.pageType === "landing" && (
          <a
            class="rulebook-header-action"
            href={resolveRelative(currentSlug, firstChapter.slug)}
          >
            Читать с начала
          </a>
        )}
      </div>
    )
  }

  RulebookHeader.css = style
  return RulebookHeader
}) satisfies QuartzComponentConstructor
