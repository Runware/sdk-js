// @ts-ignore
import ReconnectingWebsocket from "./reconnect";
import {
  Environment,
  IImage,
  IRequestImage,
  ReconnectingWebsocketProps,
} from "./types";
import { ENVIRONMENT_URLS, removeFromAray } from "./utils";

export class Picfinder {
  _ws: ReconnectingWebsocketProps;
  _listeners: MessageEvent[] = [];
  _apikey: string;
  _environment: string;

  constructor(environment: keyof typeof Environment, apikey: string) {
    this._apikey = apikey;
    this._environment = environment;
    this._ws = new ReconnectingWebsocket(ENVIRONMENT_URLS[environment]);
  }

  private addListener(lis: any) {
    this._listeners.push(lis);
    return {
      destroy: () => removeFromAray(this._listeners, lis),
    };
  }

  private send = (msg: Object) => this._ws.send(JSON.stringify(msg));

  connect() {
    this._ws.onopen = (e) => {
      this.send({ newConnection: { apiKey: this._apikey } });
    };

    this._ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      for (const listener of this._listeners) {
        const result = (listener as any)(data);
        if (result) return;
      }
    };
  }

  listenToImages(callback: (images: IImage[]) => void) {
    const images: any = [];
    this.addListener((m: any) => {
      if (m.newImages) {
        callback(m.newImages?.images as IImage[]);
      }
      return images;
    });
  }

  requestImages({
    modelId,
    positivePrompt,
    imageSize,
    negativePrompt,
    numberOfImages = 1,
    useCache = false,
  }: IRequestImage) {
    const requestObject = {
      newTask: {
        taskUUID: crypto.randomUUID(),
        offset: 0,
        modelId: modelId,
        promptText: `${positivePrompt} ${
          negativePrompt ? `-no ${negativePrompt}` : ""
        }`.trim(),
        numberResults: numberOfImages,
        sizeId: imageSize, //512x768
        taskType: 1, //9 controlnet
        useCache: useCache,
        schedulerId: 22,
        gScale: 7,
        steps: 30,
      },
    };
    this.send(requestObject);
  }
}
