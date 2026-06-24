/**
 * Telemetry delivery debug harness.
 *
 * Run:  API_KEY=... VITE_RUNWARE_SDK_URL=... npx tsx tests/telemetry-debug.ts
 *
 * It wraps the real Sentry transport so you SEE the ingest HTTP status in your
 * own console. Telemetry still targets the Runware org DSN (the loader only
 * swaps the transport, not the destination).
 */
import dotenv from "dotenv";
import { Runware } from "../Runware";
import * as Sentry from "@sentry/node";

dotenv.config();

const realMakeTransport = Sentry.makeNodeTransport;
const ingestCodes: Array<number | undefined> = [];

const transportSpyLoader = async () => ({
  ...Sentry,
  makeNodeTransport: (options: any) => {
    const transport = realMakeTransport(options);
    return {
      send: async (envelope: any) => {
        const result = await transport.send(envelope);
        const status = (result as any)?.statusCode;
        ingestCodes.push(status);
        const kinds = (envelope[1] as any[]).map((item) => item[0].type).join(",");
        console.log(`>>> SENTRY INGEST status=${status} kinds=[${kinds}]`);
        return result;
      },
      flush: (timeout: number) => transport.flush(timeout),
    };
  },
});

const runware = new Runware({
  apiKey: process.env.API_KEY || "",
  url: process.env.VITE_RUNWARE_SDK_URL || "",
  globalMaxRetries: 1,
  logging: {
    enabled: true,
    type: "both",
    level: "debug",
    sentry: { loader: transportSpyLoader },
  },
} as any);

(async () => {
  try {
    await runware.requestImages({
      positivePrompt: "telemetry debug",
      model: "runware:invalid-model@0",
      width: 512,
      height: 512,
      numberResults: 1,
      outputType: "URL",
      outputFormat: "WEBP",
    } as any);
    console.log(">>> Unexpected success — change the request to force an error");
  } catch {
    console.log(">>> SDK error (expected)");
  } finally {
    await runware.disconnect();
  }

  console.log(">>> DONE. ingest status codes:", JSON.stringify(ingestCodes));
  if (ingestCodes.includes(200)) {
    console.log(
      ">>> ✅ Telemetry WAS accepted by Sentry (200). If you can't see it: check the correct PROJECT, the ISSUES tab (event title: '[jsSdk - <ver>]: Request failed'), and the LOGS explorer for the lifecycle entries.",
    );
  } else {
    console.log(
      ">>> ❌ No 200 from ingest — telemetry never left this process (so it's a delivery/exit problem, not the Sentry UI).",
    );
  }
})();
