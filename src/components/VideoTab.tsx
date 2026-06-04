"use client";

import { useState, useEffect, useRef } from "react";
import ImageInput from "@/components/ImageInput";
import VideoCard from "@/components/VideoCard";
import type { VideoRow, VideoSSEEvent, ModelsResponse } from "@/types";

function generateId(): string {
  return `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function VideoTab() {
  const [referenceImages, setReferenceImages] = useState<[string | null, string | null, string | null]>(
    [null, null, null]
  );
  const [prompt, setPrompt] = useState("");
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: ModelsResponse | { error?: string }) => {
        if ("videoModels" in data && data.videoModels && data.videoModels.length > 0) {
          const names = data.videoModels.map((m) => m.name);
          setAvailableModels(names);
          setSelectedModel(names[0]);
        }
      })
      .catch(() => {
        // API unavailable
      });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  function handleImageChange(index: 0 | 1 | 2) {
    return (dataUri: string | null) => {
      setReferenceImages((prev) => {
        const next: [string | null, string | null, string | null] = [...prev] as [string | null, string | null, string | null];
        next[index] = dataUri;
        return next;
      });
    };
  }

  async function runGeneration() {
    if (!prompt.trim() || !selectedModel || isGenerating) return;

    const id = generateId();
    const trimmedPrompt = prompt.trim();
    const imageDataUris = referenceImages.filter((uri): uri is string => uri !== null);

    const newRow: VideoRow = {
      id,
      prompt: trimmedPrompt,
      model: selectedModel,
      status: "generating",
      startedAt: Date.now(),
    };

    setRows((prev) => [...prev, newRow]);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt, model: selectedModel, imageDataUris }),
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "");
        let errMsg = `Request failed: ${response.status}`;
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          if (parsed.error) errMsg = parsed.error;
        } catch { /* raw text */ }
        throw new Error(errMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload) as VideoSSEEvent;
            if (event.status === "done" && event.filePath) {
              setRows((prev) =>
                prev.map((r) =>
                  r.id === id
                    ? { ...r, status: "complete", filePath: event.filePath, durationMs: event.durationMs }
                    : r
                )
              );
            } else if (event.status === "error") {
              setRows((prev) =>
                prev.map((r) =>
                  r.id === id ? { ...r, status: "error", error: event.error } : r
                )
              );
            }
          } catch {
            // skip malformed SSE events
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "error", error: msg } : r))
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleGenerate() {
    void runGeneration();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }

  const canGenerate = !!prompt.trim() && !!selectedModel && !isGenerating;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Input section */}
      <section className="bg-neutral-900/50 rounded-2xl p-5 border border-neutral-800 flex flex-col gap-5">

        {/* Reference image drop zones */}
        <div>
          <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-3">
            Reference Images <span className="text-neutral-700 normal-case font-normal">(optional — up to 3)</span>
          </p>
          <div className="grid grid-cols-3 gap-3">
            {([0, 1, 2] as const).map((i) => (
              <div key={i} className="h-44">
                <ImageInput value={referenceImages[i]} onChange={handleImageChange(i)} />
              </div>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-2">
            Prompt
          </p>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the video you want to generate…"
            rows={3}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 placeholder-neutral-600 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Model selector + Generate */}
        <div className="flex items-center gap-3 flex-wrap">
          {availableModels.length > 0 && (
            <>
              <span className="text-neutral-500 text-xs">Model:</span>
              {availableModels.map((model) => {
                const short = model.split("/").pop() ?? model;
                const active = selectedModel === model;
                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => setSelectedModel(model)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                      active
                        ? "bg-violet-800/50 border-violet-600 text-violet-200"
                        : "bg-neutral-800 border-neutral-700 text-neutral-500"
                    }`}
                  >
                    {short}
                  </button>
                );
              })}
            </>
          )}

          {availableModels.length === 0 && (
            <span className="text-neutral-600 text-xs">
              No video models available — set GEMINI_API_KEY in .env.local
            </span>
          )}

          <div className="ml-auto">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="px-5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Generate
                  <span className="text-violet-300/70 text-xs font-normal">⌘↵</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      {rows.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
              Generated Videos
            </h2>
            <button
              type="button"
              onClick={() => setRows([])}
              className="text-neutral-600 hover:text-neutral-400 text-xs transition-colors"
            >
              Clear all
            </button>
          </div>
          {[...rows].reverse().map((row) => (
            <VideoCard
              key={row.id}
              row={row}
              onRemove={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
            />
          ))}
        </section>
      )}
    </div>
  );
}
