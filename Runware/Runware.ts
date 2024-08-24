let Runware;
import { RunwareClient } from "./Runware-client";
import { RunwareServer } from "./Runware-server";

if (typeof window === "undefined") {
  Runware = RunwareServer;
} else {
  Runware = RunwareClient;
}

export { Runware };
