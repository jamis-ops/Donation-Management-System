import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Send frontend /api/* calls to PHP backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // /api/login.php -> http://localhost:8000/login.php
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
