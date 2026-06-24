import { build } from "esbuild";
import { describe, expect, it } from "vitest";

describe("browser package entry", () => {
  it("bundles a client component without node-only dependencies", async () => {
    const result = await build({
      stdin: {
        contents: `
          "use client";
          import { Runware, createLogger } from "./Runware/index.browser";
          void Runware;
          void createLogger;
        `,
        loader: "ts",
        resolveDir: process.cwd(),
        sourcefile: "ClientComponent.tsx",
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
      external: ["@sentry/browser"],
    });

    const bundled = result.outputFiles[0]?.text ?? "";

    expect(bundled).not.toContain("@sentry/node");
    expect(bundled).not.toContain("diagnostics_channel");
    expect(bundled).not.toContain("from \"ws\"");
    expect(bundled).not.toContain("require(\"ws\")");
  });
});
