import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/hansearch-[name]-[hash].js`,
        chunkFileNames: `assets/hansearch-[name]-[hash].js`,
        assetFileNames: `assets/hansearch-[name]-[hash].[ext]`,
      },
    },
  },
})


