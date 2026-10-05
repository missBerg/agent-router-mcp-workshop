import { Code } from '../components/Code'
import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

const YAML = `
backendRefs:
  - name: docs
    toolSelector:
      include: [search_docs]
  - name: deploy
    toolSelector:
      include:
        - deploy
        - get_deployment_status
`

export function S11Debrief1() {
  return (
    <DeckSlide
      className="s-debrief1"
      notes={
        <SpeakerNotes
          time="0:32–0:34"
          segment="Debrief 1"
          cues={[
            <>
              Open with the soft sync: <b>"If you're not at the checkpoint yet, run <code>./lab solution 1</code> and
              keep going. You can come back."</b>
            </>,
            <>Ask one person to read out their before/after token numbers from the agent banner.</>,
            <>Stretch discussion, if time: <code>include</code> vs <code>exclude</code>. Allow-list is safer: a new tool on the server stays invisible until you opt in.</>,
          ]}
        >
          <p>
            What did you see when the router first sat in front of all five servers? Still 200 tools, but every name
            got a prefix: <code>issues__search</code> and <code>docs__search</code>. That's how the router keeps one
            endpoint's tool names unique: <code>backend__tool</code>.
          </p>
          <p>
            Then you added a <code>toolSelector</code> to each backend. 200 → 8. Same task, same agent, a fraction of
            the tokens, and <code>delete_environment</code> no longer exists as far as the agent is concerned.
          </p>
          <p>
            Key idea: <b>filtering defines what exists on this endpoint, for everyone.</b> It doesn't care who's
            calling. That's the next problem.
          </p>
        </SpeakerNotes>
      }
    >
      <div className="d1-head">
        <div>
          <p className="kicker">Debrief · Lab 1</p>
          <h2 className="title">One endpoint, only the tools the job needs</h2>
        </div>
        <div className="d1-numbers" aria-label="200 tools down to 8 tools">
          <span className="d1-from">200</span>
          <span className="d1-arrow">→</span>
          <span className="d1-to">8</span>
          <span className="d1-unit">tools</span>
        </div>
      </div>
      <div className="d1-grid">
        <div className="d1-left">
          <div className="card card--plain d1-prefix">
            <p className="d1-label">Prefixed by backend</p>
            <p className="d1-names">
              <code>
                <b className="t-brand">issues__</b>search
              </code>
              <code>
                <b className="t-brand">docs__</b>search
              </code>
            </p>
          </div>
          <p className="d1-rule">
            Filtering = what <b>exists</b> on this endpoint, <b>for everyone.</b>
          </p>
        </div>
        <Code size={34}>{YAML}</Code>
      </div>
    </DeckSlide>
  )
}
