import { Root, Content, List, ListItem } from "mdast"
import { toString } from "mdast-util-to-string"
import { QuartzTransformerPlugin } from "../types"
import { FullSlug, transformLink } from "../../util/path"

const cardsDirective = ":::cards"
const closingDirective = ":::"

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

            for (let index = 0; index < tree.children.length; index++) {
              const node = tree.children[index]

              if (!isDirectiveNode(node, cardsDirective)) {
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
