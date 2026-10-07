import type { ModelInfo } from "@/types";

const LMSTUDIO_BASE = "http://localhost:1234";

export class LMStudioUnavailableError extends Error {
  constructor() {
    super("LM Studio is not running or unreachable at localhost:1234");
    this.name = "LMStudioUnavailableError";
  }
}

// fetch rejects only when the connection itself fails (HTTP errors still resolve)
async function lmstudioFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${LMSTUDIO_BASE}${path}`, init);
  } catch {
    throw new LMStudioUnavailableError();
  }
}

interface LMStudioModel {
  type: string;
  key: string;
  size_bytes: number;
  capabilities?: { reasoning?: { allowed_options: string[] } };
}

// Sorted by key so the default pick (first LLM) is stable
async function listLLMs(): Promise<LMStudioModel[]> {
  const response = await lmstudioFetch("/api/v1/models");

  if (!response.ok) {
    throw new Error(`Failed to list LM Studio models: ${response.status}`);
  }

  const data = (await response.json()) as { models?: LMStudioModel[] };

  return (data.models ?? [])
    .filter((m) => m.type === "llm")
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * List the text LLMs LM Studio has downloaded, loaded or not (embedding
 * models are excluded).
 */
export async function listTextModels(): Promise<ModelInfo[]> {
  const llms = await listLLMs();

  return llms.map((m) => ({
    name: m.key,
    size: (m.size_bytes / 1_073_741_824).toFixed(1) + "GB",
  }));
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
 * Generate prompt variations with an LM Studio LLM: the model whose key
 * matches `model`, or the first downloaded LLM when `model` is omitted.
 */
export async function suggestVariations(
  prompt: string,
  count: number,
  model?: string
): Promise<string[]> {
  const llms = await listLLMs();
  const target = model ? llms.find((m) => m.key === model) : llms[0];

  if (!target) {
    throw new Error(
      model
        ? `LM Studio has no downloaded model "${model}"`
        : "LM Studio has no LLMs downloaded"
    );
  }

  const systemPrompt = `You are a photography and AI image generation expert.
Given a base prompt, generate ${count} creative variations that incorporate specific photography techniques.
Each variation should add different elements from: lens focal lengths (24mm, 35mm, 50mm, 85mm, 135mm),
aperture/depth of field (f/1.4 bokeh, f/8 sharp, f/16 deep focus), lighting conditions
(golden hour, blue hour, overcast, studio, Rembrandt, side-lit), film stocks
(Kodak Portra 400, Fuji Velvia, Ilford HP5, Kodachrome), composition styles
(rule of thirds, leading lines, symmetry, Dutch angle), or cinema references.
Return ONLY a numbered list with exactly ${count} items. Each item on its own line.
Format: "1. [variation]", "2. [variation]", etc. No other text.`;

  const body: Record<string, unknown> = {
    model: target.key,
    system_prompt: systemPrompt,
    input: `Base prompt: "${prompt}"\n\nGenerate ${count} photography-focused variations:`,
    // One-off suggestion chats shouldn't be kept in LM Studio
    store: false,
  };

  // Thinking only adds latency to a short list, but LM Studio errors on a
  // reasoning setting the model doesn't support, so send it only when allowed
  if (target.capabilities?.reasoning?.allowed_options.includes("off")) {
    body.reasoning = "off";
  }

  const response = await lmstudioFetch("/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      /* raw text */
    }
    throw new Error(`LM Studio suggest call failed (${response.status}): ${message}`);
  }

  const data = (await response.json()) as {
    output?: Array<{ type: string; content?: string }>;
  };

  // Only "message" items are the answer; reasoning and tool-call items are skipped
  const text = (data.output ?? [])
    .filter((item) => item.type === "message")
    .map((item) => item.content ?? "")
    .join("\n");

  return parseVariations(text, count);
}
