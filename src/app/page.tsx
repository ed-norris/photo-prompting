"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PromptInput from "@/components/PromptInput";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import VariationsPanel from "@/components/VariationsPanel";
import ResultsGrid from "@/components/ResultsGrid";
import ImageModal from "@/components/ImageModal";
import QueuePanel from "@/components/QueuePanel";
import TabBar from "@/components/TabBar";
import ReferenceTab from "@/components/ReferenceTab";
import VideoTab from "@/components/VideoTab";
import { streamGenerationEvents, applySSEEvent } from "@/lib/generation";
import type {
  PromptRow,
  GeneratedImage,
  ModelsResponse,
} from "@/types";
import type { ActiveTab } from "@/components/TabBar";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("text");
  const [prompt, setPrompt] = useState("");
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [availableImageModels, setAvailableImageModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_MODELS);
  const [imagesPerModel, setImagesPerModel] = useState(1);
  const [lastOptions, setLastOptions] = useState<{ width?: number; height?: number; steps?: number }>({});

  // Queue state
  const [queue, setQueue] = useState<string[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const cancelQueueRef = useRef(false);

  // Load available models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: ModelsResponse | { error?: string }) => {
        if ("imageModels" in data && data.imageModels.length > 0) {
          setAvailableImageModels(data.imageModels.map((m) => m.name));
        }
      })
      .catch(() => {
        // Ollama not running — fall back to hardcoded defaults
      });
  }, []);

  const updateRow = useCallback(
    (id: string, updater: (row: PromptRow) => PromptRow) => {
      setRows((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Core generation — creates a new row and streams results into it.
  // Callers are responsible for setting isGenerating.
  // ---------------------------------------------------------------------------
  async function runGeneration(
    promptText: string,
    models: string[],
    imgPerModel: number,
    options: { width?: number; height?: number; steps?: number }
  ) {
    const id = generateId();
    const newRow: PromptRow = {
      id,
      prompt: promptText,
      status: "generating",
      results: [],
      timestamp: Date.now(),
      debugParams: { models, imagesPerModel: imgPerModel, ...options },
    };

    setRows((prev) => [...prev, newRow]);

    try {
      await streamGenerationEvents(
        promptText, models, imgPerModel, options,
        (event) => updateRow(id, (r) => applySSEEvent(r, event))
      );
      updateRow(id, (r) => ({ ...r, status: "complete" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateRow(id, (r) => ({
        ...r,
        status: "error",
        results: models.map((m) => ({ model: m, images: [], error: msg })),
      }));
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleGenerate(
    promptText: string,
    models: string[],
    imgPerModel: number,
    options: { width?: number; height?: number; steps?: number }
  ) {
    if (isGenerating) return;
    setIsGenerating(true);
    setSelectedModels(models);
    setImagesPerModel(imgPerModel);
    setLastOptions(options);
    void runGeneration(promptText, models, imgPerModel, options).finally(() =>
      setIsGenerating(false)
    );
  }

  function handleRunVariations(prompts: string[]) {
    if (isGenerating) return;
    setIsGenerating(true);
    const run = async () => {
      for (const p of prompts) {
        await runGeneration(p, selectedModels, imagesPerModel, lastOptions);
      }
    };
    void run().finally(() => setIsGenerating(false));
  }

  // Retry a single model cell within an existing row
  async function handleRetry(rowId: string, model: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row?.debugParams) return;

    const { width, height, steps } = row.debugParams;

    // Reset this model's slot back to loading
    updateRow(rowId, (r) => ({
      ...r,
      status: "generating",
      results: r.results.map((res) =>
        res.model === model ? { model, images: [] } : res
      ),
    }));

    try {
      await streamGenerationEvents(
        row.prompt, [model], 1, { width, height, steps },
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

  // Queue handlers
  function handleAddToQueue(promptText: string) {
    setQueue((prev) => [...prev, promptText]);
  }

  function handleRemoveFromQueue(index: number) {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }

  function handleClearQueue() {
    setQueue([]);
  }

  function handleRunQueue() {
    if (isGenerating || isQueueRunning || queue.length === 0) return;
    setIsGenerating(true);
    setIsQueueRunning(true);
    cancelQueueRef.current = false;

    const promptsToRun = [...queue];

    const run = async () => {
      for (const p of promptsToRun) {
        if (cancelQueueRef.current) break;
        await runGeneration(p, selectedModels, imagesPerModel, lastOptions);
      }
    };

    void run().finally(() => {
      setIsGenerating(false);
      setIsQueueRunning(false);
      setQueue([]);
    });
  }

  function handleStopQueue() {
    cancelQueueRef.current = true;
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

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Text tab */}
      {activeTab === "text" && (
        <div className="max-w-screen-xl mx-auto px-6 py-6 flex gap-6">
          {/* Left sidebar: Suggestions */}
          <aside className="w-56 shrink-0 hidden lg:block">
            <SuggestionsPanel onInsert={handleInsertTerm} />
          </aside>

          {/* Center: prompt + variations + queue + results */}
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

            {/* Prompt Queue */}
            <section className="bg-neutral-900/50 rounded-2xl p-5 border border-neutral-800">
              <h2 className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Prompt Queue
              </h2>
              <QueuePanel
                queue={queue}
                isRunning={isQueueRunning}
                onAdd={handleAddToQueue}
                onRemove={handleRemoveFromQueue}
                onClear={handleClearQueue}
                onRun={handleRunQueue}
                onStop={handleStopQueue}
              />
            </section>

            {/* Results */}
            <section className="flex flex-col gap-3">
              <ResultsGrid
                rows={rows}
                models={selectedModels}
                imagesPerModel={imagesPerModel}
                onExpand={handleExpand}
                onRetry={handleRetry}
                onClear={() => setRows([])}
              />
            </section>
          </main>
        </div>
      )}

      {/* Text and Reference tab */}
      {activeTab === "reference" && <ReferenceTab />}

      {/* Video tab */}
      {activeTab === "video" && <VideoTab />}

      {/* Image Modal (Text tab only — ReferenceTab manages its own) */}
      {activeTab === "text" && modal && (
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
