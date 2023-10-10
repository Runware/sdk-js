// @ts-ignore
import { asyncRetry } from "./async-retry";
import ReconnectingWebsocket from "./reconnect";
import {
  EPreProcessor,
  EPreProcessorGroup,
  Environment,
  IControlNet,
  IControlNetWithUUID,
  IEnhancedPrompt,
  IImage,
  IImageToText,
  IPromptEnhancer,
  IRemoveImageBackground,
  IRequestImage,
  IRequestImageToText,
  IUpscaleGan,
  ReconnectingWebsocketProps,
  UploadImageType,
} from "./types";
import {
  ENVIRONMENT_URLS,
  accessDeepObject,
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
  // _globalMessages: any[] = [];
  _globalMessages: Record<string, any> = {};
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
      return await asyncRetry(async () => {
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
        this.globalListener({
          responseKey: "newUploadedImageUUID",
          taskKey: "newUploadedImageUUID",
        });

        const image = (await getIntervalWithPromise(
          ({ resolve }) => {
            const uploadedImage = this._globalMessages[taskUUID];
            if (uploadedImage) {
              delete this._globalMessages[taskUUID];
              resolve(uploadedImage);
              return true;
            }
          },
          { debugKey: "upload-image" }
        )) as UploadImageType;

        return image;
      });
    } catch (e) {
      console.log(e);
      throw e;
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
      this.globalListener({
        responseKey: "newPreProcessControlNet",
        taskKey: "newPreProcessControlNet",
      });

      const guideImage = (await getIntervalWithPromise(
        ({ resolve }) => {
          const uploadedImage = this._globalMessages[taskUUID];

          if (uploadedImage) {
            delete this._globalMessages[taskUUID];
            resolve(uploadedImage?.newPreProcessControlNet);
            return true;
          }
        },
        { debugKey: "unprocessed-image" }
      )) as UploadImageType;

      return guideImage;
    } catch (e: any) {
      throw e;
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

  listenToImages({
    onPartialImages,
    taskUUID,
  }: {
    taskUUID: string;
    onPartialImages?: (images: IImage[]) => void;
  }) {
    this.addListener({
      check: (m) => m.newImages?.images,
      lis: (m) => {
        onPartialImages?.(
          (m.newImages?.images as IImage[]).filter(
            (img) => img.taskUUID === taskUUID
          )
        );
        this._globalImages = [...this._globalImages, ...m.newImages?.images];
      },
    });
  }

  globalListener({
    responseKey,
    taskKey,
  }: {
    responseKey: string;
    taskKey: string;
  }) {
    this.addListener({
      check: (m) => {
        const value = accessDeepObject({
          key: responseKey,
          data: m,
          useZero: false,
        });
        return !!value;
      },
      lis: (m) => {
        const value = accessDeepObject({
          key: taskKey,
          data: m,
          useZero: false,
        });

        if (Array.isArray(value)) {
          value.forEach((v) => {
            this._globalMessages[v.taskUUID] = [
              ...(this._globalMessages[v.taskUUID] ?? []),
              v,
            ];
          });
        } else {
          this._globalMessages[value.taskUUID] = value;
        }
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
    onPartialImages,
  }: IRequestImage): Promise<IImage[]> {
    try {
      return await asyncRetry(async () => {
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
        const taskUUID = getUUID();

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
        this.listenToImages({ onPartialImages, taskUUID });
        const promise = await this.getSimililarImage({
          taskUUID,
          numberOfImages,
        });
        return promise;
      });
    } catch (e) {
      throw e;
    }
  }

  requestImageToText = async ({ imageInitiator }: IRequestImageToText) => {
    try {
      return await asyncRetry(async () => {
        const imageUploaded = await this.uploadImage(
          imageInitiator as File | string
        );

        if (!imageUploaded?.newImageUUID) return null;

        const taskUUID = getUUID();
        this.send({
          newReverseImageClip: {
            imageUUID: imageUploaded.newImageUUID,
            taskUUID,
          },
        });
        this.globalListener({
          responseKey: "newReverseClip",
          taskKey: "newReverseClip.texts",
        });

        const response = await getIntervalWithPromise(
          ({ resolve }) => {
            const newReverseClip = this._globalMessages[taskUUID];

            if (newReverseClip) {
              delete this._globalMessages[taskUUID];
              resolve(newReverseClip[0]);
              return true;
            }
          },
          { debugKey: "remove-image-background" }
        );

        return response as IImageToText;
      });
    } catch (e) {
      throw e;
    }
  };

  removeImageBackground = async ({
    imageInitiator,
  }: IRemoveImageBackground) => {
    try {
      return await asyncRetry(async () => {
        const imageUploaded = await this.uploadImage(
          imageInitiator as File | string
        );

        if (!imageUploaded?.newImageUUID) return null;

        const taskUUID = getUUID();

        this.send({
          newRemoveBackground: {
            imageUUID: imageUploaded.newImageUUID,
            taskUUID,
            taskType: 8,
          },
        });
        this.globalListener({
          responseKey: "newRemoveBackground",
          taskKey: "newRemoveBackground.images",
        });

        const response = await getIntervalWithPromise(
          ({ resolve }) => {
            const newRemoveBackground = this._globalMessages[taskUUID];

            if (newRemoveBackground) {
              delete this._globalMessages[taskUUID];
              resolve(newRemoveBackground);
              return true;
            }
          },
          { debugKey: "remove-image-background" }
        );

        return response as IImageToText;
      });
    } catch (e) {
      throw e;
    }
  };

  upscaleGan = async ({ imageInitiator, upscaleFactor }: IUpscaleGan) => {
    try {
      return await asyncRetry(async () => {
        const imageUploaded = await this.uploadImage(
          imageInitiator as File | string
        );

        if (!imageUploaded?.newImageUUID) return null;
        const taskUUID = getUUID();

        this.send({
          newUpscaleGan: {
            imageUUID: imageUploaded.newImageUUID,
            taskUUID,
            upscaleFactor,
          },
        });
        this.globalListener({
          responseKey: "newUpscaleGan",
          taskKey: "newUpscaleGan.images",
        });

        const response = await getIntervalWithPromise(
          ({ resolve }) => {
            const newUpscaleGan = this._globalMessages[taskUUID];
            if (newUpscaleGan) {
              delete this._globalMessages[taskUUID];
              resolve(newUpscaleGan);
              return true;
            }
          },
          { debugKey: "upscale-gan" }
        );

        return response as IImage[];
      });
    } catch (e) {
      throw e;
    }
  };

  enhancePrompt = async ({
    prompt,
    promptMaxLength = 380,
    promptLanguageId = 1,
    promptVersions = 1,
  }: IPromptEnhancer) => {
    try {
      return await asyncRetry(async () => {
        const taskUUID = getUUID();

        this.send({
          newPromptEnhance: {
            prompt,
            taskUUID,
            promptMaxLength,
            promptVersions,
            promptLanguageId,
          },
        });
        this.globalListener({
          responseKey: "newPromptEnhancer",
          taskKey: "newPromptEnhancer.texts",
        });

        const response = await getIntervalWithPromise(
          ({ resolve }) => {
            const reducedPrompt: IEnhancedPrompt[] =
              this._globalMessages[taskUUID];
            if (reducedPrompt?.length >= promptVersions) {
              delete this._globalMessages[taskUUID];
              resolve(reducedPrompt);
              return true;
            }
          },
          { debugKey: "enhance-prompt" }
        );

        return response as IEnhancedPrompt[];
      });
    } catch (e) {
      throw e;
    }
  };

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
        // onPartialImages?.(imagesWithSimilarTask)
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
