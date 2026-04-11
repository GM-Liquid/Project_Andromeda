import { PageLayout, SharedLayout } from './quartz/cfg';
import * as Component from './quartz/components';
import type { QuartzPluginData } from './quartz/plugins/vfile';
import { getRulebookPageMeta, isRulebookSlug } from './quartz/util/rulebook';

type RulebookLayoutPage = {
  fileData: QuartzPluginData;
};

const isRulebookPage = (page: RulebookLayoutPage) =>
  isRulebookSlug(page.fileData.slug);

const hasRulebookTemporaryNotice = (page: RulebookLayoutPage) =>
  isRulebookPage(page) && Boolean(getRulebookPageMeta(page.fileData).temporaryNotice);

const shouldShowRulebookHero = (page: RulebookLayoutPage) =>
  isRulebookPage(page) && !hasRulebookTemporaryNotice(page) && getRulebookPageMeta(page.fileData).showHero;

const shouldShowRulebookToc = (page: RulebookLayoutPage) =>
  isRulebookPage(page) &&
  !hasRulebookTemporaryNotice(page) &&
  getRulebookPageMeta(page.fileData).showToc &&
  Array.isArray(page.fileData.toc) &&
  page.fileData.toc.length > 0;

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [
    Component.ConditionalRender({
      component: Component.RulebookHeader(),
      condition: (page) => isRulebookPage(page)
    })
  ],
  afterBody: [
    Component.ConditionalRender({
      component: Component.RulebookPager(),
      condition: (page) => isRulebookPage(page)
    })
  ],
  footer: Component.Footer({
    links: {
      Исходники: 'https://github.com/GM-Liquid/Project_Andromeda'
    }
  })
};

export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.RulebookHero(),
      condition: (page) => shouldShowRulebookHero(page)
    }),
    Component.ConditionalRender({
      component: Component.MobileOnly(Component.TableOfContents()),
      condition: (page) => shouldShowRulebookToc(page)
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => isRulebookPage(page) && !shouldShowRulebookHero(page)
    }),
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => !isRulebookPage(page) && page.fileData.slug !== 'index'
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.TagList(),
      condition: (page) => !isRulebookPage(page)
    })
  ],
  left: [
    Component.ConditionalRender({
      component: Component.RulebookNav(),
      condition: (page) => isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.PageTitle(),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.MobileOnly(Component.Spacer()),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.Flex({
        components: [
          {
            Component: Component.Search(),
            grow: true
          },
          { Component: Component.Darkmode() },
          { Component: Component.ReaderMode() }
        ]
      }),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.Explorer(),
      condition: (page) => !isRulebookPage(page)
    })
  ],
  right: [
    Component.ConditionalRender({
      component: Component.DesktopOnly(Component.TableOfContents()),
      condition: (page) => shouldShowRulebookToc(page)
    }),
    Component.ConditionalRender({
      component: Component.Graph(),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.DesktopOnly(Component.TableOfContents()),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.Backlinks(),
      condition: (page) => !isRulebookPage(page)
    })
  ]
};

export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => !isRulebookPage(page)
    })
  ],
  left: [
    Component.ConditionalRender({
      component: Component.PageTitle(),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.MobileOnly(Component.Spacer()),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.Flex({
        components: [
          {
            Component: Component.Search(),
            grow: true
          },
          { Component: Component.Darkmode() }
        ]
      }),
      condition: (page) => !isRulebookPage(page)
    }),
    Component.ConditionalRender({
      component: Component.Explorer(),
      condition: (page) => !isRulebookPage(page)
    })
  ],
  right: []
};
