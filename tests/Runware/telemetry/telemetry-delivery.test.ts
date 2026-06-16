import { describe, it, expect } from "vitest";
import * as SentryNode from "@sentry/node";
import { RunwareLogger, RunwareSentryOptions } from "../../../Runware/logger";

// Capture Sentry envelopes through a stub transport so nothing hits the
// network. We reuse the real @sentry/node module (NodeClient, withScope,
// logger, captureMessage, defaultStackParser) and only swap the transport.
function makeHarness() {
  const envelopes: string[][] = [];
  const stubTransport = () => ({
    send: async (envelope: any) => {
      envelopes.push((envelope[1] as any[]).map((item) => item[0].type));
      return {};
    },
    flush: async () => true,
  });
  const loader = async () => ({
    ...SentryNode,
    makeNodeTransport: stubTransport,
  });
  const sentry: RunwareSentryOptions = { loader, runtime: "node" };
  return { envelopes, sentry };
}

const kinds = (envelopes: string[][]) => envelopes.flat();

async function waitFor(predicate: () => boolean, timeoutMs = 1500) {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("telemetry delivery", () => {
  it("sends an error as an event eagerly and logs after flush", async () => {
    const { envelopes, sentry } = makeHarness();
    const logger = new RunwareLogger({
      enabled: true,
      level: "debug",
      type: "telemetry",
      sentry,
    });

    logger.error("boom"); // error severity → Sentry event (+ log)
    logger.info("hello"); // non-error → log only

    await waitFor(() => kinds(envelopes).includes("event"));
    expect(kinds(envelopes)).toContain("event");

    await logger.flush(2000);
    await waitFor(() => kinds(envelopes).includes("log"));
    expect(kinds(envelopes)).toContain("log");
  });

  it("never hijacks the host's global Sentry client", async () => {
    const { sentry } = makeHarness();
    const logger = new RunwareLogger({
      enabled: true,
      level: "debug",
      type: "telemetry",
      sentry,
    });

    logger.error("boom");
    await logger.flush(2000);

    // The SDK builds an isolated client; the global Sentry client stays unset.
    expect(SentryNode.getClient()).toBeUndefined();
  });

  it("enables telemetry by default when no type is configured", async () => {
    const { envelopes, sentry } = makeHarness();
    const logger = new RunwareLogger({
      enabled: true,
      level: "debug",
      sentry,
    });

    logger.error("boom");

    await waitFor(() => envelopes.length > 0);
    expect(envelopes.length).toBeGreaterThan(0);
    await logger.flush(2000);
  });

  it("stays silent (no telemetry) when type is console-only", async () => {
    const { envelopes, sentry } = makeHarness();
    const logger = new RunwareLogger({
      enabled: true,
      level: "debug",
      type: "console",
      sentry,
    });

    logger.error("boom");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await logger.flush(2000);

    expect(envelopes.length).toBe(0);
  });
});
