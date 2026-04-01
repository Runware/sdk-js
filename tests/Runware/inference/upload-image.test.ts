import { describe, test, expect, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { createRealServer, TEST_IMAGE_URL } from "../../test-utils";

describe("uploadImage (real WebSocket)", () => {
  let server: RunwareServer;

  afterAll(() => {
    server?.disconnect();
  });

  test("SUCCESS: accepts a URL string for image upload", async () => {
    server = await createRealServer();

    const result = await (server as any).uploadImage(TEST_IMAGE_URL);

    expect(result).toHaveProperty("imageUUID");
    expect(result).toHaveProperty("taskUUID");
    expect(typeof result.imageUUID).toBe("string");
  }, 30000);
});
