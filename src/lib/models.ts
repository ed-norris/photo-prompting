import type { ModelInfo } from "@/types";

export function buildStaticImageModels(
  env: Record<string, string | undefined> = process.env
): ModelInfo[] {
  const models: ModelInfo[] = [{ name: "comfyui/flux-dev1", size: "local" }];

  if (env.GEMINI_API_KEY) {
    models.push({
      name: "gemini/gemini-3.1-flash-image-preview",
      size: "remote",
      imageInput: true,
    });
  }

  if (env.OPENAI_API_KEY) {
    models.push({
      name: "openai/gpt-image-1-mini",
      size: "remote",
      imageInput: true,
    });
  }

  return models;
}

/** Returns only models that support text + image → image (T+I→I tab). */
export function buildImageInputModels(
  env: Record<string, string | undefined> = process.env
): ModelInfo[] {
  return buildStaticImageModels(env).filter((m) => m.imageInput);
}
