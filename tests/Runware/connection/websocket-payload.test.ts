import { describe, expect, test, vi } from "vitest";
import { RunwareBase } from "../../../Runware/Runware-base";

describe("WebSocket payload serialization", () => {
  test("does not send SDK-only request parameters", async () => {
    const send = vi.fn();
    const sdk = new RunwareBase({ apiKey: "test-api-key" });

    (sdk as any)._ws = { readyState: 1, send };
    (sdk as any)._connectionSessionUUID = "test-connection-session";

    await (sdk as any).send({
      taskType: "test",
      taskUUID: "test-task",
      model: "test-model",
      skipResponse: true,
      additionalProperties: { internal: true },
    });

    expect(send).toHaveBeenCalledOnce();
    expect(JSON.parse(send.mock.calls[0][0])).toEqual([
      {
        taskType: "test",
        taskUUID: "test-task",
        model: "test-model",
      },
    ]);
  });
});
