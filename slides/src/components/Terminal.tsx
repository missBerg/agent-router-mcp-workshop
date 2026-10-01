import type { ReactNode } from 'react'

export type TerminalLine = {
  cmd: string
  /** Short annotation shown to the right of (or under) the command. */
  note?: ReactNode
}

type Props = {
  lines: TerminalLine[]
  /** Font size of the commands in 1080p px. */
  size?: number
  /** Put annotations under each command instead of beside it. */
  stacked?: boolean
  title?: string
}

/** Shell commands with a "$" prompt, big enough to copy from the back row. */
export function Terminal({ lines, size = 40, stacked = false, title }: Props) {
  return (
    <div className={`term ${stacked ? 'term--stacked' : ''}`} style={{ fontSize: size }}>
      {title && (
        <div className="term-bar">
          <span className="term-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="term-title">{title}</span>
        </div>
      )}
      {lines.map((line, i) => (
        <div className="term-line" key={i}>
          <code className="term-cmd">
            <span className="term-prompt" aria-hidden="true">
              $
            </span>
            {line.cmd}
          </code>
          {line.note && <span className="term-note">{line.note}</span>}
        </div>
      ))}
    </div>
  )
}
