import { expect, test, describe, vi } from "vitest";
import { asyncRetry } from "../../Runware/async-retry";

describe("asyncRetry - bug tests (these fail due to loop+recursion bug)", () => {
  test("should properly return result from recursive call", async () => {
    let callCount = 0;
    const apiCall = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("Failed");
      }
      return "success";
    });

    // This should succeed on the 3rd attempt
    const result = await asyncRetry(apiCall, { maxRetries: 3 });

    expect(result).toBe("success");
    expect(apiCall).toHaveBeenCalledTimes(3);
  });

  test("should not continue loop after successful recursive call", async () => {
    let callCount = 0;
    const apiCall = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("First attempt fails");
      }
      return `success on attempt ${callCount}`;
    });

    // With maxRetries=2, should succeed on 2nd attempt
    const result = await asyncRetry(apiCall, { maxRetries: 2 });

    expect(result).toBe("success on attempt 2");
    expect(apiCall).toHaveBeenCalledTimes(2);
  });
});

