import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

const BASE_SCOPES = ['issues:read', 'issues:write', 'ci:read', 'docs:read', 'chat:write']

export function S12Identity() {
  return (
    <DeckSlide
      className="s-identity"
      notes={
        <SpeakerNotes
          time="0:34–0:35"
          segment="Concept · identity"
          cues={[<>Keep the OAuth part light: it's an Investigate step in Lab 2, they'll see it for themselves.</>]}
        >
          <p>
            Filtering decided what <i>exists</i>. Now: <b>who can see and call it?</b> For that the router needs to
            know who's calling.
          </p>
          <p>
            In Lab 2 you have two agents, two identities, each a JWT signed by the workshop's key, which is public on
            purpose. <b>triage-bot</b> can read issues and CI, read docs, comment and chat. <b>release-bot</b> has all
            of that plus <code>deploy:write</code>.
          </p>
          <p>
            And the router speaks the <b>MCP authorization spec</b>. Call it without a token and you get a{' '}
            <code>401</code> with a <code>WWW-Authenticate</code> header pointing to{' '}
            <code>/.well-known/oauth-protected-resource</code>: that's how an MCP client discovers where to get a
            token. The router serves that for you.
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Concept · Identity</p>
      <h2 className="title">
        Filtering decides what exists.
        <br />
        <span className="t-brand">Authorization decides who can use it.</span>
      </h2>
      <div className="id-grid">
        <div className="card card--spotlight id-card">
          <p className="id-label">JWT · sub</p>
          <h3 className="id-name">triage-bot</h3>
          <div className="chips">
            {BASE_SCOPES.map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="card id-card">
          <p className="id-label">JWT · sub</p>
          <h3 className="id-name">release-bot</h3>
          <div className="chips">
            {BASE_SCOPES.map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
            <span className="chip chip--brand">+ deploy:write</span>
          </div>
        </div>
      </div>
      <div className="id-spec">
        <span className="id-spec-label">No token?</span>
        <code>401</code>
        <span className="id-spec-arrow">→</span>
        <code>WWW-Authenticate: Bearer resource_metadata=…</code>
        <span className="id-spec-arrow">→</span>
        <code>/.well-known/oauth-protected-resource</code>
        <span className="id-spec-note">The MCP auth spec, served by the router.</span>
      </div>
    </DeckSlide>
  )
}
