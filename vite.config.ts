import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Rust compiler errors scroll past if Vite wipes the terminal.
  clearScreen: false,
  server: {
    // The desktop shell points at this exact port. Without strictPort Vite
    // would quietly move to 5174 when 5173 is busy and the app window would
    // come up blank with no obvious cause.
    port: 5173,
    strictPort: true,
  },
})
