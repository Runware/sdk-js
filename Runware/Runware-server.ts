// @ts-ignore
// import ReconnectingWebsocket from "./reconnect";
import WebSocket from "ws";

import { RunwareBase } from "./Runware-base";
import { ETaskType, RunwareBaseType, SdkType } from "./types";
import { buildSdkUrl, SDK_VERSION } from "./utils";

// let allImages: IImage[] = [];

export class RunwareServer extends RunwareBase {
  _instantiated: boolean = false;
  _listeners: any[] = [];
  _reconnectingIntervalId: null | any = null;
  private _connecting: boolean = false;

  constructor(props: RunwareBaseType) {
    super(props);

    this._sdkType = SdkType.SERVER;
    this.connect();
  }

  protected async connect() {
    if (!this._url) return;
    if (this._connecting) return;
    this._connecting = true;

    this.resetConnection();

    try {
      const url = buildSdkUrl(this._url, {
        dryRun: this._dryRun ? 1 : undefined,
      });
      this._logger.connecting(url);

      this._ws = new WebSocket(url, {
        perMessageDeflate: false,
        headers: {
          "X-SDK-Name": "js",
          "X-SDK-Version": SDK_VERSION,
        },
      });
    } catch (err) {
      this._connecting = false;
      this._logger.connectionError(err);
      return;
    }

    this._ws.on("error", (err: any) => {
      this._connecting = false;
      this._logger.connectionError(err?.message || err);
    });

    this._ws.on("close", () => {
      this.handleClose();
    });

    this._ws.on("open", async () => {
      if (this._reconnectingIntervalId) {
        clearInterval(this._reconnectingIntervalId);
      }

      this._logger.authenticating(!!this._connectionSessionUUID);

      try {
        if (this._connectionSessionUUID && this.isWebsocketReadyState()) {
          await this.send({
            taskType: ETaskType.AUTHENTICATION,
            apiKey: this._apiKey,
            connectionSessionUUID: this._connectionSessionUUID,
          });
        } else {
          if (this.isWebsocketReadyState()) {
            await this.send({
              apiKey: this._apiKey,
              taskType: ETaskType.AUTHENTICATION,
            });
          }
        }
      } catch (err) {
        this._connecting = false;
        this._logger.error("Failed to send auth message", err);
        return;
      }

      const authListener = this.addListener({
        taskUUID: ETaskType.AUTHENTICATION,
        lis: (m) => {
          this._connecting = false;
          if (m?.error) {
            this._connectionError = m;
            this._logger.authError(m);
            authListener?.destroy?.();
            return;
          }
          this._connectionSessionUUID =
            m?.[ETaskType.AUTHENTICATION]?.[0]?.connectionSessionUUID;
          this._connectionError = undefined;
          this._logger.authenticated(this._connectionSessionUUID || "");
          authListener?.destroy?.();
          this.startHeartbeat();
        },
      });
    });

    this._ws.on("message", (e: any, isBinary: any) => {
      const data = isBinary ? e : e?.toString();
      if (!data) return;
      let m: any;
      try {
        m = JSON.parse(data);
      } catch (err) {
        this._logger.error("Failed to parse WebSocket message", err);
        return;
      }

      const messageData = Array.isArray(m?.data)
        ? m.data[0]
        : Array.isArray(m)
          ? m[0]
          : m;
      this._logger.messageReceived(
        messageData?.taskType,
        messageData?.taskUUID,
      );

      if (this.handlePongMessage(m)) return;

      this._listeners.forEach((lis) => {
        const result = lis.listener(m);
        if (result) {
          return;
        }
      });
    });
  }

  protected send = async (msg: Object) => {
    const taskType = (msg as { taskType?: string })?.taskType ?? "unknown";
    const taskUUID = (msg as { taskUUID?: string })?.taskUUID;

    if (!this.canSendMessage(taskType)) {
      this._logger.sendReconnecting();
      this.closeCurrentWebsocket();
      // ensureConnection either resolves (ws ready) or throws
      await this.ensureConnection();
    }
    this._logger.messageSent(taskType, taskUUID);
    this._ws.send(JSON.stringify([msg]));
  };

  protected handleClose() {
    this._connecting = false;
    this._logger.connectionClosed();
    this._connectionSessionUUID = undefined;
    this.stopHeartbeat();
    if (this.isInvalidAPIKey()) {
      return;
    }
    if (this._reconnectingIntervalId) {
      clearInterval(this._reconnectingIntervalId);
    }

    if (this._shouldReconnect) {
      this._logger.reconnectScheduled(1000);
      setTimeout(() => this.connect(), 1000);
    }
  }

  protected resetConnection = () => {
    this.stopHeartbeat();
    if (this._ws) {
      this._listeners.forEach((list) => {
        list?.destroy?.();
      });
      this._ws.removeAllListeners(); // Remove all listeners
      if (this._ws.readyState === 1) {
        this._ws.terminate();
        this._ws.close(); // Attempt to close gracefully
      }

      this._ws = null;
      this._listeners = [];
    }
  };

  //end of data
}
