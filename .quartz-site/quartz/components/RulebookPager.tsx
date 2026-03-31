import { resolveRelative } from "../util/path"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "./types"
import {
  getRulebookEntry,
  getRulebookNeighbors,
  isRulebookSlug,
} from "../util/rulebook"
import style from "./styles/rulebookPager.scss"

export default (() => {
  const RulebookPager: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const currentSlug = fileData.slug
    if (!isRulebookSlug(currentSlug)) {
      return null
    }

    const currentEntry = getRulebookEntry(currentSlug)
    const { previous, next } = getRulebookNeighbors(currentSlug)
    if (!currentEntry || currentEntry.pageType === "landing" || (!previous && !next)) {
      return null
    }

    return (
      <nav class="rulebook-pager" aria-label="Навигация по книге">
        {previous ? (
          <a class="rulebook-pager-card previous" href={resolveRelative(currentSlug, previous.slug)}>
            <span>Назад</span>
            <strong>{previous.title}</strong>
          </a>
        ) : (
          <span class="rulebook-pager-card ghost" aria-hidden="true"></span>
        )}
        {next && (
          <a class="rulebook-pager-card next" href={resolveRelative(currentSlug, next.slug)}>
            <span>Дальше</span>
            <strong>{next.title}</strong>
          </a>
        )}
      </nav>
    )
  }

  RulebookPager.css = style
  return RulebookPager
}) satisfies QuartzComponentConstructor
