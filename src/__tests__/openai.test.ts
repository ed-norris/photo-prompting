import { resolveSize } from "@/lib/openai";

describe("resolveSize", () => {
  it("defaults to 1024x1024 when no dimensions given", () => {
    expect(resolveSize()).toBe("1024x1024");
    expect(resolveSize(undefined, undefined)).toBe("1024x1024");
  });

  it("returns landscape for width > height", () => {
    expect(resolveSize(1536, 1024)).toBe("1536x1024");
    expect(resolveSize(2000, 100)).toBe("1536x1024");
  });

  it("returns portrait for height > width", () => {
    expect(resolveSize(1024, 1536)).toBe("1024x1536");
  });

  it("returns square for equal dimensions", () => {
    expect(resolveSize(512, 512)).toBe("1024x1024");
    expect(resolveSize(1024, 1024)).toBe("1024x1024");
  });

  it("mirrors the given dimension when only one is provided", () => {
    // w and h both resolve to the same value → equal → square
    expect(resolveSize(1536, undefined)).toBe("1024x1024");
    expect(resolveSize(undefined, 1536)).toBe("1024x1024");
  });
});

// ---------------------------------------------------------------------------
// generateImage endpoint selection tests
// ---------------------------------------------------------------------------

const FAKE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function makeOpenAIResponse() {
  return { data: [{ b64_json: FAKE_B64 }] };
}

function mockFetch(body: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "sk-test";
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("OpenAI generateImage — text-only (T→I)", () => {
  it("calls /images/generations with JSON body", async () => {
    mockFetch(makeOpenAIResponse());
    const { generateImage } = await import("@/lib/openai");

    await generateImage("gpt-image-1-mini", "a foggy pier");

    const [url, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/images\/generations$/);
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe("gpt-image-1-mini");
    expect(body.prompt).toBe("a foggy pier");
  });

  it("returns a PNG data URI", async () => {
    mockFetch(makeOpenAIResponse());
    const { generateImage } = await import("@/lib/openai");
    const result = await generateImage("gpt-image-1-mini", "a foggy pier");
    expect(result.dataUri).toBe(`data:image/png;base64,${FAKE_B64}`);
  });

  it("throws when no b64_json in response", async () => {
    mockFetch({ data: [{}] });
    const { generateImage } = await import("@/lib/openai");
    await expect(generateImage("gpt-image-1-mini", "test")).rejects.toThrow(
      /did not include image data/
    );
  });
});

describe("OpenAI generateImage — text + image (T+I→I)", () => {
  const imageDataUri = `data:image/jpeg;base64,${FAKE_B64}`;

  it("calls /images/edits with multipart FormData", async () => {
    mockFetch(makeOpenAIResponse());
    const { generateImage } = await import("@/lib/openai");

    await generateImage("gpt-image-1-mini", "restyle this", {}, imageDataUri);

    const [url, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/images\/edits$/);
    // FormData body — no Content-Type header set manually (browser sets boundary)
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-image-1-mini");
    expect(form.get("prompt")).toBe("restyle this");
    expect(form.get("n")).toBe("1");
    expect(form.get("image")).toBeInstanceOf(Blob);
  });

  it("does NOT set Content-Type header (let fetch set it with boundary)", async () => {
    mockFetch(makeOpenAIResponse());
    const { generateImage } = await import("@/lib/openai");
    await generateImage("gpt-image-1-mini", "restyle this", {}, imageDataUri);

    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("returns a PNG data URI when imageDataUri is provided", async () => {
    mockFetch(makeOpenAIResponse());
    const { generateImage } = await import("@/lib/openai");
    const result = await generateImage(
      "gpt-image-1-mini",
      "restyle this",
      {},
      imageDataUri
    );
    expect(result.dataUri).toBe(`data:image/png;base64,${FAKE_B64}`);
  });
});

describe("OpenAI generateImage — error handling", () => {
  it("throws when API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const { generateImage } = await import("@/lib/openai");
    await expect(generateImage("gpt-image-1-mini", "test")).rejects.toThrow(
      /OPENAI_API_KEY/
    );
  });

  it("throws on non-2xx response", async () => {
    mockFetch({ error: { message: "quota exceeded" } }, 429);
    const { generateImage } = await import("@/lib/openai");
    await expect(generateImage("gpt-image-1-mini", "test")).rejects.toThrow(
      /429/
    );
  });
});
