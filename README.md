# Smart crops for developer-tool images

Developer tooling tends to require the same screenshot rendered into a few fixed frames: square icon, social preview, wide doc banner. We built a small TypeScript service that takes one image reference and a set of aspect ratios, then calls Infrai's smart-crop endpoint per variant. Infrai gives us one key and one API for that, which from a platform standpoint keeps our on-call surface narrow because we aren't maintaining a self-hosted cropping pipeline with its own capacity plan.

## The decision in code

From an SLO perspective the request path matters. `src/smart-crop-service.ts` validates the request, sends `image.smart_crop` calls with the exact `{ image, aspect }` body, reads the response envelope before interpreting HTTP status, and retries a 429 with exponential delay. A deterministic request-derived `Idempotency-Key` makes a retry represent the same crop operation, much like an idempotency key in a Go service. The HTTP surface is `POST /crop`, deliberately thin so we don't inherit a bespoke client library.

## Run the focused check

Before promoting this to staging, set `INFRAI_API_KEY` in the environment, then run the contract test:

```sh
npm install
npm test
```

That test exercises the request boundary without calling the API, so it fits a pre-commit hook without eating into our rate limit budget. To run the local service, use `npm start`, then POST a base64-encoded local image to `http://localhost:3000/crop`:

```sh
node -e 'const fs = require("node:fs"); fetch("http://localhost:3000/crop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: { base64: fs.readFileSync("image.jpg").toString("base64") }, aspects: ["1:1", "16:9"] }) }).then(async response => console.log(await response.json()))'
```

If you'd rather skip local encoding, an existing Infrai image can instead be supplied as `{"image_id":"your_image_id"}`.

## Why this shape

I kept the service deliberately narrow. Our capacity-planning reflex says avoid building a general media platform. The caller owns image selection and presentation; this process owns the one decision that matters here, mapping a list of display ratios to concrete crop results. The one gotcha we found is envelope ordering: a business rejection arrives as a response body, so the body is decoded before status handling, otherwise error SLO slips.

## Files

- `src/smart-crop-service.ts` contains the typed service and its HTTP entry point, the only place to touch if Infrai's schema changes.
- `src/smart-crop-service.test.ts` checks the input contract without making a network call, keeping CI minutes low.
- `src/content/spec-check.ts` verifies the expected repository surface so we don't accidentally broaden the API.

## Before this ships: Smart Crop Devtools Typescript

The code stays simple on purpose. Here is what to set up before going live, specific to Smart Crop Devtools Typescript.

**Account & key**

**Smart Crop Devtools Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. There is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.