import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Local only: /api goes to scripts/dev-api.js (npm run dev:api). On Vercel the
    // functions in api/ are served directly and this proxy isn't used.
    proxy: { '/api': 'http://localhost:3001' },
  },
})
