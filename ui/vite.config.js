import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Increase the limit to 1000 kB (default is 500)
    chunkSizeWarningLimit: 1000,
  },
})
