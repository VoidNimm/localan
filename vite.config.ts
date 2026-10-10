import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ollama/, ''),
      },
      '/api/rembg': {
        target: 'http://127.0.0.1:7000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/rembg/, '/api'),
      },
    },
  },
  preview: {
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ollama/, ''),
      },
      '/api/rembg': {
        target: 'http://127.0.0.1:7000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/rembg/, '/api'),
      },
    },
  },
})

