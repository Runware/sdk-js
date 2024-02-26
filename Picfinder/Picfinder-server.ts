// @ts-ignore
// import ReconnectingWebsocket from "./reconnect";
import WebSocket from "ws";

import { PicfinderBase } from "./Picfinder-base";
import { Environment, IImage, SdkType } from "./types";
import { ENVIRONMENT_URLS, delay, getUUID, removeListener } from "./utils";

// let allImages: IImage[] = [];

export class PicfinderServer extends PicfinderBase {
  _instantiated: boolean = false;
  _listeners: any[] = [];
  _reconnectingIntervalId: null | any = null;
  _pingTimeout: any;
  _pongListener: any;

  constructor(environment: keyof typeof Environment, apikey: string) {
    super(environment, apikey);
    this._sdkType = SdkType.SERVER;
    if (apikey) {
      this.connect();
    }
  }

  // protected addListener({
  //   lis,
  //   check,
  //   groupKey,
  // }: {
  //   lis: (v: any) => any;
  //   check: (v: any) => any;
  //   groupKey?: string;
  // }) {
  //   const listener = (msg: any) => {
  //     if (msg?.error) {
  //       lis(msg);
  //     } else if (check(msg)) {
  //       lis(msg);
  //     }
  //   };
  //   const groupListener = { key: getUUID(), listener, groupKey };
  //   this._listeners.push(groupListener);
  //   const destroy = () => {
  //     this._listeners = removeListener(this._listeners, groupListener);
  //   };

  //   return {
  //     destroy,
  //   };
  // }

  protected async connect() {
    this._ws = new WebSocket((ENVIRONMENT_URLS as any)[this._environment], {
      perMessageDeflate: false,
    });
    delay(1);

    this._ws.on("error", () => {});
    this._ws.on("close", () => this.handleClose());

    this._ws.on("open", () => {
      // console.log("open");
      if (this._reconnectingIntervalId) {
        // console.log("clearing");
        clearInterval(this._reconnectingIntervalId);
      }
      if (this._connectionSessionUUID && this.isWebsocketReadyState()) {
        this.send({
          newConnection: {
            apiKey: this._apikey,
            connectionSessionUUID: this._connectionSessionUUID,
          },
        });
      } else {
        if (this.isWebsocketReadyState()) {
          this.send({ newConnection: { apiKey: this._apikey } });
        }
      }

      this.addListener({
        check: (m) => m?.newConnectionSessionUUID?.connectionSessionUUID,
        lis: (m) => {
          if (m?.error) {
            if (m.errorId === 19) {
              this._invalidAPIkey = "Invalid API key";
            } else {
              this._invalidAPIkey = "Error connection ";
            }
            return;
          }
          this._connectionSessionUUID =
            m?.newConnectionSessionUUID?.connectionSessionUUID;
          this._invalidAPIkey = undefined;
          this.heartBeat();
        },
      });
      this._pongListener?.destroy();
      this._pongListener = this.addListener({
        check: (m) => m?.pong,
        lis: (m) => {
          // console.log({ m });
          if (m.pong) {
            this.heartBeat();
          }
        },
      });
    });

    this._ws.on("message", (e: any, isBinary: any) => {
      const data = isBinary ? e : e?.toString();
      if (!data) return;
      const m = JSON.parse(data);
      this._listeners.forEach((lis) => {
        const result = lis.listener(m);
        if (result) {
          return;
        }
      });
    });
  }

  protected send = (msg: Object) => {
    this._ws.send(JSON.stringify(msg));
  };

  protected handleClose() {
    // console.log("closing");
    // console.log("ivanlid", this._invalidAPIkey);
    if (this._invalidAPIkey) {
      console.error(this._invalidAPIkey);
      return;
    }
    if (this._reconnectingIntervalId) {
      clearInterval(this._reconnectingIntervalId);
    }
    this._reconnectingIntervalId = setInterval(() => this.connect(), 1000);
  }

  protected heartBeat() {
    clearTimeout(this._pingTimeout);

    this._pingTimeout = setTimeout(() => {
      if (this.isWebsocketReadyState()) {
        this.send({ ping: true });
      }
    }, 5000);
  }

  //end of data
}
