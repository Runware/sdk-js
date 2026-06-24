import type { RunwareSentryLoader } from "./logger";

export const loadNodeSentry: RunwareSentryLoader = async () =>
  import("@sentry/node");
