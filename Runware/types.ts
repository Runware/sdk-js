export enum Environment {
  PRODUCTION = "PRODUCTION",
  DEVELOPMENT = "DEVELOPMENT",
  TEST = "TEST",
}
export enum SdkType {
  CLIENT = "CLIENT",
  SERVER = "SERVER",
}

export type RunwareBaseType = {
  apiKey: string;
  url?: string;
};

export interface IImage {
  imageSrc: string;
  imageUUID: string;
  taskUUID: string;
  bNSFWContent: boolean;
  cost: number;
  imageBase64Data?: string;
}

interface ILora {
  modelId: string | number;
  weight: number;
}

export enum EControlMode {
  BALANCED = "balanced",
  PROMPT = "prompt",
  CONTROL_NET = "controlnet",
}

export type IControlNetGeneral = {
  preprocessor: keyof typeof EPreProcessor;
  weight: number;
  startStep: number;
  endStep: number;
  guideImage: string | File;
  guideImageUnprocessed: string | File;
  controlMode: EControlMode;
  returnBase64Image?: boolean;
};

export type IControlNetA = RequireOnlyOne<
  IControlNetGeneral,
  "guideImage" | "guideImageUnprocessed"
>;

export type IControlNetCanny = IControlNetA & {
  preprocessor: "canny";
  lowThresholdCanny: Number;
  highThresholdCanny: Number;
  returnBase64Image?: boolean;
};

export type IControlNetHandsAndFace = IControlNetA & {
  preprocessor: keyof typeof EOpenPosePreProcessor;
  includeHandsAndFaceOpenPose: boolean;
  returnBase64Image?: boolean;
};

export type IControlNet =
  | IControlNetCanny
  | IControlNetA
  | IControlNetHandsAndFace;

export type IControlNetWithUUID = Omit<IControlNet, "guideImage"> & {
  guideImageUUID: string;
};

export interface IError {
  error: boolean;
  errorMessage: string;
  taskUUID: string;
}

export interface IRequestImage {
  positivePrompt: string;
  imageSize: number;
  modelId: number | string;
  numberOfImages?: number; // default to 1
  negativePrompt?: string;
  useCache?: boolean;
  lora?: ILora[];
  controlNet?: IControlNet[];
  imageInitiator?: File | string;
  imageMaskInitiator?: File | string;
  steps?: number;
  onPartialImages?: (images: IImage[], error?: IError) => void;
  seed?: number;
  gScale?: number;
  checkNsfw?: boolean;
  returnBase64Image?: boolean;
  scheduler?: string;
  usePromptWeighting?: boolean;
}
export interface IRequestImageToText {
  imageInitiator?: File | string;
}
export interface IImageToText {
  taskUUID: string;
  text: string;
}

export interface IRemoveImageBackground extends IRequestImageToText {}
export interface IPromptEnhancer {
  promptMaxLength?: number;
  promptLanguageId?: number;
  promptVersions?: number;
  prompt: string;
}

export interface IEnhancedPrompt extends IImageToText {}

export interface IUpscaleGan {
  imageInitiator: File | string;
  upscaleFactor: number;
  isImageUUID?: boolean;
  returnBase64Image?: boolean;
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
  newImageUUID: string;
  newImageSrc: string;
  taskUUID: string;
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
