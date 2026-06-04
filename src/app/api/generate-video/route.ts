import { NextRequest } from "next/server";
import { generateVideo } from "@/lib/veo";

export const dynamic = "force-dynamic";
// Veo generation can take several minutes
export const maxDuration = 600;

interface VideoGenerateRequest {
  prompt: string;
  model: string;
  imageDataUris?: string[];
}

function encodeSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: VideoGenerateRequest;
  try {
    body = (await request.json()) as VideoGenerateRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { prompt, model, imageDataUris = [] } = body;

  if (!prompt || !model) {
    return new Response(
      JSON.stringify({ error: "prompt and model are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: unknown) {
        controller.enqueue(encoder.encode(encodeSSE(data)));
      }

      try {
        const result = await generateVideo(
          model,
          prompt,
          imageDataUris,
          (elapsedMs) => {
            send({ status: "generating", elapsedMs });
          }
        );
        send({ status: "done", filePath: result.filePath, durationMs: result.durationMs });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        console.log(`[generate-video] ${model} failed: ${error}`);
        send({ status: "error", error });
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
