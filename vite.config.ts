import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'apps/desktop',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/desktop/src'),
      '@myocr/types': path.resolve(__dirname, './packages/types'),
      '@myocr/ai-core': path.resolve(__dirname, './packages/ai-core/src'),
      '@myocr/database': path.resolve(__dirname, './packages/database/src'),
      '@myocr/ui-components': path.resolve(__dirname, './packages/ui-components/src'),
      '@myocr/utils': path.resolve(__dirname, './packages/utils/src'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
