/**
 * Every URL and name shown on the slides lives here.
 * QR codes are generated client-side from these values, so changing a URL
 * here updates both the printed text and the QR code.
 */

/** The attendee lab site (VitePress, GitHub Pages). */
export const LAB_SITE_URL = 'https://missberg.github.io/agent-router-mcp-workshop/'

/** One-click Codespace for the workshop repo. */
export const CODESPACES_URL =
  'https://codespaces.new/missBerg/agent-router-mcp-workshop?quickstart=1'

/** The workshop repository. */
export const REPO_URL = 'https://github.com/missBerg/agent-router-mcp-workshop'

/**
 * Session feedback form (e.g. the Sched session page).
 * PLACEHOLDER: while this is empty, the feedback QR shows a dashed
 * "set FEEDBACK_URL" box so it is impossible to miss in rehearsal.
 */
export const FEEDBACK_URL = ''

/**
 * The workshop LLM key attendees paste into `./lab llm workshop` (Lab 0/1 slide).
 * Never commit it: put VITE_WORKSHOP_LLM_KEY=… in slides/.env.local (git-ignored) on the
 * presenting laptop. The public Pages build has no key and shows a placeholder instead.
 */
export const WORKSHOP_LLM_KEY: string = import.meta.env.VITE_WORKSHOP_LLM_KEY ?? ''

/**
 * Lab pages on the lab site, relative to LAB_SITE_URL.
 * Keep in sync with the site's routes (site/).
 */
export const LAB_PAGES: Record<0 | 1 | 2 | 3, string> = {
  0: 'setup',
  1: 'lab-1',
  2: 'lab-2',
  3: 'lab-3',
}

/** Project links. */
export const AGENT_ROUTER_DOCS_URL = 'https://theagentrouter.ai'
export const AGENT_ROUTER_REPO_URL = 'https://github.com/theagentrouter/agent-router'
export const AAIF_URL = 'https://aaif.io'
export const AGENT_ROUTER_VERSION = 'v1.1.0'

/** Speaker + event. */
export const SPEAKER = {
  name: 'Erica Hughberg',
  org: 'Tetrate',
  role: 'Maintainer-track contributor, Agent Router',
  /** Shown on the thank-you slide, as typed: keep them short. */
  contacts: ['linkedin.com/in/ericahughberg', 'github.com/missBerg', 'erica.hughberg@tetrate.io'],
}
export const EVENT = 'MCP Dev Summit Toronto'
export const EVENT_DATE = 'October 2026'

/** Strip protocol, query and trailing slash for on-screen display. */
export function shortUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
}

/** Short URL split after the host, for two-line display: ["host/", "path"]. */
export function splitUrl(url: string): [string, string] {
  const short = shortUrl(url)
  const i = short.indexOf('/')
  return i < 0 ? [short, ''] : [short.slice(0, i + 1), short.slice(i + 1)]
}

export function labPageUrl(n: 0 | 1 | 2 | 3): string {
  return new URL(LAB_PAGES[n], LAB_SITE_URL).toString()
}
