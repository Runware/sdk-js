import { delay } from "./utils";
import type { RunwareLogger } from "./logger";

export const asyncRetry = async (
  apiCall: Function,
  options: {
    maxRetries?: number;
    delayInSeconds?: number;
    callback?: Function;
    logger?: RunwareLogger;
  } = {}
): Promise<any> => {
  const { delayInSeconds = 1, callback, logger } = options;
  let maxRetries = options.maxRetries ?? 1;
  const initialMaxRetries = maxRetries;

  // Fix: maxRetries=0 should execute apiCall once with no retries
  if (maxRetries <= 0) {
    return await apiCall();
  }

  while (maxRetries) {
    try {
      const result = await apiCall();
      if (maxRetries < initialMaxRetries) {
        logger?.retrySuccess(initialMaxRetries - maxRetries + 1);
      }
      return result; // Return the result if successful
    } catch (error: any) {
      // Fix: API errors (with .error property) throw immediately — no callback, no retry
      if (error?.error) {
        logger?.retrySkippedApiError(error.error?.code || "unknown");
        throw error;
      }

      // Only call callback for retryable errors (network/timeout)
      callback?.();

      maxRetries--;
      if (maxRetries > 0) {
        logger?.retryAttempt(initialMaxRetries - maxRetries, initialMaxRetries, delayInSeconds * 1000);
        await delay(delayInSeconds); // Delay before the next retry
        return await asyncRetry(apiCall, { ...options, maxRetries });
      } else {
        logger?.retryExhausted(initialMaxRetries);
        throw error; // Throw the error if max retries are reached
      }
    }
  }
};
