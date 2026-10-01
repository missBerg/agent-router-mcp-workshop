import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

const STEPS = ['Predict', 'Run', 'Investigate', 'Modify', 'Make']
const R = 225 // radius of the cycle
const C = 330 // centre of the 660×660 viewBox
const NODE = 100 // node radius

function point(i: number, r = R) {
  const a = (-90 + i * 72) * (Math.PI / 180)
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }
}

/** Arc from node i to node i+1, trimmed so it starts and ends outside the nodes. */
function arc(i: number) {
  const trim = 27 // degrees
  const a0 = (-90 + i * 72 + trim) * (Math.PI / 180)
  const a1 = (-90 + (i + 1) * 72 - trim) * (Math.PI / 180)
  const p0 = { x: C + R * Math.cos(a0), y: C + R * Math.sin(a0) }
  const p1 = { x: C + R * Math.cos(a1), y: C + R * Math.sin(a1) }
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${p1.x} ${p1.y}`
}

function Cycle() {
  return (
    <svg className="primm" viewBox="0 0 660 660" role="img" aria-label="PRIMM cycle: Predict, Run, Investigate, Modify, Make">
      <defs>
        <marker id="primm-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#B83700" />
        </marker>
      </defs>
      {STEPS.map((_, i) =>
        i < STEPS.length - 1 ? (
          <path key={`a${i}`} d={arc(i)} fill="none" stroke="#B83700" strokeWidth="5" markerEnd="url(#primm-arrow)" />
        ) : (
          <path key={`a${i}`} d={arc(i)} fill="none" stroke="#B83700" strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round" markerEnd="url(#primm-arrow)" />
        ),
      )}
      <text x={C} y={C - 6} textAnchor="middle" className="primm-center">
        PRIMM
      </text>
      <text x={C} y={C + 34} textAnchor="middle" className="primm-center-sub">
        every lab
      </text>
      {STEPS.map((s, i) => {
        const p = point(i)
        const brand = i === 0
        return (
          <g key={s}>
            <circle cx={p.x} cy={p.y} r={NODE} fill={brand ? '#FF5500' : '#FFFFFF'} stroke={brand ? '#FF5500' : '#B83700'} strokeWidth="4" />
            <text x={p.x} y={p.y + 12} textAnchor="middle" className={`primm-label ${s.length > 8 ? 'primm-label--long' : ''}`}>
              {s}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function S08HowLabsWork() {
  return (
    <DeckSlide
      tone="mint"
      className="s-how"
      notes={
        <SpeakerNotes
          time="0:08–0:09"
          segment="How the labs work"
          cues={[
            <>Stress the two commands. They're the safety net that lets a mixed room move at different speeds.</>,
            <>"Nobody gets left behind: <code>./lab solution N</code> backs up your file and jumps you to a known-good state."</>,
          ]}
        >
          <p>
            Every lab has the same shape, so you can stop thinking about the structure. <b>Predict</b> first: answer a
            question before you run anything. <b>Run</b> the given config with one command. <b>Investigate</b> what
            happened. <b>Modify</b> one file, <code>workspace/mcproute.yaml</code>, to reach the goal. <b>Make</b> is
            the open-ended challenge.
          </p>
          <p>
            Three tiers. <b>Core</b> is what everyone does in the time. <b>Stretch</b> if you finish early.{' '}
            <b>Explore</b> is take-home depth.
          </p>
          <p>
            <code>./lab check N</code> tells you instantly whether you hit the checkpoint, and what's wrong if not.{' '}
            <code>./lab solution N</code> catches you up any time.
          </p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">How the labs work</p>
      <h2 className="title">Same loop, every lab. Your pace.</h2>
      <div className="how-grid">
        <Cycle />
        <div className="how-right">
          <div className="how-tiers">
            <div className="how-tier">
              <span className="how-tier-name">Core</span>
              <span>everyone, in the time</span>
            </div>
            <div className="how-tier">
              <span className="how-tier-name">Stretch</span>
              <span>finished early? build more</span>
            </div>
            <div className="how-tier">
              <span className="how-tier-name">Explore</span>
              <span>take-home depth</span>
            </div>
          </div>
          <div className="how-cmds">
            <div className="how-cmd">
              <code>./lab check N</code>
              <span>instant feedback</span>
            </div>
            <div className="how-cmd">
              <code>./lab solution N</code>
              <span>catch up any time</span>
            </div>
          </div>
        </div>
      </div>
    </DeckSlide>
  )
}
