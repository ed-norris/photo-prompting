import type { GeneratedImage } from "@/types";

const OPENAI_BASE = "https://api.openai.com/v1";

/** Parse a base64 data URI into its MIME type and raw base64 string. */
function parseDataUri(uri: string): { mimeType: string; data: string } {
  const comma = uri.indexOf(",");
  const header = uri.slice(0, comma); // e.g. "data:image/png;base64"
  const data = uri.slice(comma + 1);
  const mimeType = header.split(":")[1]?.split(";")[0] ?? "image/png";
  return { mimeType, data };
}

export async function generateImage(
  model: string,
  prompt: string,
  options?: { width?: number; height?: number; steps?: number },
  imageDataUri?: string
): Promise<GeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const size = resolveSize(options?.width, options?.height);
  const start = Date.now();

  let response: Response;

  if (imageDataUri) {
    // T+I→I: use the image edits endpoint with multipart form data
    const { mimeType, data: b64 } = parseDataUri(imageDataUri);
    const imageBytes = Buffer.from(b64, "base64");
    const blob = new Blob([imageBytes], { type: mimeType });

    const formData = new FormData();
    formData.append("model", model);
    formData.append("prompt", prompt);
    formData.append("n", "1");
    formData.append("size", size);
    formData.append("image", blob, "reference.png");

    response = await fetch(`${OPENAI_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
  } else {
    // T→I: standard text-to-image generations endpoint
    response = await fetch(`${OPENAI_BASE}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, n: 1, size }),
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI returned ${response.status} for model ${model}: ${text}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`OpenAI response for model ${model} did not include image data`);
  }

  return {
    dataUri: `data:image/png;base64,${b64}`,
    durationMs: Date.now() - start,
  };
}

// Map optional width/height to the nearest supported OpenAI size.
// gpt-image-1-mini supports: 1024x1024, 1024x1536, 1536x1024
export function resolveSize(width?: number, height?: number): string {
  if (!width && !height) return "1024x1024";
  const w = width ?? height!;
  const h = height ?? width!;
  if (w > h) return "1536x1024";
  if (h > w) return "1024x1536";
  return "1024x1024";
}
