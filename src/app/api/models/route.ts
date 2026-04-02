import { NextResponse } from "next/server";
import { listModels } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const models = await listModels();
    return NextResponse.json(models);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list models";
    console.error("[/api/models]", message);

    return NextResponse.json(
      { error: "Ollama is not running or unreachable at localhost:11434" },
      { status: 503 }
    );
  }
}
