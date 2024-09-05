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
  IMAGE_CAPTION = "imageCaption",
  IMAGE_CONTROL_NET_PRE_PROCESS = "imageControlNetPreProcess",
  PROMPT_ENHANCE = "promptEnhance",
  AUTHENTICATION = "authentication",
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
}

export interface ITextToImage extends IImage {
  positivePrompt?: string;
  negativePrompt?: string;
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
  preProcessor: EPreProcessor;
  height?: number;
  width?: number;
  outputType?: IOutputType;
  outputFormat?: IOutputFormat;
  highThresholdCanny?: number;
  lowThresholdCanny?: number;
  includeHandsAndFaceOpenPose?: boolean;
  includeCost?: boolean;
  customTaskUUID?: string;
  retry?: number;
};

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

export interface IRequestImage {
  outputType?: IOutputType;
  outputFormat?: IOutputFormat;
  uploadEndpoint?: string;
  checkNsfw?: boolean;
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
  CFGScale?: number;
  clipSkip?: number;
  usePromptWeighting?: boolean;
  numberResults?: number; // default to 1
  controlNet?: IControlNet[];
  lora?: ILora[];
  includeCost?: boolean;
  customTaskUUID?: string;

  // imageSize?: number;
  onPartialImages?: (images: IImage[], error?: IError) => void;
  retry?: number;
  // gScale?: number;
}
export interface IRequestImageToText {
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
  rgba?: number[];
  postProcessMask?: boolean;
  returnOnlyMask?: boolean;
  alphaMatting?: boolean;
  alphaMattingForegroundThreshold?: number;
  alphaMattingBackgroundThreshold?: number;
  alphaMattingErodeSize?: number;
  includeCost?: boolean;
  retry?: number;
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

export interface IPromptEnhancer {
  promptMaxLength?: number;
  promptVersions?: number;
  prompt: string;
  includeCost?: boolean;
  customTaskUUID?: string;
  retry?: number;
}

export interface IEnhancedPrompt extends IImageToText {}

export interface IUpscaleGan {
  inputImage: File | string;
  upscaleFactor: number;
  outputType?: IOutputType;
  outputFormat?: IOutputFormat;
  includeCost?: boolean;
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
