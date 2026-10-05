import { useContext, type ReactNode } from 'react'
import { DeckContext, Slide, SlideContext } from 'spectacle'
import { LAB_SITE_URL, shortUrl } from '../config'
import { color } from '../theme'
import markUrl from '../assets/ar-mark-marquee.svg'

export type Tone = 'light' | 'cream2' | 'mint' | 'peach' | 'dark'

const background: Record<Tone, string> = {
  light: color.cream,
  cream2: color.cream2,
  mint: color.mint,
  peach: color.peach,
  dark: color.ink,
}

type Props = {
  tone?: Tone
  /** Persistent footer (lab URL + slide number). On by default. */
  footer?: boolean
  className?: string
  /** A <SpeakerNotes> element. Required: every slide carries presenter notes. */
  notes: ReactNode
  children: ReactNode
}

/**
 * One slide = one full-bleed 1920×1080 frame. Spectacle's own padding is
 * disabled so the frame controls layout; the footer is absolutely positioned
 * inside the frame's bottom padding, so content can never run under it.
 */
export function DeckSlide({ tone = 'light', footer = true, className = '', notes, children }: Props) {
  return (
    <Slide backgroundColor={background[tone]} padding={0} textColor={tone === 'dark' ? color.cream : color.ink}>
      <div className={`frame frame--${tone} ${className}`}>
        {children}
        {footer && <Footer />}
      </div>
      {notes}
    </Slide>
  )
}

/** Uses the deck + slide contexts so the number is right in overview and print modes too. */
function Footer() {
  const deck = useContext(DeckContext)
  const slide = useContext(SlideContext)
  const index = deck?.slideIds?.indexOf(slide?.slideId) ?? -1
  return (
    <div className="footer" aria-hidden="true">
      <span className="footer-site">
        <img src={markUrl} alt="" />
        {shortUrl(LAB_SITE_URL)}
      </span>
      {index >= 0 && (
        <span className="footer-num">
          {index + 1} / {deck.slideCount}
        </span>
      )}
    </div>
  )
}
