import { EControlMode } from "../Picfinder";
import { MockFile } from "../Picfinder/utils";

const promptText = "A beautiful picfinder";

export const mockTaskUUID = "UNIQUE_UID";
export const mockTextImageUpload = "IMAGE_UPLOAD";
export const mockFileToBase64 = "FILE_TO_BASE_64";
export const mockNewImageUID = "NEW_IMAGE_UID";

export const mockUploadFile = new MockFile().create(
  "pic.jpg",
  1024 * 1024 * 2,
  "image/jpeg"
);

export const testExamples = {
  imageReq: {
    numberOfImages: 8,
    positivePrompt: promptText,
    imageSize: 2,
    modelId: 13,
    steps: 30,
  },
  imageRes: {
    gScale: 7,
    modelId: 13,
    numberResults: 8,
    offset: 0,
    promptText: promptText,
    schedulerId: 22,
    sizeId: 2,
    steps: 30,
    taskType: 1,
    taskUUID: mockTaskUUID,
    useCache: false,
  },
  imageUploadRes: {
    newImageUUID: mockNewImageUID,
    imageBase64: "data:image/png;base64,iVBORw0KGgoAAAA...",
    taskUUID: "50836053-a0ee-4cf5-b9d6-ae7c5d140ada",
  },
  controlNet: {
    endStep: 20,
    startStep: 0,
    guideImage: mockTextImageUpload,
    preprocessor: "canny" as any,
    weight: 1,
    controlMode: EControlMode.CONTROL_NET,
  },
};
