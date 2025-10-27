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
import { ETaskType } from "../../Runware";

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
    const globalListenerSpy = vi.spyOn(runware as any, "globalListener");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.requestImageToText({ inputImage: mockUploadFile });

    expect(imageUploadSpy).toHaveBeenCalled();

    expect(sendSpy).toHaveBeenCalledWith({
      inputImage: testExamples.imageUploadRes.imageUUID,
      taskUUID: mockTaskUUID,
      taskType: ETaskType.IMAGE_CAPTION,
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      taskUUID: mockTaskUUID,
    });
  });

  test("caption delegates to requestImageToText", async () => {
    const result = await runware.caption({ inputImage: mockUploadFile });
    expect(result).toEqual(await runware.requestImageToText({ inputImage: mockUploadFile }));
  });
});
