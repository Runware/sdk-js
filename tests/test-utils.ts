import dotenv from "dotenv";
import { RunwareServer } from "../Runware/Runware-server";

dotenv.config();

const API_KEY = process.env.API_KEY || "";
const URL = process.env.VITE_RUNWARE_SDK_URL || "";

if (!API_KEY) {
  throw new Error("API_KEY not set in .env");
}

/**
 * Creates a real RunwareServer connected to the API via WebSocket.
 * Uses .env credentials — no mocks, no fake servers.
 * Pass enableLogging: true to see detailed SDK telemetry in the console.
 */
export const createRealServer = async (
  options?: { enableLogging?: boolean },
): Promise<RunwareServer> => {
  const server = await RunwareServer.initialize({
    apiKey: API_KEY,
    url: URL,
    shouldReconnect: false,
    heartbeatInterval: 30000,
    enableLogging: options?.enableLogging ?? true,
  });
  return server as RunwareServer;
};

// A small publicly-available test image URL for upload/input tests
export const TEST_IMAGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";
