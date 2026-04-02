import { NextRequest, NextResponse } from "next/server";
import { suggestVariations } from "@/lib/ollama";
import type { SuggestRequest, SuggestResponse } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: SuggestRequest;

  try {
    body = (await request.json()) as SuggestRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, count = 4 } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const variations = await suggestVariations(prompt, Math.min(count, 10));
    const response: SuggestResponse = { variations };
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate variations";
    console.error("[/api/suggest]", message);

    if (message.toLowerCase().includes("ollama")) {
      return NextResponse.json(
        { error: "Ollama is not running or unreachable at localhost:11434" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
