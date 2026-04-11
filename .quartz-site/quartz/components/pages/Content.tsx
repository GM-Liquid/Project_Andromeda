import { ComponentChildren } from "preact"
import { htmlToJsx } from "../../util/jsx"
import { getRulebookPageMeta, isRulebookSlug } from "../../util/rulebook"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import style from "../styles/rulebookTemporaryNotice.scss"

const Content: QuartzComponent = ({ fileData, tree }: QuartzComponentProps) => {
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")

  if (isRulebookSlug(fileData.slug)) {
    const meta = getRulebookPageMeta(fileData)
    if (meta.temporaryNotice) {
      return (
        <article class={classString}>
          <section class="rulebook-temporary-notice" data-temporary-notice="true">
            <strong class="rulebook-temporary-notice__label">{meta.temporaryNotice}</strong>
          </section>
        </article>
      )
    }
  }

  const content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
  return <article class={classString}>{content}</article>
}

Content.css = style

export default (() => Content) satisfies QuartzComponentConstructor
