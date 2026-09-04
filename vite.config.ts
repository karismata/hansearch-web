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
        entryFileNames: `assets/app-v2-[name]-[hash].js`,
        chunkFileNames: `assets/app-v2-[name]-[hash].js`,
        assetFileNames: `assets/app-v2-[name]-[hash].[ext]`,
      },
    },
  },
})



