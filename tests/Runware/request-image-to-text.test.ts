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

vi.mock("../../Runware/utils", async () => {
  const actual = await vi.importActual("../../Runware/utils");
  return {
    ...(actual as any),
    fileToBase64: vi.fn().mockReturnValue("FILE_TO_BASE_64"),
    getIntervalWithPromise: vi.fn(),
    getUUID: vi.fn().mockImplementation(() => "UNIQUE_UID"),
  };
});

describe("When user request image to text", async () => {
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

  test("it should get a text conversion", async () => {
    const imageUploadSpy = vi.spyOn(runware as any, "uploadImage");
    const globalListenerSpy = vi.spyOn(runware, "globalListener");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.requestImageToText({ imageInitiator: mockUploadFile });

    expect(imageUploadSpy).toHaveBeenCalled();

    expect(sendSpy).toHaveBeenCalledWith({
      newReverseImageClip: {
        imageUUID: testExamples.imageUploadRes.newImageUUID,
        taskUUID: mockTaskUUID,
      },
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      responseKey: "newReverseClip",
      taskKey: "newReverseClip.texts",
      taskUUID: mockTaskUUID,
    });
  });
});
