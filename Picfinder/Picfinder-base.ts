// @ts-ignore
import { asyncRetry } from "./async-retry";
import {
  EPreProcessor,
  EPreProcessorGroup,
  Environment,
  IControlNet,
  IControlNetWithUUID,
  IEnhancedPrompt,
  IError,
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

export class PicfinderBase {
  _ws: ReconnectingWebsocketProps | any;
  _listeners: any[] = [];
  _apikey: string;
  _environment: string;
  // _globalMessages: any[] = [];
  _globalMessages: Record<string, any> = {};
  _globalImages: IImage[] = [];
  _globalError: IError | undefined;
  _connectionSessionUUID: string | undefined;
  _invalidAPIkey: string | undefined;

  constructor(environment: keyof typeof Environment, apikey: string) {
    this._apikey = apikey;
    this._environment = environment;
  }

  protected isWebsocketReadyState = () => this._ws?.readyState === 1;

  protected addListener({
    lis,
    check,
  }: {
    lis: (v: any) => any;
    check: (v: any) => any;
  }): { destroy: Function } {
    this._ws.onmessage = (e: any) => {
      const m = JSON.parse(e.data);

      if (m?.error) {
        lis(m);
      } else if (check(m)) {
        lis(m);
      }
    };

    return {
      destroy: () => {},
    };
  }

  protected connect() {
    this._ws.onopen = (e: any) => {
      if (this._connectionSessionUUID) {
        this.send({
          newConnection: {
            apiKey: this._apikey,
            connectionSessionUUID: this._connectionSessionUUID,
          },
        });
      } else {
        this.send({ newConnection: { apiKey: this._apikey } });
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
        },
      });
    };

    this._ws.onmessage = (e: any) => {
      const data = JSON.parse(e.data);
      for (const listener of this._listeners) {
        const result = (listener as any)(data);
        if (result) return;
      }
    };

    this._ws.onclose = (e: any) => {
      // console.log("closing");
      // console.log("ivanlid", this._invalidAPIkey);
      if (this._invalidAPIkey) {
        console.error(this._invalidAPIkey);
        return;
      }
    };
  }
  protected send = (msg: Object) => this._ws.send(JSON.stringify(msg));

  private destroy(lis: any) {
    removeFromAray(this._listeners, lis);
  }

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
        const lis = this.globalListener({
          responseKey: "newUploadedImageUUID",
          taskKey: "newUploadedImageUUID",
          taskUUID,
        });

        const image = (await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const uploadedImage = this._globalMessages[taskUUID];

            if (uploadedImage?.error) {
              reject(uploadedImage);
              return true;
            }

            if (uploadedImage) {
              delete this._globalMessages[taskUUID];
              resolve(uploadedImage);
              return true;
            }
          },
          { debugKey: "upload-image" }
        )) as UploadImageType;

        lis.destroy();

        return image;
      });
    } catch (e) {
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
      const lis = this.globalListener({
        responseKey: "newPreProcessControlNet",
        taskKey: "newPreProcessControlNet",
        taskUUID,
      });

      const guideImage = (await getIntervalWithPromise(
        ({ resolve, reject }) => {
          const uploadedImage = this._globalMessages[taskUUID];

          if (uploadedImage?.error) {
            reject(uploadedImage);
            return true;
          }

          if (uploadedImage) {
            delete this._globalMessages[taskUUID];
            resolve(uploadedImage?.newPreProcessControlNet);
            return true;
          }
        },
        { debugKey: "unprocessed-image" }
      )) as UploadImageType;

      lis.destroy();

      return guideImage;
    } catch (e: any) {
      throw e;
    }
  };

  listenToImages({
    onPartialImages,
    taskUUID,
  }: {
    taskUUID: string;
    onPartialImages?: (images: IImage[], error?: any) => void;
  }) {
    return this.addListener({
      check: (m) => m.newImages?.images,
      lis: (m) => {
        onPartialImages?.(
          (m.newImages?.images as IImage[])?.filter(
            (img) => img.taskUUID === taskUUID
          ),
          m?.error && m
        );

        if (m.error) {
          this._globalError = m;
        } else {
          this._globalImages = [...this._globalImages, ...m.newImages?.images];
        }
      },
    });
  }

  globalListener({
    responseKey,
    taskKey,
    taskUUID,
  }: {
    responseKey: string;
    taskKey: string;
    taskUUID: string;
  }) {
    return this.addListener({
      check: (m) => {
        const value = accessDeepObject({
          key: responseKey,
          data: m,
          useZero: false,
        });
        return !!value;
      },
      lis: (m) => {
        if (m.error) {
          this._globalMessages[taskUUID] = m;
          return;
        }

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
      await this.ensureConnection();
      return asyncRetry(async () => {
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

          const lis = this.listenToImages({ onPartialImages, taskUUID });

          const promise = await this.getSimililarImage({
            taskUUID,
            numberOfImages,
          });

          lis.destroy();

          return promise;
        } catch (e) {
          throw e;
        }
      });
    } catch (e) {
      throw e;
    }

    // console.log({ res });
    // return res.the;
  }

  requestImageToText = async ({
    imageInitiator,
  }: IRequestImageToText): Promise<IImageToText> => {
    try {
      await this.ensureConnection();
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
        const lis = this.globalListener({
          responseKey: "newReverseClip",
          taskKey: "newReverseClip.texts",
          taskUUID,
        });

        const response = await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const newReverseClip = this._globalMessages[taskUUID];

            if (newReverseClip?.error) {
              reject(newReverseClip);
              return true;
            }

            if (newReverseClip) {
              delete this._globalMessages[taskUUID];
              resolve(newReverseClip[0]);
              return true;
            }
          },
          { debugKey: "remove-image-background" }
        );

        lis.destroy();

        return response as IImageToText;
      });
    } catch (e) {
      throw e;
    }
  };

  removeImageBackground = async ({
    imageInitiator,
  }: IRemoveImageBackground): Promise<IImage[]> => {
    try {
      await this.ensureConnection();
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
        const lis = this.globalListener({
          responseKey: "newRemoveBackground",
          taskKey: "newRemoveBackground.images",
          taskUUID,
        });

        const response = await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const newRemoveBackground = this._globalMessages[taskUUID];

            if (newRemoveBackground?.error) {
              reject(newRemoveBackground);
              return true;
            }

            if (newRemoveBackground) {
              delete this._globalMessages[taskUUID];
              resolve(newRemoveBackground);
              return true;
            }
          },
          { debugKey: "remove-image-background" }
        );

        lis.destroy();

        return response as IImage[];
      });
    } catch (e) {
      throw e;
    }
  };

  upscaleGan = async ({
    imageInitiator,
    upscaleFactor,
  }: IUpscaleGan): Promise<IImage[]> => {
    try {
      await this.ensureConnection();
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
        const lis = this.globalListener({
          responseKey: "newUpscaleGan",
          taskKey: "newUpscaleGan.images",
          taskUUID,
        });

        const response = await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const newUpscaleGan = this._globalMessages[taskUUID];

            if (newUpscaleGan?.error) {
              reject(newUpscaleGan);
              return true;
            }

            if (newUpscaleGan) {
              delete this._globalMessages[taskUUID];
              resolve(newUpscaleGan);
              return true;
            }
          },
          { debugKey: "upscale-gan" }
        );

        lis.destroy();

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
  }: IPromptEnhancer): Promise<IEnhancedPrompt> => {
    try {
      await this.ensureConnection();
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
        const lis = this.globalListener({
          responseKey: "newPromptEnhancer",
          taskKey: "newPromptEnhancer.texts",
          taskUUID,
        });

        const response = await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const reducedPrompt: IEnhancedPrompt[] =
              this._globalMessages[taskUUID];

            if ((reducedPrompt as any)?.error) {
              reject(reducedPrompt as any);
              return true;
            }

            if (reducedPrompt?.length >= promptVersions) {
              delete this._globalMessages[taskUUID];
              resolve(reducedPrompt);
              return true;
            }
          },
          { debugKey: "enhance-prompt" }
        );

        lis.destroy();
        return response as IEnhancedPrompt[];
      });
    } catch (e) {
      console.log({ e });
      throw e;
    }
  };

  async ensureConnection() {
    let isConnected = this.connected() && this._ws.readyState === 1;

    try {
      if (this._invalidAPIkey) throw this._invalidAPIkey;
      if (!isConnected) {
        const listenerTaskUID = getUUID();

        if (this._ws.readyState === 1) {
          this.send({
            newConnection: { apiKey: this._apikey, taskUUID: listenerTaskUID },
          });
        }
        const lis = this.globalListener({
          responseKey: "newConnectionSessionUUID",
          taskKey: "newConnectionSessionUUID.connectionSessionUUID",
          taskUUID: listenerTaskUID,
        });

        await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const connectionId: string = this._globalMessages[listenerTaskUID];

            if ((connectionId as any)?.error) {
              reject(connectionId);
              return true;
            }

            if (connectionId) {
              delete this._globalMessages[listenerTaskUID];
              this._connectionSessionUUID = connectionId;
              resolve(connectionId);
              return true;
            }
          },
          { debugKey: "listen-to-connection" }
        );

        lis.destroy();
      }
    } catch (e) {
      throw (
        this._invalidAPIkey ??
        "Could not connect to server. Ensure your API key is correct"
      );
    }
  }

  async getSimililarImage({
    taskUUID,
    numberOfImages,
  }: {
    taskUUID: string;
    numberOfImages: number;
  }): Promise<IImage[] | IError> {
    const result = (await getIntervalWithPromise(
      ({ resolve, reject }) => {
        const imagesWithSimilarTask = this._globalImages.filter(
          (img) => img.taskUUID === taskUUID
        );

        if (this._globalError) {
          const newData = this._globalError;
          this._globalError = undefined;
          // throw errorData[0]
          reject<IError>?.(newData);
          return true;
        }
        // onPartialImages?.(imagesWithSimilarTask)
        else if (imagesWithSimilarTask.length === numberOfImages) {
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

  connected = () =>
    this.isWebsocketReadyState() && !!this._connectionSessionUUID;
  //end of data
}
