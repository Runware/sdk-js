# Running Tests

All tests use **real WebSocket connections** against the Runware production API. No mock servers.

## Prerequisites

1. Ensure your `.env` file has valid production credentials:

```
API_KEY = "your-api-key"
VITE_RUNWARE_SDK_URL = "wss://ws-api.runware.ai/v1"
```

2. Install dependencies:

```bash
npm install
```

---

## Run All Tests

```bash
npx vitest run tests/ --reporter verbose
```

---

## Run by Folder

```bash
# Connection lifecycle & health (heartbeat, session UUID, send guard, zombie detection)
npx vitest run tests/Runware/connection/ --reporter verbose

# Retry mechanism (asyncRetry duplicate send fix)
npx vitest run tests/Runware/retry/ --reporter verbose

# API inference (image, video, prompt, upscale, upload)
npx vitest run tests/Runware/inference/ --reporter verbose

# Server instantiation & auth
npx vitest run tests/Runware/server/ --reporter verbose
```

---

## Run a Single File

```bash
npx vitest run tests/Runware/connection/heartbeat.test.ts --reporter verbose
npx vitest run tests/Runware/connection/session-uuid.test.ts --reporter verbose
npx vitest run tests/Runware/connection/send-guard.test.ts --reporter verbose
npx vitest run tests/Runware/connection/zombie-detection.test.ts --reporter verbose
npx vitest run tests/Runware/retry/async-retry.test.ts --reporter verbose
npx vitest run tests/Runware/inference/image-generation.test.ts --reporter verbose
npx vitest run tests/Runware/inference/video-generation.test.ts --reporter verbose
npx vitest run tests/Runware/inference/enhance-prompt.test.ts --reporter verbose
npx vitest run tests/Runware/inference/upscale.test.ts --reporter verbose
npx vitest run tests/Runware/inference/upload-image.test.ts --reporter verbose
npx vitest run tests/Runware/server/connection.test.ts --reporter verbose
```

---

## Run a Single Test by Name

Use the `-t` flag to match a test name:

```bash
npx vitest run tests/Runware/inference/video-generation.test.ts -t "submits video job" --reporter verbose
npx vitest run tests/Runware/connection/heartbeat.test.ts -t "3-strike" --reporter verbose
npx vitest run tests/Runware/retry/async-retry.test.ts -t "customer scenario" --reporter verbose
```

---

## Watch Mode (re-runs on file change)

```bash
npx vitest tests/Runware/connection/heartbeat.test.ts --reporter verbose
```

---

## Test Structure

```
tests/Runware/
├── connection/                         # Connection lifecycle & health
│   ├── heartbeat.test.ts              # Ping/pong, 3-strike tolerance, keepalive
│   ├── session-uuid.test.ts           # _connectionSessionUUID clearing on close
│   ├── send-guard.test.ts             # send() readyState check + ensureConnection retry
│   └── zombie-detection.test.ts       # E2E: connect → close → state cleared → send blocked
│
├── retry/                              # Retry mechanism
│   └── async-retry.test.ts            # Missing return fix, duplicate send prevention
│
├── inference/                          # Real API feature tests
│   ├── image-generation.test.ts       # requestImages / imageInference
│   ├── video-generation.test.ts       # videoInference with skipResponse + getResponse polling
│   ├── enhance-prompt.test.ts         # enhancePrompt / promptEnhance
│   ├── upscale.test.ts                # upscaleGan / upscale
│   └── upload-image.test.ts           # uploadImage
│
└── server/                             # Server instantiation & auth
    └── connection.test.ts             # RunwareServer connect, auth, heartbeat, disconnect
```

---

## Telemetry Logging

All tests run with `enableLogging: true` by default, so you will see colored `[RUNWARE]` telemetry output showing connection, auth, heartbeat, send, and error events in the console.

To disable logging for a specific test, pass `{ enableLogging: false }` to `createRealServer()`.

---

## Timeouts

- **Connection/retry tests**: 30s default
- **Image/prompt/upscale tests**: 60s
- **Video generation tests**: up to 6 minutes (video rendering is async)

If a test times out, check your network connection and API key validity.
