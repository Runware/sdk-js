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

  test("it should upload audio and include the audioUUID in the request", async () => {
    const uploadMediaSpy = vi
      .spyOn(runware as any, "uploadMedia")
      .mockResolvedValue(testExamples.mediaStorageRes);
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
      inputAudios: [mockAudioFile],
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
        inputAudios: [testExamples.mediaStorageRes.mediaUUID],
        deliveryMethod: "async",
        taskType: ETaskType.VIDEO_INFERENCE,
      },
      debugKey: "video-inference",
    });
  });

  test("it should upload multiple audio files and include the audioUUIDs in the request", async () => {
    const uploadMediaSpy = vi.spyOn(runware as any, "uploadMedia");
    const baseSingleRequestSpy = vi.spyOn(
      runware as any,
      "baseSingleRequest"
    );

    const mockAudioFile1 = new File(["dummy audio 1"], "test1.mp3", {
      type: "audio/mp3",
    });
    const mockAudioFile2 = new File(["dummy audio 2"], "test2.mp3", {
      type: "audio/mp3",
    });

    const payload: IRequestVideo = {
      model: "audio-to-video-model",
      positivePrompt: "a dancing robot",
      inputAudios: [mockAudioFile1, mockAudioFile2],
    };

    baseSingleRequestSpy.mockResolvedValue({
      taskUUID: "main-video-task-uuid",
    });

    // Mock uploadMedia to return different UUIDs for different files
    uploadMediaSpy
      .mockResolvedValueOnce({
        ...testExamples.mediaStorageRes,
        mediaUUID: "uuid1",
      })
      .mockResolvedValueOnce({
        ...testExamples.mediaStorageRes,
        mediaUUID: "uuid2",
      });

    await runware.videoInference(payload);

    expect(uploadMediaSpy).toHaveBeenCalledWith(mockAudioFile1);
    expect(uploadMediaSpy).toHaveBeenCalledWith(mockAudioFile2);
    expect(uploadMediaSpy).toHaveBeenCalledTimes(2);

    expect(baseSingleRequestSpy).toHaveBeenCalledWith({
      payload: {
        model: "audio-to-video-model",
        positivePrompt: "a dancing robot",
        inputAudios: ["uuid1", "uuid2"],
        deliveryMethod: "async",
        taskType: ETaskType.VIDEO_INFERENCE,
      },
      debugKey: "video-inference",
    });
  });

  test("it should show a warning if an audio file is passed directly", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
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
      inputAudios: [mockAudioFile],
    };

    baseSingleRequestSpy.mockResolvedValue({
      taskUUID: "main-video-task-uuid",
    });

    await runware.videoInference(payload);

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
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