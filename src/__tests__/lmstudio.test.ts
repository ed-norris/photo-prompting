/**
 * Tests for the LM Studio client (LLM listing and prompt variations).
 * All HTTP calls are mocked — never hits a real endpoint.
 */

import {
  LMStudioUnavailableError,
  listTextModels,
  suggestVariations,
} from "@/lib/lmstudio";

const REASONING = { allowed_options: ["off", "on"], default: "on" };

// Deliberately not in key order, so the tests below exercise the sort
const MODELS = {
  models: [
    {
      type: "llm",
      key: "qwen/qwen3.6-35b-a3b",
      size_bytes: 20429364306,
      capabilities: { vision: true, trained_for_tool_use: true, reasoning: REASONING },
    },
    {
      type: "embedding",
      key: "text-embedding-nomic-embed-text-v1.5",
      size_bytes: 84106624,
    },
    {
      type: "llm",
      key: "plain/instruct-model",
      size_bytes: 4294967296,
      capabilities: { vision: false, trained_for_tool_use: false },
    },
    {
      type: "llm",
      key: "think/always-on",
      size_bytes: 8589934592,
      capabilities: { reasoning: { allowed_options: ["on"], default: "on" } },
    },
    {
      type: "llm",
      key: "google/gemma-4-26b-a4b-qat",
      size_bytes: 15641332573,
      capabilities: { vision: true, trained_for_tool_use: true, reasoning: REASONING },
    },
  ],
};

const CHAT_REPLY = {
  model_instance_id: "google/gemma-4-26b-a4b-qat",
  output: [
    { type: "message", content: "1. Portrait with 85mm lens\n2. Wide angle with 24mm" },
  ],
};

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

// Replies by URL so a test can change the chat reply while the models listing stays fixed
function mockFetch(chatReply: Response = makeResponse(CHAT_REPLY)) {
  global.fetch = jest
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(url.endsWith("/api/v1/chat") ? chatReply : makeResponse(MODELS))
    );
}

function chatCall(): [string, RequestInit] | undefined {
  const calls = (fetch as jest.Mock).mock.calls as Array<[string, RequestInit]>;
  return calls.find(([url]) => url.endsWith("/api/v1/chat"));
}

function chatBody(): Record<string, unknown> {
  const call = chatCall();
  if (!call) throw new Error("no request was sent to /api/v1/chat");
  return JSON.parse(call[1].body as string) as Record<string, unknown>;
}

beforeEach(() => jest.clearAllMocks());

describe("LM Studio listTextModels", () => {
  it("returns only LLMs, sorted by key, with sizes in GB", async () => {
    mockFetch();

    await expect(listTextModels()).resolves.toEqual([
      { name: "google/gemma-4-26b-a4b-qat", size: "14.6GB" },
      { name: "plain/instruct-model", size: "4.0GB" },
      { name: "qwen/qwen3.6-35b-a3b", size: "19.0GB" },
      { name: "think/always-on", size: "8.0GB" },
    ]);
  });
});

describe("LM Studio unavailable", () => {
  beforeEach(() => {
    // fetch rejects (rather than resolving non-OK) when the connection is refused
    global.fetch = jest.fn().mockRejectedValue(new TypeError("fetch failed"));
  });

  it("listTextModels throws LMStudioUnavailableError", async () => {
    const error = await listTextModels().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LMStudioUnavailableError);
    expect((error as Error).message).toBe(
      "LM Studio is not running or unreachable at localhost:1234"
    );
  });

  it("suggestVariations throws LMStudioUnavailableError", async () => {
    await expect(suggestVariations("a foggy pier", 2)).rejects.toBeInstanceOf(
      LMStudioUnavailableError
    );
  });
});

describe("LM Studio suggestVariations — request", () => {
  it("posts the requested model with reasoning off, store false, and a system prompt", async () => {
    mockFetch();

    await suggestVariations("a foggy pier", 2, "qwen/qwen3.6-35b-a3b");

    const call = chatCall();
    expect(call?.[0]).toBe("http://localhost:1234/api/v1/chat");
    expect(call?.[1].method).toBe("POST");

    const body = chatBody();
    expect(body.model).toBe("qwen/qwen3.6-35b-a3b");
    expect(body.reasoning).toBe("off");
    expect(body.store).toBe(false);
    expect(typeof body.system_prompt).toBe("string");
    expect(body.input).toContain("a foggy pier");
  });

  it("omits reasoning for a model without reasoning support", async () => {
    mockFetch();

    await suggestVariations("a foggy pier", 2, "plain/instruct-model");

    const body = chatBody();
    expect(body.model).toBe("plain/instruct-model");
    expect(body).not.toHaveProperty("reasoning");
  });

  it("omits reasoning for a reasoning model that can't turn it off", async () => {
    mockFetch();

    await suggestVariations("a foggy pier", 2, "think/always-on");

    expect(chatBody()).not.toHaveProperty("reasoning");
  });

  it("uses the first LLM by key when no model is passed", async () => {
    mockFetch();

    await suggestVariations("a foggy pier", 2);

    expect(chatBody().model).toBe("google/gemma-4-26b-a4b-qat");
  });
});

describe("LM Studio suggestVariations — response", () => {
  it("parses only message output items and ignores reasoning items", async () => {
    mockFetch(
      makeResponse({
        output: [
          { type: "reasoning", content: "1. Consider lens choices\n2. Consider lighting" },
          { type: "message", content: "1. Portrait with 85mm lens\n2. Wide angle with 24mm" },
        ],
      })
    );

    await expect(suggestVariations("a foggy pier", 2)).resolves.toEqual([
      "Portrait with 85mm lens",
      "Wide angle with 24mm",
    ]);
  });
});

describe("LM Studio suggestVariations — error handling", () => {
  it("surfaces LM Studio's error message on a non-OK chat response", async () => {
    mockFetch(
      makeResponse(
        {
          error: {
            message: 'Invalid model identifier "bogus".',
            type: "invalid_request",
            param: "model",
            code: "model_not_found",
          },
        },
        404
      )
    );

    await expect(suggestVariations("a foggy pier", 2)).rejects.toThrow(
      'LM Studio suggest call failed (404): Invalid model identifier "bogus".'
    );
  });

  it("falls back to the raw body when the error isn't JSON", async () => {
    mockFetch({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    } as unknown as Response);

    await expect(suggestVariations("a foggy pier", 2)).rejects.toThrow(
      "LM Studio suggest call failed (500): Internal Server Error"
    );
  });

  it("throws without calling chat when the requested model isn't downloaded", async () => {
    mockFetch();

    await expect(suggestVariations("a foggy pier", 2, "missing/model")).rejects.toThrow(
      'LM Studio has no downloaded model "missing/model"'
    );
    expect(chatCall()).toBeUndefined();
  });
});
