import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { startMockBackendServer } from "../mockServer";
import { PicfinderServer } from "../../Picfinder";

const PORT = 8080;

describe("When using backend mockServer", async () => {
  const { mockServer } = await startMockBackendServer();

  beforeAll(async () => {});

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(async () => {});

  test("it should instantiate server correctly", async () => {
    vi.spyOn(
      (PicfinderServer as any).prototype,
      "addListener"
    ).mockImplementation(() => "afa");
    vi.spyOn((PicfinderServer as any).prototype, "connect");

    const picfinderServer: any = new PicfinderServer("TEST", "API_KEY");

    expect(picfinderServer._apikey).toBe("API_KEY");
    expect(picfinderServer.connect).toBeCalledTimes(1);
    expect(picfinderServer._ws).toBeDefined();
  });
});
