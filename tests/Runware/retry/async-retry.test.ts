import { describe, test, expect, vi } from "vitest";
import { asyncRetry } from "../../../Runware/async-retry";

describe("asyncRetry — missing return fix (Bug 3)", () => {
  test("SUCCESS: retries once on transient failure and returns result", async () => {
    const apiCall = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("recovered");

    const result = await asyncRetry(apiCall, {
      maxRetries: 3,
      delayInSeconds: 0.001,
    });

    expect(result).toBe("recovered");
    expect(apiCall).toHaveBeenCalledTimes(2);
  });

  test("FAILURE: throws after all retries exhausted", async () => {
    const apiCall = vi.fn().mockRejectedValue(new Error("persistent"));

    await expect(
      asyncRetry(apiCall, { maxRetries: 2, delayInSeconds: 0.001 }),
    ).rejects.toThrow("persistent");
    // 1 initial + 1 retry = 2 calls total
    expect(apiCall).toHaveBeenCalledTimes(2);
  });

  test("FAILURE: API error with .error property throws immediately without retry", async () => {
    const apiError = {
      error: { code: "conflictTaskUUID", message: "conflict" },
    };
    const apiCall = vi.fn().mockRejectedValue(apiError);

    await expect(
      asyncRetry(apiCall, { maxRetries: 3, delayInSeconds: 0.001 }),
    ).rejects.toEqual(apiError);
    expect(apiCall).toHaveBeenCalledTimes(1);
  });

  test("REGRESSION: apiCall is NOT called a 3rd time after retry succeeds (the fix)", async () => {
    let callCount = 0;
    const apiCall = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("transient failure");
      }
      return "success";
    });

    const result = await asyncRetry(apiCall, {
      maxRetries: 3,
      delayInSeconds: 0.001,
    });

    expect(result).toBe("success");
    // With fix:    exactly 2 calls (fail + retry success)
    // Without fix: 3 calls (fail + retry success + duplicate from while loop)
    expect(apiCall).toHaveBeenCalledTimes(2);
  });

  test("REGRESSION: customer scenario — timeout + retry produces exactly 2 sends, not 3", async () => {
    const sendLog: string[] = [];
    let attempt = 0;

    const apiCall = vi.fn().mockImplementation(async () => {
      attempt++;
      sendLog.push(`attempt-${attempt}`);
      if (attempt === 1) {
        throw new Error(
          "Response could not be received from server for getting images",
        );
      }
      return [{ taskUUID: "9258b951", status: "success" }];
    });

    const callback = vi.fn();

    const result = await asyncRetry(apiCall, {
      maxRetries: 2,
      delayInSeconds: 0.001,
      callback,
    });

    expect(sendLog).toEqual(["attempt-1", "attempt-2"]);
    expect(apiCall).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(result[0].taskUUID).toBe("9258b951");
  });
});
