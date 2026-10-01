import { defineConfig } from "vitepress";
import container from "markdown-it-container";

const REPO = "https://github.com/missBerg/agent-router-mcp-workshop";

// One visual block per learning step, used identically on every lab page
// (PRIMM: Predict → Run → Investigate → Modify → Make, plus goal/checkpoint/reflect).
//   ::: predict
//   How many tools will the agent see?
//   :::
const STEPS: Record<string, string> = {
  goal: "Goal",
  recall: "Recall",
  predict: "Predict",
  run: "Run",
  investigate: "Investigate",
  modify: "Modify",
  checkpoint: "Checkpoint",
  make: "Make · Stretch",
  explore: "Explore · take-home",
  reflect: "Reflect",
};

export default defineConfig({
  title: "Agent Router MCP Workshop",
  description: "Aggregate, authorize and observe every MCP tool call with Agent Router — MCP Dev Summit Toronto 2026",
  base: "/agent-router-mcp-workshop/",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/agent-router-mcp-workshop/brand/favicon.svg" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    ["link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" }],
  ],
  themeConfig: {
    logo: { light: "/brand/ar-mark-marquee.svg", dark: "/brand/ar-mark-marquee.svg", alt: "Agent Router" },
    siteTitle: "MCP Workshop",
    nav: [
      { text: "Labs", link: "/setup" },
      { text: "Reference", link: "/reference" },
      { text: "Slides", link: "https://missberg.github.io/agent-router-mcp-workshop/slides/", target: "_self" },
      { text: "Agent Router", link: "https://theagentrouter.ai" },
    ],
    sidebar: [
      {
        text: "Workshop",
        items: [
          { text: "Start here", link: "/" },
          { text: "Lab 0 · Set up & meet the agent", link: "/setup" },
          { text: "Lab 1 · Aggregate & filter", link: "/lab-1" },
          { text: "Lab 2 · Authorize", link: "/lab-2" },
          { text: "Lab 3 · Observe", link: "/lab-3" },
          { text: "Wrap-up · Bring your own agent", link: "/byo-agent" },
        ],
      },
      {
        text: "Keep going",
        items: [
          { text: "Take-home · Kubernetes", link: "/kubernetes" },
          { text: "Reference & cheat sheet", link: "/reference" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Running this workshop",
        collapsed: true,
        items: [{ text: "Facilitator run-of-show", link: "/facilitator" }],
      },
    ],
    socialLinks: [{ icon: "github", link: REPO }],
    search: { provider: "local" },
    outline: { level: [2, 3], label: "On this page" },
    editLink: { pattern: `${REPO}/edit/main/site/:path`, text: "Suggest a fix for this page" },
    footer: {
      message: "Agent Router is an Agentic AI Foundation project, built on Envoy. Workshop by Erica Hughberg (Tetrate).",
      copyright: "MCP Dev Summit Toronto 2026",
    },
  },
  markdown: {
    config(md) {
      for (const [name, label] of Object.entries(STEPS)) {
        md.use(container, name, {
          render(tokens: { nesting: number; info: string }[], idx: number) {
            const token = tokens[idx];
            if (token.nesting !== 1) return "</div>\n";
            const extra = token.info.trim().slice(name.length).trim();
            const heading = extra ? `${label} — ${md.utils.escapeHtml(extra)}` : label;
            return `<div class="step step-${name}"><p class="step-title"><span class="step-icon" aria-hidden="true"></span>${heading}</p>\n`;
          },
        });
      }
    },
  },
});
