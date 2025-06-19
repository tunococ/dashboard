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
          "src/utils/**/*",
        ],
        exclude: [
          "src/browser-utils",
        ],
        reporter: [
          "text",
          "html",
        ],
        reportsDirectory: "./node-coverage",
      },
      exclude: [
        "./tests/browser-utils",
      ],
    },
  })
);

