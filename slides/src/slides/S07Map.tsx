import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

const STOPS = [
  { lab: 'Lab 0', name: 'Setup', min: 5, outcome: <>Meet the agent: <b>200 tools</b>, straight to the servers</> },
  { lab: 'Lab 1', name: 'Aggregate & filter', min: 17, outcome: <>One endpoint, <b>8 tools</b>, task done through the router</> },
  { lab: 'Lab 2', name: 'Authorize', min: 18, outcome: <>Each bot sees only what it may call; <b>production denied</b></> },
  { lab: 'Lab 3', name: 'Observe', min: 12, outcome: <>Find <b>who tried to deploy</b> to production, from telemetry</> },
]

export function S07Map() {
  return (
    <DeckSlide
      className="s-map"
      notes={
        <SpeakerNotes
          time="0:07–0:08"
          segment="Objectives · session map"
          cues={[<>Keep it brisk: this is the "inform objectives" beat, not a lecture.</>]}
        >
          <p>Here's the route for today. Four stops.</p>
          <p>
            <b>Lab 0</b>, five minutes: get set up and run the agent the way you just saw, 200 tools.{' '}
            <b>Lab 1</b>: put the router in front of all five servers and cut 200 tools to 8.{' '}
            <b>Lab 2</b>: give two agents two identities and decide what each may see and call, down to the
            arguments. <b>Lab 3</b>: turn on telemetry and investigate what the agents did.
          </p>
          <p>
            The promise: <b>every lab ends with your agent making a real tool call through the router.</b> Not a
            slide, not a diagram: a call you can see in the logs.
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Today's route</p>
      <h2 className="title">Three labs, one router</h2>
      <div className="map">
        <div className="map-line" aria-hidden="true" />
        {STOPS.map((s, i) => (
          <div className={`map-stop ${i === 0 ? 'map-stop--setup' : ''}`} key={s.lab}>
            <span className="map-dot" aria-hidden="true" />
            <div className="map-card">
              <div className="map-meta">
                <span className="map-lab">{s.lab}</span>
                <span className="map-min">{s.min} min</span>
              </div>
              <h3 className="map-name">{s.name}</h3>
              <p className="map-outcome">{s.outcome}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="map-promise">
        Every lab ends with <b>your agent making a real tool call through the router.</b>
      </p>
    </DeckSlide>
  )
}
