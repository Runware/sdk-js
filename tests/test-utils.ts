import { EControlMode, ETaskType } from "../Runware";
import { MockFile } from "../Runware/utils";

const promptText = "A beautiful runware";

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
    numberResults: 8,
    positivePrompt: promptText,
    model: 13,
    steps: 30,
    width: 512,
    height: 512,
  },
  imageRes: {
    model: 13,
    numberResults: 8,
    positivePrompt: promptText,
    steps: 30,
    taskType: ETaskType.IMAGE_INFERENCE,
    taskUUID: mockTaskUUID,
    width: 512,
    height: 512,
  },
  imageUploadRes: {
    imageUUID: mockNewImageUID,
    imageURL: "data:image/png;base64,iVBORw0KGgoAAAA...",
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
