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
