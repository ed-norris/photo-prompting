import { NextResponse } from "next/server";
import { listModels } from "@/lib/ollama";
import { buildStaticImageModels, buildVideoModels } from "@/lib/models";
import type { ModelsResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const staticImageModels = buildStaticImageModels();
  const videoModels = buildVideoModels();

  let ollamaModels: ModelsResponse = { imageModels: [], textModels: [] };
  try {
    ollamaModels = await listModels();
  } catch {
    // Ollama not running — static models still available
  }

  const result: ModelsResponse = {
    imageModels: [...ollamaModels.imageModels, ...staticImageModels],
    textModels: ollamaModels.textModels,
    videoModels,
  };

  return NextResponse.json(result);
}
