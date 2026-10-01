import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

export function S06WhyItHurts() {
  return (
    <DeckSlide
      className="s-hurts"
      notes={
        <SpeakerNotes
          time="0:06–0:07"
          segment="Hook · explain what we just saw"
          cues={[<>Tie each column back to the demo: "remember the token number on the banner?"</>]}
        >
          <p>Three reasons 200 tools hurts, and we just saw all three.</p>
          <p>
            <b>Context cost.</b> Every tool definition (name, description, JSON schema) goes into the context on
            every turn. That's tens of thousands of tokens before the agent reads your prompt. And some APIs simply
            refuse: a cap of 128 tools per request is common.
          </p>
          <p>
            <b>Selection accuracy.</b> The CI server has <code>get_job_logs</code>, <code>download_job_logs</code> and{' '}
            <code>stream_logs</code>. Near-duplicates make the model guess. More choices, more wrong picks.
          </p>
          <p>
            <b>Blast radius.</b> <code>deploy__delete_environment</code> is in the list. The model doesn't have to be
            malicious; one bad guess, or one prompt injection in an issue comment, is enough.
          </p>
          <p>The fix for all three is the same: give the agent only the tools the job needs.</p>
        </SpeakerNotes>
      }
    >
      <p className="kicker">Why it hurts</p>
      <h2 className="title">Every extra tool costs you three ways</h2>
      <div className="hurts-grid">
        <div className="card hurts-card">
          <span className="hurts-n">01</span>
          <h3 className="card-title">Context cost</h3>
          <p>Tens of thousands of tokens before the agent reads your prompt.</p>
          <p className="hurts-foot">Some APIs cap tools at 128 per request.</p>
        </div>
        <div className="card card--spotlight hurts-card">
          <span className="hurts-n">02</span>
          <h3 className="card-title">Selection accuracy</h3>
          <p>Near-duplicates make the model guess:</p>
          <ul className="hurts-dupes">
            <li>
              <code>get_job_logs</code>
            </li>
            <li>
              <code>download_job_logs</code>
            </li>
            <li>
              <code>stream_logs</code>
            </li>
          </ul>
        </div>
        <div className="card card--raspberry hurts-card">
          <span className="hurts-n">03</span>
          <h3 className="card-title">Blast radius</h3>
          <p>
            <code className="hurts-danger">
              deploy__
              <wbr />
              delete_environment
            </code>
          </p>
          <p>is one bad guess away.</p>
        </div>
      </div>
    </DeckSlide>
  )
}
