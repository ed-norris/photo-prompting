import type { GeneratedImage } from "@/types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function generateImage(
  model: string,
  prompt: string,
  // width/height not supported by Gemini image generation API
  _options?: { width?: number; height?: number; steps?: number }
): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const start = Date.now();

  const response = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gemini returned ${response.status} for model ${model}: ${text}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType: string; data: string };
          text?: string;
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData) {
    throw new Error(`Gemini response for model ${model} did not include image data`);
  }

  const { mimeType, data: base64 } = imagePart.inlineData;

  return {
    dataUri: `data:${mimeType};base64,${base64}`,
    durationMs: Date.now() - start,
  };
}
