# Presenter deck: One Router for Your Agent's MCP Servers

Slides for the 75-minute hands-on workshop at **MCP Dev Summit Toronto (October 2026)**:
*Aggregate, Authorize and Observe Every Tool Call* with [Agent Router](https://theagentrouter.ai).

Spectacle 10 + React 18 + Vite + TypeScript, styled with the Agent Router brand tokens.
It is a standalone npm app: nothing here depends on the rest of the repo.

## Run it

Needs Node 20.19+ or 22.12+ (the repo's `.nvmrc` pins 24).

```sh
cd slides
npm install
npm run dev        # http://localhost:5173
```

## Present it

Spectacle syncs two windows of the **same browser** on the **same origin** (via `BroadcastChannel`):

1. **Audience window**: open the deck URL, drag it to the projector, go full screen
   (macOS: Ctrl+Cmd+F, others: F11).
2. **Presenter window**: open the same URL with `?presenterMode=true`, e.g.
   `http://localhost:5173/?presenterMode=true`, or press **Cmd/Ctrl+Shift+P** in any deck window.
   You get the current and next slide, a timer (press *Start Timer* at 0:00), and the notes.

Every slide has presenter notes in the same shape: an orange **timing badge** on the workshop
clock (e.g. `0:10–0:32`), the run-of-show segment, the talk track, then **Facilitation** cues
(what to do in the room, catch-up commands, time checks).

| Action | Keys / URL |
| --- | --- |
| Next / previous | → / ←, or a clicker (PageDown / PageUp, Space / Shift+Space; see `src/clicker.ts`) |
| Presenter mode | Cmd/Ctrl+Shift+P · `?presenterMode=true` |
| Overview grid | Cmd/Ctrl+Shift+O · `?overviewMode=true` (click a slide, or Enter, to jump) |
| Back to normal | Cmd/Ctrl+Shift+D |
| Jump to a slide | `?slideIndex=9` (0-based) |
| PDF handout | `?exportMode=true`, then the browser's Print → Save as PDF |

Click steps: slide 4 has one click (lights up the 8 tools the job needs), slide 18 has three
(one recall answer per click). Every other slide advances on the first click.

**Fonts** (Archivo, Inter, JetBrains Mono) load from Google Fonts. Open the deck once on the
presenting laptop with a working connection so the browser caches them; if they ever fail to
load, the system fallbacks are narrower and nothing overflows.

## Build

```sh
npm run build      # type-checks, then writes dist/
npm run preview    # serves dist/ locally to check the production build
```

`vite.config.ts` sets `base: './'`, so every asset URL is relative and the built deck works from
any sub-path. It is published at <https://missberg.github.io/agent-router-mcp-workshop/slides/>:
copy `dist/` to the Pages artifact under `slides/`.

## Change URLs, names and placeholders

Everything shown on screen lives in **`src/config.ts`**. QR codes are generated in the browser
from these values, so changing a URL updates the text and the QR together.

| Constant | Used on | Notes |
| --- | --- | --- |
| `LAB_SITE_URL` | footer of every content slide, slides 2, 19, 20 | |
| `CODESPACES_URL` | slide 2 (the big QR) | |
| `REPO_URL` | slide 20 | |
| `FEEDBACK_URL` | slide 19 | **Placeholder.** While empty, slide 19 shows a dashed "Set FEEDBACK_URL" box instead of a QR |
| `LAB_PAGES` | QR codes on the three "your turn" slides (10, 14, 17) | **Must match the lab site's routes** |
| `SPEAKER.contacts` | slide 20 | LinkedIn and GitHub, shown as typed |
| `WORKSHOP_LLM_KEY` | slide 10 (the Lab 0/1 slide) | **Never committed.** Read from `VITE_WORKSHOP_LLM_KEY` in `slides/.env.local` (git-ignored). Empty → the slide says "the key we hand out". See `facilitator/run-of-show.md` → Workshop LLM keys |
| `AGENT_ROUTER_VERSION`, `EVENT`, `EVENT_DATE` | title, take-home | |

## Slides and timing

The run of show comes from `../DESIGN.md` §3.

| # | Slide | Clock |
| --- | --- | --- |
| 1 | Title | 0:00 |
| 2 | Open your lab now (Codespaces QR) | 0:00–0:02 |
| 3 | Hook: "Your agent needs eight tools. So why give it two hundred?" | 0:02 |
| 4 | Lakeshore Labs: 200 tools, the job needs 8 (click to reveal) | 0:03 |
| 5 | Live demo: meet ship-it, `./lab agent --direct` | 0:04–0:06 |
| 6 | Why it hurts: context cost, selection accuracy, blast radius | 0:06 |
| 7 | Today's route: Lab 0 → 1 → 2 → 3 | 0:07 |
| 8 | How the labs work: PRIMM, tiers, `./lab check` / `./lab solution` | 0:08 |
| 9 | Agent Router in one picture | 0:09 |
| 10 | Your turn: Lab 0 + Lab 1, until 0:32 | 0:10–0:32 |
| 11 | Debrief 1: prefixes, `toolSelector`, 200 → 8 | 0:32 |
| 12 | Concept: identity (triage-bot vs release-bot, MCP auth discovery) | 0:34 |
| 13 | Concept: rules in order, default Deny, `tools/list` is filtered too | 0:35 |
| 14 | Your turn: Lab 2, until 0:54 | 0:36–0:54 |
| 15 | Debrief 2: deny first, then allow | 0:54 |
| 16 | Concept: logs, traces, metrics | 0:55 |
| 17 | Your turn: Lab 3, until 1:09 | 0:57–1:09 |
| 18 | Recall: three questions (three clicks) | 1:09 |
| 19 | Take it home + feedback | 1:11 |
| 20 | Thank you | 1:14 |

## Layout

```
src/
  config.ts           URLs, names, placeholders (edit this)
  presentation.tsx    slide order
  theme.ts            Spectacle theme (1920×1080 stage)
  clicker.ts          PageDown/PageUp/Space → arrow keys
  components/         DeckSlide (frame + footer), SpeakerNotes, Code (YAML), Terminal, QR, LabGo
  slides/S01…S20      one file per slide, notes included
  styles/
    brand-tokens.css  vendored Agent Router tokens (theagentrouter/agent-router site/src/css/brand/, Apache-2.0); do not edit
    brand-pattern.css vendored A-pattern texture (same source); do not edit
    deck.css          frame, typography, cards, code, terminal, QR, presenter-notes styles
    slides.css        per-slide layout
  assets/             logos copied from the Agent Router site (theagentrouter/agent-router site/static/img/brand/)
```

Authoring rules the deck follows, worth keeping when you edit:

- Slides are authored at **1920×1080** in px and Spectacle scales them to any window, so
  check new content at 1920×1080 and it holds at 1280×720 too.
- Body text 30–46px, code ≥ 28px, footer 24px. Few words per slide.
- On light grounds, orange **text** uses `--ar-on-cream-marquee` (#B83700) or marquee-600 for
  huge numerals; #FF5500 is reserved for shapes and for display type on the ink ground.
- `theme.backdropStyle` must keep `position: fixed` + `100vw/100vh`: setting it replaces
  Spectacle's default and the stage otherwise gets cut off on small windows.

Logo files: `ar-mark-marquee.svg` and `envoy-icon-color.svg` are copied unchanged from the
Agent Router site's `static/img/brand/`. Two local derivatives: `ar-horizontal-on-dark-transparent.svg`
(`ar-horizontal-on-dark.svg` with its ink backing rectangle removed, so it sits on the stage glow)
and `aaif-logo-white.svg` (`aaif-logo.svg` with fills switched to white for ink grounds).
`public/favicon.svg` is the site's favicon.
