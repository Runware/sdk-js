import { describe, test, expect, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { createRealServer } from "../../test-utils";

describe("enhancePrompt (real WebSocket)", () => {
  let server: RunwareServer;

  afterAll(() => {
    server?.disconnect();
  });

  test("SUCCESS: enhances a prompt and returns text", async () => {
    server = await createRealServer();

    const results = await server.enhancePrompt({
      prompt: "a cat sitting on a chair",
      promptMaxLength: 200,
      promptVersions: 1,
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const result = results[0];
    expect(result).toHaveProperty("taskUUID");
    expect(result).toHaveProperty("text");
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
  }, 30000);

  test("SUCCESS: uses default promptMaxLength and promptVersions", async () => {
    const results = await server.enhancePrompt({
      prompt: "a sunset over the ocean",
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].text.length).toBeGreaterThan(0);
  }, 30000);

  test("SUCCESS: promptEnhance delegates to enhancePrompt", async () => {
    const results = await server.promptEnhance({
      prompt: "a dog playing in the park",
      promptVersions: 1,
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]).toHaveProperty("text");
  }, 30000);
});
