import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'
import markUrl from '../assets/ar-mark-marquee.svg'
import envoyIcon from '../assets/envoy-icon-color.svg'

const SERVERS = [
  { name: 'issues', port: 3001, tools: 44 },
  { name: 'ci', port: 3002, tools: 42 },
  { name: 'deploy', port: 3003, tools: 38 },
  { name: 'docs', port: 3004, tools: 32 },
  { name: 'chat', port: 3005, tools: 44 },
]
const CAPS = [
  { name: 'Aggregate + filter', sub: 'one URL · toolSelector' },
  { name: 'Authorize', sub: 'identity · rules · default Deny' },
  { name: 'Observe', sub: 'logs · traces · metrics' },
]

// Geometry (viewBox 1680×620, rendered 1:1 at 1080p).
const SRV_X = 1310
const srvY = (i: number) => 95 + i * 75
const MCP_OUT = { x: 1110, y: 275 }

function Diagram() {
  return (
    <svg className="arch" viewBox="0 0 1680 620" role="img" aria-label="An agent connects to Agent Router: /mcp aggregates, authorizes and observes five MCP servers; /v1 routes LLM calls.">
      <defs>
        <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#4A423C" />
        </marker>
        <marker id="arch-arrow-brand" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#E04400" />
        </marker>
      </defs>

      {/* agent */}
      <rect x="0" y="95" width="300" height="495" rx="22" className="arch-box" />
      <text x="150" y="300" textAnchor="middle" className="arch-agent">ship-it</text>
      <text x="150" y="340" textAnchor="middle" className="arch-sub">agent</text>
      <line x1="60" x2="240" y1="390" y2="390" className="arch-rule" />
      <text x="150" y="432" textAnchor="middle" className="arch-sub">or yours:</text>
      <text x="150" y="470" textAnchor="middle" className="arch-small">Claude Code · Cursor</text>
      <text x="150" y="502" textAnchor="middle" className="arch-small">VS Code · Goose</text>

      {/* agent → router */}
      <line x1="300" y1="275" x2="446" y2="275" className="arch-link arch-link--brand" markerEnd="url(#arch-arrow-brand)" />
      <text x="373" y="258" textAnchor="middle" className="arch-edge">MCP</text>
      <line x1="300" y1="535" x2="446" y2="535" className="arch-link" markerEnd="url(#arch-arrow)" />
      <text x="373" y="518" textAnchor="middle" className="arch-edge">LLM</text>

      {/* router */}
      <rect x="410" y="10" width="740" height="600" rx="26" className="arch-router" />
      <image href={markUrl} x="440" y="28" width="60" height="46" />
      <text x="512" y="66" className="arch-router-name">Agent Router</text>
      <text x="1120" y="64" textAnchor="end" className="arch-mono-sm">localhost:1975</text>

      <rect x="450" y="95" width="660" height="360" rx="18" className="arch-panel" />
      <text x="478" y="143" className="arch-path">/mcp</text>
      <text x="580" y="141" className="arch-sub">MCPRoute</text>
      {CAPS.map((c, i) => {
        const y = 165 + i * 92
        return (
          <g key={c.name}>
            <rect x="472" y={y} width="616" height="80" rx="12" className="arch-cap" />
            <text x="496" y={y + 51} className="arch-cap-name">{c.name}</text>
            <text x="1066" y={y + 49} textAnchor="end" className="arch-cap-sub">{c.sub}</text>
          </g>
        )
      })}

      <rect x="450" y="480" width="660" height="110" rx="18" className="arch-panel arch-panel--quiet" />
      <text x="478" y="547" className="arch-path arch-path--quiet">/v1</text>
      <text x="560" y="545" className="arch-cap-sub">LLM routing · chat completions</text>

      {/* router → servers */}
      {SERVERS.map((s, i) => {
        const y = srvY(i) + 30
        return (
          <path
            key={s.name}
            d={`M ${MCP_OUT.x} ${MCP_OUT.y} C ${MCP_OUT.x + 110} ${MCP_OUT.y}, ${SRV_X - 110} ${y}, ${SRV_X - 6} ${y}`}
            className="arch-link arch-link--brand"
            markerEnd="url(#arch-arrow-brand)"
          />
        )
      })}
      <line x1="1110" y1="535" x2="1304" y2="535" className="arch-link" markerEnd="url(#arch-arrow)" />

      {/* servers */}
      {SERVERS.map((s, i) => (
        <g key={s.name}>
          <rect x={SRV_X} y={srvY(i)} width="370" height="60" rx="12" className="arch-box" />
          <text x={SRV_X + 24} y={srvY(i) + 40} className="arch-mono">{s.name}</text>
          <text x={SRV_X + 348} y={srvY(i) + 39} textAnchor="end" className="arch-small">:{s.port} · {s.tools} tools</text>
        </g>
      ))}
      <rect x={SRV_X} y="480" width="370" height="110" rx="12" className="arch-box arch-box--quiet" />
      <text x={SRV_X + 24} y="525" className="arch-llm">LLM provider</text>
      <text x={SRV_X + 24} y="563" className="arch-small">OpenAI · Anthropic · Ollama · …</text>
    </svg>
  )
}

export function S09Architecture() {
  return (
    <DeckSlide
      className="s-arch"
      notes={
        <SpeakerNotes
          time="0:09–0:10"
          segment="Agent Router in one picture"
          cues={[<>Point at each of the three boxes inside /mcp and say which lab it is: 1, 2, 3.</>]}
        >
          <p>
            Here's the whole architecture. The agent talks to <b>one URL</b>, the router's <code>/mcp</code>{' '}
            endpoint, configured by a resource called an <b>MCPRoute</b>. Behind it, the router fans out to the five
            servers.
          </p>
          <p>
            Three jobs happen in that box, one per lab: <b>aggregate and filter</b> (Lab 1),{' '}
            <b>authorize</b> (Lab 2), <b>observe</b> (Lab 3). The agent's LLM calls also go through the same router
            on <code>/v1</code>, so one trace covers both the thinking and the tool calls.
          </p>
          <p>
            Agent Router is built on Envoy. And the same YAML runs on your laptop with <code>aigw run</code>, which is
            what we use today, and on Kubernetes with Envoy Gateway. That's the take-home.
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">The router</p>
      <h2 className="title arch-title">Agent Router in one picture</h2>
      <Diagram />
      <div className="arch-strip">
        <span>
          Same config, two ways to run: <code className="ic">aigw run</code> on your laptop · <b>Kubernetes</b> with
          Envoy Gateway
        </span>
        <span className="arch-envoy">
          <img src={envoyIcon} alt="" /> Built on Envoy
        </span>
      </div>
    </DeckSlide>
  )
}
