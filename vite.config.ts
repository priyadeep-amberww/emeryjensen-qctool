import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 6137,
    // Prefer 6137; if occupied, Vite uses the next free port (see dev-electron URL parsing).
    strictPort: false,
    open: false,
  },
})
