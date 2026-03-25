import { describe, test, expect, afterAll } from "vitest";
import { RunwareServer } from "../../../Runware/Runware-server";
import { createRealServer } from "../../test-utils";

describe("RunwareServer connection (real WebSocket)", () => {
  let server: RunwareServer;

  afterAll(() => {
    server?.disconnect();
  });

  test("SUCCESS: connects and authenticates", async () => {
    server = await createRealServer();

    expect((server as any)._apiKey).toBeTruthy();
    expect((server as any)._connectionSessionUUID).toBeDefined();
    expect((server as any)._connectionSessionUUID).not.toBeUndefined();
    expect((server as any).isWebsocketReadyState()).toBe(true);
  }, 30000);

  test("SUCCESS: heartbeat is active after connection", () => {
    expect((server as any)._heartbeatIntervalId).not.toBeNull();
  });

  test("SUCCESS: connected() returns true", () => {
    expect((server as any).connected()).toBe(true);
  });

  test("FAILURE: disconnect clears connection state", () => {
    server.disconnect();

    expect((server as any).isWebsocketReadyState()).toBe(false);
    expect((server as any)._heartbeatIntervalId).toBeNull();
  });
});
