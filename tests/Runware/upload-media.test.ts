import { expect, test, vi, describe, afterEach, beforeEach } from "vitest";
import { fileToBase64, isValidUUID } from "../../Runware/utils";
import { startMockServer } from "../mockServer";

vi.mock("../../Runware/utils", async () => {
  const actual = await vi.importActual("../../Runware/utils");
  return {
    ...(actual as any),
    fileToBase64: vi.fn().mockReturnValue("MOCK_AUDIO_BASE_64"),
    getUUID: vi.fn().mockReturnValue("UNIQUE_AUDIO_UID"),
    isValidUUID: vi.fn((str) => str === "valid-uuid"),
  };
});

describe("When user uploads media (e.g., audio):", async () => {
  const { mockServer, runware } = await startMockServer();

   // Mock the private getFileSize method before tests run
  const getFileSizeSpy = vi
    .spyOn(runware as any, "getFileSize")
    .mockResolvedValue(1000); // Mock a file size of 1000 bytes

  afterEach(() => {
    vi.clearAllMocks();
    // Restore the spy to its original implementation after each test
    getFileSizeSpy.mockResolvedValue(1000);
  });

  beforeEach(() => {
    mockServer.stop();
  });

  test("it should accept a valid UUID string and not call fileToBase64", async () => {
    await runware["uploadMedia"]("valid-uuid");
    expect(isValidUUID).toHaveBeenCalledWith("valid-uuid");
    expect(fileToBase64).not.toHaveBeenCalled();
  });

  test("it should accept a base64 string and not call fileToBase64", async () => {
    await runware["uploadMedia"]("some-base64-string");
    expect(isValidUUID).toHaveBeenCalledWith("some-base64-string");
    expect(fileToBase64).not.toHaveBeenCalled();
  });

  test("it should accept a File object and call fileToBase64", async () => {
    const mockAudioFile = new File(["dummy audio"], "test.mp3", {
      type: "audio/mp3",
    });
    await runware["uploadMedia"](mockAudioFile);
    expect(fileToBase64).toHaveBeenCalledWith(mockAudioFile);
  });
});