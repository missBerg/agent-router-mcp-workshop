import type { ReactNode } from 'react'
import { LAB_PAGES, labPageUrl } from '../config'
import { QR } from './QR'
import { Terminal, type TerminalLine } from './Terminal'

type Props = {
  lab: 0 | 1 | 2 | 3
  kicker: string
  title: ReactNode
  until: string
  minutes: string
  commands: TerminalLine[]
  /** Optional prompt shown above the commands (Predict / the investigation question). */
  question?: ReactNode
  checkpoint: string
  /** Optional strip under the checkpoint line (e.g. the workshop LLM key). */
  extra?: ReactNode
}

/** Shared layout for the dark "your turn" slides. */
export function LabGo({ lab, kicker, title, until, minutes, commands, question, checkpoint, extra }: Props) {
  const url = labPageUrl(lab)
  return (
    <div className="labgo">
      <div className="labgo-main">
        <p className="kicker">{kicker}</p>
        <h2 className="title labgo-title">{title}</h2>
        {question && <div className="labgo-question">{question}</div>}
        <Terminal lines={commands} size={42} />
        <div className="labgo-check">
          <span>
            Checkpoint <code className="ic">{checkpoint}</code>
          </span>
          <span className="labgo-stuck">
            Stuck? <code className="ic">./lab solution {lab}</code>
          </span>
        </div>
        {extra}
      </div>
      <aside className="labgo-side">
        <div className="until">
          <span className="until-label">until</span>
          <span className="until-time">{until}</span>
          <span className="until-mins">{minutes}</span>
        </div>
        <QR value={url} size={240} title={`Lab ${lab} page`} caption={<>Lab {lab} guide<br /><code>…/{LAB_PAGES[lab]}</code></>} />
      </aside>
    </div>
  )
}
