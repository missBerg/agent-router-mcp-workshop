import type { CSSProperties, ReactNode } from 'react'

type Props = {
  /** Source text. Leading/trailing blank lines are trimmed. */
  children: string
  /** Font size in 1080p px. Keep ≥ 28 so the back row can read it. */
  size?: number
  /** 1-based line numbers to emphasise. */
  highlight?: number[]
  /** Emphasis colour for highlighted lines. */
  highlightTone?: 'danger' | 'ok' | 'brand'
  className?: string
  style?: CSSProperties
}

// Tiny YAML tokenizer: comments, keys, strings, Allow/Deny, flow punctuation.
// Deliberately small: the deck only shows short, hand-written snippets.
const TOKEN =
  /(#.*$)|("(?:[^"\\]|\\.)*")|((?:^|(?<=[\s{,-]))[A-Za-z_][\w.-]*(?=:(?:\s|$)))|\b(Deny|Allow)\b|(>-|[{}[\],])|(^\s*-(?=\s))/g

function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(line)) !== null) {
    if (m[0] === '') {
      TOKEN.lastIndex++
      continue
    }
    if (m.index > last) out.push(line.slice(last, m.index))
    const [text, comment, str, key, verdict, punct, dash] = m
    const cls = comment
      ? 'tok-com'
      : str
        ? 'tok-str'
        : key
          ? 'tok-key'
          : verdict
            ? verdict === 'Deny'
              ? 'tok-deny'
              : 'tok-allow'
            : punct || dash
              ? 'tok-punct'
              : ''
    out.push(
      <span key={m.index} className={cls}>
        {text}
      </span>,
    )
    last = m.index + text.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

/** A YAML code panel, readable from the back of the room. */
export function Code({ children, size = 30, highlight = [], highlightTone = 'danger', className = '', style }: Props) {
  const lines = children.replace(/^\n+|\s+$/g, '').split('\n')
  return (
    <pre className={`code ${className}`} style={{ fontSize: size, ...style }}>
      <code>
        {lines.map((line, i) => (
          <span key={i} className={`code-line ${highlight.includes(i + 1) ? `code-line--${highlightTone}` : ''}`}>
            {highlightLine(line)}
            {'\n'}
          </span>
        ))}
      </code>
    </pre>
  )
}
