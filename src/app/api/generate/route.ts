import { NextRequest } from "next/server";
import { dispatchGenerate } from "@/lib/dispatch";
import type { GenerateRequest, ImageSSEEvent } from "@/types";

export const dynamic = "force-dynamic";
// Image generation can take many minutes for multiple images
export const maxDuration = 600;

const REMOTE_PREFIXES = ["gemini/", "openai/"];
const isRemote = (model: string) =>
  REMOTE_PREFIXES.some((p) => model.startsWith(p));

function encodeSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function extractErrorMessage(err: unknown): string {
  let message = err instanceof Error ? err.message : "Unknown error";
  if (err instanceof Error && err.cause instanceof Error) {
    message = `${message}: ${err.cause.message}`;
  }
  return message;
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

  const remoteModels = models.filter(isRemote);
  const localModels = models.filter((m) => !isRemote(m));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: ImageSSEEvent) {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      }

      // Start all remote models immediately (parallel)
      const remotePromises = remoteModels.flatMap((model) =>
        Array.from({ length: imagesPerModel }, (_, i) =>
          dispatchGenerate(model, prompt, { width, height, steps })
            .then((image) => {
              send({
                model,
                imageIndex: i,
                dataUri: image.dataUri,
                durationMs: image.durationMs,
              });
            })
            .catch((err) => {
              const message = extractErrorMessage(err);
              console.log(`[generate] ${model} failed (remote): ${message}`);
              send({ model, imageIndex: i, dataUri: "", durationMs: 0, error: message });
            })
        )
      );

      // Run local models serially — first one starts immediately alongside remotes
      for (const model of localModels) {
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
            const message = extractErrorMessage(err);
            console.log(`[generate] ${model} failed (local): ${message}`);
            send({ model, imageIndex: i, dataUri: "", durationMs: 0, error: message });
          }
        }
      }

      // Wait for all remote work to finish before closing the stream
      await Promise.allSettled(remotePromises);

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
