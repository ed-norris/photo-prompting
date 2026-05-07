"use client";

import type { PromptRow as PromptRowType, GeneratedImage } from "@/types";
import PromptRow from "@/components/PromptRow";

interface ResultsGridProps {
  rows: PromptRowType[];
  models: string[];
  imagesPerModel: number;
  onExpand: (image: GeneratedImage, model: string, prompt: string) => void;
  onRetry: (rowId: string, model: string) => void;
  onClear: () => void;
}

export default function ResultsGrid({
  rows,
  models,
  imagesPerModel,
  onExpand,
  onRetry,
  onClear,
}: ResultsGridProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-neutral-600">
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm">Enter a prompt above and click Generate to start</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-neutral-400 text-sm font-medium">
          {rows.length} {rows.length === 1 ? "prompt" : "prompts"}
        </h2>
        <button
          onClick={onClear}
          className="text-neutral-600 hover:text-neutral-400 text-xs transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Rows — newest first */}
      <div className="flex flex-col gap-4">
        {[...rows].reverse().map((row) => (
          <PromptRow
            key={row.id}
            row={row}
            models={models}
            imagesPerModel={imagesPerModel}
            onExpand={onExpand}
            onRetry={(model) => onRetry(row.id, model)}
          />
        ))}
      </div>
    </div>
  );
}
