/// <reference types="vitest" />
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        enabled: true,
        include: [
          "src/utils/**/*.ts",
          "src/browser-utils/**/*.ts",
        ],
        reporter: [
          "text-summary",
          "html",
        ],
        reportsDirectory: "./coverage",
      },
      browser: {
        provider: "playwright",
        enabled: true,
        instances: [
          {
            browser: "chromium",
          },
        ],
      },
    },
  })
);

