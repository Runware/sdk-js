import {
  EPreProcessor,
  EPreProcessorGroup,
  Environment,
  GetWithPromiseCallBackType,
  IRequestImage,
} from "./types";

const TIMEOUT_DURATION = 30000; // 30s;
const POLLING_INTERVAL = 1000; // 1s;

export const ENVIRONMENT_URLS = {
  [Environment.DEVELOPMENT]: "wss://dev-ws-api.diffusionmaster.com/v1/",
  [Environment.PRODUCTION]: "wss://ws-api.diffusionmaster.com/v1/",
};

export const removeFromAray = <T>(col: T[], targetElem: T) => {
  if (col == null) {
    return;
  }
  let i = col.indexOf(targetElem);
  if (i === -1) {
    return;
  }
  col.splice(i, 1);
};

export const getIntervalWithPromise = (
  callback: GetWithPromiseCallBackType,
  { debugKey = "debugKey" }: { debugKey?: string }
) => {
  return new Promise((resolve, reject) => {
    let intervalId = setInterval(async () => {
      const shouldClear = await callback({ resolve });

      if (shouldClear) {
        clearInterval(intervalId);
        intervalId = 0;
      }
      // resolve(imagesWithSimilarTask); // Resolve the promise with the data
    }, POLLING_INTERVAL); // Check every 1 second (adjust the interval as needed)

    const timeoutId = setTimeout(() => {
      if (intervalId) {
        clearInterval(intervalId);
        reject(`Message could not be received for ${debugKey}`);
        console.error("Message could not be received for ", debugKey);
      }
      clearTimeout(timeoutId);
      // reject();
    }, TIMEOUT_DURATION);
  });
};

export const fileToBase64 = (file: File) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function () {
      resolve(reader.result);
    };
  });

export const getUUID = () => crypto.randomUUID();

export const getTaskType = ({
  prompt,
  controlNet,
  imageMaskInitiator,
  imageInitiator,
}: Pick<
  IRequestImage,
  "controlNet" | "imageInitiator" | "imageMaskInitiator"
> & { prompt: string }) => {
  // + prompt, - controlnet, - imagemask, - imageinitatior => 1
  // let taskType = 1;
  if (
    evaluateToBoolean(prompt, !controlNet, !imageMaskInitiator, !imageInitiator)
  ) {
    return 1;
  }
  // + prompt, - controlnet, - imagemask, + imageinitiator => 2
  if (
    evaluateToBoolean(prompt, !controlNet, !imageMaskInitiator, imageInitiator)
  ) {
    return 2;
  }
  // + prompt, - controlnet, + imagemask, + imageinitiator => 3
  if (
    evaluateToBoolean(prompt, !controlNet, imageMaskInitiator, imageInitiator)
  ) {
    return 3;
  }
  // + prompt, + controlnet, - imagemask, - imageinitiator => 9
  if (
    evaluateToBoolean(prompt, controlNet, !imageMaskInitiator, !imageInitiator)
  ) {
    return 9;
  }
  // + prompt, + controlnet, - imagemask, + imageinitiator => 10
  if (
    evaluateToBoolean(prompt, controlNet, !imageMaskInitiator, imageInitiator)
  ) {
    return 10;
  }
  // + prompt, + controlnet, + imagemask, + imageinitiator => 11
  if (
    evaluateToBoolean(prompt, controlNet, imageMaskInitiator, imageInitiator)
  ) {
    return 10;
  }
};

const evaluateToBoolean = (...args: any) => [...args].every((e) => !!e);

export const compact = (value: any, data: any) => (!!value ? data : {});

export const getPreprocessorType = (
  processor: EPreProcessor
): EPreProcessorGroup => {
  const processorGroup = Object.keys(
    EPreProcessorGroup
  ) as EPreProcessorGroup[];

  switch (processor) {
    case EPreProcessor.canny:
      return EPreProcessorGroup.canny;
    // break
    case EPreProcessor.depth_leres:
    case EPreProcessor.depth_midas:
    case EPreProcessor.depth_zoe:
      return EPreProcessorGroup.depth;
    // break
    case EPreProcessor.inpaint_global_harmonious:
      return EPreProcessorGroup.depth;
    // break
    case EPreProcessor.lineart_anime:
      return EPreProcessorGroup.lineart_anime;
    // break
    case EPreProcessor.lineart_coarse:
    case EPreProcessor.lineart_realistic:
    case EPreProcessor.lineart_standard:
      return EPreProcessorGroup.lineart;
    // break
    case EPreProcessor.mlsd:
      return EPreProcessorGroup.mlsd;
    // break
    case EPreProcessor.normal_bae:
      return EPreProcessorGroup.normalbae;
    // break
    case EPreProcessor.openpose_face:
    case EPreProcessor.openpose_faceonly:
    case EPreProcessor.openpose_full:
    case EPreProcessor.openpose_hand:
    case EPreProcessor.openpose:
      return EPreProcessorGroup.openpose;
    // break
    case EPreProcessor.scribble_hed:
    case EPreProcessor.scribble_pidinet:
      return EPreProcessorGroup.scribble;
    // break
    case EPreProcessor.seg_ofade20k:
    case EPreProcessor.seg_ofcoco:
    case EPreProcessor.seg_ufade20k:
      return EPreProcessorGroup.seg;
    // break
    case EPreProcessor.shuffle:
      return EPreProcessorGroup.shuffle;
    // break
    case EPreProcessor.softedge_hed:
    case EPreProcessor.softedge_hedsafe:
    case EPreProcessor.softedge_pidinet:
    case EPreProcessor.softedge_pidisafe:
      return EPreProcessorGroup.softedge;
    // break
    case EPreProcessor.tile_gaussian:
      return EPreProcessorGroup.tile;
    // break
    default:
      return EPreProcessorGroup.canny;
  }
};

export const accessDeepObject = ({
  key,
  data,
  useZero = true,
  shouldReturnString = false,
}: {
  key: string;
  data: Record<string, any>;
  useZero?: boolean;
  shouldReturnString?: boolean;
}) => {
  const value = key.split(".").reduce((acc, curr) => {
    const returnZero = useZero ? 0 : "N/A";
    return acc[curr] ?? returnZero;
  }, data || {});

  // if (typeof value === "object" && shouldReturnString) {
  //   return JSON.stringify(value);
  // }
  return value ?? {};
};
