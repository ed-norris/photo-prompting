import { parseVariations } from "@/lib/lmstudio";

describe("parseVariations", () => {
  it("parses a standard numbered list", () => {
    const raw = "1. Portrait with 85mm lens\n2. Wide angle with 24mm\n3. Macro shot";
    expect(parseVariations(raw, 3)).toEqual([
      "Portrait with 85mm lens",
      "Wide angle with 24mm",
      "Macro shot",
    ]);
  });

  it("respects the count limit", () => {
    const raw = "1. First\n2. Second\n3. Third\n4. Fourth";
    expect(parseVariations(raw, 2)).toHaveLength(2);
    expect(parseVariations(raw, 2)).toEqual(["First", "Second"]);
  });

  it("handles leading whitespace in numbered items", () => {
    const raw = "  1. Portrait\n  2. Landscape";
    expect(parseVariations(raw, 2)).toEqual(["Portrait", "Landscape"]);
  });

  it("falls back to line parsing when no numbered list found", () => {
    const raw = "- Golden hour shot\n- Blue hour shot\n- Studio lighting";
    const result = parseVariations(raw, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("Golden hour shot");
    expect(result[1]).toBe("Blue hour shot");
  });

  it("fallback strips bullet and asterisk prefixes", () => {
    const raw = "* Kodak Portra look\n* Fuji Velvia colors";
    const result = parseVariations(raw, 2);
    expect(result[0]).toBe("Kodak Portra look");
  });

  it("returns empty array for empty input", () => {
    expect(parseVariations("", 3)).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(parseVariations("   \n  \n", 3)).toEqual([]);
  });
});
