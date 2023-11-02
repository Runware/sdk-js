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

describe("When user request to enhance prompt", async () => {
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

  test("it should give an enhanced prompt", async () => {
    const globalListenerSpy = vi.spyOn(picfinder, "globalListener");
    const sendSpy = vi.spyOn(picfinder as any, "send");

    await picfinder.enhancePrompt({
      prompt: "Mock prompt",
      promptMaxLength: 200,
      promptVersions: 4,
      promptLanguageId: 2,
    });

    expect(sendSpy).toHaveBeenCalledWith({
      newPromptEnhance: {
        prompt: "Mock prompt",
        taskUUID: mockTaskUUID,
        promptMaxLength: 200,
        promptVersions: 4,
        promptLanguageId: 2,
      },
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      responseKey: "newPromptEnhancer",
      taskKey: "newPromptEnhancer.texts",
      taskUUID: mockTaskUUID,
    });
  });

  test("it should give an enhanced prompt with default config", async () => {
    const globalListenerSpy = vi.spyOn(picfinder, "globalListener");
    const sendSpy = vi.spyOn(picfinder as any, "send");

    await picfinder.enhancePrompt({
      prompt: "Mock prompt",
    });

    expect(sendSpy).toHaveBeenCalledWith({
      newPromptEnhance: {
        prompt: "Mock prompt",
        taskUUID: mockTaskUUID,
        promptMaxLength: 380,
        promptVersions: 1,
        promptLanguageId: 1,
      },
    });
    expect(globalListenerSpy).toHaveBeenCalledWith({
      responseKey: "newPromptEnhancer",
      taskKey: "newPromptEnhancer.texts",
      taskUUID: mockTaskUUID,
    });
  });
});
