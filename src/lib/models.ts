import type { ModelInfo } from "@/types";

export function buildStaticImageModels(
  env: Record<string, string | undefined> = process.env
): ModelInfo[] {
  const models: ModelInfo[] = [{ name: "comfyui/flux-dev1", size: "local" }];

  if (env.GEMINI_API_KEY) {
    models.push({ name: "gemini/gemini-3.1-flash-image-preview", size: "remote" });
  }

  if (env.OPENAI_API_KEY) {
    models.push({ name: "openai/gpt-image-1-mini", size: "remote" });
  }

  return models;
}
