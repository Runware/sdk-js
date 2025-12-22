# Runware Javascript & Typescript SDK

> This SDK is used to run AI image generation with the Runware API, powered by the RunWare inference platform. With this SDK you can generate images with text-to-image and image-to-image with sub-second inference times. It also allows the use of an existing library of more than 150k models, including any model or LoRA from the CivitAI gallery. The API also supports upscaling, background removal, inpainting, outpainting, ControlNets, and more. Visit the Runware site for [detailed feature breakdown](https://runware.ai/features/).

## Get API access

For an API Key and free trial credits, [create a free account](https://my.runware.ai/) with [Runware](https://runware.ai)

### NB: Please keep your API key private

## Installation

To install and set up the library, run:

```sh
$  npm  install  @runware/sdk-js
```

Or if you prefer using Yarn:

```sh
$  yarn  add  @runware/sdk-js
```

## Instantiating the SDK

### Instantiating Synchronously

```js
const runware = new Runware({ apiKey: "API_KEY" });
```

### Instantiating Asynchronously

```js
const runware = await Runware.initialize({ apiKey: "API_KEY" });
```

| Parameter        | Type                                         | Use                                                                                                                                                        |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url              | string                                       | Url to get images from (optional)                                                                                                                          |
| apiKey           | string                                       | The environment api key                                                                                                                                    |
| shouldReconnect  | boolean `(default = true)`                   | This handles reconnection when there is websocket inactivity                                                                                               |
| globalMaxRetries | number `(default = 2)`                       | The number of retries it should make before throwing an error `(NB: you can specify a retry parameters for every request that overrides the global retry)` |
| timeoutDuration  | number (in milliseconds) `(default = 60000)` | The timeout span per retry before timing out                                                                                                               |

## Methods

### Ensure connection is established before making request

```js
const runware = new RunwareServer({ apiKey: "API_KEY" });

await runware.ensureConnection();
```

### Manually disconnect

```js
const runware = new RunwareServer({ apiKey: "API_KEY" });

await runware.disconnect();
```

## API

### Request Image

[Read Documentation](https://docs.runware.ai/en/image-inference/api-reference)

NB: All errors can be caught in the catch block of each request

Legacy alias: `requestImages()`

```js
import { Runware } from "@runware/sdk-js";

const  runware  =  new  Runware({ apiKey: "API_KEY" });
const images = await runware.imageInference({
	positivePrompt: string;
	negativePrompt?: string;
	width: number;
	height: number;
	model: string;
	numberResults?: number;
	outputType?: "URL" | "base64Data" | "dataURI";
	outputFormat?: "JPG" | "PNG" | "WEBP";
	uploadEndpoint?: string;
	checkNSFW?: boolean
	seedImage?: File | string;
	maskImage?: File | string;
	strength?: number;
	steps?: number;
	scheduler?: string;
	seed?: number;
	CFGScale?: number;
	clipSkip?: number;
	refiner?: IRefiner;
	usePromptWeighting?: number;
	controlNet?: IControlNet[];
	lora?: ILora[];
  	retry?: number;
	ipAdapters?: IipAdapters[];
	providerSettings?: IProviderSettings;
	embeddings?: IEmbedding[];
	outpaint: IOutpaint;
	onPartialImages?: (images: IImage[], error: IError) =>  void;
})

return interface ITextToImage {
	taskType: ETaskType;
	imageUUID: string;
	inputImageUUID?: string;
	taskUUID: string;
	imageURL?: string;
	imageBase64Data?: string;
	imageDataURI?: string;
	NSFWContent?: boolean;
	cost: number;
	positivePrompt?: string;
  	negativePrompt?: string;
}[]
```

##### Parallel Requests (2 or more requests at the same time)

```js
const  runware  =  new Runware({ apiKey: "API_KEY" });

const [firstImagesRequest, secondImagesRequest] = await Promise.all([
	runware.imageInference({
		positivePrompt: string;
		width: number;
		height: number;
		numberResults: number;
		model: string;
		negativePrompt?: string;
		onPartialImages?: (images: IImage[], error: IError) =>  void;
	}),
	runware.imageInference({
		positivePrompt: string;
		width: number;
		height: number;
		numberResults: number;
		model: string;
		ipAdapters: [{
			model: string;
			weight: number;
			guideImage: string;
		}],
		embeddings: [{
			model: string;
			weight: number;
		}],
		outpaint: {
			top: 256,
			right: 128,
			bottom: 256,
			left: 128,
			blur: 16
		}
		onPartialImages?: (images: IImage[], error: IError) =>  void;
	})
])

console.log({firstImagesRequest, secondImagesRequest})

return interface ITextToImage {
	taskType: ETaskType;
	imageUUID: string;
	inputImageUUID?: string;
	taskUUID: string;
	imageURL?: string;
	imageBase64Data?: string;
	imageDataURI?: string;
	NSFWContent?: boolean;
	cost: number;
	positivePrompt?: string;
  	negativePrompt?: string;
}[]
```

| Parameter          | Type                                  | Use                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| positivePrompt     | string                                | Defines the positive prompt description of the image.                                                                                                                                                                                                                                 |
| negativePrompt     | string                                | Defines the negative prompt description of the image.                                                                                                                                                                                                                                 |
| width              | number                                | Controls the image width.                                                                                                                                                                                                                                                             |
| height             | number                                | Controls the image height.                                                                                                                                                                                                                                                            |
| model              | string                                | The AIR system ID of the image to be requested.                                                                                                                                                                                                                                       |
| numberResults      | number: `(Optional)` (default = 1)    | `(Optional)` The number of images to be generated.                                                                                                                                                                                                                                    |
| outputType         | IOutputType: `(Optional)`             | Specifies the output type in which the image is returned.                                                                                                                                                                                                                             |
| outputFormat       | IOutputFormat: `(Optional)`           | Specifies the format of the output image.                                                                                                                                                                                                                                             |
| uploadEndpoint     | string: `(Optional)`                  | This parameter allows you to specify a URL to which the generated image will be uploaded as binary image data using the HTTP PUT method. For example, an S3 bucket URL can be used as the upload endpoint.                                                                            |
| checkNSFW          | boolean: `(Optional)`                 | This parameter is used to enable or disable the NSFW check. When enabled, the API will check if the image contains NSFW (not safe for work) content. This check is done using a pre-trained model that detects adult content in images.                                               |
| seedImage          | string or File: `(Optional)`          | When doing Image-to-Image, Inpainting or Outpainting, this parameter is required.Specifies the seed image to be used for the diffusion process.                                                                                                                                       |
| maskImage          | string or File: `(Optional)`          | The image to be used as the mask image. It can be the UUID of previously generated image, or an image from a file.                                                                                                                                                                    |
| strength           | number: `(Optional)`                  | When doing Image-to-Image, Inpainting or Outpainting, this parameter is used to determine the influence of the seedImage image in the generated output. A higher value results in more influence from the original image, while a lower value allows more creative deviation.         |
| steps              | number: `(Optional)`                  | The number of steps is the number of iterations the model will perform to generate the image. The higher the number of steps, the more detailed the image will be.                                                                                                                    |
| scheduler          | string: `(Optional)`                  | An scheduler is a component that manages the inference process. Different schedulers can be used to achieve different results like more detailed images, faster inference, or more accurate results.                                                                                  |
| seed               | number: `(Optional)`                  | A seed is a value used to randomize the image generation. If you want to make images reproducible (generate the same image multiple times), you can use the same seed value.                                                                                                          |
| CFGScale           | number: `(Optional)`                  | Guidance scale represents how closely the images will resemble the prompt or how much freedom the AI model has. Higher values are closer to the prompt. Low values may reduce the quality of the results.                                                                             |
| clipSkip           | number: `(Optional)`                  | CLIP Skip is a feature that enables skipping layers of the CLIP embedding process, leading to quicker and more varied image generation.                                                                                                                                               |
| usePromptWeighting | boolean: `(Optional)`                 | Allow setting different weights per words or expressions in prompts.                                                                                                                                                                                                                  |
| clipSkip           | number: `(Optional)`                  | CLIP Skip is a feature that enables skipping layers of the CLIP embedding process, leading to quicker and more varied image generation.                                                                                                                                               |
| lora               | ILora[]: `(Optional)`                 | With LoRA (Low-Rank Adaptation), you can adapt a model to specific styles or features by emphasizing particular aspects of the data.                                                                                                                                                  |
| embeddings         | IEmbedding[]: `(Optional)`            | Embeddings (or Textual Inversion) can be used to add specific concepts or styles to your generations. Multiple embeddings can be used at the same time.                                                                                                                               |
| ipAdapters         | IipAdapter[]: `(Optional)`            | IP-Adapters enable image-prompted generation, allowing you to use reference images to guide the style and content of your generations. Multiple IP Adapters can be used simultaneously.                                                                                               |
| outpaint           | IOutpaint[]: `(Optional)`             | Extends the image boundaries in specified directions. When using outpainting, you must provide the final dimensions using width and height parameters, which should account for the original image size plus the total extension (seedImage dimensions + top + bottom, left + right). |
| controlNet         | IControlNet[]: `(Optional)`           | With ControlNet, you can provide a guide image to help the model generate images that align with the desired structure.                                                                                                                                                               |
| onPartialImages    | function: `(Optional)`                | If you want to receive the images as they are generated instead of waiting for the async request, you get the images as they are generated from this function.                                                                                                                        |
| includeCost        | boolean `(Optional)`                  | If set to true, the cost to perform the task will be included in the response object.                                                                                                                                                                                                 |
| retry              | number `(default = globalMaxRetries)` | The number of retries it should make before throwing an error.                                                                                                                                                                                                                        |

##### ControlNet Params

| Parameter           | Type                        | Use                                                                                                                                                                                                                                                                                                                               |
| ------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| model               | string                      | Defines the model to use for the control net.                                                                                                                                                                                                                                                                                     |
| guideImage          | file or string `(Optional)` | The image requires for the guide image. It can be the UUID of previously generated image, or an image from a file.                                                                                                                                                                                                                |
| weight              | number `(Optional)`         | an have values between 0 and 1 and represent the weight of the ControlNet preprocessor in the image.                                                                                                                                                                                                                              |
| startStep           | number `(Optional)`         | represents the moment in which the ControlNet preprocessor starts to control the inference. It can take values from 0 to the maximum number of `steps` in the image create request. This can also be replaced with `startStepPercentage` (float) which represents the same value but in percentages. It takes values from 0 to 1. |
| startStepPercentage | number `(Optional)`         | Represents the percentage of steps in which the ControlNet model starts to control the inference process.                                                                                                                                                                                                                         |
| endStep             | number `(Optional)`         | similar with `startStep` but represents the end of the preprocessor control of the image inference. The equivalent of the percentage option is `endStepPercentage` (float).                                                                                                                                                       |
| endStepPercentage   | number `(Optional)`         | Represents the percentage of steps in which the ControlNet model ends to control the inference process.                                                                                                                                                                                                                           |
| controlMode         | string `(Optional)`         | This parameter has 3 options: prompt, controlnet and balanced                                                                                                                                                                                                                                                                     |

&nbsp;

### Request Image To Text

[Read Documentation](https://docs.runware.ai/en/utilities/image-to-text)

Legacy alias: `requestImageToText()`

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const imageToText = await runware.caption({
	inputImage: string | File
})
console.log(imageToText)

return interface IImageToText {
  taskType: string;
  taskUUID: string;
  text: string;
  cost?: number;
}
```

| Parameter   | Type                                  | Use                                                                                                                |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| inputImage  | string or File                        | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file. |
| includeCost | boolean `(Optional)`                  | If set to true, the cost to perform the task will be included in the response object.                              |
| retry       | number `(default = globalMaxRetries)` | The number of retries it should make before throwing an error.                                                     |

&nbsp;

### Remove Image Background

[Read Documentation](https://docs.runware.ai/en/image-editing/background-removal)

Legacy alias: `removeImageBackground()`

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const image = await runware.removeBackground({
	inputImage: string | File
	outputType?: IOutputType;
	outputFormat?: IOutputFormat;
	rgba?: number[];
	postProcessMask?: boolean;
	returnOnlyMask?: boolean;
	alphaMatting?: boolean;
	alphaMattingForegroundThreshold?: number;
	alphaMattingBackgroundThreshold?: number;
	alphaMattingErodeSize?: number;
})
console.log(image)
return interface IImage {
	taskType: ETaskType;
	taskUUID: string;
	imageUUID: string;
	inputImageUUID: string;
	imageURL?: string;
	imageBase64Data?: string;
	imageDataURI?: string;
	cost: number;
}
```

| Parameter                       | Type                                  | Use                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| inputImage                      | string or File                        | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file.                                                                   |
| outputType                      | IOutputType: `(Optional)`             | Specifies the output type in which the image is returned.                                                                                                                            |
| outputFormat                    | IOutputFormat: `(Optional)`           | Specifies the format of the output image.                                                                                                                                            |
| includeCost                     | boolean `(Optional)`                  | If set to true, the cost to perform the task will be included in the response object.                                                                                                |
| rgba                            | number[] `(Optional)`                 | An array representing the [red, green, blue, alpha] values that define the color of the removed background. The alpha channel controls transparency.                                 |
| postProcessMask                 | boolean `(Optional)`                  | Flag indicating whether to post-process the mask. Controls whether the mask should undergo additional post-processing.                                                               |
| returnOnlyMask                  | boolean `(Optional)`                  | Flag indicating whether to return only the mask. The mask is the opposite of the image background removal.                                                                           |
| alphaMatting                    | boolean `(Optional)`                  | Flag indicating whether to use alpha matting. Alpha matting is a post-processing technique that enhances the quality of the output by refining the edges of the foreground object.   |
| alphaMattingForegroundThreshold | number `(Optional)`                   | Threshold value used in alpha matting to distinguish the foreground from the background. Adjusting this parameter affects the sharpness and accuracy of the foreground object edges. |
| alphaMattingBackgroundThreshold | number `(Optional)`                   | Threshold value used in alpha matting to refine the background areas. It influences how aggressively the algorithm removes the background while preserving image details.            |
| alphaMattingErodeSize           | number `(Optional)`                   | Specifies the size of the erosion operation used in alpha matting. Erosion helps in smoothing the edges of the foreground object for a cleaner removal of the background.            |
| retry                           | number `(default = globalMaxRetries)` | The number of retries it should make before throwing an error.                                                                                                                       |

&nbsp;

### Upscale Image

[Read Documentation](https://docs.runware.ai/en/image-editing/upscaling)

Legacy alias: `upscaleGan()`

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const image = await runware.upscale({
	inputImage: File | string;
	upscaleFactor: number;
	outputType?: IOutputType;
	outputFormat?: IOutputFormat;
	includeCost?: boolean
})
console.log(image)
return interface IImage {
	taskType: ETaskType;
	imageUUID: string;
	inputImageUUID?: string;
	taskUUID: string;
	imageURL?: string;
	imageBase64Data?: string;
	imageDataURI?: string;
	NSFWContent?: boolean;
	cost: number;
}

```

| Parameter     | Type                                  | Use                                                                                                                |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| inputImage    | string or File                        | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file. |
| upscaleFactor | number                                | The number of times to upscale;                                                                                    |
| outputType    | IOutputType: `(Optional)`             | Specifies the output type in which the image is returned.                                                          |
| outputFormat  | IOutputFormat: `(Optional)`           | Specifies the format of the output image.                                                                          |
| includeCost   | boolean `(Optional)`                  | If set to true, the cost to perform the task will be included in the response object.                              |
| retry         | number `(default = globalMaxRetries)` | The number of retries it should make before throwing an error.                                                     |

&nbsp;

### Enhance Prompt

[Read Documentation](https://docs.runware.ai/en/utilities/prompt-enhancer)

Legacy alias: `enhancePrompt()`

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const enhancedPrompt = await runware.promptEnhance({
	prompt: string;
	promptMaxLength?: number;
	promptVersions?: number;
	includeCost?: boolean;
})
console.log(enhancedPrompt)
return interface IEnhancedPrompt {
	taskUUID: string;
	text: string;
}

```

| Parameter       | Type                                  | Use                                                                                                                         |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| prompt          | string                                | The prompt that you intend to enhance.                                                                                      |
| promptMaxLength | number: `Optional`                    | Character count. Represents the maximum length of the prompt that you intend to receive. Can take values between 1 and 380. |
| promptVersions  | number: `Optional`                    | The number of prompt versions that will be received. Can take values between 1 and 5.                                       |
| includeCost     | boolean: `Optional`                   | If set to true, the cost to perform the task will be included in the response object.                                       |
| retry           | number `(default = globalMaxRetries)` | The number of retries it should make before throwing an error.                                                              |

&nbsp;

### ControlNet Preprocess

[Read Documentation](https://docs.runware.ai/en/image-editing/controlnet-tools)

Legacy alias: `controlNetPreProcess()`

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const controlNetPreProcessed = await runware.controlNetPreprocess({
	inputImage: string | File;
	preProcessorType: EPreProcessor;
	height?: number;
	width?: number;
	outputType?: IOutputType;
	outputFormat?: IOutputFormat;
	highThresholdCanny?: number;
	lowThresholdCanny?: number;
	includeHandsAndFaceOpenPose?: boolean;
})
console.log(controlNetPreProcessed)
return interface IControlNetImage {
	taskUUID: string;
	inputImageUUID: string;
	guideImageUUID: string;
	guideImageURL?: string;
	guideImageBase64Data?: string;
	guideImageDataURI?: string;
	cost: number;
}

```

| Parameter                   | Type                                  | Use                                                                                   |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| inputImage                  | string or File                        | Specifies the input image to be preprocessed to generate a guide image.               |
| width                       | number                                | Controls the image width.                                                             |
| height                      | number                                | Controls the image height.                                                            |
| outputType                  | IOutputType: `(Optional)`             | Specifies the output type in which the image is returned.                             |
| outputFormat                | IOutputFormat: `(Optional)`           | Specifies the format of the output image.                                             |
| preProcessorType            | string: `(Optional)`                  | Specifies the pre processor type to use.                                              |
| includeCost                 | boolean: `Optional`                   | If set to true, the cost to perform the task will be included in the response object. |
| lowThresholdCanny           | number `Optional`                     | Defines the lower threshold when using the Canny edge detection preprocessor.         |
| highThresholdCanny          | number `Optional`                     | Defines the high threshold when using the Canny edge detection preprocessor.          |
| includeHandsAndFaceOpenPose | boolean `Optional`                    | Include the hands and face in the pose outline when using the OpenPose preprocessor.  |
| retry                       | number `(default = globalMaxRetries)` | The number of retries it should make before throwing an error.                        |

&nbsp;

### Request Caption

[Read Documentation](https://docs.runware.ai/en/utilities/caption)

```js

const runware = new Runware({ apiKey: "API_KEY" });
const caption = await runware.caption({
	"model": "memories:1@1",
	inputs: {
		video: "https://example.com/video.mp4"
	}
});

console.log(caption)

return interface IImageToText {
  taskType: ETaskType;
  taskUUID: string;
  text: string;
  cost?: number;
}
```

&nbsp;

### Audio Inference

[Read Documentation](https://runware.ai/docs/en/audio-inference/introduction)

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const audio = await runware.audioInference({
	duration: 10,
	outputFormat: "MP3",
	numberResults: 2,
	includeCost: true,
	audioSettings: {
		bitrate: 128,
		sampleRate: 44100
	},
	outputType: "URL",
	model: "elevenlabs:1@1",
	positivePrompt: "hip hop",
	deliveryMethod: "async"
})
console.log(audio)

return interface IAudio {
  taskUUID: string;
  taskType: string;
  audioUUID?: string;
  audioURL?: string;
  audioBase64Data?: string;
  audioDataURI?: string;
  cost?: number;
}
```

### Model Upload

[Read Documentation](https://docs.runware.ai/en/image-inference/model-upload)

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });

const basePayload = {
	air: string;
	name: string;
	downloadURL: string;
	uniqueIdentifier: string;
	version: string;
	format: EModelFormat;
	architecture: EModelArchitecture;
	heroImageURL?: string;
	tags?: string[];
	shortDescription?: string;
	comment?: string;
	private: boolean;
	customTaskUUID?: string;
	retry?: number;
	onUploadStream?: (
		response?: IAddModelResponse,
		error?: IErrorResponse
	) => void;
}

const controlNetUpload = await runware.modelUpload({
	...basePayload,
  	category: "controlnet";
 	conditioning: EModelConditioning;
})
console.log(controlNetUpload)

const checkpointUpload = await runware.modelUpload({
	...basePayload,
  	category: "checkpoint";
 	positiveTriggerWords?: string;
	defaultCFGScale?: number;
	defaultStrength: number;
	defaultSteps?: number;
	defaultScheduler?: number;
	type?: EModelType;
})
console.log(checkpointUpload)

const loraUpload = await runware.modelUpload({
	...basePayload,
  	category: "lora";
 	defaultWeight: number;
  	positiveTriggerWords?: string;
})

console.log(loraUpload)

return interface IAddModelResponse {
  status: string;
  message: string;
  taskUUID: string;
  air: string;
  taskType: string;
}

export interface IErrorResponse {
  code: string;
  message: string;
  parameter: string;
  type: string;
  documentation: string;
  taskUUID: string;
}

```

&nbsp;

### Photo Maker

[Read Documentation](https://docs.runware.ai/en/image-inference/photomaker)

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });

const photoMaker = await runware.photoMaker({
	positivePrompt: string;
	height: number;
	width: number;
	numberResults: number;
	steps?: number;
	inputImages: string[];
	style: EPhotoMakerEnum;
	strength?: number;
	outputFormat?: string;
	includeCost?: boolean;

	customTaskUUID?: string;
	retry?: number;
	onPartialImages?: (images: IImage[], error?: IError) => void
})
console.log(photoMaker)

export interface IImage {
	taskType: ETaskType;
	imageUUID: string;
	inputImageUUID?: string;
	taskUUID: string;
	imageURL?: string;
	imageBase64Data?: string;
	imageDataURI?: string;
	NSFWContent?: boolean;
	cost?: number;
	seed?: number;
}

```

&nbsp;

### Model Search

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });

const modelSearch = await runware.modelSearch({
	search: string;
	tags?: string[];
	category?: "checkpoint" | "lora" | "controlnet";
	architecture?: EModelArchitecture;
	limit?: number;
	offset?: number;
	owned?: boolean;
	featured: boolean;
	type: string;
	conditioning: string;
	private: boolean;
	customTaskUUID?: string;
	retry?: number;
})
console.log(modelSearch)

export type TModelSearchResponse = {
  results: TModel[];
  taskUUID: string;
  taskType: string;
  totalResults: number;
};

export type TModel = {
  name: string;
  air: string;
  downloadUrl: string;
  tags: string[];
  heroImage: string;
  category: string;
  floatingPoint: string;
  private: boolean;
  shortDescription: string;
  comment: string;
  positiveTriggerWords: string;
  defaultSteps: number;
  defaultGuidanceScale: number;
  defaultStrength: number;
  defaultVaeId: number;
  updatedDateUnixTimestamp: number;
  version: string;
  conditioning: string;
  defaultScheduler: string;
  defaultCFG: number;
  format: string;
  uniqueIdentifier: string;
  architecture: string;
  type: string;
  nsfw: boolean;
  sourceUrl: string;
  downloadCount: number;
  nsfwLevel: number;
  rating: number;
  ratingCount: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  defaultEmaEnable: boolean;
  defaultImageSizeId: string;
  compatibleSizeIds: number[];
};


```

&nbsp;

### Image Masking

[Read Documentation](https://docs.runware.ai/en/image-editing/image-masking)

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });

const imageMasking = await runware.imageMasking({
  model: string;
  inputImage: string;
  confidence?: number;
  maskPadding?: number;
  maskBlur?: number;
  outputFormat?: string;
  outputType?: string;
  includeCost?: boolean;
  uploadEndpoint?: string;
  customTaskUUID?: string;
  retry?: number;
})
console.log(imageMasking)

export type TImageMaskingResponse = {
  taskType: string;
  taskUUID: string;
  imageUUID: string;

  detections: [
    {
      x_min: number;
      y_min: number;
      x_max: number;
      y_max: number;
    }
  ];
  maskImageURL: string;
  cost: number;
};



```

&nbsp;

## Demo

<!-- To be changed to another example -->

[**Demo**](https://codesandbox.io/s/picfinder-api-implementation-9tf85s?file=/src/App.tsx).

## Changelog

### - v1.2.3

- Handle async delivery method for image inference

### - v1.2.2

- Added audioInference task type

### - v1.2.1

- Added caption task type

### - v1.2.0

- Change removeImageBackground taskType from `removeImageBackground` to `removeBackground` -- removeBackground is compatible with removeImageBackground but it also supports other media inputs such as removing backgrounds from videos
- Change upscaleGan taskType from `upscaleImage` to `upscale` -- upscale is compatible with upscaleImage but it also supports other media inputs such as upscaling video.

Breaking change: `imageUUID` can now be undefined when using removeBackground/removeImageBackground and upscale/upscaleGan.

### - v1.1.50

- Added mediaStorage taskType
- Add compatibility with taskUUID

### - v1.1.49

- Add support for vectorize taskType

**Added or Changed**

### - v1.1.48

**Added or Changed**

- Added method aliases so task types match those of official API. It is recommended to use these new aliases going forward:

  - imageInference > requestImages
  - controlNetPreprocess > controlNetPreProcess
  - caption > requestImageToText
  - upscale > upscaleGan
  - promptEnhance > ehancePrompt

### - v1.1.47

**Added or Changed**

- Added inputs object to videoInference

### - v1.1.46

**Added or Changed**

- Added speech object and referenceVideos to videoInference

### - v1.1.44

**Added or Changed**

- Added providerSettings

### - v1.1.42

**Added or Changed**

- Allow image inference to take more dynamic params
- Fix video output type

### - v1.1.42

**Added or Changed**

- Release video inference

### - v1.1.40

**Added or Changed**

- Add Reference images

### - v1.1.39

**Added or Changed**

- Added Accelerator options (Teachace, Deepcache) and layerDiffuse

### - v1.1.38

**Added or Changed**

- Update bg removal payloads

### - v1.1.37

**Added or Changed**

- Add outpainint
- Extend photomaker payloads

### - v1.1.36

**Added or Changed**

- Handle Server error and invalid api key error correctly.
- Add ip adapter and embeddings.

### - v1.1.35

**Added or Changed**

- Include outputQuality in request payload for `requestImages`, `upscaleGan`, `removeImageBackground`, `controlNetPreProcess`, `photoMaker` and `imageMasking`

### - v1.1.34

**Added or Changed**

- Limit seed to Number.MAX_SAFE_INTEGER

### - v1.1.33

**Added or Changed**

- Update types

### - v1.1.32

**Added or Changed**

- Update TModel response

### - v1.1.31

**Added or Changed**

- Remove hardcoded extra parameters
- Add optional parameters in TModel

### - v1.1.30

**Added or Changed**

- Fix error bubbling for request images filtering by taskUUID
- Fix multiple instance of retrying connection

### - v1.1.29

**Added or Changed**

- Add backdoor for request images

### - v1.1.28

**Added or Changed**

- Add prompt weighting to request image

### - v1.1.27

**Added or Changed**

- Fix default schedular from number to string

### - v1.1.26

**Added or Changed**

- Fix require import

### - v1.1.25

**Added or Changed**

- Add maxDetections to image masking

### - v1.1.24

**Added or Changed**

- Add mask margin

### - v1.1.23

**Added or Changed**

- Fix checkNSFW

### - v1.1.22

**Added or Changed**

- Add negative prompt to photoMaker
- Fix seed type in IImage

### - v1.1.21

**Added or Changed**

- Add Model Search
- Add Image Masking

### - v1.1.20

**Added or Changed**

- Add Model Upload
- Add Photo Maker
- Add Refiner

### - v1.1.19

**Added or Changed**

- Fix Preprocessor type bug for controlnet
- Update readme

### - v1.1.18

**Added or Changed**

- Add Global Max Retry and Retry count per request
- Add Global timeout duration
- Introduce asynchronous instantiation

### - v1.1.16/v1.1.17

**Added or Changed**

- Add reconnection to server on close

### - v1.1.14/v1.1.15

**Added or Changed**

- Fix incorrect response

### - v1.1.13

**Added or Changed**

- Fix image upload

### - v1.1.12

**Added or Changed**

- Fix imageUpscale and backgroundRemoval wrong response

### - v1.1.11

**Added or Changed**

- Automatically detect environment with Runware class
- Fix invalid input image not returning server errors

### - v1.1.10

**Added or Changed**

- Add disconnect method

### - v1.1.9

**Added or Changed**

- Fix partial images not including prompt

### - v1.1.8

**Added or Changed**

- Fix image generation error

### - v1.1.7

**Added or Changed**

- Fix slow connection time
- Fix invalid api key error message
- Return prompt for images generated

### - v1.1.6

**Added or Changed**

- Add connection retry to runware server

### - v1.1.5

**Added or Changed**

- Added Custom UUID

### - v1.1.3/4

**Added or Changed**

- Reduce connection time

### - v1.1.2

**Added or Changed**

- Retry connection for server side

### - v1.1.1

**Added or Changed**

- Upgraded WS
- Fix delay time

### - v1.1.0

**Added or Changed**

- Refactor Sdk to new runware api changes

### - v1.0.29/v1.0.30

**Added or Changed**

- Added prompt weighting

### - v1.0.28

**Added or Changed**

- Added cost to response.
- Added returnBase64Image as part of request object.

### - v1.0.27

**Added or Changed**

- Refactor websocket listeners
- Allow users to make parallel requests

### - v1.0.26

**Added or Changed**

- Validate valid UUID as image initiator

### - v1.0.25

**Added or Changed**

- Add Buffer utils necessary for server ws
- Return images generated if timeout reached
- Added support for LoRA
- Added support for seed

### - v1.0.24

**Added or Changed**

- Introduce retry for missing images
- Increase Polling time

### - v1.0.23

**Added or Changed**

- Fixed Upscalegan to allow imageUUID

### - v1.0.22

**Added or Changed**

- Fixed bugs

### - v1.0.21

**Added or Changed**

- Add control mode to control net

### - v1.0.20

**Added or Changed**

- Ensure connection for non instantiated instance

### - v1.0.19

**Added or Changed**

- Allow server sdk to reconnect on connection loss
- Prevent duplicate message in server sdk
- Modify connected method
- Reduced polling interval

### - v1.0.18

**Added or Changed**

- Exposed `connected`` method

### - v1.0.17

**Added or Changed**

- Minor Fixes

### - v1.0.16

**Added or Changed**

- Added Release Notes

### - v1.0.15

**Added or Changed**

- Added Server implementation (Nodejs)
- Added Errors catching

## Contributing

## Credits

## Resources

[**API Docs**](https://docs.runware.ai/)
