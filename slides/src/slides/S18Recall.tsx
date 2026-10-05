import { Appear } from 'spectacle'
import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

const QA = [
  {
    q: 'Where do you cut 200 tools to 8?',
    a: (
      <>
        <code>toolSelector</code> on each <code>backendRef</code>
      </>
    ),
  },
  {
    q: "Why can't triage-bot even see deploy?",
    a: (
      <>
        <code>tools/list</code> applies authorization
      </>
    ),
  },
  {
    q: 'Where do you look to see who called what?',
    a: <>Access logs and traces, with session + agent id</>,
  },
]

export function S18Recall() {
  return (
    <DeckSlide
      tone="peach"
      className="s-recall"
      notes={
        <SpeakerNotes
          time="1:09–1:11"
          segment="Wrap-up · recall"
          cues={[
            <>
              Ask each question to the room, wait for a few voices, <b>then click</b> to reveal. Three clicks total.
            </>,
            <>Retrieval practice works when people answer before they see it. Resist answering for them.</>,
          ]}
        >
          <p>Laptops half-closed. Three questions, answer out loud.</p>
          <p>
            <b>1.</b> Where do you cut 200 tools to 8? (click) A <code>toolSelector</code> on each backendRef of the
            MCPRoute. What exists, for everyone.
          </p>
          <p>
            <b>2.</b> Why can't triage-bot even see deploy? (click) Because <code>tools/list</code> applies the same
            authorization rules as <code>tools/call</code>. Agents only discover what they may call.
          </p>
          <p>
            <b>3.</b> Where do you look to see who called what? (click) The access logs and traces, with the session
            and the agent id you put there in Lab 3.
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Recall</p>
      <h2 className="title">Three questions</h2>
      <ol className="recall">
        {QA.map((item, i) => (
          <li className="recall-item" key={i}>
            <span className="recall-n">{i + 1}</span>
            <div className="recall-body">
              <p className="recall-q">{item.q}</p>
              <Appear>
                <p className="recall-a">{item.a}</p>
              </Appear>
            </div>
          </li>
        ))}
      </ol>
    </DeckSlide>
  )
}
