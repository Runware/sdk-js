import {
  expect,
  test,
  beforeAll,
  vi,
  describe,
  afterEach,
  beforeEach,
} from "vitest";
import { getTaskType } from "../../Picfinder/utils";
import { mockTextImageUpload, testExamples } from "./../test-utils";
import { startMockServer } from "../mockServer";
import { EControlMode } from "../../Picfinder";

vi.mock("../../Picfinder/utils", async () => {
  const actual = await vi.importActual("../../Picfinder/utils");
  return {
    ...(actual as any),
    fileToBase64: vi.fn().mockReturnValue("FILE_TO_BASE_64"),
    getIntervalWithPromise: vi.fn(),
    getUUID: vi.fn().mockImplementation(() => "UNIQUE_UID"),
  };
});

describe("When user request an image", async () => {
  const { mockServer, picfinder } = await startMockServer();

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockServer.stop();
  });

  beforeAll(async () => {
    vi.spyOn(picfinder as any, "uploadImage").mockReturnValue(
      testExamples.imageUploadRes
    );
  });

  test("it should request image without an image initiator", async () => {
    const imageUploadSpy = vi.spyOn(picfinder as any, "uploadImage");
    const sendSpy = vi.spyOn(picfinder as any, "send");
    const uploadUnprocessedImageSpy = vi.spyOn(
      picfinder as any,
      "uploadUnprocessedImage"
    );

    await picfinder.requestImages(testExamples.imageReq);

    expect(imageUploadSpy).not.toHaveBeenCalled();
    expect(uploadUnprocessedImageSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith({
      newTask: testExamples.imageRes,
    });
  });

  test("it should request image with an image initiator", async () => {
    const imageUploadSpy = vi.spyOn(picfinder as any, "uploadImage");
    const sendSpy = vi.spyOn(picfinder as any, "send");
    const uploadUnprocessedImageSpy = vi.spyOn(
      picfinder as any,
      "uploadUnprocessedImage"
    );

    await picfinder.requestImages({
      ...testExamples.imageReq,
      imageInitiator: mockTextImageUpload,
    });

    expect(imageUploadSpy).toHaveBeenCalled();
    expect(imageUploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadUnprocessedImageSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith({
      newTask: {
        ...testExamples.imageRes,
        imageInitiatorUUID: testExamples.imageUploadRes.newImageUUID,
        taskType: getTaskType({
          prompt: testExamples.imageReq.positivePrompt,
          imageInitiator: mockTextImageUpload,
        }),
      },
    });
  });

  test("it should request image with an image initiator and image mask initiator", async () => {
    const imageUploadSpy = vi.spyOn(picfinder as any, "uploadImage");
    const sendSpy = vi.spyOn(picfinder as any, "send");
    const uploadUnprocessedImageSpy = vi.spyOn(
      picfinder as any,
      "uploadUnprocessedImage"
    );

    await picfinder.requestImages({
      ...testExamples.imageReq,
      imageInitiator: mockTextImageUpload,
      imageMaskInitiator: mockTextImageUpload,
    });

    expect(imageUploadSpy).toHaveBeenCalledTimes(2);
    expect(uploadUnprocessedImageSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith({
      newTask: {
        ...testExamples.imageRes,
        imageInitiatorUUID: testExamples.imageUploadRes.newImageUUID,
        imageMaskInitiatorUUID: testExamples.imageUploadRes.newImageUUID,
        taskType: getTaskType({
          prompt: testExamples.imageReq.positivePrompt,
          imageInitiator: mockTextImageUpload,
          imageMaskInitiator: mockTextImageUpload,
        }),
      },
    });
  });

  test("it should request image with an image initiator and image mask initiator and control net", async () => {
    const imageUploadSpy = vi.spyOn(picfinder as any, "uploadImage");
    const sendSpy = vi.spyOn(picfinder as any, "send");

    await picfinder.requestImages({
      ...testExamples.imageReq,
      imageInitiator: mockTextImageUpload,
      imageMaskInitiator: mockTextImageUpload,
      controlNet: [{ ...testExamples.controlNet }],
    });

    expect(imageUploadSpy).toHaveBeenCalledTimes(3);
    expect(sendSpy).toHaveBeenCalledWith({
      newTask: {
        ...testExamples.imageRes,
        imageInitiatorUUID: testExamples.imageUploadRes.newImageUUID,
        imageMaskInitiatorUUID: testExamples.imageUploadRes.newImageUUID,
        controlNet: [
          {
            controlMode: EControlMode.CONTROL_NET,
            endStep: 20,
            guideImageUUID: "NEW_IMAGE_UID",
            highThresholdCanny: undefined,
            lowThresholdCanny: undefined,
            preprocessor: "canny",
            startStep: 0,
            weight: 1,
          },
        ],
        taskType: getTaskType({
          prompt: testExamples.imageReq.positivePrompt,
          imageInitiator: mockTextImageUpload,
          imageMaskInitiator: mockTextImageUpload,
          controlNet: [testExamples.controlNet],
        }),
      },
    });
  });
  test("it should request multiple images in parallel", async () => {
    const sendSpy = vi.spyOn(picfinder as any, "send");
    const listenToImages = vi.spyOn(picfinder as any, "listenToImages");

    await Promise.all([
      picfinder.requestImages({
        ...testExamples.imageReq,
      }),
      picfinder.requestImages({
        ...testExamples.imageReq,
        positivePrompt: "cat",
      }),
    ]);

    expect(sendSpy).toHaveBeenCalledTimes(2);

    expect(sendSpy).toHaveBeenCalledWith({
      newTask: {
        ...testExamples.imageRes,
        taskType: getTaskType({
          prompt: testExamples.imageReq.positivePrompt,
        }),
      },
    });
    expect(sendSpy).toHaveBeenCalledWith({
      newTask: {
        ...testExamples.imageRes,
        promptText: "cat",
        taskType: getTaskType({
          prompt: "cat",
        }),
      },
    });

    expect(listenToImages).toHaveBeenCalledTimes(2);
  });
});
