// @ts-ignore
import { RunwareClient } from "./Runware-client";
import { RunwareServer } from "./Runware-server";

let Runware: typeof RunwareClient | typeof RunwareServer;

if (typeof window === "undefined") {
  Runware = RunwareServer;
} else {
  Runware = RunwareClient;
}

export { Runware };
