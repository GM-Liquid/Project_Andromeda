import { QuartzPluginData } from "../plugins/vfile";
import { classNames, capitalize } from "../util/lang";
import { FullSlug, resolveRelative } from "../util/path";
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "./types";
import style from "./styles/rulebookNav.scss";

// @ts-ignore
import script from "./scripts/rulebookNav.inline";

type TocEntry = {
  depth: number;
  text: string;
  slug: string;
};

type RulebookSection = {
  slug: FullSlug;
  title: string;
  toc: TocEntry[];
};

const rulebookPrefix = "rulebook/";

function isRulebookSection(
  file: QuartzPluginData,
): file is QuartzPluginData & { slug: FullSlug } {
  const slug = file.slug;
  return (
    typeof slug === "string" &&
    slug.startsWith(rulebookPrefix) &&
    !slug.endsWith("/index") &&
    slug.split("/").length === 2
  );
}

function getBasename(slug: string): string {
  return slug.split("/").at(-1) ?? slug;
}

function getSectionOrder(slug: string): number {
  const match = getBasename(slug).match(/^(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function humanizeSlug(slug: string): string {
  return capitalize(
    getBasename(slug).replace(/^\d+-/, "").split("-").filter(Boolean).join(" "),
  );
}

function getSectionTitle(file: QuartzPluginData): string {
  const title = file.frontmatter?.title;
  return typeof title === "string" && title.length > 0
    ? title
    : humanizeSlug(file.slug ?? "");
}

function isActiveSection(currentSlug: string, sectionSlug: FullSlug): boolean {
  return (
    currentSlug === sectionSlug || currentSlug.startsWith(`${sectionSlug}/`)
  );
}

export default (() => {
  const RulebookNav: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
  }: QuartzComponentProps) => {
    const currentSlug = fileData.slug;
    if (currentSlug !== "index" && !currentSlug?.startsWith(rulebookPrefix)) {
      return null;
    }

    const sections: RulebookSection[] = allFiles
      .filter(isRulebookSection)
      .sort((a, b) => {
        const orderDiff = getSectionOrder(a.slug) - getSectionOrder(b.slug);
        if (orderDiff !== 0) {
          return orderDiff;
        }

        return getSectionTitle(a).localeCompare(getSectionTitle(b), "ru", {
          numeric: true,
          sensitivity: "base",
        });
      })
      .map((section) => ({
        slug: section.slug,
        title: getSectionTitle(section),
        toc: Array.isArray(section.toc) ? (section.toc as TocEntry[]) : [],
      }));

    if (sections.length === 0) {
      return null;
    }

    return (
      <nav
        class={classNames(displayClass, "rulebook-nav")}
        aria-label="Разделы книги правил"
        data-current-slug={currentSlug}
      >
        <ul class="rulebook-nav-list">
          {sections.map((section) => {
            const href = resolveRelative(currentSlug, section.slug);
            const hasFlyout = section.toc.length > 0;
            const active = isActiveSection(currentSlug, section.slug);
            const itemClasses = ["rulebook-nav-item"];

            if (active) {
              itemClasses.push("active");
            }

            if (hasFlyout) {
              itemClasses.push("has-flyout");
            }

            return (
              <li
                key={section.slug}
                class={itemClasses.join(" ")}
                data-has-flyout={hasFlyout ? "true" : "false"}
              >
                <a class="rulebook-nav-link" href={href}>
                  <span>{section.title}</span>
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
            );
          })}
        </ul>
      </nav>
    );
  };

  RulebookNav.css = style;
  RulebookNav.afterDOMLoaded = script;
  return RulebookNav;
}) satisfies QuartzComponentConstructor;
