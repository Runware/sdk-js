import {
  expect,
  test,
  beforeAll,
  vi,
  describe,
  afterEach,
  beforeEach,
} from "vitest";
import { mockTaskUUID, mockUploadFile, testExamples } from "../test-utils";
import { startMockServer } from "../mockServer";

vi.mock("../../Picfinder/utils", async () => {
  const actual = await vi.importActual("../../Picfinder/utils");
  return {
    ...(actual as any),
    fileToBase64: vi.fn().mockReturnValue("FILE_TO_BASE_64"),
    getIntervalWithPromise: vi.fn(),
    getUUID: vi.fn().mockImplementation(() => "UNIQUE_UID"),
  };
});

describe("When user request to upscale gan", async () => {
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

  test("it should upscale gan", async () => {
    const imageUploadSpy = vi.spyOn(picfinder as any, "uploadImage");
    const globalListenerSpy = vi.spyOn(picfinder, "globalListener");
    const sendSpy = vi.spyOn(picfinder as any, "send");

    await picfinder.upscaleGan({
      imageInitiator: mockUploadFile,
      upscaleFactor: 2,
    });

    expect(imageUploadSpy).toHaveBeenCalled();

    expect(sendSpy).toHaveBeenCalledWith({
      newUpscaleGan: {
        imageUUID: testExamples.imageUploadRes.newImageUUID,
        taskUUID: mockTaskUUID,
        upscaleFactor: 2,
      },
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      responseKey: "newUpscaleGan",
      taskKey: "newUpscaleGan.images",
    });
  });
});
