import { delay } from "./utils";

export const asyncRetry = async (
  apiCall: Function,
  options: {
    maxRetries?: number;
    delayInSeconds?: number;
    callback?: Function;
  } = {}
) => {
  const { delayInSeconds = 1, callback } = options;
  let maxRetries = options.maxRetries ?? 1;
  while (maxRetries) {
    try {
      const result = await apiCall();
      return result; // Return the result if successful
    } catch (error: any) {
      callback?.();
      maxRetries--;
      if (maxRetries > 0) {
        await delay(delayInSeconds); // Delay before the next retry
        await asyncRetry(apiCall, { ...options, maxRetries });
      } else {
        throw error; // Throw the error if max retries are reached
      }
    }
  }
};
