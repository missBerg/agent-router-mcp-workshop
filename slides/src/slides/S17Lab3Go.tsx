import { DeckSlide } from '../components/DeckSlide'
import { LabGo } from '../components/LabGo'
import { SpeakerNotes } from '../components/SpeakerNotes'

export function S17Lab3Go() {
  return (
    <DeckSlide
      tone="dark"
      className="s-go"
      notes={
        <SpeakerNotes
          time="0:57–1:09"
          segment="Lab 3 · Observe (12 min)"
          cues={[
            <>
              <code>./lab otel</code> opens otel-tui: tell people to run it in a <b>second terminal</b> (Codespaces:
              the split-terminal button).
            </>,
            <>
              Run the agent as both bots so there's something to investigate, including release-bot trying
              production: <code>./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"</code>.
            </>,
            <>
              Modify step: <code>claimToHeaders</code> (<code>sub</code> → <code>x-agent-id</code>) plus{' '}
              <code>OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES=x-agent-id:agent.id</code> in{' '}
              <code>workspace/telemetry.env</code>. That's what puts "who" into spans.
            </>,
            <>
              Can't find the logs? <code>aigw run</code> writes Envoy access logs to a file, not the terminal:{' '}
              <code>./lab logs</code> reads it for you.
            </>,
            <>
              <b>1:03</b> "Halfway." <b>1:07</b> Two-minute warning: <code>./lab solution 3</code>.
            </>,
          ]}
        >
          <p>
            Last lab. <code>./lab start 3</code> turns telemetry on. Open <code>./lab otel</code> in a
            second terminal for traces, and <code>./lab logs</code> for the access log.
          </p>
          <p>
            Your mission is an investigation: <b>which agent tried to deploy to production, and what stopped it?</b>{' '}
            <code>./lab check 3</code> asks you the questions and checks your answers against the recorded telemetry.
          </p>
          <p>
            We wrap up at <b>1:09</b>.
          </p>
        </SpeakerNotes>
      }
    >
      <LabGo
        lab={3}
        kicker="Your turn · Lab 3"
        title={<span className="t-brand">Observe</span>}
        until="1:09"
        minutes="≈ 12 min"
        question={
          <>
            <b>Investigate:</b> Which agent tried to deploy to production, and what stopped it?
          </>
        }
        commands={[
          { cmd: './lab start 3' },
          { cmd: './lab otel', note: 'second terminal' },
          { cmd: './lab logs' },
        ]}
        checkpoint="./lab check 3"
      />
    </DeckSlide>
  )
}
