// @ts-ignore
import { PicfinderBase } from "./Picfinder-base";
import ReconnectingWebsocket from "./reconnect";
import { Environment, ReconnectingWebsocketProps } from "./types";
import { ENVIRONMENT_URLS } from "./utils";

export class Picfinder extends PicfinderBase {
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
