import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/brand-tokens.css'
import './styles/brand-pattern.css'
import './styles/deck.css'
import './styles/slides.css'
import { Presentation } from './presentation'
import { installClickerKeys } from './clicker'

installClickerKeys()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Presentation />
  </StrictMode>,
)
