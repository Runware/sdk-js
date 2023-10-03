// @ts-ignore
import ReconnectingWebsocket from "./reconnect";
import {
  Environment,
  IImage,
  IRequestImage,
  ReconnectingWebsocketProps,
} from "./types";
import { ENVIRONMENT_URLS, removeFromAray } from "./utils";

// let allImages: IImage[] = [];

export class Picfinder {
  _ws: ReconnectingWebsocketProps | any;
  _listeners: MessageEvent[] = [];
  _apikey: string;
  _environment: string;
  _globalMessages: any[] = [];
  _globalImages: IImage[] = [];

  constructor(environment: keyof typeof Environment, apikey: string) {
    this._apikey = apikey;
    this._environment = environment;
    if (apikey) {
      this._ws = new (ReconnectingWebsocket as any)(
        ENVIRONMENT_URLS[environment]
      ) as ReconnectingWebsocketProps;
      this.connect();
    }
  }

  private addListener({
    lis,
    check,
  }: {
    lis: (v: any) => any;
    check: (v: any) => any;
  }) {
    this._ws.onmessage = (e: any) => {
      const m = JSON.parse(e.data);
      if (check(m)) {
        lis(m);
      }
    };
  }

  private destroy(lis: any) {
    removeFromAray(this._listeners, lis);
  }

  private send = (msg: Object) => this._ws.send(JSON.stringify(msg));

  connect() {
    this._ws.onopen = (e: any) => {
      this.send({ newConnection: { apiKey: this._apikey } });
    };

    this._ws.onmessage = (e: any) => {
      const data = JSON.parse(e.data);
      for (const listener of this._listeners) {
        const result = (listener as any)(data);
        if (result) return;
      }
    };
  }

  listenToImages() {
    this.addListener({
      check: (m) => m.newImages?.images,
      lis: (m) => {
        this._globalImages = [...this._globalImages, ...m.newImages?.images];
      },
    });
  }

  globalListener() {
    this.addListener({
      check: (m) => m,
      lis: (m) => {
        this._globalMessages.push(m);
      },
    });
  }

  async requestImages({
    modelId,
    positivePrompt,
    imageSize,
    negativePrompt,
    numberOfImages = 1,
    useCache = false,
  }: IRequestImage): Promise<IImage[]> {
    const taskUUID = crypto.randomUUID();
    const requestObject = {
      newTask: {
        taskUUID,
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
    this.listenToImages();
    const promise = await this.getSimililarImage({ taskUUID, numberOfImages });
    return promise;
  }

  getSimililarImage({
    taskUUID,
    numberOfImages,
  }: {
    taskUUID: string;
    numberOfImages: number;
  }): Promise<IImage[]> {
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(() => {
        const imagesWithSimilarTask = this._globalImages.filter(
          (img) => img.taskUUID === taskUUID
        );

        if (imagesWithSimilarTask.length === numberOfImages) {
          clearInterval(intervalId);
          this._globalImages = this._globalImages.filter(
            (img) => img.taskUUID !== taskUUID
          );
          console.log({ removing: this._globalImages.length });

          resolve(imagesWithSimilarTask); // Resolve the promise with the data
        }
      }, 1000); // Check every 1 second (adjust the interval as needed)
    });
  }
  //end of data
}
