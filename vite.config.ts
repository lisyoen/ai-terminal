import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react()
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['electron'],
      output: {
        manualChunks: (id) => {
          // React 관련 라이브러리
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor'
          }
          // xterm.js 터미널 라이브러리
          if (id.includes('@xterm/xterm')) {
            return 'terminal-vendor'
          }
          // 기타 node_modules 라이브러리
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    },
    // 청크 크기 경고 임계값 조정
    chunkSizeWarningLimit: 600
  },
  server: {
    port: 5173
  }
})