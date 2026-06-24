import { createLogger as createBaseLogger } from "./logger";
import { loadNodeSentry } from "./sentry-node";
import type { RunwareLoggingConfig } from "./logger";

export * from "./Runware-client";
export * from "./types";
export * from "./Runware-server";
export * from "./Runware";
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

export function createLogger(logging?: RunwareLoggingConfig | false) {
  return createBaseLogger(logging, loadNodeSentry);
}
