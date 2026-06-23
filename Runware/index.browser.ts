import { RunwareClient } from "./Runware-client";
import { createLogger as createBaseLogger } from "./logger";
import { loadBrowserSentry } from "./sentry-browser";
import type { RunwareLoggingConfig } from "./logger";

export * from "./Runware-client";
export * from "./types";
export {
  RunwareLogger,
  LogLevel,
  RUNWARE_TELEMETRY_SENTRY_DSN,
} from "./logger";
export type {
  RunwareLogEvent,
  RunwareLogLevel,
  RunwareLoggingConfig,
  RunwareLogTarget,
  RunwareLogType,
  RunwareSentryClient,
  RunwareSentryOptions,
} from "./logger";
export { SDK_VERSION } from "./utils";

export const Runware = RunwareClient;

export function createLogger(logging?: RunwareLoggingConfig | false) {
  return createBaseLogger(logging, loadBrowserSentry);
}
