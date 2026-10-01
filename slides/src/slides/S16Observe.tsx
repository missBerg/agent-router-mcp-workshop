import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

const LOG_FIELDS = ['method', 'backend', 'tool', 'status', 'duration', 'session']

type Span = { name: string; start: number; width: number; kind: 'root' | 'chat' | 'tool' | 'error' }

// Illustrative trace of one agent task: LLM turns (chat) interleaved with tool calls.
const SPANS: Span[] = [
  { name: 'agent task', start: 0, width: 100, kind: 'root' },
  { name: 'chat', start: 2, width: 22, kind: 'chat' },
  { name: 'tools/call issues__get_issue', start: 26, width: 10, kind: 'tool' },
  { name: 'chat', start: 38, width: 20, kind: 'chat' },
  { name: 'tools/call deploy__deploy', start: 60, width: 8, kind: 'error' },
  { name: 'chat', start: 70, width: 28, kind: 'chat' },
]

export function S16Observe() {
  return (
    <DeckSlide
      tone="cream2"
      className="s-observe"
      notes={
        <SpeakerNotes
          time="0:55–0:57"
          segment="Concept · what to observe"
          cues={[<>Ask the Lab 3 Predict question before advancing: which of who / what / how long / allowed? can the router alone answer?</>]}
        >
          <p>
            The router sees every call, so it's the natural place to observe. Three signals.
          </p>
          <p>
            <b>Access logs</b>: one line per MCP call: method, backend, tool, status, duration, session. A denied call
            shows up as a <code>403</code> line tagged with the agent id and session.
          </p>
          <p>
            <b>Traces</b>: one trace per agent task. Chat spans for the LLM, <code>tools/call</code> spans for each
            tool. A denied call is a span like <code>tools/call deploy__deploy</code> with status Error "authorization
            failed", carrying <code>agent.id</code> and <code>session.id</code>. The router also propagates trace
            context to the MCP servers in the JSON-RPC <code>_meta.traceparent</code> field, so their spans join the
            same trace.
          </p>
          <p>
            <b>Metrics</b> on <code>:1064/metrics</code>: per-tool counts and latency. Span names and attributes
            follow the OpenTelemetry GenAI and MCP semantic conventions; set{' '}
            <code>AI_GATEWAY_TRACING_SEMCONV=gen_ai</code> to switch to them.
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Concept · Observe</p>
      <h2 className="title">Every tool call, seen from one place</h2>
      <div className="obs-grid">
        <div className="card card--plain obs-card">
          <h3 className="card-title">Access logs</h3>
          <p className="obs-what">One line per MCP call</p>
          <div className="chips obs-chips">
            {LOG_FIELDS.map((f) => (
              <span className="chip" key={f}>
                {f}
              </span>
            ))}
          </div>
          <p className="obs-foot">
            Denied call: a <b>403</b> line with agent id + session
          </p>
        </div>
        <div className="card card--plain obs-card obs-card--wide">
          <h3 className="card-title">Traces</h3>
          <p className="obs-what">One trace per agent task</p>
          <div className="trace" aria-label="Example trace: chat and tools/call spans; the deploy call failed authorization">
            {SPANS.map((s, i) => (
              <div className="trace-row" key={i}>
                <span
                  className={`trace-name ${s.kind === 'root' ? '' : 'trace-name--indent'} ${s.kind === 'error' ? 'trace-name--error' : ''}`}
                >
                  {s.name}
                </span>
                <span className="trace-track">
                  <span className={`trace-bar trace-bar--${s.kind}`} style={{ left: `${s.start}%`, width: `${s.width}%` }} />
                </span>
              </div>
            ))}
          </div>
          <p className="obs-foot trace-error">
            Denied call: span status <b>Error: authorization failed</b>
          </p>
        </div>
        <div className="card card--plain obs-card">
          <h3 className="card-title">Metrics</h3>
          <p className="obs-what">
            <code className="ic">:1064/metrics</code>
          </p>
          <p className="obs-sub">per-tool call counts and latency</p>
          <p className="obs-foot">
            Group by <code className="ic">agent.id</code>
          </p>
        </div>
      </div>
      <p className="obs-semconv">
        OpenTelemetry GenAI + MCP semantic conventions · <code className="ic">AI_GATEWAY_TRACING_SEMCONV=gen_ai</code>
      </p>
    </DeckSlide>
  )
}
