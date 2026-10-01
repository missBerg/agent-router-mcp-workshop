import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'
import { Terminal } from '../components/Terminal'

export function S05Demo() {
  return (
    <DeckSlide
      tone="dark"
      className="s-demo"
      notes={
        <SpeakerNotes
          time="0:04–0:06"
          segment="Hook · live demo (Observe)"
          cues={[
            <>
              <b>Before the session:</b> Codespace open, terminal font bumped (Cmd/Ctrl&nbsp;+), <code>./lab doctor</code>{' '}
              green, LLM configured with <code>./lab llm</code>. Have a second terminal with the scripted brain ready
              as a fallback.
            </>,
            <>
              Run <code>./lab agent --direct</code>. Point at the banner: <i>200 tools from 5 servers · ≈N k tokens</i>.
              Read the token number out loud and ask people to remember it; we compare after Lab 1.
            </>,
            <>
              Let it run: tool calls print live. It may well finish the task. That's fine: the point is the cost and
              the risk, not that it fails.
            </>,
            <>
              <b>If the API rejects the request</b> (e.g. "maximum 128 tools"): that IS the point. Say: "The agent
              can't even start: this provider caps tools per request." Then <code>./lab llm scripted</code> and rerun
              to show the rest.
            </>,
            <>If the LLM is slow or flaky, switch to the scripted brain immediately; don't debug on stage.</>,
          ]}
        >
          <p>
            Let's meet ship-it. Right now it's connected <b>straight to all five servers</b>, no router in between.
            That's how most of us wire agents up today.
          </p>
          <p>
            Watch two numbers in the banner: how many tools it sees, and how many tokens those tool definitions cost
            <b> before it has read a single word of the task</b>. Then watch which tools it could call.
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Live demo</p>
      <h2 className="title demo-title">Meet ship-it</h2>
      <div className="demo-grid">
        <div className="demo-left">
          <Terminal lines={[{ cmd: './lab agent --direct' }]} size={56} />
          <p className="demo-sub">
            Connected straight to <b>5 MCP servers</b>.<br />
            No router.
          </p>
        </div>
        <div className="demo-watch">
          <p className="demo-watch-label">Watch for</p>
          <ol className="demo-list">
            <li>
              <span className="demo-n">1</span>
              <span>
                <b>Tool count</b> in the banner
              </span>
            </li>
            <li>
              <span className="demo-n">2</span>
              <span>
                <b>Token estimate</b>, before it reads the task
              </span>
            </li>
            <li>
              <span className="demo-n">3</span>
              <span>
                <b>What it could call</b>: <code className="ic">delete_environment</code>
              </span>
            </li>
          </ol>
        </div>
      </div>
    </DeckSlide>
  )
}
