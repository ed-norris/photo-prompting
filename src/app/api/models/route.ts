import { NextResponse } from "next/server";
import { listTextModels } from "@/lib/lmstudio";
import { buildStaticImageModels, buildVideoModels } from "@/lib/models";
import type { ModelInfo, ModelsResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const imageModels = buildStaticImageModels();
  const videoModels = buildVideoModels();

  let textModels: ModelInfo[] = [];
  try {
    textModels = await listTextModels();
  } catch {
    // LM Studio not running — image models don't depend on it
  }

  const result: ModelsResponse = { imageModels, textModels, videoModels };

  return NextResponse.json(result);
}
