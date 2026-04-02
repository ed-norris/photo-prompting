"use client";

import type { PromptRow as PromptRowType, GeneratedImage } from "@/types";
import ImageCard from "@/components/ImageCard";

interface PromptRowProps {
  row: PromptRowType;
  models: string[];
  imagesPerModel: number;
  onExpand: (image: GeneratedImage, model: string, prompt: string) => void;
}

export default function PromptRow({
  row,
  models,
  imagesPerModel,
  onExpand,
}: PromptRowProps) {
  // Build a flat list of all slots in order: model1-img0, model1-img1, model2-img0, ...
  // For each slot, find the corresponding result if it exists
  interface Slot {
    model: string;
    imageIndex: number;
    image: GeneratedImage | null;
    isLoading: boolean;
    error?: string;
  }

  const slots: Slot[] = [];

  for (const model of models) {
    const modelResult = row.results.find((r) => r.model === model);

    for (let i = 0; i < imagesPerModel; i++) {
      const image = modelResult?.images?.[i] ?? null;
      const hasError = !!modelResult?.error && !image;

      // A slot is loading if the row is generating and we don't have a result yet
      const isLoading = row.status === "generating" && !image && !hasError;

      slots.push({
        model,
        imageIndex: i,
        image,
        isLoading,
        error: hasError ? modelResult?.error : undefined,
      });
    }
  }

  return (
    <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
      {/* Prompt header */}
      <div className="px-4 py-3 border-b border-neutral-800 flex items-start justify-between gap-4">
        <p className="text-neutral-200 text-sm leading-relaxed flex-1 min-w-0">{row.prompt}</p>
        <div className="shrink-0 flex items-center gap-2">
          {row.status === "generating" && (
            <span className="flex items-center gap-1.5 text-violet-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Generating
            </span>
          )}
          {row.status === "complete" && (
            <span className="text-neutral-600 text-xs">
              {new Date(row.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {row.status === "error" && (
            <span className="text-red-400 text-xs">Error</span>
          )}
        </div>
      </div>

      {/* Image grid */}
      <div
        className="p-4 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
        }}
      >
        {slots.map((slot) => (
          <ImageCard
            key={`${slot.model}-${slot.imageIndex}`}
            image={slot.image}
            model={slot.model}
            isLoading={slot.isLoading}
            error={slot.error}
            prompt={row.prompt}
            onExpand={(img, model) => onExpand(img, model, row.prompt)}
          />
        ))}
      </div>
    </div>
  );
}
