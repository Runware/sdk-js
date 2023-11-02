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

describe("When user request image to text", async () => {
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

  test("it should get a text conversion", async () => {
    const imageUploadSpy = vi.spyOn(picfinder as any, "uploadImage");
    const globalListenerSpy = vi.spyOn(picfinder, "globalListener");
    const sendSpy = vi.spyOn(picfinder as any, "send");

    await picfinder.requestImageToText({ imageInitiator: mockUploadFile });

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
