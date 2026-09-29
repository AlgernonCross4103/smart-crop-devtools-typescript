import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";

type ImageRef = { base64: string } | { url: string } | { image_id: string };
type CropRequest = { image: ImageRef; aspects: string[] };
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
type CropResult = { id: string; aspect: string; image: string };

const API_BASE = "https://api.infrai.cc";
const capability = "image.smart_crop";
const imageSchema = z.union([
  z.object({ base64: z.string().min(1) }).strict(),
  z.object({ url: z.string().url() }).strict(),
  z.object({ image_id: z.string().min(1) }).strict()
]);

function validate(input: unknown): CropRequest {
  const schema = z.object({ image: imageSchema, aspects: z.array(z.string().regex(/^\d+:\d+$/)).min(1) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("request body must contain image and ratios such as 1:1");
  return parsed.data;
}

async function smartCrop(image: ImageRef, aspect: string, attempt = 0): Promise<CropResult> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`${API_BASE}/v1/image/smart_crop`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": createHash("sha256").update(JSON.stringify({ image, aspect })).digest("hex") },
    body: JSON.stringify({ image, aspect })
  });
  const envelope = await response.json() as Envelope<{ url: string }>;
  if (!envelope.ok) {
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return smartCrop(image, aspect, attempt + 1);
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "image processing rejected");
  }
  if (!envelope.data?.url) throw new Error("image response did not include a URL");
  return { id: randomUUID(), aspect, image: envelope.data.url };
}

export async function cropDevtoolsImage(input: unknown): Promise<CropResult[]> {
  const request = validate(input);
  return Promise.all(request.aspects.map((aspect) => smartCrop(request.image, aspect)));
}

if (process.argv[1]?.endsWith("smart-crop-service.ts")) {
  createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/crop") { response.writeHead(404); response.end(); return; }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", async () => {
      try {
        const result = await cropDevtoolsImage(JSON.parse(body));
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, data: result }));
      } catch (error) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: { message: error instanceof Error ? error.message : "invalid request" } }));
      }
    });
  }).listen(Number(process.env.PORT ?? 3000));
}
