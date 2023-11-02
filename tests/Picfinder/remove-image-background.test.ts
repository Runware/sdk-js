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

describe("When user request to remove image background", async () => {
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

  test("it should remove an image background", async () => {
    const imageUploadSpy = vi.spyOn(picfinder as any, "uploadImage");
    const globalListenerSpy = vi.spyOn(picfinder, "globalListener");
    const sendSpy = vi.spyOn(picfinder as any, "send");

    await picfinder.removeImageBackground({ imageInitiator: mockUploadFile });

    expect(imageUploadSpy).toHaveBeenCalled();

    expect(sendSpy).toHaveBeenCalledWith({
      newRemoveBackground: {
        imageUUID: testExamples.imageUploadRes.newImageUUID,
        taskUUID: mockTaskUUID,
        taskType: 8,
      },
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      responseKey: "newRemoveBackground",
      taskKey: "newRemoveBackground.images",
      taskUUID: mockTaskUUID,
    });
  });
});
