import { generateImage as ollamaGenerate } from "@/lib/ollama";
import { generateImage as geminiGenerate } from "@/lib/gemini";
import { generateImage as comfyuiGenerate } from "@/lib/comfyui";
import { generateImage as openaiGenerate } from "@/lib/openai";
import type { GeneratedImage } from "@/types";

export function dispatchGenerate(
  model: string,
  prompt: string,
  options: { width?: number; height?: number; steps?: number }
): Promise<GeneratedImage> {
  if (model.startsWith("gemini/")) {
    return geminiGenerate(model.slice("gemini/".length), prompt, options);
  }
  if (model.startsWith("comfyui/")) {
    return comfyuiGenerate(model.slice("comfyui/".length), prompt, options);
  }
  if (model.startsWith("openai/")) {
    return openaiGenerate(model.slice("openai/".length), prompt, options);
  }
  return ollamaGenerate(model, prompt, options);
}
