import { expect, test, vi, describe, afterEach, beforeEach } from "vitest";
import {
  getIntervalWithPromise,
  fileToBase64,
  MockFile,
} from "../../Picfinder/utils";
import {
  mockFileToBase64,
  mockTaskUUID,
  mockTextImageUpload,
  mockUploadFile,
} from "./../test-utils";
import { startMockServer } from "../mockServer";

vi.mock("../../Picfinder/utils", async () => {
  const actual = await vi.importActual("../../Picfinder/utils");
  return {
    ...(actual as any),
    fileToBase64: vi.fn().mockReturnValue("FILE_TO_BASE_64"),
    getIntervalWithPromise: vi.fn(),
    getUUID: vi.fn().mockReturnValue("UNIQUE_UID"),
  };
});

describe("When user uploads an image:", async () => {
  const { mockServer, picfinder } = await startMockServer();

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockServer.stop();
  });

  test("it should accept string during image upload", async () => {
    const sendSpy = vi.spyOn(picfinder as any, "send");
    await picfinder["uploadImage"]("IMAGE_UPLOAD");
    expect(fileToBase64).to.not.toHaveBeenCalled();
    expect(sendSpy).toBeCalledTimes(1);
  });

  test("it should accept file during image upload", async () => {
    const sendSpy = vi.spyOn(picfinder as any, "send");
    await picfinder["uploadImage"](mockUploadFile);

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
    const sendSpy = vi.spyOn(picfinder as any, "send");
    const globalListenerSpy = vi.spyOn(picfinder, "globalListener");
    await picfinder["uploadImage"](mockTextImageUpload);

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
