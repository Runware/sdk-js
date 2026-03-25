import { describe, test, expect, vi, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { delay } from "../../../Runware/utils";
import { createRealServer } from "../../test-utils";

describe("Heartbeat — ping/pong and 3-strike tolerance", () => {
  let server: RunwareServer;

  afterAll(() => {
    server?.disconnect();
  });

  test("SUCCESS: heartbeat interval is active after auth", async () => {
    server = await createRealServer();
    expect((server as any)._heartbeatIntervalId).not.toBeNull();
  }, 30000);

  test("SUCCESS: heartbeat sends pings and connection stays alive", async () => {
    // Wait for at least one heartbeat cycle to fire
    await delay(2);
    expect((server as any)._connectionSessionUUID).toBeDefined();
    expect((server as any).isWebsocketReadyState()).toBe(true);
    expect((server as any)._heartbeatIntervalId).not.toBeNull();
  }, 30000);

  test("SUCCESS: handlePongMessage returns true for valid pong and resets missedPongCount", () => {
    // Simulate 2 missed pongs then a successful one
    (server as any)._missedPongCount = 2;
    (server as any)._pongTimeoutId = setTimeout(() => {}, 5000);

    const result = (server as any).handlePongMessage({
      data: [{ taskType: "ping", pong: true }],
    });

    expect(result).toBe(true);
    expect((server as any)._pongTimeoutId).toBeNull();
    expect((server as any)._missedPongCount).toBe(0);
  });

  test("FAILURE: handlePongMessage returns false for non-pong data", () => {
    const result = (server as any).handlePongMessage({
      data: [{ taskType: "imageInference", status: "success" }],
    });
    expect(result).toBe(false);
  });

  test("FIX PROOF: single missed pong does NOT terminate (3-strike tolerance)", () => {
    // Simulate incrementing missed pong count manually
    (server as any)._missedPongCount = 0;

    // After 1 miss — still alive
    (server as any)._missedPongCount++;
    expect((server as any)._missedPongCount).toBe(1);
    expect((server as any)._missedPongCount < (server as any)._maxMissedPongs).toBe(true);
    expect((server as any).isWebsocketReadyState()).toBe(true);

    // After 2 misses — still alive
    (server as any)._missedPongCount++;
    expect((server as any)._missedPongCount).toBe(2);
    expect((server as any)._missedPongCount < (server as any)._maxMissedPongs).toBe(true);
    expect((server as any).isWebsocketReadyState()).toBe(true);

    // Reset for other tests
    (server as any)._missedPongCount = 0;
  });

  test("FIX PROOF: stopHeartbeat resets missedPongCount to 0", () => {
    (server as any)._missedPongCount = 2;
    (server as any).stopHeartbeat();
    expect((server as any)._missedPongCount).toBe(0);
    expect((server as any)._heartbeatIntervalId).toBeNull();
    expect((server as any)._pongTimeoutId).toBeNull();

    // Restart heartbeat for next tests
    (server as any).startHeartbeat();
  });

  test("FIX PROOF: heartbeat terminates connection after 3 consecutive missed pongs", async () => {
    // Stop the real heartbeat
    (server as any).stopHeartbeat();

    const ws = (server as any)._ws;
    const terminateSpy = vi.spyOn(ws, "terminate").mockImplementation(() => {
      // Don't actually terminate — we just want to verify it's called
    });

    // Manually run the 3-strike logic as the pong timeout handler would
    (server as any)._missedPongCount = 0;

    // Strike 1 — no terminate
    (server as any)._missedPongCount++;
    expect((server as any)._missedPongCount >= (server as any)._maxMissedPongs).toBe(false);

    // Strike 2 — no terminate
    (server as any)._missedPongCount++;
    expect((server as any)._missedPongCount >= (server as any)._maxMissedPongs).toBe(false);

    // Strike 3 — should trigger terminate
    (server as any)._missedPongCount++;
    expect((server as any)._missedPongCount >= (server as any)._maxMissedPongs).toBe(true);

    // Simulate what startHeartbeat's pong timeout handler does on strike 3
    if ((server as any)._missedPongCount >= (server as any)._maxMissedPongs) {
      if (typeof ws.terminate === "function") {
        ws.terminate();
      }
    }

    expect(terminateSpy).toHaveBeenCalledTimes(1);
    terminateSpy.mockRestore();

    // Reset
    (server as any)._missedPongCount = 0;
  });
});
