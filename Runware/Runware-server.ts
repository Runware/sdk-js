// @ts-ignore
// import ReconnectingWebsocket from "./reconnect";
import WebSocket from "ws";

import { RunwareBase } from "./Runware-base";
import { ETaskType, RunwareBaseType, SdkType } from "./types";
import { delay } from "./utils";

// let allImages: IImage[] = [];

export class RunwareServer extends RunwareBase {
  _instantiated: boolean = false;
  _listeners: any[] = [];
  _reconnectingIntervalId: null | any = null;
  _pingTimeout: any;
  _pongListener: any;

  constructor({ apiKey, url }: RunwareBaseType) {
    super({ apiKey, url });

    this._sdkType = SdkType.SERVER;
    if (apiKey) {
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
    if (!this._url) return;
    this._ws = new WebSocket(this._url, {
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
          taskType: ETaskType.AUTHENTICATION,
          apiKey: this._apiKey,
          connectionSessionUUID: this._connectionSessionUUID,
        });
      } else {
        if (this.isWebsocketReadyState()) {
          this.send({
            apiKey: this._apiKey,
            taskType: ETaskType.AUTHENTICATION,
          });
        }
      }

      // this.addListener({
      //   check: (m) => m?.newConnectionSessionUUID?.connectionSessionUUID,
      //   lis: (m) => {
      //     if (m?.error) {
      //       if (m.errorId === 19) {
      //         this._invalidAPIkey = "Invalid API key";
      //       } else {
      //         this._invalidAPIkey = "Error connection ";
      //       }
      //       return;
      //     }
      //     this._connectionSessionUUID =
      //       m?.newConnectionSessionUUID?.connectionSessionUUID;
      //     this._invalidAPIkey = undefined;
      //     this.heartBeat();
      //   },
      // });
      // this._pongListener?.destroy();
      // this._pongListener = this.addListener({
      //   check: (m) => m?.pong,
      //   lis: (m) => {
      //     // console.log({ m });
      //     if (m.pong) {
      //       this.heartBeat();
      //     }
      //   },
      // });
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
    this._ws.send(JSON.stringify([msg]));
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
