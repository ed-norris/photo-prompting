import { NextRequest } from "next/server";
import { dispatchGenerate } from "@/lib/dispatch";
import type { GenerateRequest, ImageSSEEvent } from "@/types";

export const dynamic = "force-dynamic";
// Image generation can take many minutes for multiple images
export const maxDuration = 600;

function encodeSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: GenerateRequest;

  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { prompt, models, imagesPerModel = 1, width, height, steps } = body;

  if (!prompt || !models || models.length === 0) {
    return new Response(
      JSON.stringify({ error: "prompt and models are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: ImageSSEEvent) {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      }

      for (const model of models) {
        for (let i = 0; i < imagesPerModel; i++) {
          try {
            const image = await dispatchGenerate(model, prompt, { width, height, steps });

            send({
              model,
              imageIndex: i,
              dataUri: image.dataUri,
              durationMs: image.durationMs,
            });
          } catch (err) {
            let message = err instanceof Error ? err.message : "Unknown error";
            // Node fetch wraps network errors (e.g. ECONNREFUSED) in err.cause
            if (err instanceof Error && err.cause instanceof Error) {
              message = `${message}: ${err.cause.message}`;
            }
            send({
              model,
              imageIndex: i,
              dataUri: "",
              durationMs: 0,
              error: message,
            });
          }
        }
      }

      // Signal completion
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
