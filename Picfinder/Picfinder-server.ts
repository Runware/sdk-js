// @ts-ignore
// import ReconnectingWebsocket from "./reconnect";
import WebSocket from "ws";

import { PicfinderBase } from "./Picfinder-base";
import { Environment, IImage } from "./types";
import { ENVIRONMENT_URLS } from "./utils";

// let allImages: IImage[] = [];

let connectionSessionUUID: string | undefined;
export class PicfinderServer extends PicfinderBase {
  constructor(environment: keyof typeof Environment, apikey: string) {
    super(environment, apikey);
    if (apikey) {
      this._ws = new WebSocket(ENVIRONMENT_URLS[environment], {
        perMessageDeflate: false,
      });
      this.connect();
    }
  }

  protected addListener({
    lis,
    check,
  }: {
    lis: (v: any) => any;
    check: (v: any) => any;
  }) {
    this._ws.on("message", (e: any, isBinary: any) => {
      const data = isBinary ? e : e?.toString();

      if (!data) return;
      const m = JSON.parse(data);
      if (m.error) {
        lis(m);
      } else if (check(m)) {
        lis(m);
      }
    });
  }

  protected connect() {
    this._ws.on("error", console.error);
    this._ws.on("open", () => {
      if (connectionSessionUUID) {
        this.send({
          newConnection: {
            apiKey: this._apikey,
            connectionSessionUUID,
          },
        });
      } else {
        this.send({ newConnection: { apiKey: this._apikey } });
      }

      this.addListener({
        check: (m) => m?.newConnectionSessionUUID?.connectionSessionUUID,
        lis: (m) => {
          connectionSessionUUID =
            m?.newConnectionSessionUUID?.connectionSessionUUID;
        },
      });
    });
  }

  protected send = (msg: Object) => {
    this._ws.send(JSON.stringify(msg));
  };

  //end of data
}
