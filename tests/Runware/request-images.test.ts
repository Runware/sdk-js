import {
  expect,
  test,
  beforeAll,
  vi,
  describe,
  afterEach,
  beforeEach,
} from "vitest";
import { mockTextImageUpload, testExamples } from "../test-utils";
import { startMockServer } from "../mockServer";
import { EControlMode, ETaskType } from "../../Runware";

vi.mock("../../Runware/utils", async () => {
  const actual = await vi.importActual("../../Runware/utils");
  return {
    ...(actual as any),
    fileToBase64: vi.fn().mockReturnValue("FILE_TO_BASE_64"),
    getIntervalWithPromise: vi.fn(),
    getUUID: vi.fn().mockImplementation(() => "UNIQUE_UID"),
  };
});

describe("When user request an image", async () => {
  const { mockServer, runware } = await startMockServer();

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockServer.stop();
  });

  beforeAll(async () => {
    vi.spyOn(runware as any, "uploadImage").mockReturnValue(
      testExamples.imageUploadRes
    );
  });

  test("it should request image without an image initiator", async () => {
    const imageUploadSpy = vi.spyOn(runware as any, "uploadImage");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.requestImages(testExamples.imageReq);

    expect(imageUploadSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith({
      ...testExamples.imageRes,
    });
  });

  test("it should request image with an image initiator", async () => {
    const imageUploadSpy = vi.spyOn(runware as any, "uploadImage");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.requestImages({
      ...testExamples.imageReq,
      seedImage: mockTextImageUpload,
    });

    expect(imageUploadSpy).toHaveBeenCalled();
    expect(imageUploadSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({
      ...testExamples.imageRes,
      seedImage: testExamples.imageUploadRes.imageUUID,
      taskType: ETaskType.IMAGE_INFERENCE,
    });
  });

  test("it should request image with an image initiator and image mask initiator", async () => {
    const imageUploadSpy = vi.spyOn(runware as any, "uploadImage");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.requestImages({
      ...testExamples.imageReq,
      seedImage: mockTextImageUpload,
      maskImage: mockTextImageUpload,
    });

    expect(imageUploadSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy).toHaveBeenCalledWith({
      ...testExamples.imageRes,
      seedImage: testExamples.imageUploadRes.imageUUID,
      maskImage: testExamples.imageUploadRes.imageUUID,
      taskType: ETaskType.IMAGE_INFERENCE,
    });
  });

  test("it should request image with an image initiator and image mask initiator and control net", async () => {
    const imageUploadSpy = vi.spyOn(runware as any, "uploadImage");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.requestImages({
      ...testExamples.imageReq,
      seedImage: mockTextImageUpload,
      maskImage: mockTextImageUpload,
      controlNet: [{ ...testExamples.controlNet, model: "control_net_model" }],
    });

    expect(imageUploadSpy).toHaveBeenCalledTimes(3);
    expect(sendSpy).toHaveBeenCalledWith({
      ...testExamples.imageRes,
      seedImage: testExamples.imageUploadRes.imageUUID,
      maskImage: testExamples.imageUploadRes.imageUUID,
      controlNet: [
        {
          controlMode: EControlMode.CONTROL_NET,
          endStep: 20,
          guideImage: "NEW_IMAGE_UID",
          model: "control_net_model",
          startStep: 0,
          weight: 1,
        },
      ],
      taskType: ETaskType.IMAGE_INFERENCE,
    });
  });
  test("it should request multiple images in parallel", async () => {
    const sendSpy = vi.spyOn(runware as any, "send");
    const listenToResponse = vi.spyOn(runware as any, "listenToResponse");

    await Promise.all([
      runware.requestImages({
        ...testExamples.imageReq,
      }),
      runware.requestImages({
        ...testExamples.imageReq,
        positivePrompt: "cat",
      }),
    ]);

    expect(sendSpy).toHaveBeenCalledTimes(2);

    expect(sendSpy).toHaveBeenCalledWith({
      ...testExamples.imageRes,
      taskType: ETaskType.IMAGE_INFERENCE,
    });
    expect(sendSpy).toHaveBeenCalledWith({
      ...testExamples.imageRes,
      positivePrompt: "cat",
      taskType: ETaskType.IMAGE_INFERENCE,
    });

    expect(listenToResponse).toHaveBeenCalledTimes(2);
  });

  test("it should request providerSettings", async() => {
    const sendSpy = vi.spyOn(runware as any, "send");

    const providerSettings = {
      bfl: {
        promptUpsampling: true,
        safetyTolerance: 4,
        raw: true,
      },
    };

    await runware.requestImages({
      ...testExamples.imageReq,
      providerSettings
    });

    expect(sendSpy).toHaveBeenCalledWith({
      ...testExamples.imageRes,
      providerSettings
    });
  });

  test("imageInference delegates to requestImages", async () => {
    const result = await runware.imageInference(testExamples.imageReq);
    expect(result).toEqual(await runware.requestImages(testExamples.imageReq));
  });
});
