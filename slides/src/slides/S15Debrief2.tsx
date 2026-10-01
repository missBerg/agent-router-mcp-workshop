import { Code } from '../components/Code'
import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

// Verified against the router: tools/list is evaluated as a hypothetical
// tools/call per tool, so the CEL guard is has(...), not a method check.
const YAML = `
rules:
  # 1 · Deny first: production needs a human
  - target: {tools: [{backend: deploy, tool: deploy}]}
    cel: >-
      has(request.mcp.params.arguments) &&
      request.mcp.params.arguments.environment == "production"
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
            The <code>has(...)</code> guard matters too: the router checks <code>tools/list</code> as a hypothetical{' '}
            <code>tools/call</code> per tool, and without the guard the CEL lookup errors with "no such key:
            arguments". (Guarding on <code>request.mcp.method</code> does not prevent that.)
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
            <code>has()</code> keeps list-time checks quiet.
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
