import {
  expect,
  test,
  vi,
  describe,
  afterEach,
  beforeEach,
  beforeAll,
} from "vitest";
import { startMockServer } from "../mockServer";
import { ETaskType, IRequestVideo } from "../../Runware";
import { testExamples } from "../test-utils";

vi.mock("../../Runware/utils", async () => {
  const actual = await vi.importActual("../../Runware/utils");
  return {
    ...(actual as any),
    getIntervalAsyncWithPromise: vi.fn(),
  };
});

describe("when user requests audio to video", async () => {
  const { mockServer, runware } = await startMockServer();

  vi.spyOn(runware as any, "getResponse").mockResolvedValue([]);

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockServer.stop();
  });

  beforeAll(async () => {
    vi.spyOn(runware as any, "uploadMedia").mockReturnValue(
      testExamples.mediaUploadRes
    );
  });

  test("it should upload audio and include the audioUUID in the request", async () => {
    const uploadMediaSpy = vi.spyOn(runware as any, "uploadMedia");
    const baseSingleRequestSpy = vi.spyOn(
      runware as any,
      "baseSingleRequest"
    );

    const mockAudioFile = new File(["dummy audio"], "test.mp3", {
      type: "audio/mp3",
    });

    const payload: IRequestVideo = {
      model: "audio-to-video-model",
      positivePrompt: "a dancing robot",
      inputAudio: mockAudioFile,
    };

    baseSingleRequestSpy.mockResolvedValue({
      taskUUID: "main-video-task-uuid",
    });

    await runware.videoInference(payload);

    expect(uploadMediaSpy).toHaveBeenCalledWith(mockAudioFile);

    expect(baseSingleRequestSpy).toHaveBeenCalledWith({
      payload: {
        model: "audio-to-video-model",
        positivePrompt: "a dancing robot",
        inputAudio: testExamples.mediaUploadRes.mediaUUID,
        deliveryMethod: "async",
        taskType: ETaskType.VIDEO_INFERENCE,
      },
      debugKey: "video-inference",
    });
  });

  test("should proceed without an audioUUID if no audio is provided", async () => {
    const uploadMediaSpy = vi.spyOn(runware as any, "uploadMedia");
    const baseSingleRequestSpy = vi.spyOn(
      runware as any,
      "baseSingleRequest"
    );

    const payload: IRequestVideo = {
      model: "audio-to-video-model",
      positivePrompt: "a silent dancing robot",
    };

    baseSingleRequestSpy.mockResolvedValue({
      taskUUID: "main-video-task-uuid",
    });

    await runware.videoInference(payload);

    expect(uploadMediaSpy).not.toHaveBeenCalled();

    expect(baseSingleRequestSpy).toHaveBeenCalledWith({
      payload: {
        model: "audio-to-video-model",
        positivePrompt: "a silent dancing robot",
        deliveryMethod: "async",
        taskType: ETaskType.VIDEO_INFERENCE,
      },
      debugKey: "video-inference",
    });
  });
});