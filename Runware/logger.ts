/**
 * Runware SDK Telemetry Logger
 *
 * Beautiful colored console output for debugging SDK internals.
 * Only active when `enableLogging: true` is passed during instantiation.
 *
 * Usage:
 *   const runware = new RunwareServer({ apiKey: "...", enableLogging: true });
 */

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

const LEVEL_STYLES: Record<
  LogLevel,
  { bg: string; fg: string; icon: string }
> = {
  [LogLevel.CONNECTION]: { bg: COLORS.bgBlue, fg: COLORS.blue, icon: "🔌" },
  [LogLevel.AUTH]: { bg: COLORS.bgGreen, fg: COLORS.green, icon: "🔑" },
  [LogLevel.HEARTBEAT]: { bg: COLORS.bgMagenta, fg: COLORS.magenta, icon: "💓" },
  [LogLevel.SEND]: { bg: COLORS.bgCyan, fg: COLORS.cyan, icon: "📤" },
  [LogLevel.RECEIVE]: { bg: COLORS.bgCyan, fg: COLORS.cyan, icon: "📥" },
  [LogLevel.RETRY]: { bg: COLORS.bgYellow, fg: COLORS.yellow, icon: "🔄" },
  [LogLevel.REQUEST]: { bg: COLORS.bgBlue, fg: COLORS.blue, icon: "📡" },
  [LogLevel.ERROR]: { bg: COLORS.bgRed, fg: COLORS.red, icon: "❌" },
  [LogLevel.WARN]: { bg: COLORS.bgYellow, fg: COLORS.yellow, icon: "⚠️" },
  [LogLevel.INFO]: { bg: COLORS.bgWhite, fg: COLORS.gray, icon: "ℹ️" },
};

const PREFIX = `${COLORS.bold}${COLORS.magenta}[RUNWARE]${COLORS.reset}`;

function timestamp(): string {
  return `${COLORS.dim}${new Date().toISOString()}${COLORS.reset}`;
}

function badge(level: LogLevel): string {
  const style = LEVEL_STYLES[level];
  return `${style.bg}${COLORS.bold}${COLORS.black} ${level} ${COLORS.reset}`;
}

function formatData(data: any): string {
  if (data === undefined || data === null) return "";
  if (typeof data === "string") return `${COLORS.dim}${data}${COLORS.reset}`;
  try {
    const str = JSON.stringify(data, null, 2);
    return `${COLORS.dim}${str}${COLORS.reset}`;
  } catch {
    return `${COLORS.dim}[unserializable]${COLORS.reset}`;
  }
}

export class RunwareLogger {
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.enabled) return;
    const style = LEVEL_STYLES[level];
    const parts = [
      "",
      `${PREFIX} ${badge(level)} ${style.icon}  ${style.fg}${COLORS.bold}${message}${COLORS.reset}`,
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

  // ── Connection lifecycle ──────────────────────────────────────────────

  connecting(url: string) {
    this.log(LogLevel.CONNECTION, `Connecting to WebSocket`, { url });
  }

  connected(sessionUUID: string) {
    this.log(LogLevel.CONNECTION, `WebSocket connection established`, {
      connectionSessionUUID: sessionUUID,
    });
  }

  reconnecting(attempt: number) {
    this.log(LogLevel.CONNECTION, `Reconnecting... attempt #${attempt}`);
  }

  reconnectScheduled(delayMs: number) {
    this.log(
      LogLevel.CONNECTION,
      `Reconnect scheduled in ${delayMs}ms`,
    );
  }

  disconnected(reason?: string) {
    this.log(
      LogLevel.CONNECTION,
      `WebSocket disconnected${reason ? `: ${reason}` : ""}`,
    );
  }

  connectionClosed(code?: number) {
    this.log(LogLevel.CONNECTION, `WebSocket closed`, {
      code,
    });
  }

  connectionError(error?: any) {
    this.log(LogLevel.ERROR, `WebSocket error`, error);
  }

  ensureConnectionStart() {
    this.log(
      LogLevel.CONNECTION,
      `Connection lost — waiting for reconnection...`,
    );
  }

  ensureConnectionSuccess() {
    this.log(LogLevel.CONNECTION, `Reconnection successful`);
  }

  ensureConnectionTimeout() {
    this.log(
      LogLevel.ERROR,
      `Reconnection timed out after max retries`,
    );
  }

  // ── Authentication ────────────────────────────────────────────────────

  authenticating(hasSession: boolean) {
    this.log(
      LogLevel.AUTH,
      hasSession ? `Re-authenticating with existing session` : `Authenticating with API key`,
    );
  }

  authenticated(sessionUUID: string) {
    this.log(LogLevel.AUTH, `Authentication successful`, {
      connectionSessionUUID: sessionUUID,
    });
  }

  authError(error: any) {
    this.log(LogLevel.ERROR, `Authentication failed`, error);
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────

  heartbeatStarted(intervalMs: number) {
    this.log(
      LogLevel.HEARTBEAT,
      `Heartbeat started — ping every ${intervalMs / 1000}s, ${3} missed pongs before close`,
    );
  }

  heartbeatPingSent() {
    this.log(LogLevel.HEARTBEAT, `Ping sent`);
  }

  heartbeatPongReceived() {
    this.log(LogLevel.HEARTBEAT, `Pong received — connection alive`);
  }

  heartbeatPongMissed(count: number, max: number) {
    this.log(
      LogLevel.WARN,
      `Pong missed (${count}/${max}) — ${count >= max ? "connection dead, terminating" : "will retry next cycle"}`,
    );
  }

  heartbeatStopped() {
    this.log(LogLevel.HEARTBEAT, `Heartbeat stopped`);
  }

  // ── Send / Receive ────────────────────────────────────────────────────

  messageSent(taskType: string, taskUUID?: string) {
    this.log(LogLevel.SEND, `Message sent`, {
      taskType,
      ...(taskUUID ? { taskUUID } : {}),
    });
  }

  messageReceived(taskType?: string, taskUUID?: string) {
    this.log(LogLevel.RECEIVE, `Message received`, {
      ...(taskType ? { taskType } : {}),
      ...(taskUUID ? { taskUUID } : {}),
    });
  }

  sendReconnecting() {
    this.log(
      LogLevel.WARN,
      `Send failed — WebSocket not ready, attempting reconnection before retry`,
    );
  }

  sendFailed(error: string) {
    this.log(LogLevel.ERROR, `Send failed — ${error}`);
  }

  // ── Request lifecycle ─────────────────────────────────────────────────

  requestStart(taskType: string, taskUUID: string) {
    this.log(LogLevel.REQUEST, `Request started`, {
      taskType,
      taskUUID,
    });
  }

  requestComplete(taskType: string, taskUUID: string, durationMs: number) {
    this.log(
      LogLevel.REQUEST,
      `Request complete in ${durationMs}ms`,
      { taskType, taskUUID },
    );
  }

  requestTimeout(taskUUID: string, timeoutMs: number) {
    this.log(LogLevel.ERROR, `Request timed out after ${timeoutMs}ms`, {
      taskUUID,
    });
  }

  requestError(taskUUID: string, error: any) {
    this.log(LogLevel.ERROR, `Request failed`, {
      taskUUID,
      error: error?.message || error?.error || error,
    });
  }

  // ── Retry ─────────────────────────────────────────────────────────────

  retryAttempt(attempt: number, maxRetries: number, delayMs: number) {
    this.log(
      LogLevel.RETRY,
      `Retry ${attempt}/${maxRetries} — waiting ${delayMs}ms before next attempt`,
    );
  }

  retrySuccess(attempt: number) {
    this.log(LogLevel.RETRY, `Retry succeeded on attempt #${attempt}`);
  }

  retryExhausted(maxRetries: number) {
    this.log(
      LogLevel.ERROR,
      `All ${maxRetries} retries exhausted — giving up`,
    );
  }

  retrySkippedApiError(code: string) {
    this.log(
      LogLevel.ERROR,
      `API error — skipping retry (not retryable)`,
      { code },
    );
  }

  // ── General ───────────────────────────────────────────────────────────

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, message, data);
  }
}

// Singleton noop logger for when logging is disabled
const NOOP_LOGGER = new RunwareLogger(false);

export function createLogger(enabled: boolean): RunwareLogger {
  return enabled ? new RunwareLogger(true) : NOOP_LOGGER;
}
