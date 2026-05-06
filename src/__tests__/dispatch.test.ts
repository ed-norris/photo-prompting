import { dispatchGenerate } from "@/lib/dispatch";

jest.mock("@/lib/ollama", () => ({
  generateImage: jest.fn().mockResolvedValue({ dataUri: "ollama-uri", durationMs: 100 }),
}));
jest.mock("@/lib/gemini", () => ({
  generateImage: jest.fn().mockResolvedValue({ dataUri: "gemini-uri", durationMs: 200 }),
}));
jest.mock("@/lib/comfyui", () => ({
  generateImage: jest.fn().mockResolvedValue({ dataUri: "comfyui-uri", durationMs: 300 }),
}));
jest.mock("@/lib/openai", () => ({
  generateImage: jest.fn().mockResolvedValue({ dataUri: "openai-uri", durationMs: 400 }),
}));

import { generateImage as ollamaGenerate } from "@/lib/ollama";
import { generateImage as geminiGenerate } from "@/lib/gemini";
import { generateImage as comfyuiGenerate } from "@/lib/comfyui";
import { generateImage as openaiGenerate } from "@/lib/openai";

const prompt = "a foggy pier";
const opts = { width: 1024, height: 1024 };

beforeEach(() => jest.clearAllMocks());

describe("dispatchGenerate routing", () => {
  it("routes gemini/ prefix to Gemini with prefix stripped", async () => {
    await dispatchGenerate("gemini/gemini-3.1-flash-image-preview", prompt, opts);
    expect(geminiGenerate).toHaveBeenCalledWith("gemini-3.1-flash-image-preview", prompt, opts);
    expect(ollamaGenerate).not.toHaveBeenCalled();
  });

  it("routes comfyui/ prefix to ComfyUI with prefix stripped", async () => {
    await dispatchGenerate("comfyui/flux-dev1", prompt, opts);
    expect(comfyuiGenerate).toHaveBeenCalledWith("flux-dev1", prompt, opts);
    expect(ollamaGenerate).not.toHaveBeenCalled();
  });

  it("routes openai/ prefix to OpenAI with prefix stripped", async () => {
    await dispatchGenerate("openai/gpt-image-1-mini", prompt, opts);
    expect(openaiGenerate).toHaveBeenCalledWith("gpt-image-1-mini", prompt, opts);
    expect(ollamaGenerate).not.toHaveBeenCalled();
  });

  it("routes bare model names to Ollama", async () => {
    await dispatchGenerate("x/flux2-klein:latest", prompt, opts);
    expect(ollamaGenerate).toHaveBeenCalledWith("x/flux2-klein:latest", prompt, opts);
    expect(geminiGenerate).not.toHaveBeenCalled();
    expect(openaiGenerate).not.toHaveBeenCalled();
  });

  it("passes options through unchanged", async () => {
    const customOpts = { width: 512, height: 768, steps: 20 };
    await dispatchGenerate("openai/gpt-image-1-mini", prompt, customOpts);
    expect(openaiGenerate).toHaveBeenCalledWith("gpt-image-1-mini", prompt, customOpts);
  });
});
