import { NextResponse } from "next/server";
import { listModels } from "@/lib/ollama";
import type { ModelsResponse, ModelInfo } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // Build per-request so the array is never mutated across requests
  const staticImageModels: ModelInfo[] = [
    { name: "comfyui/flux-dev1", size: "local" },
  ];

  if (process.env.GEMINI_API_KEY) {
    staticImageModels.push({ name: "gemini/gemini-3.1-flash-image-preview", size: "remote" });
  }

  let ollamaModels: ModelsResponse = { imageModels: [], textModels: [] };
  try {
    ollamaModels = await listModels();
  } catch {
    // Ollama not running — static models still available
  }

  const result: ModelsResponse = {
    imageModels: [...ollamaModels.imageModels, ...staticImageModels],
    textModels: ollamaModels.textModels,
  };

  return NextResponse.json(result);
}
