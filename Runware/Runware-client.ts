import { RunwareBase } from "./Runware-base";
import ReconnectingWebsocket from "./reconnect";
import { ReconnectingWebsocketProps, RunwareBaseType } from "./types";

export class RunwareClient extends RunwareBase {
  constructor(props: RunwareBaseType) {
    const { shouldReconnect, ...rest } = props;

    super(rest);
    this._ws = new (ReconnectingWebsocket as any)(
      this._url
    ) as ReconnectingWebsocketProps;
    this.connect();
  }
}
