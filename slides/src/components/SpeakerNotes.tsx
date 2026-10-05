import type { ReactNode } from 'react'
import { Notes } from 'spectacle'

type Props = {
  /** Workshop clock for this slide, e.g. "0:02–0:03". */
  time: string
  /** Segment name from the run-of-show (DESIGN.md §3). */
  segment: string
  /** What to say. */
  children: ReactNode
  /** Facilitation cues: what to do / watch for in the room. */
  cues?: ReactNode[]
}

/**
 * Presenter notes, rendered by Spectacle only in presenter mode
 * (?presenterMode=true, or Cmd/Ctrl+Shift+P).
 */
export function SpeakerNotes({ time, segment, children, cues }: Props) {
  return (
    <Notes>
      <div className="notes">
        <div className="notes-head">
          <span className="notes-time">{time}</span>
          <span className="notes-segment">{segment}</span>
        </div>
        <div className="notes-say">{children}</div>
        {cues && cues.length > 0 && (
          <>
            <h4>Facilitation</h4>
            <ul className="notes-cues">
              {cues.map((cue, i) => (
                <li key={i}>{cue}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Notes>
  )
}
