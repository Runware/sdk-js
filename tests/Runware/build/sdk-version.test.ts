import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";
import { SDK_VERSION } from "../../../Runware/utils";

describe("SDK_VERSION", () => {
  it("matches package.json", () => {
    expect(SDK_VERSION).toBe(pkg.version);
  });
});
