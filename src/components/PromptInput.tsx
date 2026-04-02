"use client";

import { useState, useRef, useEffect } from "react";

const DEFAULT_MODELS = ["x/flux2-klein:latest", "x/z-image-turbo:latest"];

interface PromptInputProps {
  onGenerate: (
    prompt: string,
    models: string[],
    imagesPerModel: number,
    options: { width?: number; height?: number; steps?: number }
  ) => void;
  isGenerating: boolean;
  value: string;
  onChange: (value: string) => void;
  availableModels?: string[];
}

export default function PromptInput({
  onGenerate,
  isGenerating,
  value,
  onChange,
  availableModels = DEFAULT_MODELS,
}: PromptInputProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>(
    DEFAULT_MODELS.filter((m) =>
      availableModels.length === 0 ? true : availableModels.includes(m)
    )
  );
  const [imagesPerModel, setImagesPerModel] = useState(2);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [steps, setSteps] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function toggleModel(model: string) {
    setSelectedModels((prev) =>
      prev.includes(model)
        ? prev.filter((m) => m !== model)
        : [...prev, model]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || isGenerating || selectedModels.length === 0) return;

    onGenerate(value.trim(), selectedModels, imagesPerModel, {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      steps: steps ? parseInt(steps) : undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const modelsToShow = availableModels.length > 0 ? availableModels : DEFAULT_MODELS;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Prompt textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the image you want to generate..."
          rows={3}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 placeholder-neutral-600 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
        />
        <div className="absolute bottom-2 right-3 text-neutral-700 text-xs pointer-events-none">
          {value.length > 0 && <span>{value.length} chars</span>}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Model selection */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-neutral-500 text-xs">Models:</span>
          {modelsToShow.map((model) => {
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

        {/* Images per model */}
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-xs">Images/model:</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setImagesPerModel(n)}
              className={`w-7 h-7 rounded-md text-xs transition-colors border ${
                imagesPerModel === n
                  ? "bg-violet-800/50 border-violet-600 text-violet-200"
                  : "bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-neutral-600 hover:text-neutral-400 text-xs transition-colors ml-auto"
        >
          {showAdvanced ? "Hide" : "Advanced"} options
        </button>
      </div>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-neutral-900/50 rounded-lg border border-neutral-800">
          <label className="flex items-center gap-2">
            <span className="text-neutral-500 text-xs w-14">Width</span>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="1024"
              className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-neutral-500 text-xs w-14">Height</span>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="1024"
              className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-neutral-500 text-xs w-14">Steps</span>
            <input
              type="number"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="20"
              className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:border-violet-500"
            />
          </label>
        </div>
      )}

      {/* Generate button */}
      <button
        type="submit"
        disabled={isGenerating || !value.trim() || selectedModels.length === 0}
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
            <span className="text-violet-300/70 text-xs font-normal">
              ⌘↵
            </span>
          </>
        )}
      </button>
    </form>
  );
}
