import { QuartzPluginData } from "../plugins/vfile"
import { classNames } from "../util/lang"
import { FullSlug, resolveRelative } from "../util/path"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "./types"
import style from "./styles/rulebookNav.scss"
import {
  getRulebookEntries,
  getRulebookEntryMap,
  isRulebookSlug,
} from "../util/rulebook"

// @ts-ignore
import script from "./scripts/rulebookNav.inline"

type TocEntry = {
  depth: number
  text: string
  slug: string
}

type RulebookSection = {
  slug: FullSlug
  title: string
  navTitle: string
  toc: TocEntry[]
}

function isActiveSection(currentSlug: string, sectionSlug: FullSlug): boolean {
  return currentSlug === sectionSlug || currentSlug.startsWith(`${sectionSlug}/`)
}

export default (() => {
  const RulebookNav: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
  }: QuartzComponentProps) => {
    const currentSlug = fileData.slug
    if (!isRulebookSlug(currentSlug)) {
      return null
    }

    const fileMap = getRulebookEntryMap(allFiles)
    const sections: RulebookSection[] = getRulebookEntries().map((entry) => {
      const matchedFile = fileMap.get(entry.slug) as QuartzPluginData | undefined
      return {
        slug: entry.slug,
        title: (matchedFile?.frontmatter?.title as string | undefined) ?? entry.title,
        navTitle:
          (matchedFile?.frontmatter?.navTitle as string | undefined) ?? entry.navTitle,
        toc: Array.isArray(matchedFile?.toc) ? (matchedFile?.toc as TocEntry[]) : [],
      }
    })

    if (sections.length === 0) {
      return null
    }

    const activeSection = sections.find((section) =>
      isActiveSection(currentSlug, section.slug),
    )

    return (
      <nav
        class={classNames(displayClass, "rulebook-nav")}
        aria-label="Разделы книги правил"
        data-current-slug={currentSlug}
        data-expanded="false"
      >
        <button
          type="button"
          class="rulebook-nav-toggle"
          aria-expanded="false"
          aria-controls="rulebook-nav-panel"
        >
          <span>Разделы книги</span>
          <strong>{activeSection?.navTitle ?? "Навигация"}</strong>
        </button>
        <div id="rulebook-nav-panel" class="rulebook-nav-panel">
          <ul class="rulebook-nav-list">
            {sections.map((section) => {
              const href = resolveRelative(currentSlug, section.slug)
              const hasFlyout = section.toc.length > 0
              const active = isActiveSection(currentSlug, section.slug)
              const itemClasses = ["rulebook-nav-item"]

              if (active) {
                itemClasses.push("active")
              }

              if (hasFlyout) {
                itemClasses.push("has-flyout")
              }

              return (
                <li
                  key={section.slug}
                  class={itemClasses.join(" ")}
                  data-has-flyout={hasFlyout ? "true" : "false"}
                >
                  <a class="rulebook-nav-link" href={href}>
                    <span>{section.navTitle}</span>
                  </a>
                  {hasFlyout && (
                    <div
                      class="rulebook-nav-flyout"
                      aria-label={`Оглавление раздела ${section.title}`}
                    >
                      <ol class="rulebook-nav-headings">
                        {section.toc.map((entry) => (
                          <li
                            key={`${section.slug}#${entry.slug}`}
                            class={`depth-${entry.depth}`}
                          >
                            <a href={`${href}#${entry.slug}`}>{entry.text}</a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </nav>
    )
  }

  RulebookNav.css = style
  RulebookNav.afterDOMLoaded = script
  return RulebookNav
}) satisfies QuartzComponentConstructor
