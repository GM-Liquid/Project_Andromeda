import { PageLayout, SharedLayout } from "./quartz/cfg";
import * as Component from "./quartz/components";

const isRulebookPage = (page: { fileData: { slug?: string } }) =>
  page.fileData.slug === "index" ||
  (page.fileData.slug?.startsWith("rulebook/") ?? false);

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      Исходники: "https://github.com/GM-Liquid/Project_Andromeda",
    },
  }),
};

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) =>
        !isRulebookPage(page) && page.fileData.slug !== "index",
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.TagList(),
      condition: (page) => !isRulebookPage(page),
    }),
  ],
  left: [
    Component.ConditionalRender({
      component: Component.RulebookNav(),
      condition: (page) => isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.PageTitle(),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.MobileOnly(Component.Spacer()),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Flex({
        components: [
          {
            Component: Component.Search(),
            grow: true,
          },
          { Component: Component.Darkmode() },
          { Component: Component.ReaderMode() },
        ],
      }),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Explorer(),
      condition: (page) => !isRulebookPage(page),
    }),
  ],
  right: [
    Component.ConditionalRender({
      component: Component.Graph(),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.DesktopOnly(Component.TableOfContents()),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Backlinks(),
      condition: (page) => !isRulebookPage(page),
    }),
  ],
};

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => !isRulebookPage(page),
    }),
  ],
  left: [
    Component.ConditionalRender({
      component: Component.RulebookNav(),
      condition: (page) => isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.PageTitle(),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.MobileOnly(Component.Spacer()),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Flex({
        components: [
          {
            Component: Component.Search(),
            grow: true,
          },
          { Component: Component.Darkmode() },
        ],
      }),
      condition: (page) => !isRulebookPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Explorer(),
      condition: (page) => !isRulebookPage(page),
    }),
  ],
  right: [],
};
