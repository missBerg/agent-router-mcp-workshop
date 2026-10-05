/**
 * Spectacle theme built on the Agent Router brand tokens
 * (src/styles/brand-tokens.css, vendored from theagentrouter/agent-router site/src/css/brand/, Apache-2.0).
 *
 * Slides are authored at 1920×1080 and Spectacle scales them to fit any
 * 16:9 window, so every px value in the deck is a 1080p px.
 */
export const color = {
  ink: '#12100E',
  ink800: '#241F1B',
  ink600: '#4A423C',
  cream: '#FBF8F5',
  cream2: '#F4EEE7',
  cream3: '#EAE1D7',
  paper: '#FFFFFF',
  mint: '#E8F6F3',
  peach: '#FFF3EC',
  marquee: '#FF5500',
  marquee700: '#B83700',
  verdigris: '#1A937F',
  verdigris400: '#31C4AA',
  raspberry: '#DC186D',
} as const

export const font = {
  display: '"Archivo", "Space Grotesk", ui-sans-serif, sans-serif',
  ui: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
}

export const theme = {
  size: { width: 1920, height: 1080 },
  colors: {
    primary: color.ink,
    secondary: color.marquee700,
    tertiary: color.cream,
    quaternary: color.verdigris,
    quinary: color.marquee,
  },
  fonts: { header: font.display, text: font.ui, monospace: font.mono },
  fontSizes: { h1: '96px', h2: '76px', h3: '48px', text: '40px', monospace: '30px' },
  space: [0, 16, 32, 48],
  // Letterbox colour around the 16:9 stage. Setting backdropStyle REPLACES
  // Spectacle's default, so the fixed full-viewport sizing must be repeated
  // here, or the stage is fitted to its unscaled height and gets cut off on
  // windows smaller than 1920×1080.
  backdropStyle: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: color.ink,
  },
}
