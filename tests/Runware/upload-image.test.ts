import { expect, test, vi, describe, afterEach, beforeEach } from "vitest";
import {
  getIntervalWithPromise,
  fileToBase64,
  MockFile,
} from "../../Runware/utils";
import {
  mockFileToBase64,
  mockTaskUUID,
  mockTextImageUpload,
  mockUploadFile,
} from "../test-utils";
import { startMockServer } from "../mockServer";

vi.mock("../../Runware/utils", async () => {
  const actual = await vi.importActual("../../Runware/utils");
  return {
    ...(actual as any),
    fileToBase64: vi.fn().mockReturnValue("FILE_TO_BASE_64"),
    getIntervalWithPromise: vi.fn(),
    getUUID: vi.fn().mockReturnValue("UNIQUE_UID"),
  };
});

describe("When user uploads an image:", async () => {
  const { mockServer, runware } = await startMockServer();

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockServer.stop();
  });

  test("it should accept string during image upload", async () => {
    const sendSpy = vi.spyOn(runware as any, "send");
    await runware["uploadImage"]("IMAGE_UPLOAD");
    expect(fileToBase64).to.not.toHaveBeenCalled();
    expect(sendSpy).toBeCalledTimes(1);
  });

  test("it should accept file during image upload", async () => {
    const sendSpy = vi.spyOn(runware as any, "send");
    await runware["uploadImage"](mockUploadFile);

    expect(fileToBase64).toHaveBeenCalled();
    expect(sendSpy).toBeCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({
      newImageUpload: {
        imageBase64: mockFileToBase64,
        taskUUID: mockTaskUUID,
        taskType: 7,
      },
    });
  });

  test("it should upload image successfully", async () => {
    const sendSpy = vi.spyOn(runware as any, "send");
    const globalListenerSpy = vi.spyOn(runware, "globalListener");
    await runware["uploadImage"](mockTextImageUpload);

    expect(fileToBase64).to.not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith({
      newImageUpload: {
        imageBase64: mockTextImageUpload,
        taskUUID: mockTaskUUID,
        taskType: 7,
      },
    });

    expect(globalListenerSpy).toHaveBeenCalledWith({
      responseKey: "newUploadedImageUUID",
      taskKey: "newUploadedImageUUID",
      taskUUID: mockTaskUUID,
    });
    expect(getIntervalWithPromise).toHaveBeenCalledTimes(1);
  });
});
