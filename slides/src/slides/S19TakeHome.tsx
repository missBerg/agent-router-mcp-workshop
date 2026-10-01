import { DeckSlide } from '../components/DeckSlide'
import { QR, QRPlaceholder } from '../components/QR'
import { SpeakerNotes } from '../components/SpeakerNotes'
import {
  AAIF_URL,
  AGENT_ROUTER_DOCS_URL,
  AGENT_ROUTER_REPO_URL,
  AGENT_ROUTER_VERSION,
  FEEDBACK_URL,
  LAB_SITE_URL,
  shortUrl,
  splitUrl,
} from '../config'

export function S19TakeHome() {
  return (
    <DeckSlide
      className="s-home"
      notes={
        <SpeakerNotes
          time="1:11–1:14"
          segment="Wrap-up · take it home + feedback"
          cues={[
            <>
              <b>Feedback QR: leave it up for a full 30 seconds.</b> Say "phones out" and wait.
            </>,
            <>The Codespace keeps working after today (until it's stopped or deleted), and every lab page stays online.</>,
            <>In Codespaces, BYO agent: run the agent CLI inside the Codespace, or make port 1975 public.</>,
          ]}
        >
          <p>
            <b>Bring your own agent.</b> Everything you built is a standard MCP endpoint. Point Claude Code, Cursor,
            VS Code, Goose, or any MCP client at <code>localhost:1975/mcp</code> with a bearer token from{' '}
            <code>./lab token release-bot</code>. The lab site has copy-paste config for each.
          </p>
          <p>
            <b>Kubernetes.</b> The same MCPRoute, applied with <code>kubectl</code> to a kind cluster running Envoy
            Gateway and Agent Router {AGENT_ROUTER_VERSION}. What works on your laptop deploys unchanged.
          </p>
          <p>
            <b>Explore tiers.</b> Every lab has one: the real GitHub MCP server with the router holding the token,
            real OAuth with Keycloak, Jaeger and Grafana dashboards.
          </p>
          <p>And please, the feedback form. It's how this workshop gets better.</p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Take it home</p>
      <h2 className="title">Put your own agent behind a router</h2>
      <div className="home-grid">
        <div className="home-cards">
          <div className="card home-card">
            <h3 className="home-card-title">Bring your own agent</h3>
            <p className="home-card-sub">Claude Code · Cursor · VS Code · Goose</p>
            <p className="home-mono">
              <code>http://localhost:1975/mcp</code>
            </p>
            <p className="home-mono home-mono--sm">
              <code>Authorization: Bearer $(./lab token release-bot)</code>
            </p>
          </div>
          <div className="card card--verdigris home-card">
            <h3 className="home-card-title">Kubernetes</h3>
            <p className="home-card-sub">
              Same MCPRoute on <b>kind</b> + Envoy Gateway, Agent Router {AGENT_ROUTER_VERSION}
            </p>
            <p className="home-mono">
              <code>takehome/kubernetes/</code>
            </p>
          </div>
          <div className="card card--spotlight home-card">
            <h3 className="home-card-title">Explore tiers</h3>
            <p className="home-card-sub">Real GitHub MCP · OAuth with Keycloak · Jaeger & Grafana</p>
          </div>
        </div>
        <div className="home-side">
          <ul className="home-links">
            <li>
              <span>Lab site</span>
              <code>
                {splitUrl(LAB_SITE_URL)[0]}
                <br />
                {splitUrl(LAB_SITE_URL)[1]}
              </code>
            </li>
            <li>
              <span>Docs</span>
              <code>{shortUrl(AGENT_ROUTER_DOCS_URL)}</code>
            </li>
            <li>
              <span>Code</span>
              <code>{shortUrl(AGENT_ROUTER_REPO_URL)}</code>
            </li>
            <li>
              <span>Foundation</span>
              <code>{shortUrl(AAIF_URL)}</code>
            </li>
          </ul>
          <div className="home-feedback">
            {FEEDBACK_URL ? (
              <QR value={FEEDBACK_URL} size={250} title="Session feedback" />
            ) : (
              <QRPlaceholder
                size={250}
                label={
                  <>
                    Set FEEDBACK_URL
                    <br />
                    in src/config.ts
                  </>
                }
              />
            )}
            <p className="home-feedback-label">
              Feedback,
              <br />
              please!
            </p>
          </div>
        </div>
      </div>
    </DeckSlide>
  )
}
