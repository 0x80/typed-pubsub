import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Typed PubSub",
  description:
    "A type-safe PubSub abstraction for Google Cloud and Firebase",
  base: "/",
  cleanUrls: true,

  themeConfig: {
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
          { text: "Configuration", link: "/configuration" },
          { text: "API Reference", link: "/api-reference" },
        ],
      },
      {
        text: "Topics",
        items: [
          { text: "Event Marking", link: "/event-marking" },
          { text: "Stale Events", link: "/stale-events" },
          { text: "Real-World Examples", link: "/real-world-examples" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/0x80/typed-pubsub" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright &copy; Thijs Koerselman",
    },
  },
});
