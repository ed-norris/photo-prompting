"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ImageInput from "@/components/ImageInput";
import type { ImageDimensions } from "@/components/ImageInput";
import ResultsGrid from "@/components/ResultsGrid";
import ImageModal from "@/components/ImageModal";
import { streamGenerationEvents, applySSEEvent } from "@/lib/generation";
import type { PromptRow, GeneratedImage, ModelsResponse } from "@/types";

function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface ModalState {
  dataUri: string;
  model: string;
  prompt: string;
  durationMs: number;
}

export default function ReferenceTab() {
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [prompt, setPrompt] = useState("");
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load only imageInput-capable models
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: ModelsResponse | { error?: string }) => {
        if ("imageModels" in data) {
          const names = data.imageModels
            .filter((m) => m.imageInput)
            .map((m) => m.name);
          setAvailableModels(names);
          setSelectedModels(names); // select all by default
        }
      })
      .catch(() => {
        // API unavailable — stay empty
      });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  const updateRow = useCallback(
    (id: string, updater: (row: PromptRow) => PromptRow) => {
      setRows((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
    },
    []
  );

  // Handle image upload — store both the data URI and the natural dimensions.
  // Dimensions are forwarded to the API so resolveSize() picks the correct
  // output aspect ratio (portrait / landscape / square) to match the reference.
  function handleImageChange(dataUri: string | null, dims?: ImageDimensions) {
    setImageDataUri(dataUri);
    setImageDimensions(dataUri && dims ? dims : null);
  }

  async function runGeneration() {
    if (!imageDataUri || !prompt.trim() || selectedModels.length === 0) return;

    const id = generateId();
    const trimmedPrompt = prompt.trim();
    const imageUri = imageDataUri;
    const dims = imageDimensions;

    const newRow: PromptRow = {
      id,
      prompt: trimmedPrompt,
      status: "generating",
      results: [],
      timestamp: Date.now(),
      debugParams: {
        models: selectedModels,
        imagesPerModel: 1,
        imageDataUri: imageUri,
        // Store dimensions so retry can pass them too
        width: dims?.width,
        height: dims?.height,
      },
    };

    setRows((prev) => [...prev, newRow]);

    try {
      await streamGenerationEvents(
        trimmedPrompt,
        selectedModels,
        1,
        { imageDataUri: imageUri, width: dims?.width, height: dims?.height },
        (event) => updateRow(id, (r) => applySSEEvent(r, event))
      );
      updateRow(id, (r) => ({ ...r, status: "complete" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateRow(id, (r) => ({
        ...r,
        status: "error",
        results: selectedModels.map((m) => ({ model: m, images: [], error: msg })),
      }));
    }
  }

  async function handleRetry(rowId: string, model: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row?.debugParams) return;

    const { imageDataUri: rowImageUri, width, height } = row.debugParams;

    updateRow(rowId, (r) => ({
      ...r,
      status: "generating",
      results: r.results.map((res) =>
        res.model === model ? { model, images: [] } : res
      ),
    }));

    try {
      await streamGenerationEvents(
        row.prompt,
        [model],
        1,
        { imageDataUri: rowImageUri, width, height },
        (event) => updateRow(rowId, (r) => applySSEEvent(r, event))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateRow(rowId, (r) => ({
        ...r,
        results: r.results.map((res) =>
          res.model === model ? { model, images: [], error: msg } : res
        ),
      }));
    } finally {
      updateRow(rowId, (r) => ({ ...r, status: "complete" }));
    }
  }

  function handleGenerate() {
    if (isGenerating) return;
    setIsGenerating(true);
    void runGeneration().finally(() => setIsGenerating(false));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }

  function toggleModel(model: string) {
    setSelectedModels((prev) =>
      prev.includes(model)
        ? prev.filter((m) => m !== model)
        : [...prev, model]
    );
  }

  function handleExpand(image: GeneratedImage, model: string, promptText: string) {
    setModal({ dataUri: image.dataUri, model, prompt: promptText, durationMs: image.durationMs });
  }

  const canGenerate = !!imageDataUri && !!prompt.trim() && selectedModels.length > 0 && !isGenerating;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-6 flex gap-6">
      {/* Center: input + results */}
      <main className="flex-1 min-w-0 flex flex-col gap-6">
        {/* Prompt row: image left, text right */}
        <section className="bg-neutral-900/50 rounded-2xl p-5 border border-neutral-800">
          <div className="flex gap-4" style={{ minHeight: "14rem" }}>
            {/*
              Image column: capped at 50vw so the reference image never takes
              more than half the viewport width. On typical screens the 40%
              width kicks in (making it visibly narrower than the text column),
              on very small viewports the 50vw cap prevents overflow.
            */}
            <div style={{ flexShrink: 0, width: "40%", maxWidth: "50vw" }}>
              <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Reference Image
              </p>
              <div className="h-52">
                <ImageInput value={imageDataUri} onChange={handleImageChange} />
              </div>
              {/* Show detected dimensions as a subtle hint */}
              {imageDimensions && (
                <p className="text-neutral-700 text-xs mt-1.5 tabular-nums">
                  {imageDimensions.width} × {imageDimensions.height}
                </p>
              )}
            </div>

            {/* Right: text prompt + controls */}
            <div className="flex-1 flex flex-col gap-3">
              <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                Prompt
              </p>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe how to transform or use the reference image..."
                rows={5}
                className="flex-1 w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 placeholder-neutral-600 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
              />

              {/* Model selector */}
              {availableModels.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-neutral-500 text-xs">Models:</span>
                  {availableModels.map((model) => {
                    const short = model.split("/").pop() ?? model;
                    const active = selectedModels.includes(model);
                    return (
                      <button
                        key={model}
                        type="button"
                        onClick={() => toggleModel(model)}
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
                </div>
              )}

              {/* Generate button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full py-2.5 rounded-xl bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Generate
                    {!imageDataUri && (
                      <span className="text-violet-300/70 text-xs font-normal">
                        (add image first)
                      </span>
                    )}
                    {imageDataUri && (
                      <span className="text-violet-300/70 text-xs font-normal">⌘↵</span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="flex flex-col gap-3">
          <ResultsGrid
            rows={rows}
            models={selectedModels}
            imagesPerModel={1}
            onExpand={handleExpand}
            onRetry={handleRetry}
            onClear={() => setRows([])}
          />
        </section>
      </main>

      {/* Image Modal */}
      {modal && (
        <ImageModal
          dataUri={modal.dataUri}
          model={modal.model}
          prompt={modal.prompt}
          durationMs={modal.durationMs}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
