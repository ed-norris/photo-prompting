/**
 * Tests for the Gemini image generation client.
 * All HTTP calls are mocked — never hits a real endpoint.
 */

const FAKE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const FAKE_MIME = "image/png";

function makeGeminiResponse(includeImage = true) {
  return {
    candidates: [
      {
        content: {
          parts: includeImage
            ? [{ inlineData: { mimeType: FAKE_MIME, data: FAKE_B64 } }]
            : [{ text: "no image here" }],
        },
      },
    ],
  };
}

function mockFetch(body: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

// Set a fake API key so the guard doesn't throw
beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("Gemini generateImage — text-only (T→I)", () => {
  it("sends a single text part and no inlineData", async () => {
    mockFetch(makeGeminiResponse());
    const { generateImage } = await import("@/lib/gemini");

    await generateImage("gemini-2.0-flash-exp", "a foggy pier");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      contents: Array<{ parts: unknown[] }>;
    };
    const parts = body.contents[0].parts;

    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ text: "a foggy pier" });
  });

  it("returns a data URI for the image", async () => {
    mockFetch(makeGeminiResponse());
    const { generateImage } = await import("@/lib/gemini");
    const result = await generateImage("gemini-2.0-flash-exp", "a foggy pier");

    expect(result.dataUri).toBe(`data:${FAKE_MIME};base64,${FAKE_B64}`);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("throws when no image is returned", async () => {
    mockFetch(makeGeminiResponse(false));
    const { generateImage } = await import("@/lib/gemini");
    await expect(generateImage("gemini-2.0-flash-exp", "test")).rejects.toThrow(
      /did not include image data/
    );
  });
});

describe("Gemini generateImage — text + image (T+I→I)", () => {
  const imageDataUri = `data:image/jpeg;base64,${FAKE_B64}`;

  it("sends text part followed by inlineData part", async () => {
    mockFetch(makeGeminiResponse());
    const { generateImage } = await import("@/lib/gemini");

    await generateImage("gemini-2.0-flash-exp", "restyle this", {}, imageDataUri);

    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      contents: Array<{ parts: unknown[] }>;
    };
    const parts = body.contents[0].parts;

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ text: "restyle this" });
    expect(parts[1]).toEqual({
      inlineData: { mimeType: "image/jpeg", data: FAKE_B64 },
    });
  });

  it("returns a data URI when imageDataUri is provided", async () => {
    mockFetch(makeGeminiResponse());
    const { generateImage } = await import("@/lib/gemini");
    const result = await generateImage(
      "gemini-2.0-flash-exp",
      "restyle this",
      {},
      imageDataUri
    );
    expect(result.dataUri).toBe(`data:${FAKE_MIME};base64,${FAKE_B64}`);
  });
});

describe("Gemini generateImage — error handling", () => {
  it("throws when API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const { generateImage } = await import("@/lib/gemini");
    await expect(generateImage("gemini-2.0-flash-exp", "test")).rejects.toThrow(
      /GEMINI_API_KEY/
    );
  });

  it("throws on non-2xx response", async () => {
    mockFetch({ error: "quota exceeded" }, 429);
    const { generateImage } = await import("@/lib/gemini");
    await expect(generateImage("gemini-2.0-flash-exp", "test")).rejects.toThrow(
      /429/
    );
  });
});
