import type { GeneratedImage, ImageSSEEvent, PromptRow } from "@/types";

// ---------------------------------------------------------------------------
// SSE streaming helper — used by both the Text tab and the Text+Reference tab.
// ---------------------------------------------------------------------------
export async function streamGenerationEvents(
  prompt: string,
  models: string[],
  imagesPerModel: number,
  options: { width?: number; height?: number; steps?: number; imageDataUri?: string },
  onEvent: (event: ImageSSEEvent) => void
): Promise<void> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, models, imagesPerModel, ...options }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    let errMsg = `Generation failed: ${response.status}`;
    try {
      const parsed = JSON.parse(errText) as { error?: string };
      if (parsed.error) errMsg = parsed.error;
    } catch {
      /* raw text */
    }
    throw new Error(errMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        onEvent(JSON.parse(payload) as ImageSSEEvent);
      } catch {
        continue;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Apply a single SSE event to a row's results (pure helper, easily testable)
// ---------------------------------------------------------------------------
export function applySSEEvent(row: PromptRow, event: ImageSSEEvent): PromptRow {
  const results = [...row.results];
  const idx = results.findIndex((r) => r.model === event.model);

  if (event.error) {
    if (idx >= 0) results[idx] = { ...results[idx], error: event.error };
    else results.push({ model: event.model, images: [], error: event.error });
  } else {
    const newImage: GeneratedImage = {
      dataUri: event.dataUri,
      durationMs: event.durationMs,
    };
    if (idx >= 0) {
      results[idx] = { ...results[idx], images: [...results[idx].images, newImage] };
    } else {
      results.push({ model: event.model, images: [newImage] });
    }
  }

  return { ...row, results };
}
