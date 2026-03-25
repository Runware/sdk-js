import { describe, test, expect, vi, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { delay } from "../../../Runware/utils";
import { createRealServer } from "../../test-utils";

describe("Zombie detection — full end-to-end timeline", () => {
  let server: RunwareServer;

  afterAll(() => {
    try {
      server?.disconnect();
    } catch {}
  });

  test("INTEGRATION: connected → close → session cleared → send blocked", async () => {
    server = await createRealServer();

    // Step 1: Verify we start connected with real production session
    expect((server as any)._connectionSessionUUID).toBeDefined();
    expect((server as any).isWebsocketReadyState()).toBe(true);
    expect((server as any).connected()).toBe(true);

    // Step 2: Send succeeds while connected
    await expect(
      (server as any).send({ taskType: "test" }),
    ).resolves.toBeUndefined();

    // Step 3: Force close the WebSocket (simulates network failure)
    (server as any)._shouldReconnect = false;
    (server as any)._ws.close();
    await delay(1);

    // Step 4: _connectionSessionUUID is cleared by handleClose() (Bug 2 fix)
    expect((server as any)._connectionSessionUUID).toBeUndefined();

    // Step 5: connected() returns false
    expect((server as any).connected()).toBe(false);

    // Step 6: send() attempts ensureConnection, which fails because reconnect is disabled
    // Mock ensureConnection to fail fast
    vi.spyOn(server as any, "ensureConnection").mockRejectedValueOnce(
      new Error("WebSocket is not connected"),
    );

    await expect(
      (server as any).send({ taskType: "test" }),
    ).rejects.toThrow();

    // Step 7: heartbeat is stopped (no dangling timers)
    expect((server as any)._heartbeatIntervalId).toBeNull();
    expect((server as any)._pongTimeoutId).toBeNull();
  }, 30000);
});
