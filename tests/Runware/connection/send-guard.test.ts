import { describe, test, expect, vi, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { createRealServer } from "../../test-utils";

describe("send() guard — readyState check + ensureConnection retry", () => {
  let server: RunwareServer;

  afterAll(() => {
    try {
      server?.disconnect();
    } catch {}
  });

  test("SUCCESS: send() succeeds on a live connection", async () => {
    server = await createRealServer();

    await expect(
      (server as any).send({ taskType: "test", data: "hello" }),
    ).resolves.toBeUndefined();
  }, 30000);

  test("SUCCESS: send() calls ensureConnection when WebSocket is not ready", async () => {
    const ensureConnectionSpy = vi
      .spyOn(server as any, "ensureConnection")
      .mockRejectedValueOnce(new Error("Retry timed out"));

    // Force ws to a non-OPEN state
    const realWs = (server as any)._ws;
    const origReadyState = realWs.readyState;
    Object.defineProperty(realWs, "readyState", {
      value: 3, // CLOSED
      writable: true,
      configurable: true,
    });

    await expect(
      (server as any).send({ taskType: "test" }),
    ).rejects.toThrow();

    // send() should have tried to reconnect via ensureConnection
    expect(ensureConnectionSpy).toHaveBeenCalledTimes(1);
    // _connectionSessionUUID should be cleared before ensureConnection
    expect((server as any)._connectionSessionUUID).toBeUndefined();

    // Restore
    Object.defineProperty(realWs, "readyState", {
      value: origReadyState,
      writable: true,
      configurable: true,
    });
    ensureConnectionSpy.mockRestore();
  });

  test("FAILURE: send() throws descriptive error when reconnection fails", async () => {
    vi.spyOn(server as any, "ensureConnection").mockRejectedValueOnce(
      new Error(
        "WebSocket connection could not be established. Check your network connection and API key.",
      ),
    );

    // Force ws to non-OPEN
    const realWs = (server as any)._ws;
    Object.defineProperty(realWs, "readyState", {
      value: 3,
      writable: true,
      configurable: true,
    });

    await expect(
      (server as any).send({ taskType: "test" }),
    ).rejects.toThrow("WebSocket connection could not be established");
  });
});
