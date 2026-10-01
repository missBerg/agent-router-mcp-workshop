import { useContext } from 'react'
import { DeckContext, useSteps } from 'spectacle'
import { DeckSlide } from '../components/DeckSlide'
import { SpeakerNotes } from '../components/SpeakerNotes'

type Server = { name: string; port: number; count: number; needed: { at: number; tool: string }[] }

// DESIGN.md §5: five servers, 200 tools; the ship-it job needs 8 of them.
const SERVERS: Server[] = [
  { name: 'issues', port: 3001, count: 44, needed: [{ at: 7, tool: 'get_issue' }, { at: 30, tool: 'add_comment' }] },
  { name: 'ci', port: 3002, count: 42, needed: [{ at: 3, tool: 'list_pipeline_runs' }, { at: 22, tool: 'get_job_logs' }] },
  { name: 'deploy', port: 3003, count: 38, needed: [{ at: 14, tool: 'deploy' }, { at: 27, tool: 'get_deployment_status' }] },
  { name: 'docs', port: 3004, count: 32, needed: [{ at: 19, tool: 'search_docs' }] },
  { name: 'chat', port: 3005, count: 44, needed: [{ at: 11, tool: 'post_message' }] },
]

function ToolWall() {
  const { placeholder, isActive } = useSteps(1)
  const deck = useContext(DeckContext)
  const revealed = isActive || deck?.inOverviewMode || deck?.inPrintMode
  return (
    <>
      {placeholder}
      <div className={`wall ${revealed ? 'wall--revealed' : ''}`}>
        <div className="wall-head">
          <div>
            <p className="kicker">Lakeshore Labs · a fictional Toronto startup</p>
            <h2 className="title">
              5 MCP servers. <span className="t-muted">200 tools.</span>
            </h2>
          </div>
          <div className="wall-badge" aria-hidden={!revealed}>
            <span className="wall-badge-n">8</span>
            <span className="wall-badge-label">
              the ship-it job
              <br />
              actually needs
            </span>
          </div>
        </div>
        <div className="wall-groups">
          {SERVERS.map((s) => {
            const neededAt = new Set(s.needed.map((n) => n.at))
            return (
              <div className="wall-group" key={s.name}>
                <div className="wall-group-head">
                  <code className="wall-group-name">{s.name}</code>
                  <span className="wall-group-count">{s.count}</span>
                </div>
                <div className="wall-tiles">
                  {Array.from({ length: s.count }, (_, i) => (
                    <span key={i} className={`tile ${neededAt.has(i) ? 'tile--needed' : ''}`} />
                  ))}
                </div>
                <ul className="wall-needed">
                  {s.needed.map((n) => (
                    <li key={n.tool}>
                      <code>{n.tool}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function S04Lakeshore() {
  return (
    <DeckSlide
      className="s-wall"
      notes={
        <SpeakerNotes
          time="0:03–0:04"
          segment="Hook · the problem, made concrete"
          cues={[
            <>
              <b>Click once</b> to light up the 8 tools the job needs. Ask the room to guess the number first.
            </>,
            <>Mention the near-duplicates and the dangerous tools hiding in the grey: we'll come back to both.</>,
          ]}
        >
          <p>
            Meet Lakeshore Labs, a fictional Toronto startup. They run a <code>checkout</code> service, and their
            engineering org exposes five MCP servers: issues, CI, deploy, docs and chat. 200 tools in total.
          </p>
          <p>
            Their ship-it agent gets one job: <i>Issue #42 just came in: checkout rejects valid Toronto postal codes
            like "m5v 3l9". Triage it, find the failing CI run, check the runbook, comment on the issue, deploy the
            fix to staging, confirm it's healthy, and post in #releases.</i>
          </p>
          <p>
            <b>How many of these 200 tools does that job need? Guess.</b> (click) Eight. Two from issues, two from CI,
            two from deploy, one from docs, one from chat. The other 192 are noise, and some of them are dangerous.
          </p>
        </SpeakerNotes>
      }
    >
      <ToolWall />
    </DeckSlide>
  )
}
