import { RunwareBase } from "./Runware-base";
import ReconnectingWebsocket from "./reconnect";
import { ReconnectingWebsocketProps, RunwareBaseType } from "./types";

export class RunwareClient extends RunwareBase {
  constructor({ apiKey, url }: RunwareBaseType) {
    super({ apiKey, url });
    if (apiKey) {
      this._ws = new (ReconnectingWebsocket as any)(
        this._url
      ) as ReconnectingWebsocketProps;
      this.connect();
    }
  }
}
