import { defineConfig } from "vite";

export default defineConfig({
  base: "/dashboard/",
  plugins: [],
  server: {
    host: true,
    watch: {
      usePolling: true,
    },
  },
});
