import { describe, test, expect, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { createRealServer } from "../../test-utils";

describe("requestImages (real WebSocket)", () => {
  let server: RunwareServer;

  afterAll(() => {
    server?.disconnect();
  });

  test("SUCCESS: generates an image and response matches API spec", async () => {
    server = await createRealServer();

    const results = await server.requestImages({
      positivePrompt: "a beautiful mountain landscape",
      model: "runware:100@1",
      numberResults: 1,
      width: 512,
      height: 512,
      steps: 4,
      includeCost: true,
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results!.length).toBe(1);

    const image = results![0];
    expect(image).toHaveProperty("taskUUID");
    expect(typeof image.taskUUID).toBe("string");
    expect(image).toHaveProperty("imageUUID");
    expect(typeof image.imageUUID).toBe("string");
    expect(image).toHaveProperty("imageURL");
    expect(typeof image.imageURL).toBe("string");
    expect(image.imageURL!.startsWith("http")).toBe(true);
    expect(image).toHaveProperty("seed");
    expect(typeof image.seed).toBe("number");
    expect(image).toHaveProperty("cost");
    expect(typeof image.cost).toBe("number");
    expect(image.cost!).toBeGreaterThan(0);
  }, 60000);

  test("SUCCESS: generates multiple images in parallel", async () => {
    const [results1, results2] = await Promise.all([
      server.requestImages({
        positivePrompt: "a red rose",
        model: "runware:100@1",
        numberResults: 1,
        width: 512,
        height: 512,
        steps: 4,
      }),
      server.requestImages({
        positivePrompt: "a blue sky",
        model: "runware:100@1",
        numberResults: 1,
        width: 512,
        height: 512,
        steps: 4,
      }),
    ]);

    expect(results1!.length).toBe(1);
    expect(results2!.length).toBe(1);
    expect(results1![0].imageURL).toBeTruthy();
    expect(results2![0].imageURL).toBeTruthy();
    expect(results1![0].taskUUID).not.toBe(results2![0].taskUUID);
    expect(results1![0].imageUUID).not.toBe(results2![0].imageUUID);
  }, 60000);

  test("SUCCESS: imageInference delegates to requestImages", async () => {
    const results = await server.imageInference({
      positivePrompt: "a forest path",
      model: "runware:100@1",
      numberResults: 1,
      width: 512,
      height: 512,
      steps: 4,
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results!.length).toBe(1);
    expect(results![0]).toHaveProperty("imageURL");
    expect(results![0]).toHaveProperty("imageUUID");
    expect(results![0]).toHaveProperty("seed");
  }, 60000);

  test("FAILURE: rejects with invalid model", async () => {
    await expect(
      server.requestImages({
        positivePrompt: "test",
        model: "nonexistent:999@999",
        numberResults: 1,
        width: 512,
        height: 512,
        steps: 4,
      }),
    ).rejects.toBeDefined();
  }, 60000);
});
