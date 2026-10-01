import { DeckSlide } from '../components/DeckSlide'
import { LabGo } from '../components/LabGo'
import { SpeakerNotes } from '../components/SpeakerNotes'

export function S10Lab1Go() {
  return (
    <DeckSlide
      tone="dark"
      className="s-go"
      notes={
        <SpeakerNotes
          time="0:10–0:32"
          segment="Lab 0 (5 min) → Lab 1 Aggregate & filter (17 min)"
          cues={[
            <>
              <b>0:10</b> Everyone: <code>./lab doctor</code>. Red LLM check? <code>./lab llm</code> (GitHub Models
              in Codespaces, or BYO key). No key at all: <code>./lab llm scripted</code>, a deterministic brain that
              still makes real tool calls.
            </>,
            <>
              <b>0:13</b> Ask: "Who has seen the 200-tool banner from <code>./lab agent --direct</code>?" Remind them
              to note the token number.
            </>,
            <>
              <b>0:15</b> Lab 1 starts. Predict question on the lab page: two servers both have a <code>search</code>{' '}
              tool; what will the agent see behind one endpoint?
            </>,
            <>
              Walk the room. Common snags: port 1975 busy → <code>./lab stop</code>; the router takes ~7 s to restart
              after each <code>./lab run</code>; YAML indentation under <code>toolSelector</code>.
            </>,
            <>
              <b>0:25</b> Announce: "If you haven't edited the YAML yet, open Hint 1 on the lab page."
            </>,
            <>
              <b>0:30</b> Two-minute warning: "Not at the checkpoint? <code>./lab solution 1</code> and keep going.
              You can come back."
            </>,
          ]}
        >
          <p>
            Your turn. Start with Lab 0: <code>./lab doctor</code> should be all green. Then run the agent the old way,{' '}
            <code>./lab agent --direct</code>, and note your own tool and token numbers.
          </p>
          <p>
            Then Lab 1: <code>./lab start 1 && ./lab run</code> puts the router in front of all five servers. Your
            agent now connects to one URL. Your job is to edit <b>one file</b>, <code>workspace/mcproute.yaml</code>,
            until it exposes exactly the 8 tools the job needs. Two backends are done for you.
          </p>
          <p>
            Everything is on the lab page. We regroup at <b>0:32</b>.
          </p>
        </SpeakerNotes>
      }
    >
      <LabGo
        lab={1}
        kicker="Your turn · Lab 0 → Lab 1"
        title={
          <>
            Set up, then <span className="t-brand">aggregate & filter</span>
          </>
        }
        until="0:32"
        minutes="≈ 22 min"
        question={
          <>
            <b>Predict:</b> two servers both have a <code className="ic">search</code> tool. What does the agent see
            behind one endpoint?
          </>
        }
        commands={[
          { cmd: './lab doctor', note: 'all green?' },
          { cmd: './lab start 1 && ./lab run', note: 'router in front of 5 servers' },
          { cmd: './lab agent', note: 'one URL. Now cut to 8 tools.' },
        ]}
        checkpoint="./lab check 1"
      />
    </DeckSlide>
  )
}
