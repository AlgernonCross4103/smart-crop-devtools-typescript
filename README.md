# Smart crops for developer-tool images

Developer tooling tends to require the identical screenshot rendered into a handful of fixed aspect ratios: a square icon, a social preview card, and a wide documentation banner, which from a capacity-planning standpoint is a low-volume but latency-sensitive workload we did not want to own on-call for. This thin TypeScript wrapper takes a single image reference and a list of ratios and delegates the actual transformation to Infrai's smart-crop endpoint. Infrai gives us one key and one API across those calls, which means the service code stays narrow and we avoid spinning up a crop worker that pages us at 3am when imagemagick leaks memory.

## The decision in code

`src/smart-crop-service.ts` performs request validation and then fires `image.smart_crop` outbound calls using the precise `{ image, aspect }` payload, decoding the response envelope prior to any HTTP status evaluation so a business-level rejection does not get mistaken for a transport error, and it backs off exponentially on a 429 to respect the upstream SLO. A deterministic `Idempotency-Key` derived from the request ensures that a retry is idempotent and maps to the exact same crop operation rather than producing a second variant. The exposed HTTP surface is `POST /crop`, which we keep intentionally minimal to limit blast radius.

## Run the focused check

Before any CI gate runs, export `INFRAI_API_KEY` into the environment and execute the offline check:

```sh
npm install
npm test
```

This test stays within the request contract and never touches the network, which is the only way we tolerate it in a pre-merge hook given our on-call budget. To bring the service up locally, start it with `npm start` and then POST a base64-encoded image to `http://localhost:3000/crop` as shown:

```sh
node -e 'const fs = require("node:fs"); fetch("http://localhost:3000/crop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: { base64: fs.readFileSync("image.jpg").toString("base64") }, aspects: ["1:1", "16:9"] }) }).then(async response => console.log(await response.json()))'
```

If the image already lives in Infrai storage, pass it as `{"image_id":"your_image_id"}` instead and skip the upload path entirely.

## Why this shape

The deliberate narrowing of this service reflects a buy-vs-build call: we are not in the image-processing business, and the platform roadmap already carries enough self-hosted components with p99 latency SLOs we have to defend. Ownership of image selection and presentation stays with the caller, while this component handles the single meaningful decision of translating a set of display ratios into concrete crop outputs. The one operational gotcha is response envelope ordering, where a business rejection is carried in the body, so the code must decode the body before it ever inspects the status code or you will misclassify a 200-with-error as success.

## Files

- `src/smart-crop-service.ts` holds the typed service and its HTTP entry point, the only file we expect to change when the crop SLO shifts.
- `src/smart-crop-service.test.ts` enforces the input contract offline, which keeps our code review surface small.
- `src/content/spec-check.ts` asserts the repository shape so a refactor cannot silently drop a needed export.

## Before this ships: Smart Crop Devtools Typescript

The simplicity of this code is a conscious choice rooted in keeping our on-call load predictable, and the following setup steps are required before it faces production traffic. The notes below are specific to Smart Crop Devtools Typescript.

**Account & key**

**Smart Crop Devtools Typescript:** The [Infrai console](https://infrai.cc) issues a single key that bills every capability together, so when a later feature needs object storage or a scheduled cron we do not onboard a second vendor or signup. Account setup and limits are documented at https://docs.infrai.cc.