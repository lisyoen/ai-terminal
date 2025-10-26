import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { splitVendorChunkPlugin } from 'vite'

export default defineConfig({
  base: './',
  plugins: [
    react({ fastRefresh: false }),
    splitVendorChunkPlugin()
  ],
  build: {
    outDir: 'dist',
    // 청크 크기 경고 임계값 조정
    chunkSizeWarningLimit: 500,
    // 최적화 설정
    minify: 'esbuild',
    // 소스맵 최적화 (프로덕션에서는 false로 설정하여 크기 감소)
    sourcemap: false,
    rollupOptions: {
      external: ['electron'],
      output: {
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  server: {
    port: 5173
  }
})