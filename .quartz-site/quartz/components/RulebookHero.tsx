import { FullSlug, resolveRelative } from "../util/path"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "./types"
import {
  getRulebookFirstChapter,
  getRulebookPageMeta,
  getRulebookPageTypeLabel,
  getRulebookReferenceEntry,
  isRulebookSlug,
  resolveRulebookAsset,
} from "../util/rulebook"
import style from "./styles/rulebookHero.scss"

function heroStyle(slug: FullSlug, heroImage?: string | null) {
  const resolvedAsset = resolveRulebookAsset(slug, heroImage)
  if (!resolvedAsset) {
    return undefined
  }

  return `--rulebook-hero-image: url('${resolvedAsset}')`
}

export default (() => {
  const RulebookHero: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const currentSlug = fileData.slug
    if (!isRulebookSlug(currentSlug)) {
      return null
    }

    const meta = getRulebookPageMeta(fileData)
    if (!meta.showHero) {
      return null
    }

    const firstChapter = getRulebookFirstChapter()
    const referenceEntry = getRulebookReferenceEntry()
    const typeLabel = getRulebookPageTypeLabel(meta.pageType)
    const styleValue = heroStyle(currentSlug, meta.heroImage)
    const actions = [
      meta.pageType === "landing" && firstChapter
        ? (
            <a class="primary" href={resolveRelative(currentSlug, firstChapter.slug)}>
              Читать по порядку
            </a>
          )
        : null,
      referenceEntry && referenceEntry.slug !== currentSlug
        ? (
            <a class="secondary" href={resolveRelative(currentSlug, referenceEntry.slug)}>
              Открыть справочник
            </a>
          )
        : null,
    ].filter(Boolean)

    return (
      <section class={`rulebook-hero ${meta.pageType ?? "chapter"}`} style={styleValue}>
        <div class="rulebook-hero-surface">
          <p class="rulebook-hero-kicker">{typeLabel}</p>
          <h1>{meta.title}</h1>
          {meta.summary && <p class="rulebook-hero-summary">{meta.summary}</p>}
          {actions.length > 0 && <div class="rulebook-hero-actions">{actions}</div>}
        </div>
      </section>
    )
  }

  RulebookHero.css = style
  return RulebookHero
}) satisfies QuartzComponentConstructor
