import { RunwareBase } from "../Runware/Runware-base";
import { ETaskType } from "../Runware/types";

const TASK_UUID = "ceab18cd-6b43-427d-bc65-0f382007265e";
const expectFixed = process.argv.includes("--expect-fixed");

type SentMessage = {
  taskType?: string;
  taskUUID?: string;
};

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  closeCalls = 0;
  terminateCalls = 0;

  constructor(
    readonly label: string,
    private readonly afterSend?: (payload: string) => void,
  ) {}

  send(payload: string) {
    this.sent.push(payload);
    this.afterSend?.(payload);
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

type RunwareHarness = {
  _ws: FakeSocket;
  _connectionSessionUUID?: string;
  _missedPongCount: number;
  _globalMessages: Record<string, unknown>;
  connected: () => boolean;
  ensureConnection: () => Promise<unknown>;
  getResponse: <T>(payload: { taskUUID: string }) => Promise<T[]>;
};

function parseSentMessage(payload: string): SentMessage {
  const parsed = JSON.parse(payload) as SentMessage[];
  return parsed[0] ?? {};
}

function hasGetResponse(socket: FakeSocket) {
  return socket.sent.some((payload) => {
    const message = parseSentMessage(payload);
    return (
      message.taskType === ETaskType.GET_RESPONSE &&
      message.taskUUID === TASK_UUID
    );
  });
}

async function main() {
  const sdk = new RunwareBase({
    apiKey: "test-key",
    url: "ws://local-half-open-repro",
    shouldReconnect: false,
    globalMaxRetries: 1,
    timeoutDuration: 1000,
    heartbeatInterval: 15000,
  }) as unknown as RunwareHarness;

  const staleSocket = new FakeSocket("stale");
  const freshSocket = new FakeSocket("fresh", (payload) => {
    const message = parseSentMessage(payload);
    setTimeout(() => {
      if (message.taskUUID) {
        sdk._globalMessages[message.taskUUID] = [
          {
            taskType: message.taskType,
            taskUUID: message.taskUUID,
            status: "success",
            source: "fresh-socket",
          },
        ];
      }
    }, 0);
  });

  let reconnects = 0;

  sdk._ws = staleSocket;
  sdk._connectionSessionUUID = "session-open-but-heartbeat-stale";
  sdk._missedPongCount = 1;
  sdk.ensureConnection = async () => {
    reconnects++;
    sdk._ws = freshSocket;
    sdk._connectionSessionUUID = "fresh-session";
    sdk._missedPongCount = 0;
    return true;
  };

  console.log("connectedBefore", sdk.connected());
  console.log("missedPongCountBefore", sdk._missedPongCount);

  let results: unknown[] | undefined;
  let error: unknown;
  try {
    results = await sdk.getResponse({ taskUUID: TASK_UUID });
  } catch (err) {
    error = err;
  }

  console.log("reconnects", reconnects);
  console.log("staleSentCount", staleSocket.sent.length);
  console.log("staleSentGetResponse", hasGetResponse(staleSocket));
  console.log("freshSentCount", freshSocket.sent.length);
  console.log("freshSentGetResponse", hasGetResponse(freshSocket));

  if (error) {
    console.log("error", String(error));
  } else {
    console.log("result", JSON.stringify(results));
  }

  if (hasGetResponse(staleSocket) && error) {
    console.log("classification", "half-open poll loss reproduced");
  } else if (!error && reconnects > 0 && hasGetResponse(freshSocket)) {
    console.log("classification", "fixed behavior observed");
  } else {
    console.log("classification", "unexpected behavior");
  }

  if (!expectFixed) return;

  const failures: string[] = [];
  if (error) {
    failures.push(`getResponse failed: ${String(error)}`);
  }
  if (hasGetResponse(staleSocket)) {
    failures.push("stale socket received getResponse");
  }
  if (reconnects !== 1) {
    failures.push(`expected one reconnect, got ${reconnects}`);
  }
  if (!hasGetResponse(freshSocket)) {
    failures.push("fresh socket did not receive getResponse");
  }

  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
