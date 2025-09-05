// @ts-ignore
import { asyncRetry } from "./async-retry";
import {
  EControlMode,
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
  ListenerType,
  ReconnectingWebsocketProps,
  RunwareBaseType,
  SdkType,
  UploadImageType,
  ETaskType,
  IControlNetPreprocess,
  IControlNetImage,
  IRemoveImage,
  ITextToImage,
  TAddModel,
  IAddModelResponse,
  IErrorResponse,
  TPhotoMaker,
  TPhotoMakerResponse,
  TModelSearch,
  TImageMaskingResponse,
  TImageMasking,
  TModelSearchResponse,
  TServerError,
  TImageUpload,
  TImageUploadResponse,
  IRequestVideo,
  IAsyncResults,
  IVideoToImage,
  UploadMediaType,
  TMediaStorage,
  TMediaStorageResponse,
} from "./types";
import {
  BASE_RUNWARE_URLS,
  LISTEN_TO_IMAGES_KEY,
  TIMEOUT_DURATION,
  accessDeepObject,
  convertBytesToMB,
  delay,
  evaluateNonTrue,
  fileToBase64,
  getIntervalAsyncWithPromise,
  getIntervalWithPromise,
  getRandomSeed,
  getUUID,
  isValidUUID,
  removeFromAray,
  removeListener,
  isUrlOrDataUri,
} from "./utils";

// let allImages: IImage[] = [];

const MAX_AUDIO_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

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
  _connectionError: TServerError | undefined;
  _sdkType: SdkType;
  _shouldReconnect: boolean;
  _globalMaxRetries: number;
  _timeoutDuration: number;
  ensureConnectionUUID: string | null = null;

  constructor({
    apiKey,
    url = BASE_RUNWARE_URLS.PRODUCTION,
    shouldReconnect = true,
    globalMaxRetries = 2,
    timeoutDuration = TIMEOUT_DURATION,
  }: RunwareBaseType) {
    this._apiKey = apiKey;
    this._url = url;
    this._sdkType = SdkType.CLIENT;
    this._shouldReconnect = shouldReconnect;
    this._globalMaxRetries = globalMaxRetries;
    this._timeoutDuration = timeoutDuration;
  }

  static async initialize(props: RunwareBaseType) {
    try {
      const instance = new this(props);
      await instance.ensureConnection();
      return instance;
    } catch (e) {
      throw e;
    }
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

  //   return
  //     destroy: () => {},
  //   };
  // }

  protected isInvalidAPIKey = () => {
    return this._connectionError?.error?.code === "invalidApiKey";
  };

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

      const arrayErrors = (msg as any)?.[0]?.errors
        ? (msg as any)?.[0]?.errors
        : Array.isArray(msg?.errors)
        ? msg.errors
        : [msg.errors];

      const filteredMessage = arrayMessage.filter(
        (v) => (v?.taskUUID || v?.taskType) === taskUUID
      );

      const filteredErrors = arrayErrors.filter(
        (v: any) => (v?.taskUUID || v?.taskType) === taskUUID
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
    const groupListener = { key: taskUUID || getUUID(), listener, groupKey };
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
            this._connectionError = m;
            return;
          }
          this._connectionSessionUUID =
            m?.[ETaskType.AUTHENTICATION]?.[0]?.connectionSessionUUID;
          this._connectionError = undefined;
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
      if (this.isInvalidAPIKey()) {
        return;
      }
    };
  }

  // We moving to an array format, it make sense to consolidate all request to an array here
  protected send = (msg: Object) => {
    this._ws.send(JSON.stringify([msg]));
  };

  private destroy(lis: any) {
    removeFromAray(this._listeners, lis);
  }

  private isAudioFile = (file: File | string): boolean => {
    // Client-side (browser) check using MIME type
    if (typeof window !== "undefined" && file instanceof File) {
      return file.type.startsWith("audio/");
    }
    // Server-side (Node.js) check using file extension
    else if (typeof file === "string") {
      const audioExtensions = [
        ".mp3",
        ".wav",
        ".flac",
        ".aac",
        ".ogg",
        ".m4a",
        ".wma",
      ];
      const lowercasedFile = file.toLowerCase();
      return audioExtensions.some((ext) => lowercasedFile.endsWith(ext));
    }
    return false;
  };

  private getFileSize = async (
    file: File | string
  ): Promise<number> => {
    // Client-side (browser) environment
    if (typeof window !== "undefined" && file instanceof File) {
      return file.size; // Returns size in bytes
    }
    // Server-side (Node.js) environment
    else if (typeof file === "string") {
      try {
        // Dynamically import 'fs' only for Node.js environment
        const fs = await import("fs");
        const stats = await fs.promises.stat(file);
        return stats.size; // Returns size in bytes
      } catch (error) {
        console.error("Error getting file stats on server:", error);
        throw new Error(`Could not find or access file at path: ${file}`);
      }
    }
    throw new Error("Unsupported file type for getting file size.");
  };

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

        return {
          imageURL: imageBase64,
          imageUUID: imageBase64,
          taskUUID,
          taskType: ETaskType.IMAGE_UPLOAD,
        };
      });
    } catch (e) {
      throw e;
    }
  };

  private uploadMedia = async (
    file: File | string
  ): Promise<UploadMediaType | null> => {
    try {
      return await asyncRetry(async () => {
        const taskUUID = getUUID();

        if (typeof file === "string" && isValidUUID(file)) {
          return {
            mediaURL: file,
            mediaUUID: file,
            taskUUID,
            taskType: ETaskType.MEDIA_STORAGE,
          };
        }

        if (!isUrlOrDataUri(file)) {
          const fileSize = await this.getFileSize(file);
          if (this.isAudioFile(file) && fileSize > MAX_AUDIO_FILE_SIZE_BYTES) {
            throw new Error(
              `File size (${convertBytesToMB(
                fileSize
              )}MB) exceeds the ${convertBytesToMB(
                MAX_AUDIO_FILE_SIZE_BYTES
              )}MB limit.`
            );
          }
        }

        // TODO: For direct upload to media storage endpoint
        // if (file instanceof File) {
        //   const response = await this.mediaStorage({ media: file });
        //   return {
        //     mediaURL: response.mediaUUID,
        //     mediaUUID: response.mediaUUID,
        //     taskUUID,
        //     taskType: ETaskType.MEDIA_STORAGE,
        //   };
        // }

        const mediaBase64 =
          typeof file === "string" ? file : await fileToBase64(file);

        return {
          mediaURL: mediaBase64,
          mediaUUID: mediaBase64,
          taskUUID,
          taskType: ETaskType.MEDIA_STORAGE,
        };
      });
    } catch (e) {
      throw e;
    }
  };

  private _warnOnUpload = (
    media: File | string | undefined,
    mediaType: "audio" | "video"
  ) => {
    if (!media) return;

    if (
      media instanceof File ||
      (typeof media === "string" && !isValidUUID(media))
    ) {
      console.warn(
        `Longer time for inference because of ${mediaType} upload, we advise you upload the media separately and supply the uuid to have a faster inference`
      );
    }
  };

  private listenToImages({
    onPartialImages,
    taskUUID,
    groupKey,
    requestPayload,
    startTime,
  }: {
    taskUUID: string;
    onPartialImages?: (images: IImage[], error?: any) => void;
    groupKey: LISTEN_TO_IMAGES_KEY;
    requestPayload?: Record<string, any>;
    startTime?: number;
  }) {
    return this.addListener({
      taskUUID: taskUUID,
      lis: (m) => {
        let images = (m?.[taskUUID] as IImage[])?.filter(
          (img) => img.taskUUID === taskUUID
        );

        if (m.error) {
          onPartialImages?.(images, m?.error && m);
          this._globalError = m;
        } else {
          images = images.map((image) => {
            this.insertAdditionalResponse({
              response: image,
              payload: requestPayload ? requestPayload : undefined,
              startTime: startTime ? startTime : undefined,
            });

            return {
              ...image,
            };
          });
          onPartialImages?.(images, m?.error && m);

          if (this._sdkType === SdkType.CLIENT) {
            // this._globalImages = [...this._globalImages, ...m.images];
            this._globalImages = [
              ...this._globalImages,
              ...(m?.[taskUUID] ?? []).map((image: IImage) => {
                this.insertAdditionalResponse({
                  response: image,
                  payload: requestPayload ? requestPayload : undefined,
                  startTime: startTime ? startTime : undefined,
                });

                return {
                  ...image,
                };
              }),
            ];
          } else {
            this._globalImages = [...this._globalImages, ...images];
          }
        }
      },
      groupKey,
    });
  }

  private listenToUpload({
    onUploadStream,
    taskUUID,
  }: {
    taskUUID: string;
    onUploadStream?: (
      addModelResponse?: IAddModelResponse,
      error?: IErrorResponse
    ) => void;
  }) {
    return this.addListener({
      taskUUID: taskUUID,
      lis: (m) => {
        const error = m?.error;

        const result = m?.[taskUUID]?.[0] as IAddModelResponse;
        let response = result?.taskUUID === taskUUID ? result : null;

        if (response || error) {
          onUploadStream?.(response || undefined, error);
        }
      },
    });
  }

  private globalListener({ taskUUID }: { taskUUID: string }) {
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

        // console.log("m", m);

        const value = accessDeepObject({
          key: taskUUID,
          data: m,
          useZero: false,
        });
        // console.log({ value });

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

  // includePayload?: boolean
  // includeGenerationTime?: boolean

  async requestImages(
    {
      outputType,
      outputFormat,
      uploadEndpoint,
      checkNSFW,
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
      promptWeighting,
      numberResults = 1,
      onPartialImages,
      includeCost,
      customTaskUUID,
      retry,
      refiner,
      maskMargin,
      outputQuality,
      controlNet,
      lora,
      embeddings,
      ipAdapters,
      providerSettings,
      outpaint,
      acceleratorOptions,
      advancedFeatures,
      referenceImages,
      includeGenerationTime,
      includePayload,
      ...rest
    }: // imageSize,
    // gScale,
    IRequestImage,
    moreOptions?: Record<string, any>
  ): Promise<ITextToImage[] | undefined> {
    let lis: any = undefined;
    let requestObject: Record<string, any> | undefined = undefined;
    let taskUUIDs: string[] = [];
    let retryCount = 0;

    const totalRetry = retry || this._globalMaxRetries;

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

          const imageUploaded = guideImage
            ? await this.uploadImage(guideImage as File | string)
            : null;

          controlNetData.push({
            guideImage: imageUploaded?.imageUUID,
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

        ...(outputType ? { outputType } : {}),
        ...(outputFormat ? { outputFormat } : {}),
        ...(uploadEndpoint ? { uploadEndpoint } : {}),
        ...evaluateNonTrue({ key: "checkNSFW", value: checkNSFW }),
        ...evaluateNonTrue({ key: "strength", value: strength }),
        ...evaluateNonTrue({ key: "CFGScale", value: CFGScale }),
        ...evaluateNonTrue({ key: "clipSkip", value: clipSkip }),
        ...evaluateNonTrue({ key: "maskMargin", value: maskMargin }),
        ...evaluateNonTrue({
          key: "usePromptWeighting",
          value: usePromptWeighting,
        }),
        ...evaluateNonTrue({ key: "steps", value: steps }),
        ...(promptWeighting ? { promptWeighting } : {}),
        ...(seed ? { seed: seed } : {}),
        ...(scheduler ? { scheduler } : {}),
        ...(refiner ? { refiner } : {}),
        ...(outpaint ? { outpaint } : {}),
        ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
        ...(seedImageUUID ? { seedImage: seedImageUUID } : {}),
        ...(maskImageUUID ? { maskImage: maskImageUUID } : {}),
        ...(outputQuality ? { outputQuality } : {}),
        ...(controlNetData.length ? { controlNet: controlNetData } : {}),
        ...(lora?.length ? { lora: lora } : {}),
        ...(embeddings?.length ? { embeddings } : {}),
        ...(ipAdapters?.length ? { ipAdapters } : {}),
        ...(providerSettings ? { providerSettings } : {}),
        ...(acceleratorOptions ? { acceleratorOptions } : {}),
        ...(advancedFeatures ? { advancedFeatures } : {}),
        ...(referenceImages?.length ? { referenceImages } : {}),
        ...rest,
        ...(moreOptions ?? {}),
      };

      const startTime = Date.now();

      return await asyncRetry(
        async () => {
          retryCount++;
          lis?.destroy();
          const imagesWithSimilarTask = this._globalImages.filter((img) =>
            taskUUIDs.includes(img.taskUUID)
          );

          const taskUUID = customTaskUUID || getUUID();

          taskUUIDs.push(taskUUID);

          const imageRemaining = numberResults - imagesWithSimilarTask.length;

          const newRequestObject = {
            ...requestObject,
            taskUUID: taskUUID,
            numberResults: imageRemaining,
          };
          this.send(newRequestObject);

          // const generationTime = endTime - startTime;

          lis = this.listenToImages({
            onPartialImages,
            taskUUID: taskUUID,
            groupKey: LISTEN_TO_IMAGES_KEY.REQUEST_IMAGES,
            requestPayload: includePayload ? newRequestObject : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          const promise = await this.getSimilarImages({
            taskUUID: taskUUIDs,
            numberResults,
            lis,
          });

          lis.destroy();

          return promise;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      if (retryCount >= totalRetry) {
        return this.handleIncompleteImages({ taskUUIDs, error: e });
      }
      throw e;
    }
  }

  controlNetPreProcess = async ({
    inputImage,
    preProcessorType,
    height,
    width,
    outputType,
    outputFormat,
    highThresholdCanny,
    lowThresholdCanny,
    includeHandsAndFaceOpenPose,
    includeCost,
    outputQuality,
    customTaskUUID,
    retry,
    includeGenerationTime,
    includePayload,
  }: IControlNetPreprocess): Promise<IControlNetImage | null> => {
    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;

    const startTime = Date.now();

    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          const image = await this.uploadImage(inputImage);
          if (!image?.imageUUID) return null;

          const taskUUID = customTaskUUID || getUUID();
          const payload = {
            inputImage: image.imageUUID,
            taskType: ETaskType.IMAGE_CONTROL_NET_PRE_PROCESS,
            taskUUID,
            preProcessorType,
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
            ...(outputQuality ? { outputQuality } : {}),
          };

          this.send({
            ...payload,
          });
          lis = this.globalListener({
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
            {
              debugKey: "unprocessed-image",
              timeoutDuration: this._timeoutDuration,
            }
          )) as IControlNetImage;

          lis.destroy();

          this.insertAdditionalResponse({
            response: guideImage,
            payload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          return guideImage;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e: any) {
      throw e;
    }
  };

  requestImageToText = async ({
    inputImage,
    includeCost,
    customTaskUUID,
    retry,
    includePayload,
    includeGenerationTime,
  }: IRequestImageToText): Promise<IImageToText> => {
    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;

    const startTime = Date.now();

    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          const imageUploaded = inputImage
            ? await this.uploadImage(inputImage as File | string)
            : null;

          const taskUUID = customTaskUUID || getUUID();

          const payload = {
            taskUUID,
            taskType: ETaskType.IMAGE_CAPTION,
            inputImage: imageUploaded?.imageUUID,
            ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
          };

          this.send(payload);

          lis = this.globalListener({
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
            {
              debugKey: "remove-image-background",
              timeoutDuration: this._timeoutDuration,
            }
          );

          lis.destroy();

          this.insertAdditionalResponse({
            response: response,
            payload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          return response as IImageToText;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      throw e;
    }
  };

  removeImageBackground = async (
    payload: IRemoveImageBackground
  ): Promise<IRemoveImage> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        taskType: ETaskType.IMAGE_BACKGROUND_REMOVAL,
      },
      debugKey: "remove-image-background",
    });
  };

  videoInference = async (
    payload: IRequestVideo
  ): Promise<IVideoToImage[] | IVideoToImage> => {
    const { skipResponse, inputAudios, ...rest } = payload;
    try {
      let audioUUIDs: string[] = [];

      if (inputAudios?.length) {
        if (
          inputAudios.some(
            (media) =>
              media instanceof File ||
              (typeof media === "string" && !isValidUUID(media))
          )
        ) {
          this._warnOnUpload(inputAudios[0], "audio");
        }

        const uploadedAudios = await Promise.all(
          inputAudios.map((audio) => this.uploadMedia(audio))
        );

        audioUUIDs = uploadedAudios
          .map((uploaded) => uploaded?.mediaUUID)
          .filter((uuid): uuid is string => !!uuid);
      }

      const request = await this.baseSingleRequest<IVideoToImage>({
        payload: {
          ...rest,
          ...(audioUUIDs.length ? { inputAudios: audioUUIDs } : {}),
          deliveryMethod: "async",
          taskType: ETaskType.VIDEO_INFERENCE,
        },

        debugKey: "video-inference",
      });

      if (skipResponse) {
        return request;
      }

      const taskUUID = request?.taskUUID;

      const numberResults = payload?.numberResults ?? 1;

      const allVideos = new Map<string, any>();

      await getIntervalAsyncWithPromise(
        async ({ resolve, reject }) => {
          try {
            const videos = await this.getResponse({ taskUUID });

            // Add videos to the collection
            for (const video of videos || []) {
              if (video.videoUUID) {
                allVideos.set(video.videoUUID, video);
              }
            }

            // Check completion AFTER updating the collection
            const isComplete = allVideos.size === numberResults;

            if (isComplete) {
              resolve(Array.from(allVideos.values()));
              return true; // Signal to clear the interval
            }

            return false; // Continue polling
          } catch (err) {
            reject(err);
            return true; // Signal to clear the interval on error
          }
        },
        {
          debugKey: "async-response",
          pollingInterval: 2 * 1000,
          timeoutDuration: 10 * 60 * 1000,
        }
      );
      return Array.from(allVideos.values());
    } catch (e) {
      throw e;
    }
  };

  getResponse = async (payload: IAsyncResults): Promise<IVideoToImage[]> => {
    const taskUUID = payload.taskUUID;
    // const mock = getRandomTaskResponses({ count: 2, taskUUID });
    return this.baseSingleRequest({
      payload: {
        ...payload,
        customTaskUUID: taskUUID,
        taskType: ETaskType.GET_RESPONSE,
      },
      isMultiple: true,
      debugKey: "async-results",
    });
  };

  upscaleGan = async ({
    inputImage,
    upscaleFactor,
    outputType,
    outputFormat,
    includeCost,
    outputQuality,
    customTaskUUID,
    retry,
    includeGenerationTime,
    includePayload,
  }: IUpscaleGan): Promise<IImage> => {
    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;

    const startTime = Date.now();
    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          let imageUploaded;

          imageUploaded = await this.uploadImage(inputImage as File | string);

          const taskUUID = customTaskUUID || getUUID();
          const payload = {
            taskUUID,
            inputImage: imageUploaded?.imageUUID,
            taskType: ETaskType.IMAGE_UPSCALE,
            upscaleFactor,
            ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
            ...(outputType ? { outputType } : {}),
            ...(outputQuality ? { outputQuality } : {}),
            ...(outputFormat ? { outputFormat } : {}),
          };

          this.send(payload);

          lis = this.globalListener({
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
                resolve(newUpscaleGan);
                return true;
              }
            },
            { debugKey: "upscale-gan", timeoutDuration: this._timeoutDuration }
          );

          lis.destroy();

          this.insertAdditionalResponse({
            response,
            payload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          return response as IImage;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      throw e;
    }
  };

  enhancePrompt = async ({
    prompt,
    promptMaxLength = 380,
    promptVersions = 1,
    includeCost,
    customTaskUUID,
    retry,
    includeGenerationTime,
    includePayload,
  }: IPromptEnhancer): Promise<IEnhancedPrompt[]> => {
    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;

    const startTime = Date.now();

    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          const taskUUID = customTaskUUID || getUUID();

          const payload = {
            prompt,
            taskUUID,
            promptMaxLength,
            promptVersions,
            ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
            taskType: ETaskType.PROMPT_ENHANCE,
          };

          this.send(payload);

          lis = this.globalListener({
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
            {
              debugKey: "enhance-prompt",
              timeoutDuration: this._timeoutDuration,
            }
          );

          lis.destroy();

          this.insertAdditionalResponse({
            response: response,
            payload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });
          return response as IEnhancedPrompt[];
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      throw e;
    }
  };

  modelUpload = async (payload: TAddModel) => {
    // This is written to destructure the payload from the additional parameters
    const { onUploadStream, retry, customTaskUUID, ...addModelPayload } =
      payload;

    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;

    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          const taskUUID = customTaskUUID || getUUID();

          this.send({
            ...addModelPayload,
            taskUUID,
            taskType: ETaskType.MODEL_UPLOAD,
          });

          let result: IAddModelResponse;
          let errorResult: IErrorResponse;

          lis = this.listenToUpload({
            taskUUID,
            onUploadStream: (response, error) => {
              onUploadStream?.(response, error);
              if (response?.status === "ready") {
                result = response;
              } else if (error) {
                errorResult = error;
              }
            },
          });

          const modelUploadResponse = await getIntervalWithPromise(
            ({ resolve, reject }) => {
              if (result) {
                resolve(result);
                return true;
              } else if (errorResult) {
                reject(errorResult);
                return false;
              }
            },
            {
              shouldThrowError: false,
              timeoutDuration: 60 * 60 * 1000,
            }
          );

          return modelUploadResponse as IAddModelResponse | IErrorResponse;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      throw e;
    }
  };

  photoMaker = async (
    payload: TPhotoMaker,
    moreOptions?: Record<string, any>
  ): Promise<TPhotoMakerResponse[] | undefined> => {
    // This is written to destructure the payload from the additional parameters
    const {
      onPartialImages,
      retry,
      customTaskUUID,
      numberResults,
      includeGenerationTime,
      includePayload,
      ...photoMakerPayload
    } = payload;

    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;
    let taskUUIDs: string[] = [];
    let retryCount = 0;

    const startTime = Date.now();

    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          retryCount++;
          const imagesWithSimilarTask = this._globalImages.filter((img) =>
            taskUUIDs.includes(img.taskUUID)
          );

          const taskUUID = customTaskUUID || getUUID();
          taskUUIDs.push(taskUUID);

          const imageRemaining = numberResults - imagesWithSimilarTask.length;

          const payload = {
            ...photoMakerPayload,
            ...(photoMakerPayload.seed
              ? { seed: photoMakerPayload.seed }
              : { seed: getRandomSeed() }),
            ...(moreOptions ?? {}),
            taskUUID,
            taskType: ETaskType.PHOTO_MAKER,
            numberResults,
          };

          this.send({
            ...payload,
            numberResults: imageRemaining,
          });

          lis = this.listenToImages({
            onPartialImages,
            taskUUID: taskUUID,
            groupKey: LISTEN_TO_IMAGES_KEY.REQUEST_IMAGES,
            requestPayload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          const promise = await this.getSimilarImages({
            taskUUID: taskUUIDs,
            numberResults,
            lis,
          });

          lis.destroy();

          return promise as TPhotoMakerResponse[];
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      if ((e as any).taskUUID) {
        throw e;
      }
      if (retryCount >= totalRetry) {
        return this.handleIncompleteImages({
          taskUUIDs,
          error: e,
        }) as TPhotoMakerResponse[];
      }
    }
  };

  modelSearch = async (
    payload: TModelSearch
  ): Promise<TModelSearchResponse> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        taskType: ETaskType.MODEL_SEARCH,
      },
      debugKey: "model-search",
    });
  };

  imageMasking = async (
    payload: TImageMasking
  ): Promise<TImageMaskingResponse> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        taskType: ETaskType.IMAGE_MASKING,
      },
      debugKey: "image-masking",
    });
  };

  imageUpload = async (
    payload: TImageUpload
  ): Promise<TImageUploadResponse> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        taskType: ETaskType.IMAGE_UPLOAD,
      },
      debugKey: "image-upload",
    });
  };

  mediaStorage = async (
    payload: TMediaStorage
  ): Promise<TMediaStorageResponse> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        taskType: ETaskType.MEDIA_STORAGE,
      },
      debugKey: "media-storage",
    });
  };

  protected baseSingleRequest = async <T>({
    payload,
    debugKey,
    isMultiple,
  }: {
    payload: Record<string, any>;
    debugKey: string;
    isMultiple?: boolean;
  }): Promise<T> => {
    const {
      retry,
      customTaskUUID,
      includePayload,
      includeGenerationTime,
      ...restPayload
    } = payload;

    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;

    const startTime = Date.now();

    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          const taskUUID = customTaskUUID || getUUID();
          const payload = {
            ...restPayload,
            taskUUID,
          };

          this.send(payload);

          lis = this.globalListener({
            taskUUID,
          });

          const response = await getIntervalWithPromise(
            ({ resolve, reject }) => {
              // console.log("multiple", isMultiple);
              const response = isMultiple
                ? this.getMultipleMessages({ taskUUID })
                : this.getSingleMessage({ taskUUID });
              if (!response) return;

              if (response?.error) {
                reject(response);
                return true;
              }

              if (response) {
                delete this._globalMessages[taskUUID];
                resolve(response);
                return true;
              }
            },
            {
              debugKey,
              timeoutDuration: this._timeoutDuration,
            }
          );

          this.insertAdditionalResponse({
            response: response,
            payload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          lis.destroy();
          return response as T;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        }
      );
    } catch (e) {
      throw e;
    }
  };

  async ensureConnection() {
    let isConnected = this.connected();
    if (isConnected || this._url === BASE_RUNWARE_URLS.TEST) return;

    const retryInterval = 2000;
    const pollingInterval = 200;
    // const pollingInterval = this._sdkType === SdkType.CLIENT ? 200 : 2000;

    try {
      if (this.isInvalidAPIKey()) {
        throw this._connectionError;
      }

      return new Promise((resolve, reject) => {
        //  const isConnected =
        let retry = 0;
        const MAX_RETRY = 30;

        const localConnectionUUID = getUUID();

        let retryIntervalId: any;
        let pollingIntervalId: any;

        const clearAllIntervals = () => {
          this.ensureConnectionUUID = null;
          clearInterval(retryIntervalId);
          clearInterval(pollingIntervalId);
        };

        if (this._sdkType === SdkType.SERVER) {
          retryIntervalId = setInterval(async () => {
            try {
              const hasConnected = this.connected();

              // only one instance should be responsible for making the call again, not other ensureConnection
              let shouldCallServer = false;

              if (
                !this.ensureConnectionUUID ||
                localConnectionUUID === this.ensureConnectionUUID
              ) {
                if (!this.ensureConnectionUUID) {
                  this.ensureConnectionUUID = localConnectionUUID;
                }
                shouldCallServer = true;
              }

              // Retry every (retryInterval % retry) => 60s
              // every 20 seconds (ie. => retry is 10 (20s), retry is 20 (40s))
              const SHOULD_RETRY = retry % 10 === 0 && shouldCallServer;

              if (hasConnected) {
                clearAllIntervals();
                resolve(true);
              } else if (retry >= MAX_RETRY) {
                clearAllIntervals();
                reject(new Error("Retry timed out"));
              } else {
                if (SHOULD_RETRY) {
                  this.connect();
                }
                retry++;
              }
            } catch (error) {
              clearAllIntervals();
              reject(error);
            }
          }, retryInterval);
        }

        pollingIntervalId = setInterval(async () => {
          const hasConnected = this.connected();

          if (hasConnected) {
            clearAllIntervals();
            resolve(true);
            return;
          }
          if (!!this.isInvalidAPIKey()) {
            clearAllIntervals();
            reject(this._connectionError);
            return;
          }
        }, pollingInterval);
      });
    } catch (e) {
      this.ensureConnectionUUID = null;
      this._connectionError = undefined;

      throw (
        this._connectionError ??
        "Could not connect to server. Ensure your API key is correct"
      );
    }
  }

  private async getSimilarImages({
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
      {
        debugKey: "getting images",
        shouldThrowError,
        timeoutDuration: this._timeoutDuration,
      }
    )) as IImage[];
  }

  private getSingleMessage = ({ taskUUID }: { taskUUID: string }) => {
    const value = this._globalMessages[taskUUID]?.[0];
    const errorValue = this._globalMessages[taskUUID];
    if (!value && !errorValue) return null;
    return errorValue?.error ? errorValue : value;
  };
  private getMultipleMessages = ({ taskUUID }: { taskUUID: string }) => {
    // console.log("global", this._globalMessages);
    const value = this._globalMessages[taskUUID]?.[0];
    const mainValue = this._globalMessages[taskUUID];
    if (!value && !mainValue) return null;
    return mainValue;
  };

  private insertAdditionalResponse = <T>({
    response,
    payload,
    startTime,
  }: {
    response: T;
    payload?: Record<string, any>;
    startTime?: number;
  }) => {
    if (!payload && !startTime) return;
    const res = response as any;
    res.additionalResponse = {};

    if (!!payload) {
      (response as any).additionalResponse.payload = payload;
    }
    if (!!startTime) {
      (response as any).additionalResponse.generationTime =
        Date.now() - startTime;
    }
  };

  private handleIncompleteImages({
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

  disconnect = async () => {
    this._shouldReconnect = false;
    this._ws?.terminate?.();
    this._ws?.close?.();
  };

  private connected = () =>
    this.isWebsocketReadyState() && !!this._connectionSessionUUID;
  //end of data
}
