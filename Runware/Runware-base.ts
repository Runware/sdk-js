// @ts-ignore
import { asyncRetry } from "./async-retry";
import {
  EControlMode,
  EPreProcessor,
  EPreProcessorGroup,
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
  IOutputType,
  IUpscaleGan,
  ListenerType,
  ReconnectingWebsocketProps,
  RunwareBaseType,
  SdkType,
  UploadImageType,
  ETaskType,
  IControlNetPreprocess,
  IControlNetImage,
  IRemoveImage,
} from "./types";
import {
  BASE_RUNWARE_URLS,
  LISTEN_TO_IMAGES_KEY,
  accessDeepObject,
  compact,
  delay,
  evaluateNonTrue,
  fileToBase64,
  getIntervalWithPromise,
  getUUID,
  isValidUUID,
  removeFromAray,
  removeListener,
} from "./utils";

// let allImages: IImage[] = [];

export class RunwareBase {
  _ws: ReconnectingWebsocketProps | any;
  _listeners: ListenerType[] = [];
  _apiKey: string;
  _url?: string;
  // _globalMessages: any[] = [];
  _globalMessages: Record<string, any> = {};
  _globalImages: IImage[] = [];
  _globalError: IError | undefined;
  _connectionSessionUUID: string | undefined;
  _invalidAPIkey: string | undefined;
  _sdkType: SdkType;

  constructor({ apiKey, url = BASE_RUNWARE_URLS.PRODUCTION }: RunwareBaseType) {
    this._apiKey = apiKey;
    this._url = url;
    this._sdkType = SdkType.CLIENT;
  }

  protected isWebsocketReadyState = () => this._ws?.readyState === 1;

  // protected addListener({
  //   lis,
  //   check,
  // }: {
  //   lis: (v: any) => any;
  //   check: (v: any) => any;
  //   groupKey?: string;
  // }): { destroy: Function } {
  //   this._ws.onmessage = (e: any) => {
  //     const m = JSON.parse(e.data);

  //     if (m?.error) {
  //       lis(m);
  //     } else if (check(m)) {
  //       lis(m);
  //     }
  //   };

  //   return {
  //     destroy: () => {},
  //   };
  // }

  protected addListener({
    lis,
    // check,
    groupKey,
    taskUUID,
  }: {
    lis: (v: any) => any;
    // check: ETaskType;
    groupKey?: string;
    taskUUID: string;
  }) {
    const listener = (msg: {
      data: any[];
      errors?: { taskUUID: string; code: string; taskType?: string }[];
      errorMessage?: string;
    }) => {
      const arrayMessage = Array.isArray(msg?.data) ? msg.data : [msg.data];

      const arrayErrors = Array.isArray(msg?.errors)
        ? msg.errors
        : [msg.errors];

      // const filteredMessage = arrayMessage.filter(
      //   (v) => v?.taskType === check
      // );

      const filteredMessage = arrayMessage.filter(
        (v) => (v?.taskUUID || v?.taskType) === taskUUID
      );

      const filteredErrors = arrayErrors.filter(
        (v) => (v?.taskUUID || v?.taskType) === taskUUID
      );

      if (filteredErrors.length) {
        lis({ error: { ...(arrayErrors[0] ?? {}) } });
        return;
      }

      if (filteredMessage.length) {
        lis({ [taskUUID]: arrayMessage });
        return;
      }
    };
    const groupListener = { key: getUUID(), listener, groupKey };
    this._listeners.push(groupListener);
    const destroy = () => {
      this._listeners = removeListener(this._listeners, groupListener);
    };

    return {
      destroy,
    };
  }

  protected connect() {
    this._ws.onopen = (e: any) => {
      if (this._connectionSessionUUID) {
        this.send({
          taskType: ETaskType.AUTHENTICATION,
          apiKey: this._apiKey,
          connectionSessionUUID: this._connectionSessionUUID,
        });
      } else {
        this.send({ apiKey: this._apiKey, taskType: ETaskType.AUTHENTICATION });
      }

      this.addListener({
        taskUUID: ETaskType.AUTHENTICATION,
        lis: (m) => {
          if (m?.error) {
            if (m.errorId === 19) {
              this._invalidAPIkey = "Invalid API key";
            }
            return;
          }
          this._connectionSessionUUID =
            m?.[ETaskType.AUTHENTICATION]?.[0]?.connectionSessionUUID;
          this._invalidAPIkey = undefined;
        },
      });
    };

    this._ws.onmessage = (e: any) => {
      const data = JSON.parse(e.data);
      for (const lis of this._listeners) {
        const result = (lis as any)?.listener?.(data);
        if (result) return;
      }
    };

    this._ws.onclose = (e: any) => {
      // console.log("closing");
      // console.log("invalid", this._invalidAPIkey);
      if (this._invalidAPIkey) {
        console.error(this._invalidAPIkey);
        return;
      }
    };
  }

  // We moving to an array format, it make sense to consolidate all request to an array here
  protected send = (msg: Object) => this._ws.send(JSON.stringify([msg]));

  private destroy(lis: any) {
    removeFromAray(this._listeners, lis);
  }

  private uploadImage = async (
    file: File | string
  ): Promise<UploadImageType | null> => {
    try {
      return await asyncRetry(async () => {
        const taskUUID = getUUID();

        if (typeof file === "string" && isValidUUID(file)) {
          return {
            imageURL: file,
            imageUUID: file,
            taskUUID,
            taskType: ETaskType.IMAGE_UPLOAD,
          };
        }

        const imageBase64 =
          typeof file === "string" ? file : await fileToBase64(file);

        this.send({
          taskType: ETaskType.IMAGE_UPLOAD,
          image: imageBase64,
          taskUUID,
        });
        const lis = this.globalListener({
          taskUUID,
        });

        const image = (await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const uploadedImage = this.getSingleMessage({
              taskUUID,
            });
            if (!uploadedImage) return;

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

  listenToImages({
    onPartialImages,
    taskUUID,
    groupKey,
  }: {
    taskUUID: string;
    onPartialImages?: (images: IImage[], error?: any) => void;
    groupKey: LISTEN_TO_IMAGES_KEY;
  }) {
    return this.addListener({
      taskUUID: taskUUID,
      lis: (m) => {
        const images = (m?.[taskUUID] as IImage[])?.filter(
          (img) => img.taskUUID === taskUUID
        );
        onPartialImages?.(images, m?.error && m);

        if (m.error) {
          this._globalError = m;
        } else {
          if (this._sdkType === SdkType.CLIENT) {
            // this._globalImages = [...this._globalImages, ...m.images];
            this._globalImages = [
              ...this._globalImages,
              ...(m?.[taskUUID] ?? []),
            ];
          } else {
            this._globalImages = [...this._globalImages, ...images];
          }
        }
      },
      groupKey,
    });
  }

  globalListener({ taskUUID }: { taskUUID: string }) {
    return this.addListener({
      // check: (m) => {
      //   const value = accessDeepObject({
      //     key: responseKey,
      //     data: m,
      //     useZero: false,
      //   });
      //   return !!value;
      // },
      // check: responseKey,
      taskUUID: taskUUID,
      lis: (m) => {
        if (m.error) {
          this._globalMessages[taskUUID] = m;
          return;
        }

        const value = accessDeepObject({
          key: taskUUID,
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
    outputType,
    outputFormat,
    uploadEndpoint,
    checkNsfw,
    positivePrompt,
    negativePrompt,
    seedImage,
    maskImage,
    strength,
    height,
    width,
    model,
    steps,
    scheduler,
    seed,
    CFGScale,
    clipSkip,
    usePromptWeighting,
    numberResults = 1,
    controlNet,
    lora,
    useCache,
    onPartialImages,
    includeCost,
  }: // imageSize,

  // gScale,
  IRequestImage): Promise<IImage[] | undefined> {
    let lis: any = undefined;
    let requestObject: Record<string, any> | undefined = undefined;
    let taskUUIDs: string[] = [];
    let retryCount = 0;

    try {
      await this.ensureConnection();

      let seedImageUUID: string | null = null;
      let maskImageUUID: string | null = null;
      let controlNetData: IControlNetWithUUID[] = [];

      if (seedImage) {
        const uploadedImage = await this.uploadImage(seedImage);

        if (!uploadedImage) return [];
        seedImageUUID = uploadedImage.imageUUID;
      }
      if (maskImage) {
        const uploadedMaskInitiator = await this.uploadImage(maskImage);
        if (!uploadedMaskInitiator) return [];
        maskImageUUID = uploadedMaskInitiator.imageUUID;
      }

      if (controlNet?.length) {
        for (let i = 0; i < controlNet.length; i++) {
          const controlData: IControlNet = controlNet[i];
          const {
            endStep,
            startStep,
            weight,
            guideImage,
            controlMode,
            startStepPercentage,
            endStepPercentage,
            model: controlNetModel,
          } = controlData;

          if (!guideImage) return;

          const imageUploaded = await this.uploadImage(
            guideImage as File | string
          );

          if (!imageUploaded) return;

          controlNetData.push({
            guideImage: imageUploaded.imageUUID,
            model: controlNetModel,
            endStep,
            startStep,
            weight,
            ...evaluateNonTrue({
              key: "startStepPercentage",
              value: startStepPercentage,
            }),
            ...evaluateNonTrue({
              key: "endStepPercentage",
              value: endStepPercentage,
            }),
            controlMode: controlMode || EControlMode.CONTROL_NET,
          });
        }
      }

      requestObject = {
        taskType: ETaskType.IMAGE_INFERENCE,
        model,
        positivePrompt: positivePrompt,
        ...(negativePrompt ? { negativePrompt } : {}),
        ...(height ? { height } : {}),
        ...(width ? { width } : {}),
        numberResults,
        ...(lora?.length ? { lora: lora } : {}),
        ...(outputType ? { outputType } : {}),
        ...(outputFormat ? { outputFormat } : {}),
        ...(uploadEndpoint ? { uploadEndpoint } : {}),
        ...evaluateNonTrue({ key: "checkNsfw", value: checkNsfw }),
        ...evaluateNonTrue({ key: "strength", value: strength }),
        ...evaluateNonTrue({ key: "CFGScale", value: CFGScale }),
        ...evaluateNonTrue({ key: "clipSkip", value: clipSkip }),
        ...evaluateNonTrue({
          key: "usePromptWeighting",
          value: usePromptWeighting,
        }),
        ...evaluateNonTrue({ key: "steps", value: steps }),
        ...(controlNetData.length ? { controlNet: controlNetData } : {}),
        ...(seed ? { seed: seed } : {}),
        ...(scheduler ? { scheduler } : {}),
        ...evaluateNonTrue({ key: "includeCost", value: includeCost }),

        ...evaluateNonTrue({ key: "useCache", value: useCache }),
        ...(seedImageUUID ? { seedImage: seedImageUUID } : {}),
        ...(maskImageUUID ? { maskImage: maskImageUUID } : {}),
      };

      return await asyncRetry(
        async () => {
          retryCount++;
          lis?.destroy();
          const imagesWithSimilarTask = this._globalImages.filter((img) =>
            taskUUIDs.includes(img.taskUUID)
          );

          const taskUUID = getUUID();

          taskUUIDs.push(taskUUID);

          const imageRemaining = numberResults - imagesWithSimilarTask.length;

          const newRequestObject = {
            ...requestObject,
            taskUUID: taskUUID,
            numberResults: imageRemaining,
          };
          this.send(newRequestObject);

          lis = this.listenToImages({
            onPartialImages,
            taskUUID: taskUUID,
            groupKey: LISTEN_TO_IMAGES_KEY.REQUEST_IMAGES,
          });

          const promise = await this.getSimilarImages({
            taskUUID: taskUUIDs,
            numberResults,
            lis,
          });

          // lis.destroy();
          return promise;
        },
        {
          maxRetries: 2,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      if (retryCount >= 2) {
        return this.handleIncompleteImages({ taskUUIDs, error: e });
      }
    }

    // console.log({ res });
    // return res.the;
  }

  controlNetPreProcess = async ({
    inputImage,
    preProcessor,
    height,
    width,
    outputType,
    outputFormat,
    highThresholdCanny,
    lowThresholdCanny,
    includeHandsAndFaceOpenPose,
    includeCost,
  }: IControlNetPreprocess): Promise<IControlNetImage | null> => {
    try {
      const image = await this.uploadImage(inputImage);
      if (!image?.imageUUID) return null;

      const taskUUID = getUUID();
      this.send({
        inputImage: image.imageUUID,
        taskType: ETaskType.IMAGE_CONTROL_NET_PRE_PROCESS,
        taskUUID,
        preProcessor,
        ...evaluateNonTrue({ key: "height", value: height }),
        ...evaluateNonTrue({ key: "width", value: width }),
        ...evaluateNonTrue({ key: "outputType", value: outputType }),
        ...evaluateNonTrue({ key: "outputFormat", value: outputFormat }),
        ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
        ...evaluateNonTrue({
          key: "highThresholdCanny",
          value: highThresholdCanny,
        }),
        ...evaluateNonTrue({
          key: "lowThresholdCanny",
          value: lowThresholdCanny,
        }),
        ...evaluateNonTrue({
          key: "includeHandsAndFaceOpenPose",
          value: includeHandsAndFaceOpenPose,
        }),
      });
      const lis = this.globalListener({
        taskUUID,
      });

      const guideImage = (await getIntervalWithPromise(
        ({ resolve, reject }) => {
          const uploadedImage = this.getSingleMessage({
            taskUUID,
          });

          if (!uploadedImage) return;

          if (uploadedImage?.error) {
            reject(uploadedImage);
            return true;
          }

          if (uploadedImage) {
            // delete this._globalMessages[taskUUID];
            resolve(uploadedImage);
            return true;
          }
        },
        { debugKey: "unprocessed-image" }
      )) as IControlNetImage;

      lis.destroy();

      return guideImage;
    } catch (e: any) {
      throw e;
    }
  };

  requestImageToText = async ({
    inputImage,
    includeCost,
  }: IRequestImageToText): Promise<IImageToText> => {
    try {
      await this.ensureConnection();
      return await asyncRetry(async () => {
        const imageUploaded = await this.uploadImage(
          inputImage as File | string
        );

        if (!imageUploaded?.imageUUID) return null;

        const taskUUID = getUUID();
        this.send({
          taskUUID,
          taskType: ETaskType.IMAGE_CAPTION,
          inputImage: imageUploaded.imageUUID,
          ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
        });

        const lis = this.globalListener({
          taskUUID,
        });

        const response = await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const newReverseClip = this.getSingleMessage({
              taskUUID,
            });

            if (!newReverseClip) return;

            if (newReverseClip?.error) {
              reject(newReverseClip);
              return true;
            }

            if (newReverseClip) {
              delete this._globalMessages[taskUUID];
              resolve(newReverseClip);
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
    inputImage,
    outputType,
    outputFormat,
    rgba,
    postProcessMask,
    returnOnlyMask,
    alphaMatting,
    alphaMattingForegroundThreshold,
    alphaMattingBackgroundThreshold,
    alphaMattingErodeSize,
    includeCost,
  }: IRemoveImageBackground): Promise<IRemoveImage[]> => {
    try {
      await this.ensureConnection();
      return await asyncRetry(async () => {
        const imageUploaded = await this.uploadImage(
          inputImage as File | string
        );

        if (!imageUploaded?.imageUUID) return null;

        const taskUUID = getUUID();

        this.send({
          taskType: ETaskType.IMAGE_BACKGROUND_REMOVAL,
          taskUUID,
          inputImage: imageUploaded.imageUUID,
          ...evaluateNonTrue({ key: "rgba", value: rgba }),
          ...evaluateNonTrue({
            key: "postProcessMask",
            value: postProcessMask,
          }),
          ...evaluateNonTrue({ key: "returnOnlyMask", value: returnOnlyMask }),
          ...evaluateNonTrue({ key: "alphaMatting", value: alphaMatting }),
          ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
          ...evaluateNonTrue({
            key: "alphaMattingForegroundThreshold",
            value: alphaMattingForegroundThreshold,
          }),
          ...evaluateNonTrue({
            key: "alphaMattingBackgroundThreshold",
            value: alphaMattingBackgroundThreshold,
          }),
          ...evaluateNonTrue({
            key: "alphaMattingErodeSize",
            value: alphaMattingErodeSize,
          }),
          ...evaluateNonTrue({ key: "outputType", value: outputType }),
          ...evaluateNonTrue({ key: "outputFormat", value: outputFormat }),
        });

        const lis = this.globalListener({
          taskUUID,
        });

        const response = await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const newRemoveBackground = this.getSingleMessage({ taskUUID });

            if (!newRemoveBackground) return;

            if (newRemoveBackground?.error) {
              reject(newRemoveBackground);
              return true;
            }

            if (newRemoveBackground) {
              delete this._globalMessages[taskUUID];
              resolve([newRemoveBackground]);
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
    inputImage,
    upscaleFactor,
    outputType,
    outputFormat,
    includeCost,
  }: IUpscaleGan): Promise<IImage[]> => {
    try {
      await this.ensureConnection();
      return await asyncRetry(async () => {
        let imageUploaded;

        imageUploaded = await this.uploadImage(inputImage as File | string);
        if (!imageUploaded?.imageUUID) return null;

        const taskUUID = getUUID();

        this.send({
          taskUUID,
          inputImage: imageUploaded?.imageUUID,
          taskType: ETaskType.IMAGE_UPSCALE,
          upscaleFactor,
          ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
          ...(outputType ? { outputType } : {}),
          ...(outputFormat ? { outputFormat } : {}),
        });

        const lis = this.globalListener({
          taskUUID,
        });

        const response = await getIntervalWithPromise(
          ({ resolve, reject }) => {
            const newUpscaleGan = this.getSingleMessage({ taskUUID });
            if (!newUpscaleGan) return;

            if (newUpscaleGan?.error) {
              reject(newUpscaleGan);
              return true;
            }

            if (newUpscaleGan) {
              delete this._globalMessages[taskUUID];
              resolve([newUpscaleGan]);
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
    promptVersions = 1,
    includeCost,
  }: IPromptEnhancer): Promise<IEnhancedPrompt[]> => {
    try {
      await this.ensureConnection();
      return await asyncRetry(async () => {
        const taskUUID = getUUID();

        this.send({
          prompt,
          taskUUID,
          promptMaxLength,
          promptVersions,
          ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
          taskType: ETaskType.PROMPT_ENHANCE,
        });

        const lis = this.globalListener({
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
      throw e;
    }
  };

  async ensureConnection() {
    let isConnected = this.connected();

    if (isConnected) return;

    const interval = 2000;

    try {
      if (this._invalidAPIkey) throw this._invalidAPIkey;

      return new Promise((resolve, reject) => {
        //  const isConnected =
        let retry = 0;
        const MAX_RETRY = 2;

        const intervalId = setInterval(async () => {
          try {
            const hasConnected = this.connected();
            if (hasConnected) {
              clearInterval(intervalId);
              resolve(true);
            } else if (retry >= MAX_RETRY) {
              clearInterval(intervalId);
              reject(new Error("Polling timed out"));
            } else {
              this.connect();
              retry++;
            }
          } catch (error) {
            clearInterval(intervalId);
            reject(error);
          }
        }, interval);
      });

      if (!isConnected) {
        this.connect();
        await delay(2);
        // const listenerTaskUID = getUUID();
        // if (this._ws.readyState === 1) {
        //   this.send({
        //     newConnection: { apiKey: this._apiKey, taskUUID: listenerTaskUID },
        //   });
        // }
        // const lis = this.globalListener({
        //   responseKey: "newConnectionSessionUUID",
        //   taskType: "newConnectionSessionUUID.connectionSessionUUID",
        //   taskUUID: listenerTaskUID,
        // });

        // await getIntervalWithPromise(
        //   ({ resolve, reject }) => {
        //     const connectionId: string = this._globalMessages[listenerTaskUID];

        //     if ((connectionId as any)?.error) {
        //       reject(connectionId);
        //       return true;
        //     }

        //     if (connectionId) {
        //       delete this._globalMessages[listenerTaskUID];
        //       this._connectionSessionUUID = connectionId;
        //       resolve(connectionId);
        //       return true;
        //     }
        //   },
        //   { debugKey: "listen-to-connection" }
        // );

        // lis.destroy();
      }
    } catch (e) {
      throw (
        this._invalidAPIkey ??
        "Could not connect to server. Ensure your API key is correct"
      );
    }
  }

  async getSimilarImages({
    taskUUID,
    numberResults,
    shouldThrowError,
    lis,
  }: {
    taskUUID: string | string[];
    numberResults: number;
    shouldThrowError?: boolean;
    lis: any;
  }): Promise<IImage[] | IError> {
    return (await getIntervalWithPromise(
      ({ resolve, reject, intervalId }) => {
        const taskUUIDs = Array.isArray(taskUUID) ? taskUUID : [taskUUID];
        const imagesWithSimilarTask = this._globalImages.filter((img) =>
          taskUUIDs.includes(img.taskUUID)
        );

        if (this._globalError) {
          const newData = this._globalError;
          this._globalError = undefined;
          // throw errorData[0]
          clearInterval(intervalId);
          reject<IError>?.(newData);
          return true;
        }
        // onPartialImages?.(imagesWithSimilarTask)
        else if (imagesWithSimilarTask.length >= numberResults) {
          // lis?.destroy();
          clearInterval(intervalId);
          this._globalImages = this._globalImages.filter(
            (img) => !taskUUIDs.includes(img.taskUUID)
          );
          resolve<IImage[]>([...imagesWithSimilarTask].slice(0, numberResults));
          return true;
          // Resolve the promise with the data
        }
      },
      { debugKey: "getting images", shouldThrowError }
    )) as IImage[];
  }

  getSingleMessage = ({ taskUUID }: { taskUUID: string }) => {
    if (!this._globalMessages[taskUUID]?.[0]) return null;

    return this._globalMessages[taskUUID]?.[0];
  };

  handleIncompleteImages({
    taskUUIDs,
    error,
  }: {
    taskUUIDs: string[];
    error: any;
  }) {
    const imagesWithSimilarTask = this._globalImages.filter((img) =>
      taskUUIDs.includes(img.taskUUID)
    );
    if (imagesWithSimilarTask.length > 1) {
      this._globalImages = this._globalImages.filter(
        (img) => !taskUUIDs.includes(img.taskUUID)
      );
      return imagesWithSimilarTask;
    } else {
      throw error;
    }
  }

  connected = () =>
    this.isWebsocketReadyState() && !!this._connectionSessionUUID;
  //end of data
}
