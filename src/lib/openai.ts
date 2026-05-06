import type { GeneratedImage } from "@/types";

const OPENAI_BASE = "https://api.openai.com/v1";

export async function generateImage(
  model: string,
  prompt: string,
  options?: { width?: number; height?: number; steps?: number }
): Promise<GeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const size = resolveSize(options?.width, options?.height);
  const start = Date.now();

  const response = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
    }),
  });

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
