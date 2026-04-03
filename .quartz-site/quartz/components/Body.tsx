// @ts-ignore
import clipboardScript from "./scripts/clipboard.inline"
// @ts-ignore
import abilityCatalogScript from "./scripts/abilityCatalog.inline"
import clipboardStyle from "./styles/clipboard.scss"
import abilityCatalogStyle from "./styles/abilityCatalog.scss"
import { concatenateResources } from "../util/resources"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const Body: QuartzComponent = ({ children }: QuartzComponentProps) => {
  return <div id="quartz-body">{children}</div>
}

Body.afterDOMLoaded = concatenateResources(clipboardScript, abilityCatalogScript)
Body.css = concatenateResources(clipboardStyle, abilityCatalogStyle)

export default (() => Body) satisfies QuartzComponentConstructor
