import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'
import { EVENT, EVENT_DATE, SPEAKER } from '../config'
import arLockup from '../assets/ar-horizontal-on-dark-transparent.svg'
import aaifLogo from '../assets/aaif-logo-white.svg'

export function S01Title() {
  return (
    <DeckSlide
      tone="dark"
      footer={false}
      className="s-title"
      notes={
        <SpeakerNotes
          time="0:00–0:01"
          segment="Welcome"
          cues={[
            <>
              <b>Before doors open:</b> this tab in presenter mode on your laptop, the audience tab on the projector.
              Demo Codespace open with a big terminal font, <code>./lab doctor</code> green.
            </>,
            <>Helpers in the aisles from minute 0 for GitHub sign-in and Codespace start-up questions.</>,
          ]}
        >
          <p>
            Welcome! I'm Erica Hughberg from Tetrate. I work on Agent Router, the open-source router for agent
            traffic that used to be called Envoy AI Gateway. It's now an Agentic AI Foundation project.
          </p>
          <p>
            For the next 75 minutes you'll put one router in front of five MCP servers and make your agent{' '}
            <b>smaller, safer and observable</b>. Three hands-on labs; each one ends with your agent making a real
            tool call through the router.
          </p>
          <p>
            <em>Do not linger here.</em> Within 30 seconds go to the next slide so laptops start booting.
          </p>
        </SpeakerNotes>
      }
    >
      <img className="title-lockup" src={arLockup} alt="Agent Router" />
      <div className="title-body">
        <p className="kicker">Hands-on workshop · 75 minutes · bring a laptop</p>
        <h1 className="title-main">One Router for Your Agent's MCP Servers</h1>
        <p className="title-sub t-oxidise">Aggregate, Authorize and Observe Every Tool Call</p>
      </div>
      <div className="title-foot">
        <div className="title-speaker">
          <span className="title-name">{SPEAKER.name}</span>
          <span className="title-role">
            {SPEAKER.org} · {SPEAKER.role}
          </span>
        </div>
        <div className="title-event">
          <span className="title-event-name">
            {EVENT} · {EVENT_DATE}
          </span>
          <span className="title-aaif">
            <span>An Agentic AI Foundation project</span>
            <img src={aaifLogo} alt="Agentic AI Foundation" />
          </span>
        </div>
      </div>
    </DeckSlide>
  )
}
