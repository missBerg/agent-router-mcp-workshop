/**
 * Spectacle only binds ArrowRight / ArrowLeft. Most presentation clickers
 * send PageDown / PageUp (and some send Space), so translate those into the
 * arrow keys Spectacle already understands. Works in every mode, including
 * presenter mode, because Spectacle decides which deck reacts.
 */
const NEXT = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
const PREV = { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

export function installClickerKeys(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const target =
        e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)
          ? NEXT
          : e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)
            ? PREV
            : null
      if (!target) return
      e.preventDefault()
      e.stopPropagation()
      document.dispatchEvent(new KeyboardEvent('keydown', { ...target, which: target.keyCode, bubbles: true } as KeyboardEventInit))
    },
    { capture: true },
  )
}
