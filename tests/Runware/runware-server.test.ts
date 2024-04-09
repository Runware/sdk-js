import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { startMockBackendServer } from "../mockServer";
import { RunwareServer } from "../../Runware";
import { BASE_RUNWARE_URLS } from "../../Runware/utils";

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

    const runwareServer: any = new RunwareServer({
      apiKey: "API_KEY",
      url: BASE_RUNWARE_URLS.TEST,
    });

    expect(runwareServer._apiKey).toBe("API_KEY");
    expect(runwareServer.connect).toBeCalledTimes(1);
    expect(runwareServer._ws).toBeDefined();
  });
});
