// @ts-ignore
import { asyncRetry } from "./async-retry";
import { RunwareLogger, createLogger } from "./logger";
import {
  EControlMode,
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
  TMediaStorage,
  TMediaStorageResponse,
  TVectorize,
  TVectorizeResponse,
  IRequestAudio,
  IAudio,
  MediaUUID,
  IRequestThreeD,
  IThreeDImage,
  ITextResponse,
  IRequestTextInference,
  IError,
  TGetTaskDetailsRequest,
  TGetTaskDetailsResponse,
  IRequestTraining,
  TTrainingResponse,
} from "./types";
import {
  BASE_RUNWARE_URLS,
  LISTEN_TO_MEDIA_KEY,
  TIMEOUT_DURATION,
  accessDeepObject,
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
  isUrl,
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
  _globalErrors: IError[] = [];
  _connectionSessionUUID: string | undefined;
  _connectionError: TServerError | undefined;
  _sdkType: SdkType;
  _shouldReconnect: boolean;
  _globalMaxRetries: number;
  _timeoutDuration: number;
  _heartbeatIntervalId: any = null;
  _pongTimeoutId: any = null;
  _heartbeatInterval: number;
  _missedPongCount: number = 0;
  _maxMissedPongs: number = 3;
  ensureConnectionUUID: string | null = null;
  _logger: RunwareLogger;

  constructor({
    apiKey,
    url = BASE_RUNWARE_URLS.PRODUCTION,
    shouldReconnect = true,
    globalMaxRetries = 2,
    timeoutDuration = TIMEOUT_DURATION,
    heartbeatInterval = 45000,
    enableLogging = false,
  }: RunwareBaseType) {
    this._apiKey = apiKey;
    this._url = url;
    this._sdkType = SdkType.CLIENT;
    this._shouldReconnect = shouldReconnect;
    this._globalMaxRetries = globalMaxRetries;
    this._timeoutDuration = timeoutDuration;
    // Clamp heartbeat interval between 10s and 120s
    this._heartbeatInterval = Math.max(10000, Math.min(120000, heartbeatInterval));
    this._logger = createLogger(enableLogging);
  }

  private getUniqueUUID(item: MediaUUID): string | undefined {
    return (
      item.mediaUUID ||
      item.audioUUID ||
      item.imageUUID ||
      item.videoUUID ||
      item.outputs?.files?.map((file) => file.uuid).join("-") ||
      item.text
    );
  }

  /**
   * Shared polling logic for async results.
   * @param taskUUID - The task UUID to poll for.
   * @param numberResults - Number of results expected.
   * @returns Promise resolving to array of results.
   */
  private async pollForAsyncResults<T extends { status: string } & MediaUUID>({
    taskUUID,
    numberResults = 1,
    dedupeKey,
  }: {
    taskUUID: string;
    numberResults?: number;
    dedupeKey?: string | ((item: T) => string | undefined);
  }): Promise<T[]> {
    const allResults = new Map<string, T>();
    await getIntervalAsyncWithPromise(
      async ({ resolve, reject }) => {
        try {
          const response = await this.getResponse<T>({ taskUUID });

          // Add results to the collection
          for (const responseItem of response || []) {
            if (responseItem.status === "success") {
              const uuid =
                typeof dedupeKey === "function"
                  ? dedupeKey(responseItem)
                  : dedupeKey || this.getUniqueUUID(responseItem);
              if (uuid) {
                allResults.set(uuid, responseItem);
              }
            }
          }

          // Check completion AFTER updating the collection
          const isComplete = allResults.size === numberResults;

          if (isComplete) {
            resolve(Array.from(allResults.values()));
            return true; // Signal to clear the interval
          }

          return false;
        } catch (err) {
          reject(err);
          return true;
        }
      },
      {
        debugKey: "async-response",
        pollingInterval: 2 * 1000,
        timeoutDuration: 10 * 60 * 1000,
      },
    );
    return Array.from(allResults.values());
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

  protected startHeartbeat() {
    this.stopHeartbeat();
    this._logger.heartbeatStarted(this._heartbeatInterval);
    this._heartbeatIntervalId = setInterval(() => {
      if (!this.isWebsocketReadyState()) {
        this.stopHeartbeat();
        return;
      }
      try {
        this._ws.send(
          JSON.stringify([{ taskType: "ping", ping: true }]),
        );
        this._logger.heartbeatPingSent();
      } catch {
        this.stopHeartbeat();
        return;
      }
      // Clear any previous pong timeout to prevent accumulation
      if (this._pongTimeoutId) {
        clearTimeout(this._pongTimeoutId);
        this._pongTimeoutId = null;
      }
      this._pongTimeoutId = setTimeout(() => {
        this._missedPongCount++;
        this._logger.heartbeatPongMissed(this._missedPongCount, this._maxMissedPongs);
        if (this._missedPongCount >= this._maxMissedPongs) {
          if (this._ws) {
            if (typeof this._ws.terminate === "function") {
              this._ws.terminate();
            } else {
              this._ws.close();
            }
          }
        }
      }, 10000);
    }, this._heartbeatInterval);
  }

  protected stopHeartbeat() {
    if (this._heartbeatIntervalId) {
      clearInterval(this._heartbeatIntervalId);
      this._heartbeatIntervalId = null;
      this._logger.heartbeatStopped();
    }
    if (this._pongTimeoutId) {
      clearTimeout(this._pongTimeoutId);
      this._pongTimeoutId = null;
    }
    this._missedPongCount = 0;
  }

  protected handlePongMessage(data: any) {
    const messages = Array.isArray(data?.data) ? data.data : [];
    for (const msg of messages) {
      if (msg?.taskType === "ping" && msg?.pong === true) {
        this._missedPongCount = 0;
        if (this._pongTimeoutId) {
          clearTimeout(this._pongTimeoutId);
          this._pongTimeoutId = null;
        }
        this._logger.heartbeatPongReceived();
        return true;
      }
    }
    return false;
  }

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
        (v) => (v?.taskUUID || v?.taskType) === taskUUID,
      );

      const filteredErrors = arrayErrors.filter(
        (v: any) => (v?.taskUUID || v?.taskType) === taskUUID,
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
    this._logger.connecting(this._url || "unknown");

    this._ws.onopen = async (e: any) => {
      this._logger.authenticating(!!this._connectionSessionUUID);
      try {
        if (this._connectionSessionUUID) {
          await this.send({
            taskType: ETaskType.AUTHENTICATION,
            apiKey: this._apiKey,
            connectionSessionUUID: this._connectionSessionUUID,
          });
        } else {
          await this.send({ apiKey: this._apiKey, taskType: ETaskType.AUTHENTICATION });
        }
      } catch (err) {
        this._logger.error("Failed to send auth message", err);
        return;
      }

      const authListener = this.addListener({
        taskUUID: ETaskType.AUTHENTICATION,
        lis: (m) => {
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
    };

    this._ws.onmessage = (e: any) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (err) {
        this._logger.error("Failed to parse WebSocket message", err);
        return;
      }
      if (this.handlePongMessage(data)) return;
      for (const lis of this._listeners) {
        const result = (lis as any)?.listener?.(data);
        if (result) return;
      }
    };

    this._ws.onclose = (e: any) => {
      this._logger.connectionClosed(e?.code);
      this._connectionSessionUUID = undefined;
      this.stopHeartbeat();
      if (this.isInvalidAPIKey()) {
        return;
      }
    };

    this._ws.onerror = (e: any) => {
      this._logger.connectionError(e?.message || e);
    };
  }

  // We moving to an array format, it make sense to consolidate all request to an array here
  protected send = async (msg: Object) => {
    if (!this.isWebsocketReadyState()) {
      this._logger.sendReconnecting();
      if (this._ws) {
        try {
          if (typeof this._ws.terminate === "function") {
            this._ws.terminate();
          } else {
            this._ws.close();
          }
        } catch {}
      }
      this._connectionSessionUUID = undefined;
      // ensureConnection either resolves (ws ready) or throws
      await this.ensureConnection();
    }
    const taskType = (msg as any)?.taskType;
    const taskUUID = (msg as any)?.taskUUID;
    this._logger.messageSent(taskType, taskUUID);
    this._ws.send(JSON.stringify([msg]));
  };

  private destroy(lis: any) {
    removeFromAray(this._listeners, lis);
  }

  private uploadImage = async (
    file: File | string,
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

  private listenToResponse({
    onPartialImages,
    taskUUID,
    groupKey,
    requestPayload,
    startTime,
  }: {
    taskUUID: string;
    onPartialImages?: (images: IImage[], error?: any) => void;
    groupKey: LISTEN_TO_MEDIA_KEY;
    requestPayload?: Record<string, any>;
    startTime?: number;
  }) {
    return this.addListener({
      taskUUID: taskUUID,
      lis: (m) => {
        let images = (m?.[taskUUID] as IImage[])?.filter(
          (img) => img.taskUUID === taskUUID,
        );

        if (m.error) {
          onPartialImages?.(images, m?.error && m);
          this._globalErrors.push(m);
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
      error?: IErrorResponse,
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
      taskUUID: _taskUUID,
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
    moreOptions?: Record<string, any>,
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
            taskUUIDs.includes(img.taskUUID),
          );

          const taskUUID = _taskUUID || customTaskUUID || getUUID();

          taskUUIDs.push(taskUUID);

          const imageRemaining = numberResults - imagesWithSimilarTask.length;

          const newRequestObject = {
            ...requestObject,
            taskUUID: taskUUID,
            numberResults: imageRemaining,
          };
          await this.send(newRequestObject);

          // const generationTime = endTime - startTime;

          lis = this.listenToResponse({
            onPartialImages,
            taskUUID: taskUUID,
            groupKey: LISTEN_TO_MEDIA_KEY.REQUEST_IMAGES,
            requestPayload: includePayload ? newRequestObject : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          const promise = await this.getResponseWithSimilarTaskUUID({
            taskUUID: taskUUIDs,
            numberResults,
            lis,
            deliveryMethod: rest.deliveryMethod,
          });

          lis.destroy();

          return promise;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        },
      );
    } catch (e) {
      if (retryCount >= totalRetry) {
        return this.handleIncompleteImages({ taskUUIDs, error: e });
      }
      throw e;
    }
  }

  // Alias for requestImages
  async imageInference(
    params: IRequestImage,
    moreOptions?: Record<string, any>,
  ): Promise<ITextToImage[] | undefined> {
    return this.requestImages(params, moreOptions);
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
    taskUUID: _taskUUID,
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

          const taskUUID = _taskUUID || customTaskUUID || getUUID();
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

          await this.send({
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
            },
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
        },
      );
    } catch (e: any) {
      throw e;
    }
  };

  // Alias for controlNetPreProcess
  controlNetPreprocess = async (
    params: IControlNetPreprocess,
  ): Promise<IControlNetImage | null> => {
    return this.controlNetPreProcess(params);
  };

  requestImageToText = async ({
    inputImage,
    inputs,
    includeCost,
    customTaskUUID,
    taskUUID: _taskUUID,
    retry,
    includePayload,
    includeGenerationTime,
    deliveryMethod,
    skipResponse,
    model,
  }: IRequestImageToText): Promise<IImageToText> => {
    try {
      let imageUploaded;

      // TODO: Add support for handling all media uploads from inputs object
      // This is legacy support for inputImage only
      if (inputImage) {
        imageUploaded = await this.uploadImage(inputImage as File | string);
      }

      const taskUUID = _taskUUID || customTaskUUID || getUUID();
      const payload = {
        taskUUID,
        taskType: ETaskType.CAPTION,
        model,
        inputImage: imageUploaded?.imageUUID,
        inputs,
        ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
        retry,
        includePayload,
        includeGenerationTime,
      };

      const request = await this.baseSingleRequest<IImageToText>({
        payload: {
          ...payload,
          taskType: ETaskType.CAPTION,
        },
        debugKey: "caption",
      });

      if (skipResponse) {
        return request;
      }

      if (deliveryMethod === "async") {
        const taskUUID = request?.taskUUID;
        const results = await this.pollForAsyncResults<IImageToText>({
          taskUUID,
        });
        return results[0];
      }

      return request;
    } catch (e) {
      throw e;
    }
  };

  // Alias for requestImageToText
  caption = async (params: IRequestImageToText): Promise<IImageToText> => {
    return this.requestImageToText(params);
  };

  /**
   * Remove the background from an image or video.
   * @remark This method now supports the removeBackground type which can handle multiple media types such as image and video.
   * If you pass an `inputs` object with `inputs.image` or `inputs.video`, the response will contain `mediaUUID` and `mediaURL`.
   * If you pass `inputImage`, the response will contain `imageUUID` and `imageURL`.
   * @remark `imageUUID` is no longer guaranteed in the response. Use `mediaUUID` for new implementations.
   * @since 1.2.0
   * @returns {Promise<IRemoveImage>} If called with `inputs.image` or `inputs.video`, returns an object with `mediaUUID` and `mediaURL`. If called with `inputImage`, returns an object with `imageUUID` and `imageURL` (not guaranteed).
   */
  removeImageBackground = async (
    payload: IRemoveImageBackground,
  ): Promise<IRemoveImage> => {
    const { skipResponse, ...rest } = payload;

    try {
      const deliveryMethod = rest.deliveryMethod;
      const request = await this.baseSingleRequest<IRemoveImage>({
        payload: {
          ...rest,
          taskType: ETaskType.REMOVE_BACKGROUND,
        },
        debugKey: "remove-background",
      });

      if (skipResponse) {
        return request;
      }

      if (deliveryMethod === "async") {
        const taskUUID = request?.taskUUID;
        const results = await this.pollForAsyncResults<IRemoveImage>({
          taskUUID,
        });
        return results[0];
      }

      // If not async, just return the initial result
      return request;
    } catch (e) {
      throw e;
    }
  };

  // Alias for removeImageBackground
  removeBackground = async (
    payload: IRemoveImageBackground,
  ): Promise<IRemoveImage> => {
    return this.removeImageBackground(payload);
  };

  vectorize = async (payload: TVectorize): Promise<TVectorizeResponse> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        taskType: ETaskType.VECTORIZE,
      },
      debugKey: "vectorize",
    });
  };

  getTaskDetails = async (
    payload: TGetTaskDetailsRequest,
  ): Promise<TGetTaskDetailsResponse> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        taskType: ETaskType.GET_TASK_DETAILS,
      },
      debugKey: "get-task-details",
    });
  };

  training = async (
    payload: IRequestTraining,
  ): Promise<TTrainingResponse | TTrainingResponse[]> => {
    // training usually takes hours, so we skipResponse by default
    const { skipResponse = true, ...rest } = payload;

    const request = await this.baseSingleRequest<TTrainingResponse>({
      payload: {
        ...rest,
        deliveryMethod: "async",
        taskType: ETaskType.TRAINING,
      },
      debugKey: "training",
    });

    if (skipResponse) {
      return request;
    }

    return this.pollForAsyncResults<TTrainingResponse>({
      taskUUID: request?.taskUUID,
      dedupeKey: (response) => response.taskUUID,
    });
  };

  videoInference = async (
    payload: IRequestVideo,
  ): Promise<IVideoToImage[] | IVideoToImage> => {
    const { skipResponse, inputAudios, referenceVideos, ...rest } = payload;
    try {
      const request = await this.baseSingleRequest<IVideoToImage>({
        payload: {
          ...rest,
          ...(inputAudios?.length && { inputAudios }),
          ...(referenceVideos?.length && { referenceVideos }),
          deliveryMethod: "async",
          taskType: ETaskType.VIDEO_INFERENCE,
        },

        debugKey: "video-inference",
      });

      if (skipResponse) {
        return request;
      }

      const taskUUID = request?.taskUUID;
      return this.pollForAsyncResults({
        taskUUID,
        numberResults: payload?.numberResults,
      });
    } catch (e) {
      throw e;
    }
  };

  audioInference = async (
    payload: IRequestAudio,
  ): Promise<IAudio[] | IAudio> => {
    const { skipResponse, deliveryMethod = "sync", ...rest } = payload;

    try {
      const requestMethod =
        deliveryMethod === "sync"
          ? this.baseSyncRequest
          : this.baseSingleRequest;

      const request = await requestMethod<IAudio>({
        payload: {
          ...rest,
          numberResults: rest.numberResults || 1,
          taskType: ETaskType.AUDIO_INFERENCE,
          deliveryMethod: deliveryMethod,
        },
        groupKey: LISTEN_TO_MEDIA_KEY.REQUEST_AUDIO,
        debugKey: "audio-inference",
        skipResponse,
      });

      if (skipResponse) {
        return request;
      }

      const taskUUID = request?.taskUUID;
      if (deliveryMethod === "async") {
        return this.pollForAsyncResults<IAudio>({
          taskUUID,
          numberResults: payload?.numberResults,
        });
      }

      // If not async, just return the initial result
      return request;
    } catch (e) {
      throw e;
    }
  };

  threeDInference = async (
    payload: IRequestThreeD,
  ): Promise<IThreeDImage[] | IThreeDImage> => {
    const { skipResponse, deliveryMethod = "sync", ...rest } = payload;

    try {
      const requestMethod =
        deliveryMethod === "sync"
          ? this.baseSyncRequest
          : this.baseSingleRequest;

      const request = await requestMethod<IThreeDImage>({
        payload: {
          ...rest,
          numberResults: rest.numberResults || 1,
          taskType: ETaskType.THREE_D_INFERENCE,
          deliveryMethod: deliveryMethod,
        },
        groupKey: LISTEN_TO_MEDIA_KEY.REQUEST_IMAGES,
        debugKey: "three-d-inference",
        skipResponse,
      });

      if (skipResponse) {
        return request;
      }

      const taskUUID = request?.taskUUID;
      if (deliveryMethod === "async") {
        return this.pollForAsyncResults<IThreeDImage>({
          taskUUID,
          numberResults: payload?.numberResults,
        });
      }

      return request;
    } catch (e) {
      throw e;
    }
  };

  textInference = async (
    payload: IRequestTextInference,
  ): Promise<ITextResponse[] | ITextResponse> => {
    const { skipResponse, deliveryMethod = "sync", ...rest } = payload;

    try {
      const requestMethod =
        deliveryMethod === "sync"
          ? this.baseSyncRequest
          : this.baseSingleRequest;

      const request = await requestMethod<ITextResponse>({
        payload: {
          ...rest,
          numberResults: rest.numberResults || 1,
          taskType: ETaskType.TEXT_INFERENCE,
          deliveryMethod: deliveryMethod,
        },
        groupKey: LISTEN_TO_MEDIA_KEY.REQUEST_TEXT,
        debugKey: "text-inference",
        skipResponse,
      });

      if (skipResponse) {
        return request;
      }

      const taskUUID = request?.taskUUID;
      if (deliveryMethod === "async") {
        return this.pollForAsyncResults<ITextResponse>({
          taskUUID,
          numberResults: payload?.numberResults,
        });
      }

      return request;
    } catch (e) {
      throw e;
    }
  };

  getResponse = async <T>(payload: IAsyncResults): Promise<T[]> => {
    const taskUUID = payload.taskUUID;
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

  /**
   * Upscale an image or video
   * @remark This method now supports the upscale type which can handle multiple media types such as image and video.
   * If you pass an `inputs` object with `inputs.image` or `inputs.video`, the response will contain `mediaUUID` and `mediaURL`.
   * If you pass `inputImage`, the response will contain `imageUUID` and `imageURL`.
   * @remark `imageUUID` is no longer guaranteed in the response. Use `mediaUUID` for new implementations.
   * @since 1.2.0
   * @returns {Promise<IImage>} If called with `inputs.image` or `inputs.video`, returns an object with `mediaUUID` and `mediaURL`. If called with `inputImage`, returns an object with `imageUUID` and `imageURL` (not guaranteed).
   */
  upscaleGan = async (payload: IUpscaleGan): Promise<IImage> => {
    const { inputImage, skipResponse, deliveryMethod = "sync", ...rest } = payload;

    try {
      let imageUploaded;

      // TODO: Add support for handling all media uploads from inputs object
      // This is legacy support for inputImage only
      if (inputImage) {
        imageUploaded = await this.uploadImage(inputImage as File | string);
      }


      const request = await this.baseSingleRequest<IImage>({
        payload: {
          ...rest,
          ...(imageUploaded?.imageUUID ? { inputImage: imageUploaded.imageUUID } : {}),
          taskType: ETaskType.UPSCALE,
          deliveryMethod,
        },
        debugKey: "upscale",
      });

      if (skipResponse) {
        return request;
      }
      

      if (deliveryMethod === "async") {
        const taskUUID = request?.taskUUID;
        const results = await this.pollForAsyncResults<IImage>({
          taskUUID,
        });
        return results[0];
      }

      // If not async, just return the initial result
      return request;
    } catch (e) {
      throw e;
    }
  };

  // Alias for upscaleGan
  upscale = async (params: IUpscaleGan): Promise<IImage> => {
    return this.upscaleGan(params);
  };

  enhancePrompt = async ({
    prompt,
    promptMaxLength = 380,
    promptVersions = 1,
    includeCost,
    customTaskUUID,
    taskUUID: _taskUUID,
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
          const taskUUID = _taskUUID || customTaskUUID || getUUID();

          const payload = {
            prompt,
            taskUUID,
            promptMaxLength,
            promptVersions,
            ...evaluateNonTrue({ key: "includeCost", value: includeCost }),
            taskType: ETaskType.PROMPT_ENHANCE,
          };

          await this.send(payload);

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
            },
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
        },
      );
    } catch (e) {
      throw e;
    }
  };

  // Alias for enhancePrompt
  promptEnhance = async (
    params: IPromptEnhancer,
  ): Promise<IEnhancedPrompt[]> => {
    return this.enhancePrompt(params);
  };

  modelUpload = async (payload: TAddModel) => {
    // This is written to destructure the payload from the additional parameters
    const {
      onUploadStream,
      retry,
      customTaskUUID,
      taskUUID: _taskUUID,
      ...addModelPayload
    } = payload;

    const totalRetry = retry || this._globalMaxRetries;
    let lis: any = undefined;

    try {
      return await asyncRetry(
        async () => {
          await this.ensureConnection();
          const taskUUID = _taskUUID || customTaskUUID || getUUID();

          await this.send({
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
                return true;
              }
            },
            {
              shouldThrowError: false,
              timeoutDuration: 60 * 60 * 1000,
            },
          );

          lis?.destroy();
          return modelUploadResponse as IAddModelResponse | IErrorResponse;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
        },
      );
    } catch (e) {
      throw e;
    }
  };

  photoMaker = async (
    payload: TPhotoMaker,
    moreOptions?: Record<string, any>,
  ): Promise<TPhotoMakerResponse[] | undefined> => {
    // This is written to destructure the payload from the additional parameters
    const {
      onPartialImages,
      retry,
      customTaskUUID,
      taskUUID: _taskUUID,
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
            taskUUIDs.includes(img.taskUUID),
          );

          const taskUUID = _taskUUID || customTaskUUID || getUUID();
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

          await this.send({
            ...payload,
            numberResults: imageRemaining,
          });

          lis = this.listenToResponse({
            onPartialImages,
            taskUUID: taskUUID,
            groupKey: LISTEN_TO_MEDIA_KEY.REQUEST_IMAGES,
            requestPayload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          const promise = await this.getResponseWithSimilarTaskUUID({
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
        },
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
    payload: TModelSearch,
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
    payload: TImageMasking,
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
    payload: TImageUpload,
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
    payload: TMediaStorage,
  ): Promise<TMediaStorageResponse> => {
    return this.baseSingleRequest({
      payload: {
        ...payload,
        operation: payload.operation || "upload",
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
      taskUUID: _taskUUID,
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
          const taskUUID = _taskUUID || customTaskUUID || getUUID();
          const payload = {
            ...restPayload,
            taskUUID,
          };

          this._logger.requestStart(debugKey, taskUUID);
          await this.send(payload);

          lis = this.globalListener({
            taskUUID,
          });

          const response = await getIntervalWithPromise(
            ({ resolve, reject }) => {
              const response = isMultiple
                ? this.getMultipleMessages({ taskUUID })
                : this.getSingleMessage({ taskUUID });
              if (!response) return;

              if (response?.error) {
                this._logger.requestError(taskUUID, response);
                reject(response);
                return true;
              }

              if (response) {
                delete this._globalMessages[taskUUID];
                this._logger.requestComplete(debugKey, taskUUID, Date.now() - startTime);
                resolve(response);
                return true;
              }
            },
            {
              debugKey,
              timeoutDuration: this._timeoutDuration,
            },
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
          logger: this._logger,
        },
      );
    } catch (e) {
      throw e;
    }
  };

  protected baseSyncRequest = async <T>({
    payload,
    groupKey,
    skipResponse = false,
  }: {
    payload: Record<string, any>;
    groupKey: LISTEN_TO_MEDIA_KEY;
    skipResponse?: boolean;
  }): Promise<T> => {
    const {
      retry,
      customTaskUUID,
      includePayload,
      numberResults = 1,
      onPartialResponse,
      includeGenerationTime,
      ...restPayload
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

          const taskWithSimilarTaskUUID = this._globalImages.filter((audio) =>
            taskUUIDs.includes(audio.taskUUID),
          );

          const taskUUID = customTaskUUID || getUUID();
          taskUUIDs.push(taskUUID);
          const taskRemaining = numberResults - taskWithSimilarTaskUUID.length;

          const payload = {
            ...restPayload,
            taskUUID,
            numberResults: taskRemaining,
          };

          this._logger.requestStart(restPayload.taskType || groupKey, taskUUID);
          await this.send(payload);

          if (skipResponse) {
            this._logger.info(`Async mode (skipResponse) — waiting for server acknowledgement`, { taskUUID });
            return new Promise<T>((resolve, reject) => {
              const listener = this.addListener({
                taskUUID,
                groupKey,
                lis: (msg) => {
                  listener.destroy();
                  if (msg.error) {
                    this._logger.requestError(taskUUID, msg.error);
                    reject(msg.error);
                  } else {
                    this._logger.requestComplete(restPayload.taskType || groupKey, taskUUID, Date.now() - startTime);
                    resolve(msg[taskUUID]);
                  }
                },
              });
            });
          }

          lis = this.listenToResponse({
            onPartialImages: onPartialResponse,
            taskUUID: taskUUID,
            groupKey,
            requestPayload: includePayload ? payload : undefined,
            startTime: includeGenerationTime ? startTime : undefined,
          });

          const promise = await this.getResponseWithSimilarTaskUUID({
            taskUUID: taskUUIDs,
            numberResults,
            lis,
          });

          this._logger.requestComplete(restPayload.taskType || groupKey, taskUUID, Date.now() - startTime);
          lis.destroy();
          return promise as T;
        },
        {
          maxRetries: totalRetry,
          callback: () => {
            lis?.destroy();
          },
          logger: this._logger,
        },
      );
    } catch (e) {
      throw e;
    }
  };

  async ensureConnection() {
    let isConnected = this.connected();
    if (isConnected || this._url === BASE_RUNWARE_URLS.TEST) return;

    this._logger.ensureConnectionStart();

    const retryInterval = 2000;
    const pollingInterval = 200;

    try {
      if (this.isInvalidAPIKey()) {
        throw this._connectionError;
      }

      return new Promise((resolve, reject) => {
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

              const SHOULD_RETRY = retry % 10 === 0 && shouldCallServer;

              if (hasConnected) {
                clearAllIntervals();
                this._logger.ensureConnectionSuccess();
                resolve(true);
              } else if (retry >= MAX_RETRY) {
                clearAllIntervals();
                this._logger.ensureConnectionTimeout();
                reject(new Error("Retry timed out"));
              } else {
                if (SHOULD_RETRY) {
                  this._logger.reconnecting(retry + 1);
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
            this._logger.ensureConnectionSuccess();
            resolve(true);
            return;
          }
          if (!!this.isInvalidAPIKey()) {
            clearAllIntervals();
            this._logger.error("Connection failed — invalid API key");
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

  private async getResponseWithSimilarTaskUUID({
    taskUUID,
    numberResults,
    shouldThrowError,
    lis,
    deliveryMethod,
  }: {
    taskUUID: string | string[];
    numberResults: number;
    shouldThrowError?: boolean;
    lis: any;
    deliveryMethod?: "sync" | "async";
  }): Promise<IImage[] | IError> {
    return (await getIntervalWithPromise(
      ({ resolve, reject, intervalId }) => {
        const taskUUIDs = Array.isArray(taskUUID) ? taskUUID : [taskUUID];
        const imagesWithSimilarTask = this._globalImages.filter((img) =>
          taskUUIDs.includes(img.taskUUID),
        );

        const isAsyncResponse =
          deliveryMethod === "async" && imagesWithSimilarTask.length > 0;

        const errors = this._globalErrors.filter((err) =>
          taskUUIDs.includes(err.error.taskUUID),
        );

        if (errors.length > 0) {
          const newData = errors[0];
          this._globalErrors = this._globalErrors.filter(
            (err) => !taskUUIDs.includes(err.error.taskUUID),
          );
          clearInterval(intervalId);
          reject<IError>?.(newData);
          return true;
        } else if (
          imagesWithSimilarTask.length >= numberResults ||
          isAsyncResponse
        ) {
          // lis?.destroy();
          clearInterval(intervalId);
          this._globalImages = this._globalImages.filter(
            (img) => !taskUUIDs.includes(img.taskUUID),
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
      },
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
      taskUUIDs.includes(img.taskUUID),
    );
    if (imagesWithSimilarTask.length > 1) {
      this._globalImages = this._globalImages.filter(
        (img) => !taskUUIDs.includes(img.taskUUID),
      );
      return imagesWithSimilarTask;
    } else {
      throw error;
    }
  }

  disconnect = async () => {
    this._logger.disconnected("user initiated");
    this._shouldReconnect = false;
    this._connectionSessionUUID = undefined;
    this.stopHeartbeat();
    this._ws?.terminate?.();
    this._ws?.close?.(1000, "", { keepClosed: true });
  };

  private connected = () =>
    this.isWebsocketReadyState() && !!this._connectionSessionUUID;
  //end of data
}
