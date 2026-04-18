"use client";

import { useState, useEffect, useCallback } from "react";
import PromptInput from "@/components/PromptInput";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import VariationsPanel from "@/components/VariationsPanel";
import ResultsGrid from "@/components/ResultsGrid";
import ImageModal from "@/components/ImageModal";
import type {
  PromptRow,
  GeneratedImage,
  ImageSSEEvent,
  ModelsResponse,
} from "@/types";

const DEFAULT_MODELS = ["x/flux2-klein:latest", "x/z-image-turbo:latest"];

function generateId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface ModalState {
  dataUri: string;
  model: string;
  prompt: string;
  durationMs: number;
}

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [availableImageModels, setAvailableImageModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_MODELS);
  const [imagesPerModel, setImagesPerModel] = useState(1);
  const [lastOptions, setLastOptions] = useState<{ width?: number; height?: number; steps?: number }>({});

  // Load available models from Ollama on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: ModelsResponse | { error?: string }) => {
        if ("imageModels" in data && data.imageModels.length > 0) {
          const names = data.imageModels.map((m) => m.name);
          setAvailableImageModels(names);
        }
      })
      .catch(() => {
        // Ollama not running — fall back to hardcoded defaults; user will see errors on generate
      });
  }, []);

  // Update row state helper
  const updateRow = useCallback(
    (id: string, updater: (row: PromptRow) => PromptRow) => {
      setRows((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
    },
    []
  );

  async function runGeneration(
    promptText: string,
    models: string[],
    imgPerModel: number,
    options: { width?: number; height?: number; steps?: number }
  ) {
    if (isGenerating) return;

    const id = generateId();
    const newRow: PromptRow = {
      id,
      prompt: promptText,
      status: "generating",
      results: [],
      timestamp: Date.now(),
    };

    setIsGenerating(true);
    setSelectedModels(models);
    setImagesPerModel(imgPerModel);
    setLastOptions(options);
    setRows((prev) => [...prev, newRow]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          models,
          imagesPerModel: imgPerModel,
          ...options,
        }),
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "");
        let errMsg = `Generation failed: ${response.status}`;
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          if (parsed.error) errMsg = parsed.error;
        } catch { /* raw text */ }

        updateRow(id, (r) => ({
          ...r,
          status: "error",
          results: models.map((m) => ({ model: m, images: [], error: errMsg })),
        }));
        return;
      }

      // Stream SSE events
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;

          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;

          let event: ImageSSEEvent;
          try {
            event = JSON.parse(payload) as ImageSSEEvent;
          } catch {
            continue;
          }

          updateRow(id, (r) => {
            const results = [...r.results];
            const modelIdx = results.findIndex((res) => res.model === event.model);

            if (event.error) {
              // Record the error for this model
              if (modelIdx >= 0) {
                results[modelIdx] = {
                  ...results[modelIdx],
                  error: event.error,
                };
              } else {
                results.push({
                  model: event.model,
                  images: [],
                  error: event.error,
                });
              }
            } else {
              // Add the completed image
              const newImage: GeneratedImage = {
                dataUri: event.dataUri,
                durationMs: event.durationMs,
              };

              if (modelIdx >= 0) {
                const existingImages = [...results[modelIdx].images, newImage];
                results[modelIdx] = {
                  ...results[modelIdx],
                  images: existingImages,
                };
              } else {
                results.push({
                  model: event.model,
                  images: [newImage],
                });
              }
            }

            return { ...r, results };
          });
        }
      }

      // Mark row as complete
      updateRow(id, (r) => ({ ...r, status: "complete" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateRow(id, (r) => ({
        ...r,
        status: "error",
        results: models.map((m) => ({ model: m, images: [], error: msg })),
      }));
    } finally {
      setIsGenerating(false);
    }
  }

  function handleGenerate(
    promptText: string,
    models: string[],
    imgPerModel: number,
    options: { width?: number; height?: number; steps?: number }
  ) {
    void runGeneration(promptText, models, imgPerModel, options);
  }

  function handleRunVariations(prompts: string[]) {
    const run = async () => {
      for (const p of prompts) {
        await runGeneration(p, selectedModels, imagesPerModel, lastOptions);
      }
    };
    void run();
  }

  function handleInsertTerm(term: string) {
    setPrompt((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return term;
      if (trimmed.endsWith(",")) return `${trimmed} ${term}`;
      return `${trimmed}, ${term}`;
    });
  }

  function handleExpand(image: GeneratedImage, model: string, promptText: string) {
    setModal({
      dataUri: image.dataUri,
      model,
      prompt: promptText,
      durationMs: image.durationMs,
    });
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-neutral-100 font-semibold text-base tracking-tight">
              Image Prompt Workbench
            </h1>
          </div>
          <span className="text-neutral-600 text-xs font-mono">v1</span>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-screen-xl mx-auto px-6 py-6 flex gap-6">
        {/* Left sidebar: Suggestions */}
        <aside className="w-56 shrink-0 hidden lg:block">
          <SuggestionsPanel onInsert={handleInsertTerm} />
        </aside>

        {/* Center: prompt + variations + results */}
        <main className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Prompt Input */}
          <section className="flex flex-col gap-4 bg-neutral-900/50 rounded-2xl p-5 border border-neutral-800">
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              availableModels={
                availableImageModels.length > 0 ? availableImageModels : DEFAULT_MODELS
              }
            />
          </section>

          {/* Variations Panel */}
          <section className="bg-neutral-900/50 rounded-2xl p-5 border border-neutral-800">
            <h2 className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Prompt Variations
            </h2>
            <VariationsPanel
              basePrompt={prompt}
              onRunVariations={handleRunVariations}
            />
          </section>

          {/* Results */}
          <section className="flex flex-col gap-3">
            <ResultsGrid
              rows={rows}
              models={selectedModels}
              imagesPerModel={imagesPerModel}
              onExpand={handleExpand}
              onClear={() => setRows([])}
            />
          </section>
        </main>
      </div>

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
