import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps every asset URL relative, so the built deck works from any
// sub-path (it is published at https://missberg.github.io/agent-router-mcp-workshop/slides/).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    // Spectacle + styled-components is one big chunk; that is fine for a deck.
    chunkSizeWarningLimit: 2000,
  },
})
