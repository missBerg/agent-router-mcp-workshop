import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

const RULES = [
  { who: 'scope issues:read', what: 'issues__get_issue', verdict: 'Allow' },
  { who: 'scope chat:write', what: 'chat__post_message', verdict: 'Allow' },
  { who: 'scope deploy:write', what: 'deploy__deploy', verdict: 'Allow' },
]

export function S13Rules() {
  return (
    <DeckSlide
      className="s-rules"
      notes={
        <SpeakerNotes
          time="0:35–0:36"
          segment="Concept · authorization rules"
          cues={[<>The second half of this slide is the surprising part. Slow down on "tools/list".</>]}
        >
          <p>
            Authorization is a list of rules on the MCPRoute. Each rule says: <i>this source</i> (for us, JWT
            scopes) may call <i>these tools</i>. They're evaluated <b>in order, first match wins</b>, and if nothing
            matches, the <b>default is Deny</b>.
          </p>
          <p>
            Here's the part people don't expect: <code>tools/list</code> honors the same rules as{' '}
            <code>tools/call</code>. triage-bot doesn't get a "403" when it tries to deploy. It never sees{' '}
            <code>deploy__deploy</code> in the first place. <b>Agents only discover what they may call.</b> That's
            least privilege that also saves tokens.
          </p>
          <p>Predict for Lab 2: triage-bot runs the full task. What happens at the deploy step?</p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Concept · Authorization rules</p>
      <h2 className="title">In order. First match wins. Default Deny.</h2>
      <div className="rules-grid">
        <ol className="rules">
          {RULES.map((r, i) => (
            <li className="rule" key={r.what}>
              <span className="rule-n">{i + 1}</span>
              <span className="rule-who">{r.who}</span>
              <span className="rule-arrow">→</span>
              <code className="rule-what">{r.what}</code>
              <span className="rule-verdict rule-verdict--allow">{r.verdict}</span>
            </li>
          ))}
          <li className="rule rule--default">
            <span className="rule-n">∅</span>
            <span className="rule-who">no match</span>
            <span className="rule-arrow">→</span>
            <span className="rule-what" />
            <span className="rule-verdict rule-verdict--deny">Deny</span>
          </li>
        </ol>
        <div className="card rules-callout">
          <p className="rules-callout-top">
            <code>tools/list</code> applies the same rules as <code>tools/call</code>
          </p>
          <p className="rules-callout-big">Agents only discover what they may call.</p>
          <div className="rules-list">
            <p className="rules-list-label">triage-bot's tools/list</p>
            <div className="chips">
              <span className="chip">issues__get_issue</span>
              <span className="chip">chat__post_message</span>
              <span className="chip chip--hidden">deploy__deploy</span>
            </div>
          </div>
        </div>
      </div>
    </DeckSlide>
  )
}
