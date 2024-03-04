import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { startMockBackendServer } from "../mockServer";
import { RunwareServer } from "../../Runware";

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
      (RunwareServer as any).prototype,
      "addListener"
    ).mockImplementation(() => "afa");
    vi.spyOn((RunwareServer as any).prototype, "connect");

    const runwareServer: any = new RunwareServer("TEST", "API_KEY");

    expect(runwareServer._apikey).toBe("API_KEY");
    expect(runwareServer.connect).toBeCalledTimes(1);
    expect(runwareServer._ws).toBeDefined();
  });
});
