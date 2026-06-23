import { RunwareBase } from "./Runware-base";
import ReconnectingWebsocket from "./reconnect";
import { loadBrowserSentry } from "./sentry-browser";
import { ReconnectingWebsocketProps, RunwareBaseType } from "./types";
import { buildSdkUrl } from "./utils";

export class RunwareClient extends RunwareBase {
  constructor(props: RunwareBaseType) {
    const { shouldReconnect, ...rest } = props;

    super(rest, loadBrowserSentry);
    const url = buildSdkUrl(this._url || "", {
      dryRun: this._dryRun ? 1 : undefined,
    });
    this._ws = new (ReconnectingWebsocket as any)(
      url
    ) as ReconnectingWebsocketProps;
    this.connect();
  }
}
