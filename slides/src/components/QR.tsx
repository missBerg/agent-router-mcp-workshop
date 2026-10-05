import type { ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type Props = {
  value: string
  /** Rendered size in 1080p px, quiet zone included. */
  size: number
  /** Accessible name. */
  title: string
  caption?: ReactNode
  className?: string
}

/**
 * Scannable-from-the-back-row QR: ink modules on a white card, with the
 * spec's 4-module quiet zone rendered as part of the code itself.
 */
export function QR({ value, size, title, caption, className = '' }: Props) {
  return (
    <figure className={`qr ${className}`}>
      <div className="qr-card" style={{ width: size, height: size }}>
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          marginSize={4}
          fgColor="#12100E"
          bgColor="#FFFFFF"
          title={title}
        />
      </div>
      {caption && <figcaption className="qr-caption">{caption}</figcaption>}
    </figure>
  )
}

/** Dashed stand-in shown when a URL in config.ts has not been filled in yet. */
export function QRPlaceholder({ size, label }: { size: number; label: ReactNode }) {
  return (
    <figure className="qr">
      <div className="qr-placeholder" style={{ width: size, height: size }}>
        {label}
      </div>
    </figure>
  )
}
