import {
  EPreProcessor,
  EPreProcessorGroup,
  Environment,
  GetWithPromiseAsyncCallBackType,
  GetWithPromiseCallBackType,
  IRequestImage,
} from "./types";
import { v4 as uuidv4, validate as validateUUID } from "uuid";

export const TIMEOUT_DURATION = 60000; // 120S;
export const MINIMUM_TIMEOUT_DURATION = 1000; // 120S;
const POLLING_INTERVAL = 100; // 1s;

export const BASE_RUNWARE_URLS = {
  [Environment.PRODUCTION]: "wss://ws-api.runware.ai/v1",
  [Environment.TEST]: "ws://localhost:8080",
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
  {
    debugKey = "debugKey",
    timeoutDuration = TIMEOUT_DURATION,
    shouldThrowError = true,
    pollingInterval = POLLING_INTERVAL,
  }: {
    debugKey?: string;
    timeoutDuration?: number;
    shouldThrowError?: boolean;
    pollingInterval?: number;
  }
) => {
  timeoutDuration =
    timeoutDuration < MINIMUM_TIMEOUT_DURATION
      ? MINIMUM_TIMEOUT_DURATION
      : timeoutDuration;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (intervalId) {
        clearInterval(intervalId);
        if (shouldThrowError) {
          reject(`Response could not be received from server for ${debugKey}`);
        }
      }
      clearTimeout(timeoutId);
      // reject();
    }, timeoutDuration);

    let intervalId = setInterval(async () => {
      const shouldClear = callback({ resolve, reject, intervalId });

      if (shouldClear) {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      }
      // resolve(imagesWithSimilarTask); // Resolve the promise with the data
    }, pollingInterval); // Check every 1 second (adjust the interval as needed)
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

// export const getUUID = () => crypto.randomUUID();
export const getUUID = () => uuidv4();

export const isValidUUID = (uuid: string) => validateUUID(uuid);

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
  const splittedKeys = key.split(/\.|\[/).map((key) => key.replace(/\]$/, ""));

  const value = splittedKeys.reduce((acc, curr) => {
    const returnZero = useZero ? 0 : undefined;
    const currentValue = acc?.[curr];

    if (!currentValue) {
      return returnZero;
    }
    if (Array.isArray(currentValue) && /^\d+$/.test(curr)) {
      const index = parseInt(curr, 10);
      if (index >= 0 && index < currentValue.length) {
        return (acc[curr] = currentValue[index]);
      } else {
        return acc[curr] ?? returnZero;
      }
    } else {
      return acc[curr] ?? returnZero;
    }
  }, data || {});

  // if (typeof value === "object" && shouldReturnString) {
  //   return JSON.stringify(value);
  // }
  return value ?? {};
};

export const delay = (time: number, milliseconds = 1000) => {
  return new Promise((resolve) => setTimeout(resolve, time * milliseconds));
};

export class MockFile {
  create = function (name: string, size: number, mimeType: string) {
    name = name || "mock.txt";
    size = size || 1024;
    mimeType = mimeType || "plain/txt";

    var blob: any = new Blob([range(size)], { type: mimeType });
    blob.lastModifiedDate = new Date();
    blob.name = name;

    return blob;
  };
}

function range(count: number) {
  var output = "";
  for (var i = 0; i < count; i++) {
    output += "a";
  }
  return output;
}

export const RETRY_SDK_COUNTS = {
  GLOBAL: 2,
  REQUEST_IMAGES: 2,
};

export const remove1Mutate = (col: any, targetElem: any) => {
  if (col == null) {
    return;
  }

  let i = col.indexOf(targetElem);
  if (i === -1) {
    return;
  }
  col.splice(i, 1);
};

export const removeListener = (listeners: any[], listener: any) => {
  return listeners.filter((lis) => lis.key !== listener.key);
};

export const removeAllKeyListener = ({
  listeners,
  key,
}: {
  listeners: any[];
  key: any;
}) => {
  return listeners.filter((lis) => lis?.key !== key);
};

export enum LISTEN_TO_IMAGES_KEY {
  REQUEST_IMAGES = "REQUEST_IMAGES",
  REQUEST_AUDIO = "REQUEST_AUDIO"
}

export const evaluateNonTrue = ({
  key,
  value,
}: {
  key: string;
  value: any;
}) => {
  if (!!value || value === 0 || value === false) {
    return { [key]: value };
  } else {
    return {};
  }
};

export const getRandomNumber = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
export const getRandomSeed = () => {
  return getRandomNumber(1, Number.MAX_SAFE_INTEGER);
};

export const getIntervalAsyncWithPromise = (
  callback: GetWithPromiseAsyncCallBackType,
  {
    debugKey = "debugKey",
    timeoutDuration = TIMEOUT_DURATION,
    shouldThrowError = true,
    pollingInterval = POLLING_INTERVAL,
  }: {
    debugKey?: string;
    timeoutDuration?: number;
    shouldThrowError?: boolean;
    pollingInterval?: number;
  }
) => {
  timeoutDuration =
    timeoutDuration < MINIMUM_TIMEOUT_DURATION
      ? MINIMUM_TIMEOUT_DURATION
      : timeoutDuration;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (intervalId) {
        clearInterval(intervalId);
        if (shouldThrowError) {
          reject(`Response could not be received from server for ${debugKey}`);
        }
      }
      clearTimeout(timeoutId);
    }, timeoutDuration);

    let intervalId = setInterval(async () => {
      try {
        const shouldClear = await callback({ resolve, reject, intervalId });
        if (shouldClear) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
        }
      } catch (error) {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        reject(error);
      }
    }, pollingInterval);
  });
};

export const isUrl = (value: any): value is string => {
  return (
    typeof value === "string" &&
    (value.startsWith("http:") ||
      value.startsWith("https:"))
  );
};