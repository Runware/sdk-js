# Runware Javascript & Typescript SDK

> This SDK is used to run AI image generation with the Runware API, powered by the RunWare inference platform. With this SDK you can generate images with text-to-image and image-to-image with sub-second inference times. It also allows the use of an existing library of more than 150k models, including any model or LoRA from the CivitAI gallery. The API also supports upscaling, background removal, inpainting, outpainting, ControlNets, and more. Visit the Runware site for [detailed feature breakdown](https://runware.ai/features/).

## Get API access

For an API Key and free trial credits, [create a free account](https://my.runware.ai/) with [Runware](https://runware.ai)

### NB: Please keep your API key private

## Installation

To install and set up the library, run:

```sh
$  npm  install  runware-sdk
```

Or if you prefer using Yarn:

```sh
$  yarn  add  runware-sdk
```

## Instantiating the SDK

```js
# For  Client (Javascript, React, Vue  etc) Use
const  runware  =  new Runware({ apiKey: "API_KEY" });

# For  Server (Nodejs) Use
const  runware  =  new RunwareServer({ apiKey: "API_KEY" });
```

| Parameter | Type   | Use                               |
| --------- | ------ | --------------------------------- |
| url       | string | Url to get images from (optional) |
| apiKey    | string | The environment api key           |

## API

### Request Image

NB: All errors can be caught in the catch block of each request

```js
const  runware  =  new  Runware({ apiKey: "API_KEY" });
const images = await runware.requestImages({
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
	schedular?: string;
	seed?: number;
	CFGScale?: number;
	clipSkip?: number;
	usePromptWeighting?: number;
	controlNet?: IControlNet[];
	lora?: ILora[];

	useCache?: boolean;
	returnBase64Image?: boolean;
	onPartialImages?: (images: IImage[], error: IError) =>  void;
})

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
}[]
```

##### Parallel Requests (2 or more requests at the same time)

```js
const  runware  =  new Runware({ apiKey: "API_KEY" });

const [firstImagesRequest, secondImagesRequest] = await Promise.all([
	runware.requestImages({
		positivePrompt: string;
		width: number;
		height: number;
		numberResults: number;
		model: string;
		negativePrompt?: string;
		onPartialImages?: (images: IImage[], error: IError) =>  void;
	}),
	runware.requestImages({
		positivePrompt: string;
		width: number;
		height: number;
		numberResults: number;
		model: string;
		onPartialImages?: (images: IImage[], error: IError) =>  void;
	})
])

console.log({firstImagesRequest, secondImagesRequest})

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
}[]
```

| Parameter          | Type                               | Use                                                                                                                                                                                                                                                                           |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| positivePrompt     | string                             | Defines the positive prompt description of the image.                                                                                                                                                                                                                         |
| negativePrompt     | string                             | Defines the negative prompt description of the image.                                                                                                                                                                                                                         |
| width              | number                             | Controls the image width.                                                                                                                                                                                                                                                     |
| height             | number                             | Controls the image height.                                                                                                                                                                                                                                                    |
| model              | string                             | The AIR system ID of the image to be requested.                                                                                                                                                                                                                               |
| numberResults      | number: `(Optional)` (default = 1) | `(Optional)` The number of images to be generated.                                                                                                                                                                                                                            |
| outputType         | IOutputType: `(Optional)`          | Specifies the output type in which the image is returned.                                                                                                                                                                                                                     |
| outputFormat       | IOutputFormat: `(Optional)`        | Specifies the format of the output image.                                                                                                                                                                                                                                     |
| uploadEndpoint     | string: `(Optional)`               | This parameter allows you to specify a URL to which the generated image will be uploaded as binary image data using the HTTP PUT method. For example, an S3 bucket URL can be used as the upload endpoint.                                                                    |
| checkNSFW          | boolean: `(Optional)`              | This parameter is used to enable or disable the NSFW check. When enabled, the API will check if the image contains NSFW (not safe for work) content. This check is done using a pre-trained model that detects adult content in images.                                       |
| seedImage          | string or File: `(Optional)`       | When doing Image-to-Image, Inpainting or Outpainting, this parameter is required.Specifies the seed image to be used for the diffusion process.                                                                                                                               |
| maskImage          | string or File: `(Optional)`       | The image to be used as the mask image. It can be the UUID of previously generated image, or an image from a file.                                                                                                                                                            |
| strength           | number: `(Optional)`               | When doing Image-to-Image, Inpainting or Outpainting, this parameter is used to determine the influence of the seedImage image in the generated output. A higher value results in more influence from the original image, while a lower value allows more creative deviation. |
| steps              | number: `(Optional)`               | The number of steps is the number of iterations the model will perform to generate the image. The higher the number of steps, the more detailed the image will be.                                                                                                            |
| scheduler          | string: `(Optional)`               | An scheduler is a component that manages the inference process. Different schedulers can be used to achieve different results like more detailed images, faster inference, or more accurate results.                                                                          |
| seed               | number: `(Optional)`               | A seed is a value used to randomize the image generation. If you want to make images reproducible (generate the same image multiple times), you can use the same seed value.                                                                                                  |
| CFGScale           | number: `(Optional)`               | Guidance scale represents how closely the images will resemble the prompt or how much freedom the AI model has. Higher values are closer to the prompt. Low values may reduce the quality of the results.                                                                     |
| clipSkip           | number: `(Optional)`               | CLIP Skip is a feature that enables skipping layers of the CLIP embedding process, leading to quicker and more varied image generation.                                                                                                                                       |
| usePromptWeighting | boolean: `(Optional)`              | Allow setting different weights per words or expressions in prompts.                                                                                                                                                                                                          |
| clipSkip           | number: `(Optional)`               | CLIP Skip is a feature that enables skipping layers of the CLIP embedding process, leading to quicker and more varied image generation.                                                                                                                                       |
| lora               | ILora[]: `(Optional)`              | With LoRA (Low-Rank Adaptation), you can adapt a model to specific styles or features by emphasizing particular aspects of the data.                                                                                                                                          |
| controlNet         | IControlNet[]: `(Optional)`        | With ControlNet, you can provide a guide image to help the model generate images that align with the desired structure.                                                                                                                                                       |
| onPartialImages    | function: `(Optional)`             | If you want to receive the images as they are generated instead of waiting for the async request, you get the images as they are generated from this function.                                                                                                                |
| includeCost        | boolean `(Optional)`               | If set to true, the cost to perform the task will be included in the response object.                                                                                                                                                                                         |

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

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const imageToText = await runware.requestImageToText({
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

| Parameter   | Type                 | Use                                                                                                                |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| inputImage  | string or File       | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file. |
| includeCost | boolean `(Optional)` | If set to true, the cost to perform the task will be included in the response object.                              |

&nbsp;

### Remove Image Background

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const image = await runware.removeImageBackground({
	imageInitiator: string | File
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
}[]
```

| Parameter                       | Type                        | Use                                                                                                                                                                                  |
| ------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| inputImage                      | string or File              | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file.                                                                   |
| outputType                      | IOutputType: `(Optional)`   | Specifies the output type in which the image is returned.                                                                                                                            |
| outputFormat                    | IOutputFormat: `(Optional)` | Specifies the format of the output image.                                                                                                                                            |
| includeCost                     | boolean `(Optional)`        | If set to true, the cost to perform the task will be included in the response object.                                                                                                |
| rgba                            | number[] `(Optional)`       | An array representing the [red, green, blue, alpha] values that define the color of the removed background. The alpha channel controls transparency.                                 |
| postProcessMask                 | boolean `(Optional)`        | Flag indicating whether to post-process the mask. Controls whether the mask should undergo additional post-processing.                                                               |
| returnOnlyMask                  | boolean `(Optional)`        | Flag indicating whether to return only the mask. The mask is the opposite of the image background removal.                                                                           |
| alphaMatting                    | boolean `(Optional)`        | Flag indicating whether to use alpha matting. Alpha matting is a post-processing technique that enhances the quality of the output by refining the edges of the foreground object.   |
| alphaMattingForegroundThreshold | number `(Optional)`         | Threshold value used in alpha matting to distinguish the foreground from the background. Adjusting this parameter affects the sharpness and accuracy of the foreground object edges. |
| alphaMattingBackgroundThreshold | number `(Optional)`         | Threshold value used in alpha matting to refine the background areas. It influences how aggressively the algorithm removes the background while preserving image details.            |
| alphaMattingErodeSize           | number `(Optional)`         | Specifies the size of the erosion operation used in alpha matting. Erosion helps in smoothing the edges of the foreground object for a cleaner removal of the background.            |

&nbsp;

### Upscale Image

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const image = await runware.upscaleGan({
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
}[]

```

| Parameter     | Type                        | Use                                                                                                                |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| inputImage    | string or File              | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file. |
| upscaleFactor | number                      | The number of times to upscale;                                                                                    |
| outputType    | IOutputType: `(Optional)`   | Specifies the output type in which the image is returned.                                                          |
| outputFormat  | IOutputFormat: `(Optional)` | Specifies the format of the output image.                                                                          |
| includeCost   | boolean `(Optional)`        | If set to true, the cost to perform the task will be included in the response object.                              |

&nbsp;

### Enhance Prompt

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const enhancedPrompt = await runware.enhancePrompt({
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

| Parameter       | Type                | Use                                                                                                                         |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| prompt          | string              | The prompt that you intend to enhance.                                                                                      |
| promptMaxLength | number: `Optional`  | Character count. Represents the maximum length of the prompt that you intend to receive. Can take values between 1 and 380. |
| promptVersions  | number: `Optional`  | The number of prompt versions that will be received. Can take values between 1 and 5.                                       |
| includeCost     | boolean: `Optional` | If set to true, the cost to perform the task will be included in the response object.                                       |

&nbsp;

### ControlNet Preprocess

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const controlNetPreProcessed = await runware.controlNetPreProcess({
	inputImage: string | File;
	preProcessor: EPreProcessor;
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

| Parameter                   | Type                        | Use                                                                                   |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| inputImage                  | string or File              | Specifies the input image to be preprocessed to generate a guide image.               |
| width                       | number                      | Controls the image width.                                                             |
| height                      | number                      | Controls the image height.                                                            |
| outputType                  | IOutputType: `(Optional)`   | Specifies the output type in which the image is returned.                             |
| outputFormat                | IOutputFormat: `(Optional)` | Specifies the format of the output image.                                             |
| preProcessorType            | string: `(Optional)`        | Specifies the pre processor type to use.                                              |
| includeCost                 | boolean: `Optional`         | If set to true, the cost to perform the task will be included in the response object. |
| lowThresholdCanny           | number `Optional`           | Defines the lower threshold when using the Canny edge detection preprocessor.         |
| highThresholdCanny          | number `Optional`           | Defines the high threshold when using the Canny edge detection preprocessor.          |
| includeHandsAndFaceOpenPose | boolean `Optional`          | Include the hands and face in the pose outline when using the OpenPose preprocessor.  |

&nbsp;

## Demo

<!-- To be changed to another example -->

[**Demo**](https://codesandbox.io/s/picfinder-api-implementation-9tf85s?file=/src/App.tsx).

## Changelog

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
