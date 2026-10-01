import { DeckSlide } from '../components/DeckSlide'
import { LabGo } from '../components/LabGo'
import { SpeakerNotes } from '../components/SpeakerNotes'

export function S14Lab2Go() {
  return (
    <DeckSlide
      tone="dark"
      className="s-go"
      notes={
        <SpeakerNotes
          time="0:36–0:54"
          segment="Lab 2 · Authorize (18 min)"
          cues={[
            <>
              Behind on Lab 1? <code>./lab solution 1</code> first; Lab 2 starts from its own known state anyway
              (<code>./lab start 2</code>).
            </>,
            <>
              Investigate step people enjoy: call the router with no token, see the <code>401</code> and{' '}
              <code>WWW-Authenticate</code>, then fetch <code>/.well-known/oauth-protected-resource/mcp</code>.
            </>,
            <>
              Most common snag: an <em>allow</em> rule with an argument condition. The deploy tool vanishes from{' '}
              <code>tools/list</code>. Point them to Hint 2 (deny-first). This is the debrief, so don't spoil it for
              the room.
            </>,
            <>
              Also common: rule order. A broad allow above the deny wins first.
            </>,
            <>
              <b>0:46</b> "Halfway." <b>0:52</b> Two-minute warning: <code>./lab solution 2</code> and keep going.
            </>,
          ]}
        >
          <p>
            Lab 2. <code>./lab start 2 && ./lab run</code> turns on identity. Run the agent as triage-bot first.{' '}
            <b>Predict before you run it:</b> what happens at the deploy step?
          </p>
          <p>
            Then as release-bot, which deploys to staging. Your Modify step: the runbook says production deploys need a
            human. Add a rule so <b>nobody</b> can deploy to production through the router, while release-bot can
            still deploy to staging.
          </p>
          <p>
            Checkpoint: <code>./lab check 2</code>. We regroup at <b>0:54</b>.
          </p>
        </SpeakerNotes>
      }
    >
      <LabGo
        lab={2}
        kicker="Your turn · Lab 2"
        title={<span className="t-brand">Authorize</span>}
        until="0:54"
        minutes="≈ 18 min"
        question={
          <>
            <b>Predict:</b> triage-bot runs the full task. What happens at the deploy step?
          </>
        }
        commands={[
          { cmd: './lab start 2 && ./lab run' },
          { cmd: './lab agent --as triage-bot' },
          { cmd: './lab agent --as release-bot' },
        ]}
        checkpoint="./lab check 2"
      />
    </DeckSlide>
  )
}
