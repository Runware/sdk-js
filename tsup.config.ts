import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "Runware/index.ts",
    "index.browser": "Runware/index.browser.ts",
    "index.node": "Runware/index.node.ts",
  },
  format: ["esm", "cjs"],
  sourcemap: true,
  minify: true,
  target: "esnext",
  outDir: "dist",
  external: ["@sentry/browser", "@sentry/node"],
  // outExtension({ format }) {
  //   console.log("gforat", format);
  //   return {
  //     js: `.${format === "cjs" ? "cjs" : "mjs"}`,
  //   };
  // },
  // entry: ['src/**/*.ts']
});

// "build": "tsup Runware/index.ts --format cjs,esm --dts",
