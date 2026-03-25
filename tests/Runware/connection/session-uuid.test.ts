import { describe, test, expect, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { delay } from "../../../Runware/utils";
import { createRealServer } from "../../test-utils";

describe("_connectionSessionUUID cleared on close (Bug 2 fix)", () => {
  let server: RunwareServer;

  afterAll(() => {
    try {
      server?.disconnect();
    } catch {}
  });

  test("SUCCESS: _connectionSessionUUID is set after auth", async () => {
    server = await createRealServer();
    expect((server as any)._connectionSessionUUID).toBeDefined();
    expect(typeof (server as any)._connectionSessionUUID).toBe("string");
    expect((server as any)._connectionSessionUUID.length).toBeGreaterThan(0);
  }, 30000);

  test("FIX PROOF: _connectionSessionUUID is cleared after WebSocket close", async () => {
    const sessionBefore = (server as any)._connectionSessionUUID;
    expect(sessionBefore).toBeDefined();

    // Force close the WebSocket to simulate network drop
    (server as any)._ws.close();
    await delay(1);

    // CRITICAL: _connectionSessionUUID must be cleared by handleClose()
    expect((server as any)._connectionSessionUUID).toBeUndefined();
  });

  test("FIX PROOF: connected() returns false after WebSocket close", () => {
    expect((server as any).connected()).toBe(false);
  });

  test("FIX PROOF: heartbeat is stopped after WebSocket close", () => {
    expect((server as any)._heartbeatIntervalId).toBeNull();
  });
});
