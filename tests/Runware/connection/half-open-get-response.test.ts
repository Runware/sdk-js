import { afterEach, describe, expect, test, vi } from "vitest";
import { RunwareBase } from "../../../Runware/Runware-base";
import { RunwareServer } from "../../../Runware/Runware-server";
import { ETaskType } from "../../../Runware/types";

const TASK_UUID = "ceab18cd-6b43-427d-bc65-0f382007265e";

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  closeCalls = 0;
  terminateCalls = 0;

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.closeCalls++;
    this.readyState = 3;
  }

  terminate() {
    this.terminateCalls++;
    this.readyState = 3;
  }
}

type Harness = {
  _ws: FakeSocket;
  _connectionSessionUUID?: string;
  _missedPongCount: number;
  _maxMissedPongs: number;
  connected: () => boolean;
  send: (msg: Record<string, unknown>) => Promise<void>;
  ensureConnection: () => Promise<unknown>;
};

class TestRunwareServer extends RunwareServer {
  protected async connect() {}
}

function createBaseHarness() {
  return new RunwareBase({
    apiKey: "test-key",
    url: "ws://local-half-open-test",
    shouldReconnect: false,
  }) as unknown as Harness;
}

function createServerHarness() {
  return new TestRunwareServer({
    apiKey: "test-key",
    url: "ws://local-half-open-test",
    shouldReconnect: false,
  }) as unknown as Harness;
}

function putInHalfOpenState(harness: Harness) {
  const staleSocket = new FakeSocket();
  harness._ws = staleSocket;
  harness._connectionSessionUUID = "session-open-but-heartbeat-stale";
  harness._missedPongCount = 1;
  return staleSocket;
}

function sentGetResponse(socket: FakeSocket) {
  return socket.sent.some((payload) => {
    const message = JSON.parse(payload)[0] as Record<string, unknown>;
    return (
      message.taskType === ETaskType.GET_RESPONSE &&
      message.taskUUID === TASK_UUID
    );
  });
}

describe("half-open getResponse send guard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("connected() is false after a missed pong even when the socket is OPEN", () => {
    const sdk = createBaseHarness();
    const staleSocket = putInHalfOpenState(sdk);

    expect(staleSocket.readyState).toBe(1);
    expect(sdk.connected()).toBe(false);
  });

  test.each([
    ["base client path", createBaseHarness],
    ["server override path", createServerHarness],
  ])(
    "%s reconnects before sending getResponse on a heartbeat-stale OPEN socket",
    async (_label, createHarness) => {
      const sdk = createHarness();
      const staleSocket = putInHalfOpenState(sdk);
      const freshSocket = new FakeSocket();
      const ensureConnection = vi.fn(async () => {
        sdk._ws = freshSocket;
        sdk._connectionSessionUUID = "fresh-session";
        sdk._missedPongCount = 0;
        return true;
      });
      sdk.ensureConnection = ensureConnection;

      await sdk.send({
        taskType: ETaskType.GET_RESPONSE,
        taskUUID: TASK_UUID,
      });

      expect(ensureConnection).toHaveBeenCalledTimes(1);
      expect(staleSocket.terminateCalls + staleSocket.closeCalls).toBe(1);
      expect(sentGetResponse(staleSocket)).toBe(false);
      expect(sentGetResponse(freshSocket)).toBe(true);
      expect(freshSocket.sent).toHaveLength(1);
    },
  );

  test.each([
    ["base client path", createBaseHarness],
    ["server override path", createServerHarness],
  ])(
    "%s rejects before sending when reconnection cannot recover",
    async (_label, createHarness) => {
      const sdk = createHarness();
      const staleSocket = putInHalfOpenState(sdk);
      sdk.ensureConnection = vi.fn(async () => {
        throw new Error("Retry timed out");
      });

      await expect(
        sdk.send({
          taskType: ETaskType.GET_RESPONSE,
          taskUUID: TASK_UUID,
        }),
      ).rejects.toThrow("Retry timed out");

      expect(sentGetResponse(staleSocket)).toBe(false);
    },
  );

  test("authentication can still send on an OPEN socket before session UUID exists", async () => {
    const sdk = createBaseHarness();
    const socket = new FakeSocket();
    const ensureConnection = vi.fn();
    sdk._ws = socket;
    sdk._connectionSessionUUID = undefined;
    sdk._missedPongCount = 0;
    sdk.ensureConnection = ensureConnection;

    await sdk.send({
      taskType: ETaskType.AUTHENTICATION,
      apiKey: "test-key",
    });

    expect(ensureConnection).not.toHaveBeenCalled();
    expect(socket.sent).toHaveLength(1);
  });

  test("heartbeat termination threshold remains three missed pongs", () => {
    const sdk = createBaseHarness();

    sdk._missedPongCount = 1;
    expect(sdk._missedPongCount >= sdk._maxMissedPongs).toBe(false);

    sdk._missedPongCount = 2;
    expect(sdk._missedPongCount >= sdk._maxMissedPongs).toBe(false);

    sdk._missedPongCount = 3;
    expect(sdk._missedPongCount >= sdk._maxMissedPongs).toBe(true);
  });

  test("client ensureConnection rejects after a finite timeout with connection state", async () => {
    vi.useFakeTimers();
    const sdk = createBaseHarness();
    const closedSocket = new FakeSocket();
    closedSocket.readyState = 3;
    sdk._ws = closedSocket;
    sdk._connectionSessionUUID = undefined;
    sdk._missedPongCount = 0;

    const promise = sdk.ensureConnection();
    const assertion = expect(promise).rejects.toThrow(
      "WebSocket reconnection timed out after 60000ms",
    );

    await vi.advanceTimersByTimeAsync(60_001);

    await assertion;
  });

  test("client ensureConnection timeout explains heartbeat-stale state", async () => {
    vi.useFakeTimers();
    const sdk = createBaseHarness();
    const staleSocket = putInHalfOpenState(sdk);

    const promise = sdk.ensureConnection();
    const assertion = expect(promise).rejects.toThrow(
      /readyState=OPEN \(1\), session=present, heartbeat=unhealthy \(1\/3 missed pongs\).*did not send the request/,
    );

    await vi.advanceTimersByTimeAsync(60_001);

    await assertion;
    expect(sentGetResponse(staleSocket)).toBe(false);
  });
});
