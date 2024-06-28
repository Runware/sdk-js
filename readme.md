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
	imageSize: number;
	modelId: number;
	numberOfImages?: number;
	negativePrompt?: string;
	useCache?: boolean;
	lora?: ILora[];
	controlNet?: IControlNet[];
	imageInitiator?: File | string;
	imageMaskInitiator?: File | string;
	steps?: number;
	returnBase64Image?: boolean;
	onPartialImages?: (images: IImage[], error: IError) =>  void;
})
console.log(images)

return interface IImage {
	imageSrc: string;
	imageUUID: string;
	taskUUID: string;
	bNSFWContent: boolean;
	cost: string;
}[]
```

##### Parallel Requests (2 or more requests at the same time)

```js
const  runware  =  new Runware({ apiKey: "API_KEY" });

const [firstImagesRequest, secondImagesRequest] = await Promise.all([
	runware.requestImages({
		positivePrompt: string;
		imageSize: number;
		modelId: number;
		numberOfImages?: number;
		negativePrompt?: string;
		useCache?: boolean;
		onPartialImages?: (images: IImage[], error: IError) =>  void;
	}),
	runware.requestImages({
		positivePrompt: string;
		imageSize: number;
		modelId: number;
		numberOfImages?: number;
		negativePrompt?: string;
		useCache?: boolean;
		onPartialImages?: (images: IImage[], error: IError) =>  void;
	})
])

console.log({firstImagesRequest, secondImagesRequest})

return interface IImage {
	imageSrc: string;
	imageUUID: string;
	taskUUID: string;
	bNSFWContent: boolean;
}[]
```

| Parameter          | Type                               | Use                                                                                                                                                            |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| positivePrompt     | string                             | Defines the positive prompt description of the image.                                                                                                          |
| imageSize          | number                             | Controls the image size.                                                                                                                                       |
| modelId            | number                             | The model id of the image to be requested.                                                                                                                     |
| numberOfImages     | number: `(Optional)` (default = 1) | `(Optional)` The number of images to be sent.                                                                                                                  |
| useCache           | string: `(Optional)`               | Should use cached images (for faster response) or generate new images.                                                                                         |
| lora               | ILora[]: `(Optional)`              | If provided it should be an array of objects. Each object must have two attributes: `loraCivitaiAIR` (string) and `weight` (float) with values from 0 to 1.    |
| controlNet         | IControlNet[]: `(Optional)`        | If provided, should be an array of objects. Each object must have five attributes:                                                                             |
| imageInitiator     | string or File: `(Optional)`       | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file.                                             |
| imageMaskInitiator | string or File: `(Optional)`       | The image to be used as the mask image. It can be the UUID of previously generated image, or an image from a file.                                             |
| returnBase64Image  | boolean: `(Optional)`              | Returns base64 image.                                                                                                                                          |
| onPartialImages    | function: `(Optional)`             | If you want to receive the images as they are generated instead of waiting for the async request, you get the images as they are generated from this function. |

##### ControlNet Params

| Parameter             | Type                               | Use                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| preprocessor          | string                             | Defines the positive prompt description of the image.                                                                                                                                                                                                                                                                             |
| weight                | number                             | an have values between 0 and 1 and represent the weight of the ControlNet preprocessor in the image.                                                                                                                                                                                                                              |
| startStep             | number                             | represents the moment in which the ControlNet preprocessor starts to control the inference. It can take values from 0 to the maximum number of `steps` in the image create request. This can also be replaced with `startStepPercentage` (float) which represents the same value but in percentages. It takes values from 0 to 1. |
| numberOfImages        | number: `(Optional)` (default = 1) | `(Optional)` The number of images to be sent.                                                                                                                                                                                                                                                                                     |
| endStep               | number                             | similar with `startStep` but represents the end of the preprocessor control of the image inference. The equivalent of the percentage option is `startStepPercentage` (float).                                                                                                                                                     |
| guideImage            | file or string `(Optional)`        | The image requires for the guide image. It can be the UUID of previously generated image, or an image from a file.                                                                                                                                                                                                                |
| guideImageUnprocessed | file or string `(Optional)`        | The image requires for the guide image unprocessed. It can be the UUID of previously generated image, or an image from a file.                                                                                                                                                                                                    |

&nbsp;

### Request Image To Text

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const imageToText = await runware.requestImageToText({
	imageInitiator: string | File
})
console.log(imageToText)

return interface IImageToText {
	taskUUID: string;
	text: string;
}
```

| Parameter      | Type           | Use                                                                                                                |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| imageInitiator | string or File | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file. |

&nbsp;

### Remove Image Background

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const image = await runware.removeImageBackground({
	imageInitiator: string | File
})
console.log(image)
return interface IImage {
	imageSrc: string;
	imageUUID: string;
	taskUUID: string;
	bNSFWContent: boolean;
}[]
```

| Parameter      | Type           | Use                                                                                                                |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| imageInitiator | string or File | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file. |

&nbsp;

### Upscale Image

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const image = await runware.upscaleGan({
	imageInitiator: string | File;
	upscaleFactor: number;
})
console.log(image)
return interface IImage {
	imageSrc: string;
	imageUUID: string;
	taskUUID: string;
	bNSFWContent: boolean;
}[]

```

| Parameter      | Type           | Use                                                                                                                |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| imageInitiator | string or File | The image to be used as the seed image. It can be the UUID of previously generated image, or an image from a file. |
| upscaleFactor  | number         | The number of times to upscale;                                                                                    |

&nbsp;

### Enhance Prompt

```js

const  runware  =  new Runware({ apiKey: "API_KEY" });
const enhancedPrompt = await runware.enhancePrompt({
	prompt: string;
	promptMaxLength?: number;
	promptLanguageId?: number;
	promptVersions?: number;
})
console.log(enhancedPrompt)
return interface IEnhancedPrompt {
	taskUUID: string;
	text: string;
}[]

```

| Parameter        | Type               | Use                                                                                                                         |
| ---------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| prompt           | string             | The prompt that you intend to enhance.                                                                                      |
| promptMaxLength  | number: `Optional` | Character count. Represents the maximum length of the prompt that you intend to receive. Can take values between 1 and 380. |
| promptVersions   | number: `Optional` | The number of prompt versions that will be received. Can take values between 1 and 5.                                       |
| promptLanguageId | number: `Optional` | The language prompt text. Can take values between 1 and 298. Default is `1` - English. Options are provided below.          |

&nbsp;

## Demo

<!-- To be changed to another example -->

[**Demo**](https://codesandbox.io/s/picfinder-api-implementation-9tf85s?file=/src/App.tsx).

## Changelog

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
