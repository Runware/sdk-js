import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["Runware/index.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
  minify: true,
  target: "esnext",
  outDir: "dist",
  // outExtension({ format }) {
  //   console.log("gforat", format);
  //   return {
  //     js: `.${format === "cjs" ? "cjs" : "mjs"}`,
  //   };
  // },
  // entry: ['src/**/*.ts']
});

// "build": "tsup Runware/index.ts --format cjs,esm --dts",
