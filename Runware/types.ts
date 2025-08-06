export enum Environment {
  PRODUCTION = "PRODUCTION",
  DEVELOPMENT = "DEVELOPMENT",
  TEST = "TEST",
}
export enum SdkType {
  CLIENT = "CLIENT",
  SERVER = "SERVER",
}

export enum ETaskType {
  IMAGE_INFERENCE = "imageInference",
  IMAGE_UPLOAD = "imageUpload",
  IMAGE_UPSCALE = "imageUpscale",
  IMAGE_BACKGROUND_REMOVAL = "imageBackgroundRemoval",
  VIDEO_INFERENCE = "videoInference",
  GET_RESPONSE = "getResponse",
  PHOTO_MAKER = "photoMaker",
  IMAGE_CAPTION = "imageCaption",
  IMAGE_CONTROL_NET_PRE_PROCESS = "imageControlNetPreProcess",
  IMAGE_MASKING = "imageMasking",
  PROMPT_ENHANCE = "promptEnhance",
  AUTHENTICATION = "authentication",
  MODEL_UPLOAD = "modelUpload",
  MODEL_SEARCH = "modelSearch",
}

export type RunwareBaseType = {
  apiKey: string;
  url?: string;
  shouldReconnect?: boolean;
  globalMaxRetries?: number;
  timeoutDuration?: number;
};

export type IOutputType = "base64Data" | "dataURI" | "URL";
export type IOutputFormat = "JPG" | "PNG" | "WEBP";
export type IVideoOutputFormat = "MP4" | "WEBM" | "MOV";

export interface IAdditionalResponsePayload {
  includePayload?: boolean;
  includeGenerationTime?: boolean;
}

export interface IImage {
  taskType: ETaskType;
  imageUUID: string;
  inputImageUUID?: string;
  taskUUID: string;
  imageURL?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  NSFWContent?: boolean;
  cost?: number;
  seed: number;
}

export interface ITextToImage extends IImage {
  positivePrompt?: string;
  negativePrompt?: string;
}

export interface IVideoToImage {
  taskUUID: string;
  taskType: string;
  status: string;
  videoUUID?: string;
  cost?: number;
  seed?: number;
  videoURL?: string;
}
export interface IControlNetImage {
  taskUUID: string;
  inputImageUUID: string;
  guideImageUUID: string;
  guideImageURL?: string;
  guideImageBase64Data?: string;
  guideImageDataURI?: string;
  cost?: number;
}

interface ILora {
  model: string | number;
  weight: number;
}

export enum EControlMode {
  BALANCED = "balanced",
  PROMPT = "prompt",
  CONTROL_NET = "controlnet",
}

export type IControlNetGeneral = {
  model: string;
  guideImage: string | File;
  weight?: number;
  startStep?: number;
  startStepPercentage?: number;
  endStep?: number;
  endStepPercentage?: number;
  controlMode: EControlMode;
};
export type IControlNetPreprocess = {
  inputImage: string | File;
  preProcessorType: EPreProcessorGroup;
  height?: number;
  width?: number;
  outputType?: IOutputType;
  outputFormat?: IOutputFormat;
  highThresholdCanny?: number;
  lowThresholdCanny?: number;
  includeHandsAndFaceOpenPose?: boolean;
  includeCost?: boolean;
  outputQuality?: number;

  customTaskUUID?: string;
  retry?: number;
} & IAdditionalResponsePayload;

// export type IControlNetA = RequireOnlyOne<
//   IControlNetGeneral,
//   "guideImage" | "guideImageUnprocessed"
// >;

// export type IControlNetCanny = IControlNetA & {
//   preprocessor: "canny";
//   lowThresholdCanny: Number;
//   highThresholdCanny: Number;
//   outputType?: IOutputType;
// };

// export type IControlNetHandsAndFace = IControlNetA & {
//   preprocessor: keyof typeof EOpenPosePreProcessor;
//   includeHandsAndFaceOpenPose: boolean;
//   outputType?: IOutputType;
// };

export type IControlNet = IControlNetGeneral;

export type IControlNetWithUUID = Omit<IControlNet, "guideImage"> & {
  guideImage?: string;
};

export interface IError {
  error: boolean;
  errorMessage: string;
  taskUUID: string;
}

export type TPromptWeighting = "compel" | "sdEmbeds";

export interface IRequestImage extends IAdditionalResponsePayload {
  outputType?: IOutputType;
  outputFormat?: IOutputFormat;
  uploadEndpoint?: string;
  checkNSFW?: boolean;
  positivePrompt: string;
  negativePrompt?: string;
  seedImage?: File | string;
  maskImage?: File | string;
  strength?: number;
  height?: number;
  width?: number;
  model: number | string;
  steps?: number;
  scheduler?: string;
  seed?: number;
  maskMargin?: number;
  CFGScale?: number;
  clipSkip?: number;
  /**
   * @deprecated The usePromptWeighting should not be used, use promptWeighting instead
   */
  usePromptWeighting?: boolean;
  promptWeighting?: TPromptWeighting;
  numberResults?: number; // default to 1
  includeCost?: boolean;
  outputQuality?: number;

  controlNet?: IControlNet[];
  lora?: ILora[];
  embeddings?: IEmbedding[];
  ipAdapters?: IipAdapter[];
  providerSettings?: IProviderSettings;
  outpaint?: IOutpaint;
  refiner?: IRefiner;
  acceleratorOptions?: TAcceleratorOptions;
  advancedFeatures?: {
    layerDiffuse: boolean;
  };
  referenceImages?: string[];

  // imageSize?: number;
  customTaskUUID?: string;
  onPartialImages?: (images: IImage[], error?: IError) => void;
  retry?: number;
  // gScale?: number;

  [key: string]: any;
}

export type TAcceleratorOptions =
  | { teaCache: boolean; teaCacheDistance: number }
  | {
      deepCache: boolean;
      deepCacheInterval: number;
      deepCacheBranchId: number;
    };

export interface IOutpaint {
  top?: number;
  bottom?: number;
  right?: number;
  left?: number;
  blur?: number;
}
export interface IEmbedding {
  model: string;
  weight: number;
}
export interface IipAdapter {
  model: string;
  weight: number;
  guideImage: string;
}

export interface IBflProviderSettings {
  promptUpsampling?: boolean;
  safetyTolerance?: number;
  raw?: boolean;
}

export type ProviderSettings = {
  bfl: IBflProviderSettings;
};

export type IProviderSettings = RequireOnlyOne<
  ProviderSettings,
  keyof ProviderSettings
>;

export interface IRefiner {
  model: string;
  startStep?: number;
  startStepPercentage?: number;
}
export interface IRequestImageToText extends IAdditionalResponsePayload {
  inputImage?: File | string;
  includeCost?: boolean;
  customTaskUUID?: string;
  retry?: number;
}
export interface IImageToText {
  taskType: ETaskType;
  taskUUID: string;
  text: string;
  cost?: number;
}

export interface IRemoveImageBackground extends IRequestImageToText {
  outputType?: IOutputType;
  outputFormat?: IOutputFormat;
  model: string;
  settings?: {
    rgba?: number[];
    postProcessMask?: boolean;
    returnOnlyMask?: boolean;
    alphaMatting?: boolean;
    alphaMattingForegroundThreshold?: number;
    alphaMattingBackgroundThreshold?: number;
    alphaMattingErodeSize?: number;
  };
  includeCost?: boolean;
  outputQuality?: number;
  retry?: number;
}

export interface IRequestVideo extends IRequestImageToText {
  outputType?: IOutputType;
  outputFormat?: IVideoOutputFormat;
  outputQuality?: number;
  uploadEndpoint?: string;
  checkNSFW?: boolean;
  includeCost?: boolean;
  positivePrompt: string;
  negativePrompt?: string;
  model: string;
  steps?: number;
  CFGScale?: number;
  seed?: number;
  duration?: number;
  fps?: number;
  width?: number;
  height?: number;
  numberResults?: number;

  skipResponse?: boolean;
  customTaskUUID?: string;
  retry?: number;

  [key: string]: any;
}
export interface IAsyncResults {
  taskUUID: string;
  onPartialImages?: (images: IImage[], error?: IError) => void;
}

export interface IRemoveImage {
  taskType: ETaskType;
  taskUUID: string;
  imageUUID: string;
  inputImageUUID: string;
  imageURL?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  cost?: number;
}

export interface IPromptEnhancer extends IAdditionalResponsePayload {
  promptMaxLength?: number;
  promptVersions?: number;
  prompt: string;
  includeCost?: boolean;
  customTaskUUID?: string;
  retry?: number;
}

export interface IEnhancedPrompt extends IImageToText {}

export interface IUpscaleGan extends IAdditionalResponsePayload {
  inputImage: File | string;
  upscaleFactor: number;
  outputType?: IOutputType;
  outputFormat?: IOutputFormat;
  includeCost?: boolean;
  outputQuality?: number;

  customTaskUUID?: string;
  retry?: number;
}

export type ReconnectingWebsocketProps = {
  addEventListener: (
    type: string,
    listener: EventListener,
    options: any
  ) => void;
  send: (data: any) => void;
} & WebSocket;

export type UploadImageType = {
  imageURL: string;
  imageUUID: string;
  taskUUID: string;
  taskType: ETaskType;
};

export type GetWithPromiseCallBackType = ({
  resolve,
  reject,
  intervalId,
}: {
  resolve: <T>(value: T) => void;
  reject: <T>(value: T) => void;
  intervalId: any;
}) => boolean | undefined;

export type GetWithPromiseAsyncCallBackType = ({
  resolve,
  reject,
  intervalId,
}: {
  resolve: <T>(value: T) => void;
  reject: <T>(value: T) => void;
  intervalId: any;
}) => any;

export enum EPreProcessorGroup {
  "canny" = "canny",
  "depth" = "depth",
  "mlsd" = "mlsd",
  "normalbae" = "normalbae",
  "openpose" = "openpose",
  "tile" = "tile",
  "seg" = "seg",
  "lineart" = "lineart",
  "lineart_anime" = "lineart_anime",
  "shuffle" = "shuffle",
  "scribble" = "scribble",
  "softedge" = "softedge",
}

export enum EPreProcessor {
  "canny" = "canny",
  "depth_leres" = "depth_leres",
  "depth_midas" = "depth_midas",
  "depth_zoe" = "depth_zoe",
  "inpaint_global_harmonious" = "inpaint_global_harmonious",
  "lineart_anime" = "lineart_anime",
  "lineart_coarse" = "lineart_coarse",
  "lineart_realistic" = "lineart_realistic",
  "lineart_standard" = "lineart_standard",
  "mlsd" = "mlsd",
  "normal_bae" = "normal_bae",

  "scribble_hed" = "scribble_hed",
  "scribble_pidinet" = "scribble_pidinet",
  "seg_ofade20k" = "seg_ofade20k",
  "seg_ofcoco" = "seg_ofcoco",
  "seg_ufade20k" = "seg_ufade20k",
  "shuffle" = "shuffle",
  "softedge_hed" = "softedge_hed",
  "softedge_hedsafe" = "softedge_hedsafe",
  "softedge_pidinet" = "softedge_pidinet",
  "softedge_pidisafe" = "softedge_pidisafe",
  "tile_gaussian" = "tile_gaussian",

  "openpose" = "openpose",
  "openpose_face" = "openpose_face",
  "openpose_faceonly" = "openpose_faceonly",
  "openpose_full" = "openpose_full",
  "openpose_hand" = "openpose_hand",
}

export enum EOpenPosePreProcessor {
  "openpose" = "openpose",
  "openpose_face" = "openpose_face",
  "openpose_faceonly" = "openpose_faceonly",
  "openpose_full" = "openpose_full",
  "openpose_hand" = "openpose_hand",
}

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
      Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

export type ListenerType = {
  key: string;
  listener: (msg: any) => void;
  groupKey?: string;
};

export interface IAddModelResponse {
  status: string;
  message: string;
  taskUUID: string;
  air: string;
  taskType: string;
}

export interface IErrorResponse {
  code: string;
  message: string;
  parameter: string;
  type: string;
  documentation: string;
  taskUUID: string;
  min?: number;
  max?: number;
  default?: string | number;
}

export type TAddModelBaseType = {
  air: string;
  name: string;
  downloadURL: string;
  uniqueIdentifier: string;

  version: string;
  format: EModelFormat;
  architecture: EModelArchitecture;
  heroImageURL?: string;
  tags?: string[];
  shortDescription?: string;
  comment?: string;
  private: boolean;

  // Custom parameters
  customTaskUUID?: string;
  retry?: number;
  onUploadStream?: (
    response?: IAddModelResponse,
    error?: IErrorResponse
  ) => void;
};

export type TAddModelControlNet = {
  category: "controlnet";
  conditioning: EModelConditioning;
} & TAddModelBaseType;

export type TAddModelCheckPoint = {
  category: "checkpoint";
  defaultCFGScale?: number;
  defaultStrength: number;
  defaultSteps?: number;
  defaultScheduler?: string;
  type: EModelType;
} & TAddModelBaseType;

export type TAddModelLora = {
  category: "lora";
  defaultWeight: number;
  positiveTriggerWords?: string;
} & TAddModelBaseType;

export type TAddModel =
  | TAddModelCheckPoint
  | TAddModelControlNet
  | TAddModelLora;

export type TPhotoMaker = {
  style: EPhotoMakerEnum;
  inputImages: string[];
  outputType?: string;
  outputFormat?: string;
  uploadEndpoint?: string;
  checkNSFW?: boolean;
  positivePrompt: string;
  negativePrompt?: string;
  strength?: number;
  height: number;
  width: number;
  model?: string; // this should be hidden for now cause we have a single model
  steps?: number;
  scheduler?: string;
  seed?: number;
  CFGScale?: number;
  clipSkip?: number;
  numberResults: number;
  includeCost?: boolean;
  outputQuality?: number;

  // other options
  customTaskUUID?: string;
  retry?: number;
  onPartialImages?: (images: IImage[], error?: IError) => void;
} & IAdditionalResponsePayload;

export type TPhotoMakerResponse = {
  taskType: string;
  taskUUID: string;
  imageUUID: string;
  NSFWContent: boolean;
  cost: number;
  seed: number;
  imageURL: string;
  positivePrompt: string;
  negativePrompt?: string;
};

export enum EModelFormat {
  safetensors = "safetensors",
  pickletensor = "pickletensor",
}

export enum EModelArchitecture {
  flux1d = "flux1d",
  flux1s = "flux1s",
  pony = "pony",
  sdhyper = "sdhyper",
  sd1x = "sd1x",
  sd1xlcm = "sd1xlcm",
  sd3 = "sd3",
  sdxl = "sdxl",
  sdxllcm = "sdxllcm",
  sdxldistilled = "sdxldistilled",
  sdxlhyper = "sdxlhyper",
  sdxllightning = "sdxllightning",
  sdxlturbo = "sdxlturbo",
}

export enum EModelType {
  base = "base",
  inpainting = "inpainting",
  pix2pix = "pix2pix",
}

export enum EModelConditioning {
  canny = "canny",
  depth = "depth",
  qrcode = "qrcode",
  hed = "hed",
  scrible = "scrible",
  openpose = "openpose",
  seg = "segmentation",
  openmlsd = "openmlsd",
  softedge = "softedge",
  normal = "normal bae",
  shuffle = "shuffle",
  pix2pix = "pix2pix",
  inpaint = "inpaint",
  lineart = "line art",
  sketch = "sketch",
  inpaintdepth = "inpaint depth",
  tile = "tile",
  outfit = "outfit",
  blur = "blur",
  gray = "gray",
  lowquality = "low quality",
}

export enum EPhotoMakerEnum {
  NoStyle = "No style",
  Cinematic = "Cinematic",
  DisneyCharacter = "Disney Character",
  DigitalArt = "Digital Art",
  Photographic = "Photographic",
  FantasyArt = "Fantasy art",
  Neonpunk = "Neonpunk",
  Enhance = "Enhance",
  ComicBook = "Comic book",
  Lowpoly = "Lowpoly",
  LineArt = "Line art",
}

export type TModelSearch = {
  search?: string;
  tags?: string[];
  category?: "checkpoint" | "lora" | "controlnet";
  type?: string;
  architecture?: EModelArchitecture;
  conditioning?: string;
  visibility?: "public" | "private" | "all";
  limit?: number;
  offset?: number;

  // other options
  customTaskUUID?: string;
  retry?: number;
} & { [key: string]: any };

export type TModel = {
  air: string;
  name: string;
  version: string;
  category: string;
  architecture: string;
  tags: string[];
  heroImage: string;
  private: boolean;
  comment: string;

  // Optionals
  type?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultSteps?: number;
  defaultScheduler?: string;
  defaultCFG?: number;
  defaultStrength: number;
  conditioning?: string;
  positiveTriggerWords?: string;
} & { [key: string]: any };

export type TModelSearchResponse = {
  results: TModel[];
  taskUUID: string;
  taskType: string;
  totalResults: number;
};

export type TImageMasking = {
  model: string;
  inputImage: string;
  confidence?: number;
  maskPadding?: number;
  maskBlur?: number;
  outputFormat?: string;
  outputType?: string;
  includeCost?: boolean;
  uploadEndpoint?: string;
  maxDetections?: number;
  outputQuality?: number;

  customTaskUUID?: string;
  retry?: number;
};

export type TImageUpload = {
  image: string;

  customTaskUUID?: string;
  retry?: number;
};

export type TImageUploadResponse = {
  image: string;
  taskUUID: string;
  imageUUID: number;
  imageURL: string;
};

export type TImageMaskingResponse = {
  taskType: string;
  taskUUID: string;
  maskImageUUID: string;

  detections: [
    {
      x_min: number;
      y_min: number;
      x_max: number;
      y_max: number;
    }
  ];
  maskImageURL: string;
  cost: number;
};

export type TServerError = {
  error: {
    code: string;
    message: string;
    parameter: string;
    type: string;
    taskType: string;
  };
};
