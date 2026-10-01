import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

export function S03Hook() {
  return (
    <DeckSlide
      tone="dark"
      className="s-hook"
      notes={
        <SpeakerNotes
          time="0:02–0:03"
          segment="Hook"
          cues={[
            <>Pause after the first line. Let the second line land.</>,
            <>Quick poll: "Hands up if your agent has more than 20 tools connected. More than 50? More than 100?"</>,
          ]}
        >
          <p>
            <b>Your agent needs eight tools to do its job. So why give it two hundred?</b>
          </p>
          <p>
            That's the question for today. Connecting an MCP server is one line of config, so we connect all of
            them, and every tool from every server lands in the agent's context, whether the job needs it or not.
          </p>
          <p>Let me show you what that looks like at a company with just five MCP servers.</p>
        </SpeakerNotes>
      }
    >
      <div className="hook">
        <p className="hook-line">
          Your agent needs <span className="t-ok">eight</span> tools.
        </p>
        <p className="hook-line">
          So why give it <span className="hook-many">two hundred?</span>
        </p>
      </div>
    </DeckSlide>
  )
}
