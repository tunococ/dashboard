import { defineConfig } from 'vite'

export default defineConfig({
  base: "/dashboard/",
  plugins: [],
  server: {
    watch: {
      usePolling: true
    }
  },
})

