export enum Environment {
  PRODUCTION = "PRODUCTION",
  DEVELOPMENT = "DEVELOPMENT",
}

export interface IImage {
  imageSrc: string;
  imageUUID: string;
  taskUUID: string;
  bNSFWContent: boolean;
}

interface ILora {
  loraCivitaiAIR: string;
  weight: number;
}

interface IControlNet {
  preprocessor: string;
  weight: number;
  startStep: number;
  endStep: number;
  guideImageUUID: string;
}

export interface IRequestImage {
  positivePrompt: string;
  imageSize: number;
  modelId: number;
  numberOfImages?: number; // default to 1
  negativePrompt?: string;
  useCache?: boolean;
  lora?: ILora[];
  controlnet?: IControlNet;
}
