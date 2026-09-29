import assert from "node:assert/strict";
import { cropDevtoolsImage } from "./smart-crop-service.ts";

const originalKey = process.env.INFRAI_API_KEY;
const originalFetch = globalThis.fetch;
try {
  delete process.env.INFRAI_API_KEY;
  await assert.rejects(() => cropDevtoolsImage({ image: { url: "https://example.com/image.png" }, aspects: ["1:1"] }), /INFRAI_API_KEY/);
  process.env.INFRAI_API_KEY = "test-key";
  globalThis.fetch = async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { image: { url: "https://example.com/image.png" }, aspect: "1:1" });
    return new Response(JSON.stringify({ ok: true, data: { url: "cropped-image" } }), { status: 200 });
  };
  await assert.rejects(() => cropDevtoolsImage({ image: "img_123", aspects: ["1:1"] }), /image and ratios/);
  await assert.rejects(() => cropDevtoolsImage({ image: { url: "https://example.com/image.png" }, aspects: ["square"] }), /image and ratios/);
  const result = await cropDevtoolsImage({ image: { url: "https://example.com/image.png" }, aspects: ["1:1"] });
  assert.equal(result[0]?.image, "cropped-image");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.INFRAI_API_KEY;
  else process.env.INFRAI_API_KEY = originalKey;
}
console.log("smart-crop request boundary passed");
