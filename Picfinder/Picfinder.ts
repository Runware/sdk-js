// @ts-ignore
import ReconnectingWebsocket from "./reconnect";
import {
  EPreProcessor,
  EPreProcessorGroup,
  Environment,
  IControlNet,
  IControlNetWithUUID,
  IImage,
  IRequestImage,
  ReconnectingWebsocketProps,
  UploadImageType,
} from "./types";
import {
  ENVIRONMENT_URLS,
  compact,
  fileToBase64,
  getIntervalWithPromise,
  getPreprocessorType,
  getTaskType,
  getUUID,
  removeFromAray,
} from "./utils";

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

  private uploadImage = async (
    file: File | string
  ): Promise<UploadImageType | null> => {
    try {
      const imageBase64 =
        typeof file === "string" ? file : await fileToBase64(file);
      const taskUUID = getUUID();
      this.send({
        newImageUpload: {
          imageBase64,
          taskUUID,
          taskType: 7,
        },
      });
      this.globalListener();

      const image = (await getIntervalWithPromise(
        ({ resolve }) => {
          const uploadedImage = this._globalMessages.find(
            (v) => v?.newUploadedImageUUID?.taskUUID === taskUUID
          );
          if (uploadedImage) {
            this._globalMessages = this._globalMessages.filter(
              (v) => v?.newUploadedImageUUID?.taskUUID === taskUUID
            );
            resolve(uploadedImage?.newUploadedImageUUID);
            return true;
          }
        },
        { debugKey: "upload-image" }
      )) as UploadImageType;

      return image;
    } catch (e) {
      return null;
    }
  };

  private uploadUnprocessedImage = async ({
    file,
    preProcessorType,
    width,
    height,
    lowThresholdCanny,
    highThresholdCanny,
    includeHandsAndFaceOpenPose = true,
  }: {
    file: File | string;
    preProcessorType: EPreProcessorGroup;
    width?: number;
    height?: number;
    lowThresholdCanny?: number;
    highThresholdCanny?: number;
    includeHandsAndFaceOpenPose?: boolean;
  }): Promise<UploadImageType | null> => {
    try {
      const image = await this.uploadImage(file);
      if (!image) return null;

      const taskUUID = getUUID();
      this.send({
        newPreProcessControlNet: {
          taskUUID,
          preProcessorType,
          guideImageUUID: image.newImageUUID,
          includeHandsAndFaceOpenPose,
          ...compact(lowThresholdCanny, { lowThresholdCanny }),
          ...compact(highThresholdCanny, { highThresholdCanny }),
          // width,
          // height,
        },
      });
      this.globalListener();

      const guideImage = (await getIntervalWithPromise(
        ({ resolve }) => {
          const uploadedImage = this._globalMessages.find(
            (v) => v?.newPreProcessControlNet?.taskUUID === taskUUID
          );
          if (uploadedImage) {
            this._globalMessages = this._globalMessages.filter(
              (v) => v?.newPreProcessControlNet?.taskUUID === taskUUID
            );
            resolve(uploadedImage?.newPreProcessControlNet);
            return true;
          }
        },
        { debugKey: "unprocessed-image" }
      )) as UploadImageType;

      return guideImage;
    } catch (e: any) {
      throw Error(e);
    }
  };

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
    imageInitiator,
    controlNet,
    imageMaskInitiator,
    steps,
  }: IRequestImage): Promise<IImage[]> {
    try {
      let imageInitiatorUUID: string | null = null;
      let imageMaskInitiatorUUID: string | null = null;
      let controlNetData: IControlNetWithUUID[] = [];

      if (imageInitiator) {
        const uploadedImage = await this.uploadImage(imageInitiator);

        if (!uploadedImage) return [];
        imageInitiatorUUID = uploadedImage.newImageUUID;
      }
      if (imageMaskInitiator) {
        const uploadedMaskInitiator = await this.uploadImage(
          imageMaskInitiator
        );
        if (!uploadedMaskInitiator) return [];
        imageMaskInitiatorUUID = uploadedMaskInitiator.newImageUUID;
      }

      if (controlNet?.length) {
        for (let i = 0; i < controlNet.length; i++) {
          const controlData: IControlNet = controlNet[i];
          const anyControlData = controlData as any;
          const {
            endStep,
            preprocessor,
            startStep,
            weight,
            guideImage,
            guideImageUnprocessed,
          } = controlData;

          const getCannyObject = () => {
            if (controlData.preprocessor === "canny") {
              return {
                lowThresholdCanny: anyControlData.lowThresholdCanny,
                highThresholdCanny: anyControlData.highThresholdCanny,
              };
            } else return {};
          };

          const imageUploaded = await (guideImageUnprocessed
            ? this.uploadUnprocessedImage({
                file: guideImageUnprocessed,
                preProcessorType: getPreprocessorType(
                  preprocessor as EPreProcessor
                ),
                includeHandsAndFaceOpenPose:
                  anyControlData.includeHandsAndFaceOpenPose,
                ...getCannyObject(),
              })
            : this.uploadImage(guideImage as File | string));

          if (!imageUploaded) return [];

          controlNetData.push({
            guideImageUUID: imageUploaded.newImageUUID,
            endStep,
            preprocessor,
            startStep,
            weight,
            ...getCannyObject(),
          });
        }
      }

      const taskUUID = crypto.randomUUID();
      const prompt = `${positivePrompt} ${
        negativePrompt ? `-no ${negativePrompt}` : ""
      }`.trim();
      const requestObject = {
        newTask: {
          taskUUID,
          offset: 0,
          modelId: modelId,
          promptText: prompt,
          numberResults: numberOfImages,
          sizeId: imageSize,
          taskType: getTaskType({
            prompt,
            controlNet,
            imageInitiator,
            imageMaskInitiator,
          }),
          useCache: useCache,
          schedulerId: 22,
          gScale: 7,
          ...(steps ? { steps } : {}),
          ...(imageInitiatorUUID ? { imageInitiatorUUID } : {}),
          ...(imageMaskInitiatorUUID ? { imageMaskInitiatorUUID } : {}),
          ...(controlNetData.length ? { controlNet: controlNetData } : {}),
        },
      };
      this.send(requestObject);
      this.listenToImages();
      const promise = await this.getSimililarImage({
        taskUUID,
        numberOfImages,
      });
      return promise;
    } catch (e: any) {
      throw Error(e);
    }
  }

  async getSimililarImage({
    taskUUID,
    numberOfImages,
  }: {
    taskUUID: string;
    numberOfImages: number;
  }): Promise<IImage[]> {
    const result = (await getIntervalWithPromise(
      ({ resolve }) => {
        const imagesWithSimilarTask = this._globalImages.filter(
          (img) => img.taskUUID === taskUUID
        );

        if (imagesWithSimilarTask.length === numberOfImages) {
          // clearInterval(intervalId);
          this._globalImages = this._globalImages.filter(
            (img) => img.taskUUID !== taskUUID
          );

          resolve<IImage[]>(imagesWithSimilarTask);
          return true;
          // Resolve the promise with the data
        }
      },
      { debugKey: "getting images" }
    )) as IImage[];

    return result;
  }
  //end of data
}
