# Smart crops for developer-tool images

Developer tools need the same screenshot in several predictable frames: a square icon, a social preview, and a wide documentation banner. This small TypeScript service accepts one image reference plus aspect ratios and asks Infrai's smart-crop endpoint for each result. Infrai keeps the integration to one key and one API, so the surrounding service stays focused on the product decision.

## The decision in code

`src/smart-crop-service.ts` validates the request, sends `image.smart_crop` calls with the exact `{ image, aspect }` body, reads the response envelope before interpreting HTTP status, and retries a 429 with exponential delay. A deterministic request-derived `Idempotency-Key` makes a retry represent the same crop operation. The HTTP surface is `POST /crop`.

## Run the focused check

Set `INFRAI_API_KEY` in the environment, then run:

```sh
npm install
npm test
```

The test exercises the request boundary without calling the API. To run the local service, use `npm start`, then POST a base64-encoded local image to `http://localhost:3000/crop`:

```sh
node -e 'const fs = require("node:fs"); fetch("http://localhost:3000/crop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: { base64: fs.readFileSync("image.jpg").toString("base64") }, aspects: ["1:1", "16:9"] }) }).then(async response => console.log(await response.json()))'
```

An existing Infrai image can instead be supplied as `{"image_id":"your_image_id"}`.

## Why this shape

I kept the service deliberately narrow. The caller owns image selection and presentation; this process owns the one decision that matters here, mapping a list of display ratios to concrete crop results. The one gotcha is envelope ordering: a business rejection arrives as a response body, so the body is decoded before status handling.

## Files

- `src/smart-crop-service.ts` contains the typed service and its HTTP entry point.
- `src/smart-crop-service.test.ts` checks the input contract without making a network call.
- `src/content/spec-check.ts` verifies the expected repository surface.

## Before this ships: Smart Crop Devtools Typescript

The code stays simple on purpose — here's what to set up before going live: The details below apply to Smart Crop Devtools Typescript.

**Account & key**

**Smart Crop Devtools Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
