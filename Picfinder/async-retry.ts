import { delay } from "./utils";

export const asyncRetry = async (
  apiCall: Function,
  options: { maxRetries?: number; delayInSeconds?: number } = {}
) => {
  const { delayInSeconds = 1 } = options;
  let maxRetries = options.maxRetries ?? 1;
  while (maxRetries) {
    try {
      const result = await apiCall();
      return result; // Return the result if successful
    } catch (error: any) {
      maxRetries--;
      if (maxRetries > -1) {
        await delay(delayInSeconds); // Delay before the next retry
        await asyncRetry(apiCall, { ...options, maxRetries });
      } else {
        throw error; // Throw the error if max retries are reached
      }
    }
  }
};
