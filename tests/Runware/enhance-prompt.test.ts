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

describe("When user request to enhance prompt", async () => {
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

  test("it should give an enhanced prompt", async () => {
    const globalListenerSpy = vi.spyOn(runware, "globalListener");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.enhancePrompt({
      prompt: "Mock prompt",
      promptMaxLength: 200,
      promptVersions: 4,
    });

    expect(sendSpy).toHaveBeenCalledWith({
      prompt: "Mock prompt",
      taskUUID: mockTaskUUID,
      promptMaxLength: 200,
      promptVersions: 4,
      taskType: ETaskType.PROMPT_ENHANCE,
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      taskUUID: mockTaskUUID,
    });
  });

  test("it should give an enhanced prompt with default config", async () => {
    const globalListenerSpy = vi.spyOn(runware, "globalListener");
    const sendSpy = vi.spyOn(runware as any, "send");

    await runware.enhancePrompt({
      prompt: "Mock prompt",
    });

    expect(sendSpy).toHaveBeenCalledWith({
      prompt: "Mock prompt",
      taskUUID: mockTaskUUID,
      promptMaxLength: 380,
      promptVersions: 1,
      taskType: ETaskType.PROMPT_ENHANCE,
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      taskUUID: mockTaskUUID,
    });
  });
});
