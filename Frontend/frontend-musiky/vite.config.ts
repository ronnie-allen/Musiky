import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Flask backend serves both the REST API and the Socket.IO endpoint,
// so the dev server proxies /api and /socket.io to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
