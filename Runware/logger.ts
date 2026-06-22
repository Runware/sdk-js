/**
 * Runware SDK Telemetry Logger
 *
 * Colored console output and optional lazy Sentry-backed telemetry for SDK
 * internals. Logging is disabled unless `logging.enabled` is true.
 *
 * When enabled, logs go to the console only by default. Opt in to remote
 * telemetry with `type: "telemetry"` (Runware org Sentry only) or
 * `type: "both"` (console + telemetry). Telemetry uses an isolated client that
 * never touches the host app's own Sentry. Error-severity events appear as
 * Sentry Issues; everything else is sent as structured logs. Buffered telemetry
 * is flushed on `runware.disconnect()` and on natural process exit.
 *
 * Usage:
 *   const runware = new RunwareServer({
 *     apiKey: "...",
 *     logging: { enabled: true, level: "info" }, // console only
 *   });
 *   // Send telemetry to Runware as well:
 *   //   logging: { enabled: true, type: "both" }
 *   // ...
 *   await runware.disconnect(); // flushes telemetry before exit
 */

import { SDK_VERSION } from "./utils";

// ANSI color codes for terminal output
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground
  black: "\x1b[30m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright foreground
  green: "\x1b[92m",
  yellow: "\x1b[93m",
  blue: "\x1b[94m",
  magenta: "\x1b[95m",
  cyan: "\x1b[96m",
  red: "\x1b[91m",

  // Background
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgRed: "\x1b[41m",
  bgWhite: "\x1b[47m",
} as const;

export enum LogLevel {
  CONNECTION = "CONNECTION",
  AUTH = "AUTH",
  HEARTBEAT = "HEARTBEAT",
  SEND = "SEND",
  RECEIVE = "RECEIVE",
  RETRY = "RETRY",
  REQUEST = "REQUEST",
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
}

const LEVEL_STYLES: Record<LogLevel, { bg: string; fg: string; icon: string }> =
  {
    [LogLevel.CONNECTION]: { bg: COLORS.bgBlue, fg: COLORS.blue, icon: "🔌" },
    [LogLevel.AUTH]: { bg: COLORS.bgGreen, fg: COLORS.green, icon: "🔑" },
    [LogLevel.HEARTBEAT]: {
      bg: COLORS.bgMagenta,
      fg: COLORS.magenta,
      icon: "💓",
    },
    [LogLevel.SEND]: { bg: COLORS.bgCyan, fg: COLORS.cyan, icon: "📤" },
    [LogLevel.RECEIVE]: { bg: COLORS.bgCyan, fg: COLORS.cyan, icon: "📥" },
    [LogLevel.RETRY]: { bg: COLORS.bgYellow, fg: COLORS.yellow, icon: "🔄" },
    [LogLevel.REQUEST]: { bg: COLORS.bgBlue, fg: COLORS.blue, icon: "📡" },
    [LogLevel.ERROR]: { bg: COLORS.bgRed, fg: COLORS.red, icon: "❌" },
    [LogLevel.WARN]: { bg: COLORS.bgYellow, fg: COLORS.yellow, icon: "⚠️" },
    [LogLevel.INFO]: { bg: COLORS.bgWhite, fg: COLORS.gray, icon: "ℹ️" },
  };

const SDK_NAME = "jsSdk";
const SDK_PACKAGE = "@runware/sdk-js";
const LOG_PREFIX = `[${SDK_NAME} - ${SDK_VERSION}]`;
const PREFIX = `${COLORS.bold}${COLORS.magenta}${LOG_PREFIX}${COLORS.reset}`;
const REDACTED = "[redacted]";
const MAX_ATTRIBUTE_LENGTH = 512;

export const RUNWARE_TELEMETRY_SENTRY_DSN =
  "https://749d775cf60934faecfee3b4d6b7bacb@o4508574932992000.ingest.de.sentry.io/4511575549608016";

export type RunwareLogLevel = "error" | "warn" | "info" | "debug";
export type RunwareLogEvent =
  | "error"
  | "success"
  | "connection"
  | "retry"
  | "heartbeat"
  | "request";
export type RunwareLogTarget = "console" | "telemetry" | "sentry";
export type RunwareLogType = RunwareLogTarget | "both" | RunwareLogTarget[];
export type RunwareSentryRuntime = "browser" | "node";
export type RunwareSentryLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";
export type RunwareSentryCaptureLevel =
  | "fatal"
  | "error"
  | "warning"
  | "log"
  | "info"
  | "debug";
export type RunwareSentryAttribute = string | number | boolean;
export type RunwareSentryAttributes = Record<string, RunwareSentryAttribute>;
export type RunwareSentryLogFn = (
  message: string,
  attributes?: RunwareSentryAttributes,
) => unknown;

export interface RunwareSentryClient {
  init?: (options: Record<string, unknown>) => unknown;
  logger?: Partial<Record<RunwareSentryLogLevel, RunwareSentryLogFn>>;
  captureMessage?: (
    message: string,
    context?:
      | RunwareSentryCaptureLevel
      | { level?: RunwareSentryCaptureLevel; extra?: RunwareSentryAttributes },
  ) => unknown;
  flush?: (timeout?: number) => Promise<unknown> | unknown;
}

export type RunwareSentryLoader = (
  runtime: RunwareSentryRuntime,
) => Promise<unknown>;

// Minimal structural views of the bits of a Sentry module/client we touch.
// We never call the global `init()` — instead we build an isolated client so
// Runware telemetry can never clobber a host app's own Sentry.
interface RunwareIsolatedSentryClient {
  captureMessage: (
    message: string,
    level?: RunwareSentryCaptureLevel,
  ) => unknown;
  flush: (timeout?: number) => Promise<boolean>;
}

interface RunwareSentryScope {
  setClient: (client: unknown) => void;
  setExtras: (extras: Record<string, unknown>) => void;
}

interface RunwareSentryModule {
  NodeClient?: new (
    options: Record<string, unknown>,
  ) => RunwareIsolatedSentryClient;
  BrowserClient?: new (
    options: Record<string, unknown>,
  ) => RunwareIsolatedSentryClient;
  makeNodeTransport?: unknown;
  makeFetchTransport?: unknown;
  defaultStackParser?: unknown;
  withScope?: (callback: (scope: RunwareSentryScope) => void) => void;
  captureMessage?: (
    message: string,
    level?: RunwareSentryCaptureLevel,
  ) => unknown;
  logger?: Partial<Record<RunwareSentryLogLevel, RunwareSentryLogFn>>;
}

interface SentryEmitEntry {
  isError: boolean;
  message: string;
  loggerLevel: RunwareSentryLogLevel;
  captureLevel: RunwareSentryCaptureLevel;
  attributes: RunwareSentryAttributes;
}

interface RunwareSentryEmitter {
  emit: (entry: SentryEmitEntry) => void;
  flush: (timeoutMs: number) => Promise<void>;
}

export type RunwareSentryOptions = {
  client?: RunwareSentryClient;
  loader?: RunwareSentryLoader;
  dsn?: string;
  initOptions?: Record<string, unknown>;
  environment?: string;
  release?: string;
  runtime?: RunwareSentryRuntime;
};

export type RunwareLoggingConfig = {
  enabled?: boolean;
  level?: RunwareLogLevel;
  type?: RunwareLogType;
  events?: RunwareLogEvent[];
  sampleRate?: number;
  sentry?: RunwareSentryOptions;
};

type SentryTarget = "telemetry" | "sentry";

const LOG_LEVEL_PRIORITY: Record<RunwareLogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function timestamp(): string {
  return `${COLORS.dim}${new Date().toISOString()}${COLORS.reset}`;
}

function badge(level: LogLevel): string {
  const style = LEVEL_STYLES[level];
  return `${style.bg}${COLORS.bold}${COLORS.black} ${level} ${COLORS.reset}`;
}

function shouldRedactKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return [
    "apikey",
    "authorization",
    "password",
    "token",
    "secret",
    "connectionsessionuuid",
    "sessionuuid",
    "payload",
    "requestpayload",
    "positiveprompt",
    "negativeprompt",
    "prompt",
    "imagebase64data",
    "imagedatauri",
    "base64data",
    "datauri",
    "inputimage",
    "seedimage",
    "maskimage",
    "referenceimages",
  ].some((keyPart) => normalizedKey.includes(keyPart));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorLike(value: unknown): value is Error & { code?: unknown } {
  return value instanceof Error;
}

function sanitizeLogData(
  data: unknown,
  key?: string,
  depth: number = 0,
): unknown {
  if (key && shouldRedactKey(key)) return REDACTED;
  if (data === undefined || data === null) return data;
  if (typeof data === "string") {
    if (data.startsWith("data:") || data.length > 4096) return REDACTED;
    return data;
  }
  if (typeof data === "number" || typeof data === "boolean") return data;
  if (isErrorLike(data)) {
    return {
      name: data.name,
      message: data.message,
      ...(typeof data.code === "string" ? { code: data.code } : {}),
    };
  }
  if (depth >= 4) return "[object]";
  if (Array.isArray(data)) {
    return data
      .slice(0, 5)
      .map((item) => sanitizeLogData(item, key, depth + 1));
  }
  if (!isPlainRecord(data)) return String(data);

  return Object.fromEntries(
    Object.entries(data).map(([entryKey, value]) => [
      entryKey,
      sanitizeLogData(value, entryKey, depth + 1),
    ]),
  );
}

function stringifySafely(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return "[unserializable]";
  }
}

function toSentryAttribute(value: unknown): RunwareSentryAttribute {
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return typeof value === "string" && value.length > MAX_ATTRIBUTE_LENGTH
      ? `${value.slice(0, MAX_ATTRIBUTE_LENGTH)}...`
      : value;
  }

  const serialized = stringifySafely(value);
  return serialized.length > MAX_ATTRIBUTE_LENGTH
    ? `${serialized.slice(0, MAX_ATTRIBUTE_LENGTH)}...`
    : serialized;
}

function flattenAttributes(
  value: unknown,
  prefix: string,
  attributes: RunwareSentryAttributes,
  depth: number = 0,
) {
  if (value === undefined || value === null) return;
  if (depth >= 3 || !isPlainRecord(value)) {
    attributes[prefix || "value"] = toSentryAttribute(value);
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenAttributes(nestedValue, nextPrefix, attributes, depth + 1);
  }
}

function formatData(data: unknown): string {
  if (data === undefined || data === null) return "";
  if (typeof data === "string") return `${COLORS.dim}${data}${COLORS.reset}`;
  try {
    const str = JSON.stringify(data, null, 2);
    return `${COLORS.dim}${str}${COLORS.reset}`;
  } catch {
    return `${COLORS.dim}[unserializable]${COLORS.reset}`;
  }
}

function getRuntime(runtime?: RunwareSentryRuntime): RunwareSentryRuntime {
  if (runtime) return runtime;
  return typeof window !== "undefined" && typeof document !== "undefined"
    ? "browser"
    : "node";
}

async function defaultSentryLoader(
  runtime: RunwareSentryRuntime,
): Promise<unknown> {
  if (runtime === "browser") return import("@sentry/browser");
  return import("@sentry/node");
}

function isSentryClient(value: unknown): value is RunwareSentryClient {
  if (!isPlainRecord(value)) return false;
  return (
    typeof value.init === "function" ||
    typeof value.captureMessage === "function" ||
    isPlainRecord(value.logger)
  );
}

function normalizeSentryClient(value: unknown): RunwareSentryClient | null {
  if (isSentryClient(value)) return value;
  if (isPlainRecord(value) && isSentryClient(value.default)) {
    return value.default;
  }
  return null;
}

function normalizeSentryModule(value: unknown): RunwareSentryModule | null {
  if (isPlainRecord(value)) {
    if (
      typeof value.withScope === "function" ||
      typeof value.NodeClient === "function" ||
      typeof value.BrowserClient === "function"
    ) {
      return value as RunwareSentryModule;
    }
    if (isPlainRecord(value.default)) {
      return normalizeSentryModule(value.default);
    }
  }
  return null;
}

// Build an isolated Sentry client instance (never the global one) and route
// events + logs to it via a forked scope. Returns null if the module lacks the
// primitives we need (caller falls back to the duck-typed client path).
function buildIsolatedEmitter(
  module: RunwareSentryModule,
  sentry: RunwareSentryOptions,
  runtime: RunwareSentryRuntime,
): RunwareSentryEmitter | null {
  const ClientCtor =
    runtime === "browser" ? module.BrowserClient : module.NodeClient;
  const transport =
    runtime === "browser"
      ? module.makeFetchTransport
      : module.makeNodeTransport;
  const withScope = module.withScope;

  if (!ClientCtor || !transport || !module.defaultStackParser || !withScope) {
    return null;
  }
  if (!sentry.dsn) return null;

  const { defaultIntegrations: _ignored, ...initOptions } =
    sentry.initOptions ?? {};

  const client = new ClientCtor({
    ...initOptions,
    dsn: sentry.dsn,
    ...(sentry.environment ? { environment: sentry.environment } : {}),
    ...(sentry.release ? { release: sentry.release } : {}),
    enableLogs: true,
    transport,
    stackParser: module.defaultStackParser,
    // No default integrations: we must not hook the host's global error
    // handlers or capture its unrelated crashes into the Runware org.
    integrations: [],
  });

  return {
    emit: ({ isError, message, loggerLevel, captureLevel, attributes }) => {
      withScope((scope) => {
        scope.setClient(client);
        scope.setExtras(attributes);
        if (isError) {
          module.captureMessage?.(message, captureLevel);
        }
        module.logger?.[loggerLevel]?.(message, attributes);
      });
    },
    flush: async (timeoutMs) => {
      await client.flush(timeoutMs);
    },
  };
}

// Emit through a customer-supplied, already-initialized Sentry client.
function buildCustomerEmitter(
  client: RunwareSentryClient,
): RunwareSentryEmitter {
  return {
    emit: ({ isError, message, loggerLevel, captureLevel, attributes }) => {
      const captureContext = { level: captureLevel, extra: attributes };
      const sentryLogger = client.logger?.[loggerLevel];
      if (sentryLogger) {
        sentryLogger(message, attributes);
        if (isError) {
          client.captureMessage?.(message, captureContext);
        }
        return;
      }
      client.captureMessage?.(message, captureContext);
    },
    flush: async (timeoutMs) => {
      await client.flush?.(timeoutMs);
    },
  };
}

function mapSentryLoggerLevel(level: LogLevel): RunwareSentryLogLevel {
  const severity = mapSeverity(level);
  if (severity === "error") return "error";
  if (severity === "warn") return "warn";
  if (severity === "debug") return "debug";
  return "info";
}

function mapSentryCaptureLevel(level: LogLevel): RunwareSentryCaptureLevel {
  const severity = mapSeverity(level);
  if (severity === "error") return "error";
  if (severity === "warn") return "warning";
  if (severity === "debug") return "debug";
  return "info";
}

function mapSeverity(level: LogLevel): RunwareLogLevel {
  if (level === LogLevel.ERROR) return "error";
  if (level === LogLevel.WARN) return "warn";
  if (
    level === LogLevel.HEARTBEAT ||
    level === LogLevel.SEND ||
    level === LogLevel.RECEIVE
  ) {
    return "debug";
  }
  return "info";
}

function normalizeTargets(type?: RunwareLogType): Set<RunwareLogTarget> {
  const targets = new Set<RunwareLogTarget>();
  const addTarget = (target: RunwareLogTarget) => targets.add(target);

  if (!type) {
    addTarget("console");
  } else if (type === "both") {
    addTarget("console");
    addTarget("telemetry");
  } else if (Array.isArray(type)) {
    type.forEach(addTarget);
  } else {
    addTarget(type);
  }

  return targets;
}

function normalizeSampleRate(sampleRate?: number): number {
  if (typeof sampleRate !== "number" || Number.isNaN(sampleRate)) return 1;
  if (sampleRate <= 0) return 0;
  if (sampleRate >= 1) return 1;
  return sampleRate;
}

// A single process-level `beforeExit` handler flushes every active logger, so
// constructing many SDK instances doesn't leak one listener each.
const runwareExitFlushers = new Set<(timeoutMs: number) => Promise<void>>();
let runwareExitHandlerRegistered = false;

function registerRunwareExitFlush(
  flush: (timeoutMs: number) => Promise<void>,
): void {
  runwareExitFlushers.add(flush);
  if (runwareExitHandlerRegistered) return;
  if (getRuntime() !== "node") return;
  if (typeof process === "undefined" || typeof process.once !== "function") {
    return;
  }
  runwareExitHandlerRegistered = true;
  process.once("beforeExit", () => {
    void Promise.all(
      [...runwareExitFlushers].map((flushOne) =>
        flushOne(2000).catch(() => {}),
      ),
    );
  });
}

function createRunwareTelemetrySentryOptions(): RunwareSentryOptions {
  return {
    dsn: RUNWARE_TELEMETRY_SENTRY_DSN,
    release: `${SDK_PACKAGE}@${SDK_VERSION}`,
  };
}

export class RunwareLogger {
  private enabled: boolean;
  private level: RunwareLogLevel;
  private targets: Set<RunwareLogTarget>;
  private events?: Set<RunwareLogEvent>;
  private sampleRate: number;
  private sentry?: RunwareSentryOptions;
  private telemetrySentry: RunwareSentryOptions;
  private sentryEmitterPromises: Partial<
    Record<SentryTarget, Promise<RunwareSentryEmitter | null>>
  > = {};
  private sentryDisabled: Partial<Record<SentryTarget, boolean>> = {};
  private sentryFailureWarned: Partial<Record<SentryTarget, boolean>> = {};
  private exitFlushRegistered = false;

  constructor(logging?: RunwareLoggingConfig | false) {
    const config = logging || undefined;
    this.enabled = config?.enabled === true;
    this.level = config?.level ?? "info";
    this.targets = normalizeTargets(config?.type);
    this.events = config?.events ? new Set(config.events) : undefined;
    this.sampleRate = normalizeSampleRate(config?.sampleRate);
    this.sentry = config?.sentry;
    this.telemetrySentry = createRunwareTelemetrySentryOptions();

    if (
      this.enabled &&
      (this.shouldUseTelemetry() || this.shouldUseCustomerSentry())
    ) {
      // Pre-warm the dynamic import + client build so the first event isn't
      // racing process exit, and flush buffered logs on natural exit.
      if (this.shouldUseTelemetry()) void this.loadSentryEmitter("telemetry");
      if (this.shouldUseCustomerSentry()) void this.loadSentryEmitter("sentry");
      this.registerExitFlush();
    }
  }

  private shouldUseConsole() {
    return this.targets.has("console");
  }

  private shouldUseTelemetry() {
    return !this.sentryDisabled.telemetry && this.targets.has("telemetry");
  }

  private shouldUseCustomerSentry() {
    return (
      !this.sentryDisabled.sentry && !!this.sentry && this.targets.has("sentry")
    );
  }

  private shouldEmit(
    level: LogLevel,
    event: RunwareLogEvent,
    sampled: boolean,
  ) {
    if (!this.enabled) return false;
    if (
      LOG_LEVEL_PRIORITY[mapSeverity(level)] > LOG_LEVEL_PRIORITY[this.level]
    ) {
      return false;
    }
    if (this.events && !this.events.has(event)) return false;
    if (sampled && this.sampleRate < 1 && Math.random() >= this.sampleRate) {
      return false;
    }
    return true;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    event: RunwareLogEvent = "request",
    options: { sampled?: boolean } = {},
  ) {
    if (!this.shouldEmit(level, event, options.sampled ?? true)) return;
    const sanitizedData = sanitizeLogData(data);

    if (this.shouldUseConsole()) {
      this.logToConsole(level, message, sanitizedData);
    }

    if (this.shouldUseTelemetry()) {
      void this.emitToSentryTarget(
        "telemetry",
        level,
        message,
        sanitizedData,
        event,
      );
    }

    if (this.shouldUseCustomerSentry()) {
      void this.emitToSentryTarget(
        "sentry",
        level,
        message,
        sanitizedData,
        event,
      );
    }
  }

  private logToConsole(level: LogLevel, message: string, data?: unknown) {
    const style = LEVEL_STYLES[level];
    const parts = [
      "",
      `${PREFIX}: ${badge(level)} ${style.icon}  ${style.fg}${COLORS.bold}${message}${COLORS.reset}`,
      `       ${timestamp()}`,
    ];
    if (data !== undefined) {
      parts.push(`       ${formatData(data)}`);
    }
    parts.push("");

    if (level === LogLevel.ERROR) {
      console.error(parts.join("\n"));
    } else if (level === LogLevel.WARN) {
      console.warn(parts.join("\n"));
    } else {
      console.log(parts.join("\n"));
    }
  }

  private getSentryOptions(
    target: SentryTarget,
  ): RunwareSentryOptions | undefined {
    if (target === "sentry") return this.sentry;

    // Telemetry always targets the Runware org DSN via its own isolated client.
    // We may reuse the customer's module loader/runtime (affects how the SDK is
    // imported), but never their `client` — that would redirect telemetry into
    // the customer's Sentry.
    return {
      ...this.telemetrySentry,
      initOptions: {
        ...(this.sentry?.initOptions ?? {}),
        ...(this.telemetrySentry.initOptions ?? {}),
      },
      ...(this.sentry?.loader ? { loader: this.sentry.loader } : {}),
      ...(this.sentry?.runtime ? { runtime: this.sentry.runtime } : {}),
    };
  }

  private async loadSentryEmitter(
    target: SentryTarget,
  ): Promise<RunwareSentryEmitter | null> {
    if (this.sentryDisabled[target]) return null;
    const sentry = this.getSentryOptions(target);
    if (!sentry) return null;
    if (!this.sentryEmitterPromises[target]) {
      this.sentryEmitterPromises[target] = this.createSentryEmitter(
        target,
        sentry,
      );
    }
    return this.sentryEmitterPromises[target] ?? null;
  }

  private async createSentryEmitter(
    target: SentryTarget,
    sentry: RunwareSentryOptions,
  ): Promise<RunwareSentryEmitter | null> {
    try {
      // Customer passed their own already-initialized Sentry client — route
      // through it as-is, never touching the global client ourselves.
      if (sentry.client) {
        return buildCustomerEmitter(sentry.client);
      }

      const runtime = getRuntime(sentry.runtime);
      const loaded = await (sentry.loader ?? defaultSentryLoader)(runtime);

      const module = normalizeSentryModule(loaded);
      if (module) {
        const isolated = buildIsolatedEmitter(module, sentry, runtime);
        if (isolated) return isolated;
      }

      // Fallback: the loader returned a duck-typed client (not a full module).
      const client = normalizeSentryClient(loaded);
      return client ? buildCustomerEmitter(client) : null;
    } catch (error) {
      this.disableSentry(target, error);
      return null;
    }
  }

  private disableSentry(target: SentryTarget, error: unknown) {
    this.sentryDisabled[target] = true;
    if (!this.shouldUseConsole() || this.sentryFailureWarned[target]) return;
    this.sentryFailureWarned[target] = true;
    console.warn(
      `${PREFIX} ${badge(LogLevel.WARN)} ${LEVEL_STYLES[LogLevel.WARN].icon}  ${LEVEL_STYLES[LogLevel.WARN].fg}${COLORS.bold}${target === "telemetry" ? "Telemetry" : "Sentry"} logging disabled — ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`,
    );
  }

  private async emitToSentryTarget(
    target: SentryTarget,
    level: LogLevel,
    message: string,
    data: unknown,
    event: RunwareLogEvent,
  ) {
    try {
      const emitter = await this.loadSentryEmitter(target);
      if (!emitter) return;

      const attributes: RunwareSentryAttributes = {
        "runware.event": event,
        "runware.log_level": level,
        "runware.severity": mapSeverity(level),
        "runware.target": target,
        "runware.sdk.name": SDK_NAME,
        "runware.sdk.package": SDK_PACKAGE,
        "runware.sdk.version": SDK_VERSION,
      };
      flattenAttributes(data, "", attributes);

      const isError = mapSeverity(level) === "error";

      // Sentry groups message events by the message text. Fold the (bounded)
      // error code into the message so distinct API failures become distinct
      // issues instead of all collapsing into one "Request failed". taskUUID is
      // deliberately excluded — it would explode grouping cardinality.
      const errorCode =
        typeof attributes["error.code"] === "string"
          ? (attributes["error.code"] as string)
          : typeof attributes["code"] === "string"
            ? (attributes["code"] as string)
            : undefined;

      const baseMessage = `${LOG_PREFIX}: ${message}`;
      // Append the code only when the message doesn't already carry it (e.g.
      // inferenceError builds "[code] modelAir" itself).
      const finalMessage =
        isError && errorCode && !baseMessage.includes(errorCode)
          ? `${baseMessage} (${errorCode})`
          : baseMessage;

      emitter.emit({
        isError,
        message: finalMessage,
        loggerLevel: mapSentryLoggerLevel(level),
        captureLevel: mapSentryCaptureLevel(level),
        attributes,
      });
    } catch (error) {
      this.disableSentry(target, error);
    }
  }

  private registerExitFlush() {
    if (this.exitFlushRegistered) return;
    this.exitFlushRegistered = true;
    // `beforeExit` fires on a natural drain (not on process.exit()); starting
    // the async flush keeps the loop alive until buffered telemetry is sent.
    registerRunwareExitFlush((timeoutMs) => this.flush(timeoutMs));
  }

  /**
   * Flush any buffered telemetry to Sentry. Call before the process exits
   * (e.g. `await runware.disconnect()`) so logs/events aren't dropped.
   */
  async flush(timeoutMs: number = 2000): Promise<void> {
    const targets: SentryTarget[] = ["telemetry", "sentry"];
    await Promise.all(
      targets.map(async (target) => {
        const pending = this.sentryEmitterPromises[target];
        if (!pending) return;
        try {
          const emitter = await pending;
          await emitter?.flush(timeoutMs);
        } catch {
          // Best-effort: never let a flush failure throw on teardown.
        }
      }),
    );
  }

  // ── Connection lifecycle ──────────────────────────────────────────────

  connecting(url: string) {
    this.log(
      LogLevel.CONNECTION,
      `Connecting to WebSocket`,
      { url },
      "connection",
    );
  }

  connected(sessionUUID: string) {
    this.log(
      LogLevel.CONNECTION,
      `WebSocket connection established`,
      {
        connectionSessionUUID: sessionUUID,
      },
      "connection",
    );
  }

  reconnecting(attempt: number) {
    this.log(
      LogLevel.CONNECTION,
      `Reconnecting... attempt #${attempt}`,
      undefined,
      "connection",
    );
  }

  reconnectScheduled(delayMs: number) {
    this.log(
      LogLevel.CONNECTION,
      `Reconnect scheduled in ${delayMs}ms`,
      undefined,
      "connection",
    );
  }

  disconnected(reason?: string) {
    this.log(
      LogLevel.CONNECTION,
      `WebSocket disconnected${reason ? `: ${reason}` : ""}`,
      undefined,
      "connection",
    );
  }

  connectionClosed(code?: number) {
    this.log(
      LogLevel.CONNECTION,
      `WebSocket closed`,
      {
        code,
      },
      "connection",
    );
  }

  connectionError(error?: unknown) {
    this.log(LogLevel.ERROR, `WebSocket error`, error, "error");
  }

  ensureConnectionStart() {
    this.log(
      LogLevel.CONNECTION,
      `Connection lost — waiting for reconnection...`,
      undefined,
      "connection",
    );
  }

  ensureConnectionSuccess() {
    this.log(
      LogLevel.CONNECTION,
      `Reconnection successful`,
      undefined,
      "connection",
    );
  }

  ensureConnectionTimeout() {
    this.log(
      LogLevel.ERROR,
      `Reconnection timed out after max retries`,
      undefined,
      "error",
    );
  }

  // ── Authentication ────────────────────────────────────────────────────

  authenticating(hasSession: boolean) {
    this.log(
      LogLevel.AUTH,
      hasSession
        ? `Re-authenticating with existing session`
        : `Authenticating with API key`,
      undefined,
      "connection",
    );
  }

  authenticated(sessionUUID: string) {
    this.log(
      LogLevel.AUTH,
      `Authentication successful`,
      {
        connectionSessionUUID: sessionUUID,
      },
      "connection",
    );
  }

  authError(error: unknown) {
    this.log(LogLevel.ERROR, `Authentication failed`, error, "error");
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────

  heartbeatStarted(intervalMs: number, maxMissedPongs: number) {
    this.log(
      LogLevel.HEARTBEAT,
      `Heartbeat started — ping every ${intervalMs / 1000}s, ${maxMissedPongs} missed pongs before close`,
      undefined,
      "heartbeat",
    );
  }

  heartbeatPingSent() {
    this.log(LogLevel.HEARTBEAT, `Ping sent`, undefined, "heartbeat");
  }

  heartbeatPongReceived() {
    this.log(
      LogLevel.HEARTBEAT,
      `Pong received — connection alive`,
      undefined,
      "heartbeat",
    );
  }

  heartbeatPongMissed(count: number, max: number) {
    this.log(
      LogLevel.WARN,
      `Pong missed (${count}/${max}) — ${count >= max ? "connection dead, terminating" : "will retry next cycle"}`,
      undefined,
      "heartbeat",
    );
  }

  heartbeatStopped() {
    this.log(LogLevel.HEARTBEAT, `Heartbeat stopped`, undefined, "heartbeat");
  }

  // ── Send / Receive ────────────────────────────────────────────────────

  messageSent(taskType: string, taskUUID?: string) {
    this.log(
      LogLevel.SEND,
      `Message sent`,
      {
        taskType,
        ...(taskUUID ? { taskUUID } : {}),
      },
      "request",
    );
  }

  messageReceived(taskType?: string, taskUUID?: string) {
    this.log(
      LogLevel.RECEIVE,
      `Message received`,
      {
        ...(taskType ? { taskType } : {}),
        ...(taskUUID ? { taskUUID } : {}),
      },
      "request",
    );
  }

  sendReconnecting() {
    this.log(
      LogLevel.WARN,
      `Send failed — WebSocket not ready, attempting reconnection before retry`,
      undefined,
      "connection",
    );
  }

  sendFailed(error: string) {
    this.log(LogLevel.ERROR, `Send failed — ${error}`, undefined, "error");
  }

  // ── Request lifecycle ─────────────────────────────────────────────────

  requestStart(taskType: string, taskUUID: string) {
    this.log(
      LogLevel.REQUEST,
      `Request started`,
      {
        taskType,
        taskUUID,
      },
      "request",
    );
  }

  requestComplete(taskType: string, taskUUID: string, durationMs: number) {
    this.log(
      LogLevel.REQUEST,
      `Request complete in ${durationMs}ms`,
      { taskType, taskUUID },
      "success",
    );
  }

  requestTimeout(taskUUID: string, timeoutMs: number) {
    this.log(
      LogLevel.ERROR,
      `Request timed out after ${timeoutMs}ms`,
      {
        taskUUID,
      },
      "error",
    );
  }

  requestError(taskUUID: string, error: unknown) {
    const errorMessage = isPlainRecord(error)
      ? (error.message ?? error.error ?? error)
      : error;
    this.log(
      LogLevel.ERROR,
      `Request failed`,
      {
        taskUUID,
        error: errorMessage,
      },
      "error",
    );
  }

  inferenceError(code: string, modelAir: string, data?: unknown) {
    this.log(
      LogLevel.ERROR,
      `inference error: [${code}] ${modelAir}`,
      data,
      "error",
    );
  }

  // ── Retry ─────────────────────────────────────────────────────────────

  retryAttempt(attempt: number, maxRetries: number, delayMs: number) {
    this.log(
      LogLevel.RETRY,
      `Retry ${attempt}/${maxRetries} — waiting ${delayMs}ms before next attempt`,
      undefined,
      "retry",
    );
  }

  retrySuccess(attempt: number) {
    this.log(
      LogLevel.RETRY,
      `Retry succeeded on attempt #${attempt}`,
      undefined,
      "success",
    );
  }

  retryExhausted(maxRetries: number) {
    this.log(
      LogLevel.ERROR,
      `All ${maxRetries} retries exhausted — giving up`,
      undefined,
      "error",
    );
  }

  retrySkippedApiError(code: string) {
    this.log(
      LogLevel.ERROR,
      `API error — skipping retry (not retryable)`,
      { code },
      "error",
    );
  }

  // ── General ───────────────────────────────────────────────────────────

  info(message: string, data?: unknown) {
    this.log(LogLevel.INFO, message, data, "request");
  }

  warn(message: string, data?: unknown) {
    this.log(LogLevel.WARN, message, data, "request");
  }

  error(message: string, data?: unknown) {
    this.log(LogLevel.ERROR, message, data, "error");
  }
}

// Singleton noop logger for when logging is disabled
const NOOP_LOGGER = new RunwareLogger();

export function createLogger(
  logging?: RunwareLoggingConfig | false,
): RunwareLogger {
  if (!logging || logging.enabled !== true) return NOOP_LOGGER;
  return new RunwareLogger(logging);
}
