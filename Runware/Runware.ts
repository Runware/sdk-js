// @ts-ignore
import { RunwareBase } from "./Runware-base";
import ReconnectingWebsocket from "./reconnect";
import { Environment, ReconnectingWebsocketProps } from "./types";
import { ENVIRONMENT_URLS } from "./utils";

export class Runware extends RunwareBase {
  constructor(environment: keyof typeof Environment, apikey: string) {
    super(environment, apikey);
    if (apikey) {
      this._ws = new (ReconnectingWebsocket as any)(
        ENVIRONMENT_URLS[environment]
      ) as ReconnectingWebsocketProps;
      this.connect();
    }
  }
}
