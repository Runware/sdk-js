# Picfinder Javascript & Typescript SDK

> The SDK is used to run image inference with the PicFinder API, powered by the RunWare inference platform. It can be used to generate imaged with text-to-image and image-to-image. It also allows the use of an existing gallery of models or selecting any model or LoRA from the CivitAI gallery. The API also supports upscaling, background removal, inpainting and outpainting, and a series of other ControlNet models.

## Request for API access

You can request for api access and get your API key [here](https://picfinder.ai/support/en/articles/7944975-how-to-access-the-picfinder-api)

## Installation

To install and set up the library, run:

```sh
$  npm  install  picfinder-sdk
```

Or if you prefer using Yarn:

```sh
$  yarn  add  picfinder-sdk
```

## Request for API access

You can request for api access and get your API key [here](https://picfinder.ai/support/en/articles/7944975-how-to-access-the-picfinder-api)

## Instantiating the SDK

```js
# For  Client (Javascript, React, Vue  etc) Use
const  picfinder  =  new  Picfinder(ENVIRONMENT , API_KEY);

# For  Server (Nodejs) Use
const  picfinder  =  new  PicfinderServer(ENVIRONMENT , API_KEY);
```

| Parameter   | Type   | Use                         |
| ----------- | ------ | --------------------------- |
| ENVIRONMENT | string | "PRODUCTION", "DEVELOPMENT" |
| API_KEY     | string | The environment api key     |

## API

### Request Image

NB: All errors can be catched in the catch block of each request

```js
const  picfinder  =  new  Picfinder(ENVIRONMENT	, API_KEY);
const images = await picfinder.requestImages({
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
	onPartialImages?: (images: IImage[], error: IError) =>  void;
})
console.log(images)

return interface IImage {
	imageSrc: string;
	imageUUID: string;
	taskUUID: string;
	bNSFWContent: boolean;
}[]
```

##### Parallel Requests (2 or more requests at the same time)

```js
const  picfinder  =  new  Picfinder(ENVIRONMENT	, API_KEY);

const [firstImagesRequest, secondImagesRequest] = await Promise.all([
	picfinder.requestImages({
		positivePrompt: string;
		imageSize: number;
		modelId: number;
		numberOfImages?: number;
		negativePrompt?: string;
		useCache?: boolean;
		onPartialImages?: (images: IImage[], error: IError) =>  void;
	}),
	picfinder.requestImages({
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
| imageInitiator     | string or File: `(Optional)`       | The image requires for the seed image. It can be the UUID of previously generated image or an a file image.                                                    |
| imageMaskInitiator | string or File: `(Optional)`       | The mask image requires for the seed image. It can be the UUID of previously generated image or an a file image.                                               |
| steps              | number: `(Optional)`               | The steps required to generate the image.                                                                                                                      |
| onPartialImages    | function: `(Optional)`             | If you want to receive the images as they are generated instead of waiting for the async request, you get the images as they are generated from this function. |

##### ControlNet Params

| Parameter             | Type                               | Use                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| preprocessor          | string                             | Defines the positive prompt description of the image.                                                                                                                                                                                                                                                                             |
| weight                | number                             | an have values between 0 and 1 and represent the weight of the ControlNet preprocessor in the image.                                                                                                                                                                                                                              |
| startStep             | number                             | represents the moment in which the ControlNet preprocessor starts to control the inference. It can take values from 0 to the maximum number of `steps` in the image create request. This can also be replaced with `startStepPercentage` (float) which represents the same value but in percentages. It takes values from 0 to 1. |
| numberOfImages        | number: `(Optional)` (default = 1) | `(Optional)` The number of images to be sent.                                                                                                                                                                                                                                                                                     |
| endStep               | number                             | similar with `startStep` but represents the end of the preprocessor control of the image inference. The equivalent of the percentage option is `startStepPercentage` (float).                                                                                                                                                     |
| guideImage            | file or string `(Optional)`        | The image requires for the guide image. It can be the UUID of previously generated image or an a file image.                                                                                                                                                                                                                      |
| guideImageUnprocessed | file or string `(Optional)`        | The image requires for the guide image unprocessed. It can be the UUID of previously generated image or an a file image.                                                                                                                                                                                                          |

&nbsp;

### Request Image To Text

```js

const  picfinder  =  new  Picfinder(ENVIRONMENT	, API_KEY);
const imageToText = await picfinder.requestImageToText({
	imageInitiator: string | File
})
console.log(imageToText)

return interface IImageToText {
	taskUUID: string;
	text: string;
}
```

| Parameter      | Type           | Use                                                                                                         |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| imageInitiator | string or File | The image requires for the seed image. It can be the UUID of previously generated image or an a file image. |

&nbsp;

### Remove Image Background

```js

const  picfinder  =  new  Picfinder(ENVIRONMENT	, API_KEY);
const image = await picfinder.removeImageBackground({
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

| Parameter      | Type           | Use                                                                                                         |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| imageInitiator | string or File | The image requires for the seed image. It can be the UUID of previously generated image or an a file image. |

&nbsp;

### Upscale Image

```js

const  picfinder  =  new  Picfinder(ENVIRONMENT	, API_KEY);
const image = await picfinder.upscaleGan({
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

| Parameter      | Type           | Use                                                                                                         |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| imageInitiator | string or File | The image requires for the seed image. It can be the UUID of previously generated image or an a file image. |
| upscaleFactor  | number         | The number of times to upscale;                                                                             |

&nbsp;

### Enhance Prompt

```js

const  picfinder  =  new  Picfinder(ENVIRONMENT	, API_KEY);
const enhancedPrompt = await picfinder.enhancePrompt({
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

[**Demo**](https://codesandbox.io/s/picfinder-api-implementation-9tf85s?file=/src/App.tsx).

## Changelog

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

- Expose is connected method

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

[**API Docs**](https://picfinder.ai/support/en/collections/4049537-api-docs)
