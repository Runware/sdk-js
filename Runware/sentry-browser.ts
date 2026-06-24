import type { RunwareSentryLoader } from "./logger";

export const loadBrowserSentry: RunwareSentryLoader = async () =>
  import("@sentry/browser");
