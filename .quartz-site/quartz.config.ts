import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Проект Андромеда",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "ru-RU",
    baseUrl: "gm-liquid.github.io/Project_Andromeda",
    ignorePatterns: ["private", "templates", ".obsidian", ".quartz-cache", ".npm-cache"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        title: { name: "Merriweather", weights: [700] },
        header: { name: "Merriweather", weights: [400, 700] },
        body: { name: "Source Sans 3", weights: [400, 600, 700], includeItalic: true },
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#f6f0e8",
          lightgray: "#ddd2c5",
          gray: "#a79b8d",
          darkgray: "#544d46",
          dark: "#1e1d1c",
          secondary: "#2d5876",
          tertiary: "#7ea3b8",
          highlight: "rgba(45, 88, 118, 0.11)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#101318",
          lightgray: "#2d333d",
          gray: "#66707e",
          darkgray: "#d7dde5",
          dark: "#f3f5f8",
          secondary: "#8eb6cd",
          tertiary: "#6c8ea2",
          highlight: "rgba(142, 182, 205, 0.14)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.RulebookBlocks(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
