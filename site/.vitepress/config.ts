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
  stuck: "Stuck?",
  reflect: "Reflect",
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
          { text: "Optional · Your coding agent", link: "/coding-agent" },
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
      // GitHub-style task lists ("- [ ] item") render as checkboxes, like they do on GitHub.
      md.core.ruler.after("inline", "task-lists", (state) => {
        state.tokens.forEach((token, i) => {
          const first = token.children?.[0];
          if (token.type !== "inline" || state.tokens[i - 2]?.type !== "list_item_open" || first?.type !== "text") return;
          const m = /^\[([ xX])\] /.exec(first.content);
          if (!m) return;
          first.content = first.content.slice(m[0].length);
          const box = new state.Token("html_inline", "", 0);
          box.content = `<input type="checkbox" class="task-list-item-checkbox" disabled${m[1] === " " ? "" : " checked"} aria-hidden="true"> `;
          token.children!.unshift(box);
        });
      });

      // Each step title is a real <h2> with an anchor, so the page outline ("On this page")
      // and local search show the PRIMM structure: Predict, Run, Investigate, Modify, …
      for (const [name, label] of Object.entries(STEPS)) {
        md.use(container, name, {
          render(tokens: { nesting: number; info: string }[], idx: number, _opts: unknown, env: Record<string, any>) {
            const token = tokens[idx];
            if (token.nesting !== 1) return "</div>\n";
            const extra = token.info.trim().slice(name.length).trim();
            const text = extra ? `${label} — ${extra}` : label;
            const ids: Record<string, number> = (env.__stepIds ??= {});
            const base = slugify(extra ? `${name} ${extra}` : name);
            ids[base] = (ids[base] ?? 0) + 1;
            const id = ids[base] > 1 ? `${base}-${ids[base]}` : base;
            const safe = md.utils.escapeHtml(text);
            return (
              `<div class="step step-${name}">` +
              `<h2 class="step-title" id="${id}" tabindex="-1"><span class="step-icon" aria-hidden="true"></span>${safe} ` +
              `<a class="header-anchor" href="#${id}" aria-label="Permalink to &quot;${safe}&quot;">&#8203;</a></h2>\n`
            );
          },
        });
      }
    },
  },
});
