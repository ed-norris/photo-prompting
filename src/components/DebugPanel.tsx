"use client";

import { useState } from "react";
import type { DebugParams } from "@/types";

interface DebugPanelProps {
  prompt: string;
  params: DebugParams;
  timestamp: number;
}

function resolveOpenAISize(width?: number, height?: number): string {
  if (!width && !height) return "1024x1024";
  const w = width ?? height!;
  const h = height ?? width!;
  if (w > h) return "1536x1024";
  if (h > w) return "1024x1536";
  return "1024x1024";
}

function buildPayload(
  model: string,
  prompt: string,
  params: DebugParams
): Record<string, unknown> {
  const { imagesPerModel, width, height, steps } = params;

  if (model.startsWith("gemini/")) {
    return {
      model: model.slice("gemini/".length),
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    };
  }

  if (model.startsWith("openai/")) {
    return {
      model: model.slice("openai/".length),
      prompt,
      n: imagesPerModel,
      size: resolveOpenAISize(width, height),
      response_format: "b64_json",
    };
  }

  if (model.startsWith("comfyui/")) {
    const payload: Record<string, unknown> = {
      workflow: model.slice("comfyui/".length),
      prompt,
    };
    if (width) payload.width = width;
    if (height) payload.height = height;
    if (steps) payload.steps = steps;
    return payload;
  }

  // Ollama
  const payload: Record<string, unknown> = { model, prompt, stream: false };
  if (width) payload.width = width;
  if (height) payload.height = height;
  if (steps) payload.steps = steps;
  return payload;
}

export default function DebugPanel({ prompt, params, timestamp }: DebugPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(key: string, text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-3 flex flex-col gap-3">
      {/* Summary line */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-neutral-500 text-xs font-mono">
        <span>{new Date(timestamp).toLocaleTimeString()}</span>
        <span className="text-neutral-700">·</span>
        <span>{params.imagesPerModel} img/model</span>
        {params.width && (
          <>
            <span className="text-neutral-700">·</span>
            <span>{params.width}×{params.height ?? params.width}px</span>
          </>
        )}
        {params.steps && (
          <>
            <span className="text-neutral-700">·</span>
            <span>{params.steps} steps</span>
          </>
        )}
      </div>

      {/* Per-model payloads */}
      <div className="flex flex-col gap-2">
        {params.models.map((model) => {
          const payload = buildPayload(model, prompt, params);
          const json = JSON.stringify(payload, null, 2);
          const key = `copy-${model}`;
          return (
            <div
              key={model}
              className="rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800">
                <span className="text-neutral-400 text-xs font-mono">{model}</span>
                <button
                  onClick={() => copy(key, json)}
                  className="text-neutral-600 hover:text-neutral-400 text-xs transition-colors"
                >
                  {copied === key ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="px-3 py-2 text-xs text-neutral-500 font-mono overflow-x-auto whitespace-pre leading-relaxed">
                {json}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
