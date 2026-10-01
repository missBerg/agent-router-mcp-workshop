import { Code } from '../components/Code'
import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

// Verified against the router: tools/list has no arguments and other deploy tools have no
// `environment`, so the CEL uses optional access (.?) — zero evaluation errors.
const YAML = `
rules:
  # 1 · Deny first: production needs a human
  - target: {tools: [{backend: deploy, tool: deploy}]}
    cel: >-
      request.mcp.params.?arguments.?environment
        .orValue("") == "production"
    action: Deny
  # 2 · Then allow deploy:write
  - source: {jwt: {scopes: [deploy:write]}}
    target: {tools: [{backend: deploy, tool: deploy}]}
`

export function S15Debrief2() {
  return (
    <DeckSlide
      className="s-debrief2"
      notes={
        <SpeakerNotes
          time="0:54–0:55"
          segment="Debrief 2"
          cues={[
            <>
              Soft sync: <b>"Not at the checkpoint? <code>./lab solution 2</code> and keep going."</b>
            </>,
            <>Ask: "Who wrote an allow rule with the condition first? What happened to the deploy tool?" Let one person explain.</>,
          ]}
        >
          <p>
            The pattern to take home: <b>deny first, then allow.</b> Rule 1 denies <code>deploy</code> when the
            environment argument is production, for everyone. Rule 2 allows deploy for anyone holding{' '}
            <code>deploy:write</code>. First match wins, so production is blocked before the allow is reached.
          </p>
          <p>
            Why not one rule: "allow deploy if environment is staging"? Because the router also applies rules to{' '}
            <code>tools/list</code>, and at list time <b>there are no arguments</b>. An allow-only-if-arguments rule
            can't match, so the tool disappears from the list and the agent can't even deploy to staging.
          </p>
          <p>
            The <code>.?</code> matters too — it's CEL's optional field access, like <code>?.</code> in JavaScript.
            At list time there are no arguments, and other deploy tools (like <code>get_deployment_status</code>)
            have no <code>environment</code>; a plain <code>.environment</code> lookup errors with "no such key"
            every time. <code>.orValue("")</code> turns "missing" into "not production".
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Debrief · Lab 2</p>
      <h2 className="title">Deny first, then allow</h2>
      <div className="d2-grid">
        <Code size={30} highlight={[2, 3, 4, 5, 6, 7]}>
          {YAML}
        </Code>
        <div className="card card--raspberry d2-why">
          <p className="d2-why-label">Why deny-first?</p>
          <p>
            <code>tools/list</code> has <b>no arguments</b>.
          </p>
          <p>
            An allow-only-if-arguments rule can't match, so the tool is <b>hidden</b>.
          </p>
          <p className="d2-why-foot">
            <code>.?</code> keeps checks quiet when a field is missing.
          </p>
        </div>
      </div>
      <div className="d2-outcomes">
        <span className="d2-outcome">
          release-bot · staging <b className="t-ok">Allow</b>
        </span>
        <span className="d2-outcome">
          release-bot · production <b className="t-danger">Deny 403</b>
        </span>
        <span className="d2-outcome">
          triage-bot · deploy <b className="t-muted">not even listed</b>
        </span>
      </div>
    </DeckSlide>
  )
}
