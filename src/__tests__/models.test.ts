import { buildStaticImageModels, buildImageInputModels } from "@/lib/models";

describe("buildStaticImageModels", () => {
  it("always includes comfyui/flux-dev1", () => {
    const names = buildStaticImageModels({}).map((m) => m.name);
    expect(names).toContain("comfyui/flux-dev1");
  });

  it("excludes Gemini when GEMINI_API_KEY is not set", () => {
    const names = buildStaticImageModels({}).map((m) => m.name);
    expect(names).not.toContain("gemini/gemini-3.1-flash-image-preview");
  });

  it("includes Gemini when GEMINI_API_KEY is set", () => {
    const names = buildStaticImageModels({ GEMINI_API_KEY: "test-key" }).map((m) => m.name);
    expect(names).toContain("gemini/gemini-3.1-flash-image-preview");
  });

  it("excludes OpenAI when OPENAI_API_KEY is not set", () => {
    const names = buildStaticImageModels({}).map((m) => m.name);
    expect(names).not.toContain("openai/gpt-image-1-mini");
  });

  it("includes OpenAI when OPENAI_API_KEY is set", () => {
    const names = buildStaticImageModels({ OPENAI_API_KEY: "sk-test" }).map((m) => m.name);
    expect(names).toContain("openai/gpt-image-1-mini");
  });

  it("includes both Gemini and OpenAI when both keys are present", () => {
    const names = buildStaticImageModels({
      GEMINI_API_KEY: "g-key",
      OPENAI_API_KEY: "o-key",
    }).map((m) => m.name);
    expect(names).toContain("gemini/gemini-3.1-flash-image-preview");
    expect(names).toContain("openai/gpt-image-1-mini");
  });

  it("marks static models as local or remote", () => {
    const models = buildStaticImageModels({
      GEMINI_API_KEY: "g-key",
      OPENAI_API_KEY: "o-key",
    });
    const comfy = models.find((m) => m.name === "comfyui/flux-dev1");
    const gemini = models.find((m) => m.name === "gemini/gemini-3.1-flash-image-preview");
    const openai = models.find((m) => m.name === "openai/gpt-image-1-mini");
    expect(comfy?.size).toBe("local");
    expect(gemini?.size).toBe("remote");
    expect(openai?.size).toBe("remote");
  });

  it("sets imageInput: true on Gemini and OpenAI, not on ComfyUI", () => {
    const models = buildStaticImageModels({
      GEMINI_API_KEY: "g-key",
      OPENAI_API_KEY: "o-key",
    });
    const comfy = models.find((m) => m.name === "comfyui/flux-dev1");
    const gemini = models.find((m) => m.name === "gemini/gemini-3.1-flash-image-preview");
    const openai = models.find((m) => m.name === "openai/gpt-image-1-mini");
    expect(comfy?.imageInput).toBeFalsy();
    expect(gemini?.imageInput).toBe(true);
    expect(openai?.imageInput).toBe(true);
  });
});

describe("buildImageInputModels", () => {
  it("returns empty array when no API keys are set", () => {
    const models = buildImageInputModels({});
    expect(models).toHaveLength(0);
  });

  it("returns only imageInput models", () => {
    const models = buildImageInputModels({
      GEMINI_API_KEY: "g-key",
      OPENAI_API_KEY: "o-key",
    });
    expect(models.every((m) => m.imageInput === true)).toBe(true);
  });

  it("excludes comfyui/flux-dev1 (no imageInput support)", () => {
    const names = buildImageInputModels({
      GEMINI_API_KEY: "g-key",
      OPENAI_API_KEY: "o-key",
    }).map((m) => m.name);
    expect(names).not.toContain("comfyui/flux-dev1");
  });

  it("includes Gemini when key is set", () => {
    const names = buildImageInputModels({ GEMINI_API_KEY: "g-key" }).map(
      (m) => m.name
    );
    expect(names).toContain("gemini/gemini-3.1-flash-image-preview");
  });

  it("includes OpenAI when key is set", () => {
    const names = buildImageInputModels({ OPENAI_API_KEY: "o-key" }).map(
      (m) => m.name
    );
    expect(names).toContain("openai/gpt-image-1-mini");
  });
});
