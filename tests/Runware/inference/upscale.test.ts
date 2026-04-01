import { describe, test, expect, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { createRealServer, TEST_IMAGE_URL } from "../../test-utils";

describe("upscaleGan (real WebSocket)", () => {
  let server: RunwareServer;

  afterAll(() => {
    server?.disconnect();
  });

  test("SUCCESS: upscales an image", async () => {
    server = await createRealServer();

    const result = await server.upscaleGan({
      inputImage: TEST_IMAGE_URL,
      upscaleFactor: 2,
    });

    expect(result).toHaveProperty("taskUUID");
    expect(typeof result.taskUUID).toBe("string");
  }, 60000);

  test("SUCCESS: upscale delegates to upscaleGan", async () => {
    const result = await server.upscale({
      inputImage: TEST_IMAGE_URL,
      upscaleFactor: 2,
    });

    expect(result).toHaveProperty("taskUUID");
    expect(typeof result.taskUUID).toBe("string");
  }, 60000);
});
