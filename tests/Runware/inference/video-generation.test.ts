import { describe, test, expect, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { IVideoToImage } from "../../../Runware/types";
import { createRealServer } from "../../test-utils";

describe("videoInference (real WebSocket, async)", () => {
  let server: RunwareServer;
  let submittedTaskUUID: string;

  afterAll(() => {
    server?.disconnect();
  });

  test("SUCCESS: submits video job with skipResponse and gets taskUUID back", async () => {
    server = await createRealServer();

    const result = (await server.videoInference({
      model: "pixverse:1@5",
      positivePrompt: "smooth camera pan across a mountain landscape",
      duration: 5,
      width: 720,
      height: 1280,
      numberResults: 1,
      outputFormat: "MP4",
      includeCost: true,
      skipResponse: true,
    })) as IVideoToImage;

    expect(result).toHaveProperty("taskUUID");
    expect(typeof result.taskUUID).toBe("string");
    expect(result.taskUUID.length).toBeGreaterThan(0);

    // With skipResponse: true, videoURL should not be present yet
    expect(result.videoURL).toBeUndefined();

    submittedTaskUUID = result.taskUUID;
  }, 60000);

  test("SUCCESS: getResponse retrieves completed video result", async () => {
    expect(submittedTaskUUID).toBeDefined();

    // Poll for the async result — video generation can take a while
    let results: IVideoToImage[] = [];
    const maxAttempts = 60; // 60 * 5s = 5 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      try {
        results = await server.getResponse<IVideoToImage>({
          taskUUID: submittedTaskUUID,
        });
        if (results && results.length > 0 && results[0].videoURL) {
          break;
        }
      } catch {
        // Not ready yet, keep polling
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    expect(results.length).toBeGreaterThanOrEqual(1);

    const video = results[0];
    expect(video).toHaveProperty("taskUUID");
    expect(video).toHaveProperty("videoURL");
    expect(typeof video.videoURL).toBe("string");
    expect(video.videoURL!.startsWith("http")).toBe(true);
  }, 360000); // 6 minute timeout

  test("SUCCESS: parallel video submissions each get unique taskUUIDs", async () => {
    const [result1, result2] = await Promise.all([
      server.videoInference({
        model: "pixverse:1@5",
        positivePrompt: "a sunset timelapse",
        duration: 5,
        width: 720,
        height: 1280,
        numberResults: 1,
        outputFormat: "MP4",
        skipResponse: true,
      }) as Promise<IVideoToImage>,
      server.videoInference({
        model: "pixverse:1@5",
        positivePrompt: "ocean waves crashing",
        duration: 5,
        width: 720,
        height: 1280,
        numberResults: 1,
        outputFormat: "MP4",
        skipResponse: true,
      }) as Promise<IVideoToImage>,
    ]);

    expect(result1.taskUUID).toBeTruthy();
    expect(result2.taskUUID).toBeTruthy();
    expect(result1.taskUUID).not.toBe(result2.taskUUID);
  }, 60000);

  test("FAILURE: rejects with invalid video model", async () => {
    await expect(
      server.videoInference({
        model: "nonexistent:999@999",
        positivePrompt: "test",
        duration: 5,
        width: 720,
        height: 1280,
        numberResults: 1,
        skipResponse: true,
      }),
    ).rejects.toBeDefined();
  }, 60000);
});
