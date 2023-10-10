import { expect, test, beforeAll, vi, describe, afterEach } from "vitest";
import { Picfinder } from "../Picfinder";
import {
  getIntervalWithPromise,
  fileToBase64,
  delay,
  MockFile,
} from "../utils";
import { Server } from "mock-socket";

vi.mock("../utils", async () => {
  const actual = await vi.importActual("../utils");

  return {
    ...(actual as any),
    fileToBase64: vi.fn(),
    getIntervalWithPromise: vi.fn(),
    getUUID: vi.fn(),
  };
});

describe("Picfinder", async () => {
  const mockServer = new Server("ws://localhost:8080");

  mockServer.on("connection", (socket) => {
    socket.on("message", (data) => {
      //   socket.send("test message from mock server");
    });
  });

  beforeAll(async () => {});

  afterEach(() => {
    vi.resetAllMocks();
    mockServer.stop();
  });

  const picfinder = new Picfinder("TEST", "API_KEY");
  await delay(1);

  test("Should accept string during image upload", async () => {
    const sendSpy = vi.spyOn(picfinder as any, "send");
    await picfinder["uploadImage"]("IMAGE_UPLOAD");
    expect(fileToBase64).to.not.toHaveBeenCalled();
    expect(sendSpy).toBeCalledTimes(1);
  });

  test("Should accept file during image upload", async () => {
    var file = new MockFile().create("pic.jpg", 1024 * 1024 * 2, "image/jpeg");
    const sendSpy = vi.spyOn(picfinder as any, "send");
    await picfinder["uploadImage"](file);

    expect(fileToBase64).toHaveBeenCalled();
    expect(sendSpy).toBeCalledTimes(1);
  });

  test("Should upload image successfully", async () => {
    const sendSpy = vi.spyOn(picfinder as any, "send");
    const globalListenerSpy = vi.spyOn(picfinder, "globalListener");
    await picfinder["uploadImage"]("IMAGE_UPLOAD");

    expect(fileToBase64).to.not.toHaveBeenCalled();
    expect(sendSpy).toBeCalledTimes(1);
    expect(globalListenerSpy).toHaveBeenCalledWith({
      responseKey: "newUploadedImageUUID",
      taskKey: "newUploadedImageUUID",
    });
    expect(getIntervalWithPromise).toHaveBeenCalledTimes(1);
  });
});
