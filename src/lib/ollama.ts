import type { GeneratedImage, ModelInfo, ModelsResponse } from "@/types";

const OLLAMA_BASE = "http://localhost:11434";

// Known image model name patterns — anything else is treated as text
const IMAGE_MODEL_PATTERNS = [
  /flux/i,
  /diffusion/i,
  /image/i,
  /stable/i,
  /sdxl/i,
  /sd3/i,
  /z-image/i,
];

function isImageModel(name: string): boolean {
  return IMAGE_MODEL_PATTERNS.some((pat) => pat.test(name));
}

/**
 * Generate a single image from a model.
 * Returns a GeneratedImage with a data URI and duration.
 */
export async function generateImage(
  model: string,
  prompt: string,
  options?: { width?: number; height?: number; steps?: number }
): Promise<GeneratedImage> {
  const start = Date.now();

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
  };

  if (options?.width) body.width = options.width;
  if (options?.height) body.height = options.height;
  if (options?.steps) body.steps = options.steps;

  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Ollama returned ${response.status} for model ${model}: ${text}`
    );
  }

  const data = (await response.json()) as {
    image?: string;
    done?: boolean;
    total_duration?: number;
  };

  if (!data.image) {
    throw new Error(
      `Ollama response for model ${model} did not include an image field`
    );
  }

  const durationMs = data.total_duration
    ? Math.round(data.total_duration / 1_000_000) // nanoseconds → ms
    : Date.now() - start;

  return {
    dataUri: `data:image/png;base64,${data.image}`,
    durationMs,
  };
}

export function parseVariations(raw: string, count: number): string[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  const variations: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*\d+\.\s+(.+)$/);
    if (match) {
      variations.push(match[1].trim());
    }
  }

  if (variations.length === 0) {
    return lines
      .map((l) => l.replace(/^\s*[-*\d.]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, count);
  }

  return variations.slice(0, count);
}

/**
 * Generate prompt variations using gemma3 (text LLM).
 */
export async function suggestVariations(
  prompt: string,
  count: number
): Promise<string[]> {
  const systemPrompt = `You are a photography and AI image generation expert.
Given a base prompt, generate ${count} creative variations that incorporate specific photography techniques.
Each variation should add different elements from: lens focal lengths (24mm, 35mm, 50mm, 85mm, 135mm),
aperture/depth of field (f/1.4 bokeh, f/8 sharp, f/16 deep focus), lighting conditions
(golden hour, blue hour, overcast, studio, Rembrandt, side-lit), film stocks
(Kodak Portra 400, Fuji Velvia, Ilford HP5, Kodachrome), composition styles
(rule of thirds, leading lines, symmetry, Dutch angle), or cinema references.
Return ONLY a numbered list with exactly ${count} items. Each item on its own line.
Format: "1. [variation]", "2. [variation]", etc. No other text.`;

  const body = {
    model: "gemma4:e4b",
    prompt: `Base prompt: "${prompt}"\n\nGenerate ${count} photography-focused variations:`,
    system: systemPrompt,
    stream: false,
  };

  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama suggest call failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { response?: string };
  return parseVariations(data.response ?? "", count);
}

/**
 * List available models from Ollama, categorised into image vs text models.
 */
export async function listModels(): Promise<ModelsResponse> {
  const response = await fetch(`${OLLAMA_BASE}/api/tags`);

  if (!response.ok) {
    throw new Error(`Failed to list Ollama models: ${response.status}`);
  }

  const data = (await response.json()) as {
    models: Array<{ name: string; size: number }>;
  };

  const imageModels: ModelInfo[] = [];
  const textModels: ModelInfo[] = [];

  for (const m of data.models ?? []) {
    const sizeGB = (m.size / 1_073_741_824).toFixed(1) + "GB";
    const info: ModelInfo = { name: m.name, size: sizeGB };
    if (isImageModel(m.name)) {
      imageModels.push(info);
    } else {
      textModels.push(info);
    }
  }

  return { imageModels, textModels };
}
