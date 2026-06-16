import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createLogger,
  RUNWARE_TELEMETRY_SENTRY_DSN,
  RunwareSentryClient,
} from "../../../Runware/logger";
import { SDK_VERSION } from "../../../Runware/utils";

const flushSentryLogs = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("RunwareLogger transport routing", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("omitted logging does not touch console or load Sentry", async () => {
    const loader = vi.fn<[], Promise<RunwareSentryClient>>(async () => ({
      logger: { info: vi.fn() },
    }));
    const logger = createLogger();

    logger.info("hidden", { taskUUID: "task-1" });
    await flushSentryLogs();

    expect(loader).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test("logging enabled defaults to info-level console logging with sanitized data", () => {
    const logger = createLogger({ enabled: true });

    logger.info("console only", {
      taskUUID: "task-1",
      apiKey: "secret-key",
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(consoleLogSpy.mock.calls)).toContain(
      `[jsSdk - ${SDK_VERSION}]`,
    );
    expect(JSON.stringify(consoleLogSpy.mock.calls)).toContain("task-1");
    expect(JSON.stringify(consoleLogSpy.mock.calls)).not.toContain("secret-key");
  });

  test("error level suppresses success and info logs but still emits errors", () => {
    const logger = createLogger({ enabled: true, level: "error" });

    logger.info("hidden info");
    logger.requestComplete("imageInference", "task-1", 10);
    logger.error("visible error", { code: "NETWORK" });

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).toContain("NETWORK");
  });

  test("telemetry type sends to Runware Sentry and does not call console", async () => {
    const telemetryInfo = vi.fn();
    // A loader returning a duck-typed client (no module primitives) exercises
    // the customer-emitter fallback. We never call a global init().
    const loader = vi.fn<[], Promise<RunwareSentryClient>>(async () => ({
      logger: { info: telemetryInfo },
    }));
    const logger = createLogger({
      enabled: true,
      type: "telemetry",
      sentry: { loader },
    });

    logger.info("telemetry only", {
      taskUUID: "task-1",
      apiKey: "secret-key",
    });
    await flushSentryLogs();

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalled();
    expect(telemetryInfo).toHaveBeenCalledTimes(1);
    expect(telemetryInfo.mock.calls[0][0]).toBe(
      `[jsSdk - ${SDK_VERSION}]: telemetry only`,
    );
    const attributes = telemetryInfo.mock.calls[0][1];
    expect(attributes["runware.target"]).toBe("telemetry");
    expect(attributes["runware.sdk.name"]).toBe("jsSdk");
    expect(attributes["runware.sdk.package"]).toBe("@runware/sdk-js");
    expect(attributes["runware.sdk.version"]).toBe(SDK_VERSION);
    expect(attributes.taskUUID).toBe("task-1");
    expect(attributes.apiKey).toBe("[redacted]");
  });

  test("telemetry builds an isolated client with logs enabled and never inits globally", async () => {
    const captured: { options?: Record<string, unknown> } = {};
    const loggerInfo = vi.fn();
    const flush = vi.fn(async () => true);
    class FakeNodeClient {
      flush = flush;
      captureMessage = vi.fn();
      constructor(options: Record<string, unknown>) {
        captured.options = options;
      }
    }
    const moduleStub = {
      NodeClient: FakeNodeClient,
      makeNodeTransport: () => ({ send: async () => ({}), flush: async () => true }),
      defaultStackParser: () => [],
      withScope: (cb: (scope: any) => void) =>
        cb({ setClient: () => {}, setExtras: () => {} }),
      logger: { info: loggerInfo },
      captureMessage: vi.fn(),
    };
    const loader = vi.fn(async () => moduleStub);

    const logger = createLogger({
      enabled: true,
      type: "telemetry",
      sentry: { loader, runtime: "node" },
    });

    logger.info("telemetry only", { taskUUID: "task-1" });
    await flushSentryLogs();

    expect(loader).toHaveBeenCalled();
    expect(captured.options?.dsn).toBe(RUNWARE_TELEMETRY_SENTRY_DSN);
    expect(captured.options?.enableLogs).toBe(true);
    expect(captured.options?.integrations).toEqual([]);
    expect(loggerInfo).toHaveBeenCalledTimes(1);
    await logger.flush(100);
    expect(flush).toHaveBeenCalled();
  });

  test("console type never loads Sentry", async () => {
    const loader = vi.fn<[], Promise<RunwareSentryClient>>(async () => ({
      logger: { info: vi.fn() },
    }));
    const logger = createLogger({
      enabled: true,
      type: "console",
      sentry: { loader },
    });

    logger.info("console only");
    await flushSentryLogs();

    expect(loader).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  test("sentry type uses a customer-owned fake Sentry client", async () => {
    const sentryInfo = vi.fn();
    const client: RunwareSentryClient = {
      logger: { info: sentryInfo },
    };
    const logger = createLogger({
      enabled: true,
      type: "sentry",
      sentry: { client },
    });

    logger.info("sentry only", {
      taskUUID: "task-1",
      apiKey: "secret-key",
      connectionSessionUUID: "session-secret",
      payload: { positivePrompt: "private prompt" },
      nested: { token: "private-token", code: "safe-code" },
    });
    await flushSentryLogs();

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(sentryInfo).toHaveBeenCalledTimes(1);
    expect(sentryInfo.mock.calls[0][0]).toBe(
      `[jsSdk - ${SDK_VERSION}]: sentry only`,
    );
    const attributes = sentryInfo.mock.calls[0][1];
    expect(attributes["runware.target"]).toBe("sentry");
    expect(attributes["runware.sdk.version"]).toBe(SDK_VERSION);
    expect(attributes.taskUUID).toBe("task-1");
    expect(attributes.apiKey).toBe("[redacted]");
    expect(attributes.connectionSessionUUID).toBe("[redacted]");
    expect(attributes.payload).toBe("[redacted]");
    expect(attributes["nested.token"]).toBe("[redacted]");
    expect(attributes["nested.code"]).toBe("safe-code");
    expect(JSON.stringify(attributes)).not.toContain("secret-key");
    expect(JSON.stringify(attributes)).not.toContain("private prompt");
    expect(JSON.stringify(attributes)).not.toContain("session-secret");
  });

  test("error events fold the error code into the message for distinct grouping", async () => {
    const captureMessage = vi.fn();
    const telemetryError = vi.fn();
    const logger = createLogger({
      enabled: true,
      type: "telemetry",
      sentry: {
        loader: async () => ({
          logger: { error: telemetryError },
          captureMessage,
        }),
      },
    });

    // Same as the SDK's requestError payload shape.
    logger.requestError("task-1", {
      error: { code: "invalidModel", message: "bad model" },
    });
    await flushSentryLogs();

    // Distinct API errors must not all collapse into one "Request failed".
    expect(captureMessage.mock.calls[0][0]).toBe(
      `[jsSdk - ${SDK_VERSION}]: Request failed (invalidModel)`,
    );
  });

  test("inferenceError formats message as 'inference error: [code] modelAir' without double-appending", async () => {
    const captureMessage = vi.fn();
    const telemetryError = vi.fn();
    const logger = createLogger({
      enabled: true,
      type: "telemetry",
      sentry: {
        loader: async () => ({
          logger: { error: telemetryError },
          captureMessage,
        }),
      },
    });

    logger.inferenceError("invalidModel", "runware:invalid-model@0", {
      taskUUID: "task-1",
      error: { code: "invalidModel" },
    });
    await flushSentryLogs();

    const expected = `[jsSdk - ${SDK_VERSION}]: inference error: [invalidModel] runware:invalid-model@0`;
    expect(captureMessage.mock.calls[0][0]).toBe(expected);
    // No "(invalidModel)" suffix even though error.code is in the attributes.
    expect(captureMessage.mock.calls[0][0]).not.toContain("(invalidModel)");
  });

  test("both type sends to console and Runware telemetry", async () => {
    const telemetryWarn = vi.fn();
    // Telemetry honors `loader` (never a customer-supplied `client`).
    const logger = createLogger({
      enabled: true,
      type: "both",
      sentry: { loader: async () => ({ logger: { warn: telemetryWarn } }) },
    });

    logger.warn("degraded connection", { taskUUID: "task-2" });
    await flushSentryLogs();

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(telemetryWarn).toHaveBeenCalledTimes(1);
  });

  test("error telemetry also captures a Sentry message for alerts", async () => {
    const telemetryError = vi.fn();
    const captureMessage = vi.fn();
    // Telemetry honors `loader`; a duck-typed result uses the customer emitter.
    const logger = createLogger({
      enabled: true,
      type: "telemetry",
      sentry: {
        loader: async () => ({
          logger: { error: telemetryError },
          captureMessage,
        }),
      },
    });

    logger.error("request failed", { taskUUID: "task-3", code: "BAD_REQUEST" });
    await flushSentryLogs();

    // Error code is folded into the message for distinct issue grouping.
    expect(telemetryError).toHaveBeenCalledWith(
      `[jsSdk - ${SDK_VERSION}]: request failed (BAD_REQUEST)`,
      expect.objectContaining({
        "runware.target": "telemetry",
        "runware.severity": "error",
        taskUUID: "task-3",
        code: "BAD_REQUEST",
      }),
    );
    expect(captureMessage).toHaveBeenCalledWith(
      `[jsSdk - ${SDK_VERSION}]: request failed (BAD_REQUEST)`,
      expect.objectContaining({
        level: "error",
        extra: expect.objectContaining({
          "runware.target": "telemetry",
          "runware.severity": "error",
          taskUUID: "task-3",
          code: "BAD_REQUEST",
        }),
      }),
    );
  });

  test("array type can send to console and customer Sentry", async () => {
    const sentryWarn = vi.fn();
    const logger = createLogger({
      enabled: true,
      type: ["console", "sentry"],
      sentry: { client: { logger: { warn: sentryWarn } } },
    });

    logger.warn("degraded connection", { taskUUID: "task-2" });
    await flushSentryLogs();

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(sentryWarn).toHaveBeenCalledTimes(1);
  });

  test("Sentry loader is loaded once and cached across emits", async () => {
    const sentryInfo = vi.fn();
    const loader = vi.fn<[], Promise<RunwareSentryClient>>(async () => ({
      logger: { info: sentryInfo },
    }));
    const logger = createLogger({
      enabled: true,
      type: "sentry",
      sentry: {
        dsn: "https://example@sentry.invalid/1",
        environment: "test",
        loader,
      },
    });

    logger.info("first enabled log");
    logger.info("second enabled log");
    await flushSentryLogs();

    // Pre-warmed + cached: the module is loaded once regardless of emit count,
    // and no global init() is ever invoked.
    expect(loader).toHaveBeenCalledTimes(1);
    expect(sentryInfo).toHaveBeenCalledTimes(2);
  });

  test("Sentry loader failure is swallowed and only warns when console is enabled", async () => {
    const logger = createLogger({
      enabled: true,
      type: ["console", "sentry"],
      sentry: {
        loader: async () => {
          throw new Error("Sentry package missing");
        },
      },
    });

    expect(() => logger.error("still safe")).not.toThrow();
    await flushSentryLogs();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(consoleWarnSpy.mock.calls)).toContain(
      "Sentry logging disabled",
    );
  });

  test("captureMessage is used when Sentry logger API is unavailable", async () => {
    const captureMessage = vi.fn();
    const logger = createLogger({
      enabled: true,
      type: "sentry",
      sentry: { client: { captureMessage } },
    });

    logger.warn("fallback warning", { code: "degraded" });
    await flushSentryLogs();

    expect(captureMessage).toHaveBeenCalledWith(
      `[jsSdk - ${SDK_VERSION}]: fallback warning`,
      expect.objectContaining({
        level: "warning",
        extra: expect.objectContaining({ code: "degraded" }),
      }),
    );
  });
});
