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
        entryFileNames: `assets/clean-[name]-[hash].js`,
        chunkFileNames: `assets/clean-[name]-[hash].js`,
        assetFileNames: `assets/clean-[name]-[hash].[ext]`,
      },
    },
  },
})





