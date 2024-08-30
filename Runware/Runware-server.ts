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

  constructor({ apiKey, url, shouldReconnect }: RunwareBaseType) {
    super({ apiKey, url, shouldReconnect });

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

    this.resetConnection();

    this._ws = new WebSocket(this._url, {
      perMessageDeflate: false,
    });

    // delay(1);

    this._ws.on("error", () => {});
    this._ws.on("close", () => {
      this.handleClose();
    });

    this._ws.on("open", () => {
      if (this._reconnectingIntervalId) {
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

      this.addListener({
        taskUUID: ETaskType.AUTHENTICATION,
        lis: (m) => {
          if (m?.error) {
            this._invalidAPIkey = "Invalid API key";
            return;
          }
          this._connectionSessionUUID =
            m?.[ETaskType.AUTHENTICATION]?.[0]?.connectionSessionUUID;
          this._invalidAPIkey = undefined;
        },
      });

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
    if (this._invalidAPIkey) {
      console.error(this._invalidAPIkey);
      return;
    }
    if (this._reconnectingIntervalId) {
      clearInterval(this._reconnectingIntervalId);
    }

    console.log("should reconnect", this._shouldReconnect);
    if (this._shouldReconnect) {
      console.log("reconnecting");

      setTimeout(() => this.connect(), 1000);
    }
    // this._reconnectingIntervalId = setInterval(() => this.connect(), 1000);
  }

  protected resetConnection = () => {
    if (this._ws) {
      this._listeners.forEach((list) => {
        list?.destroy?.();
      });
      this._ws.removeAllListeners(); // Remove all listeners
      this._ws.terminate();
      this._ws.close(); // Attempt to close gracefully
      this._ws = null;
      this._listeners = [];
    }
  };

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
