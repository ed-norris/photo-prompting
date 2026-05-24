"use client";

import type { GeneratedImage } from "@/types";

interface ImageCardProps {
  image: GeneratedImage | null;
  model: string;
  isLoading?: boolean;
  error?: string;
  prompt: string;
  onExpand: (image: GeneratedImage, model: string) => void;
  onRetry?: () => void;
}

export default function ImageCard({
  image,
  model,
  isLoading = false,
  error,
  prompt,
  onExpand,
  onRetry,
}: ImageCardProps) {
  const shortModel = model.split("/").pop() ?? model;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="aspect-square w-full bg-neutral-800 rounded-lg flex flex-col items-center justify-center gap-3 border border-neutral-700 animate-pulse">
          <div className="w-8 h-8 rounded-full border-2 border-neutral-500 border-t-violet-400 animate-spin" />
          <span className="text-neutral-500 text-xs text-center px-2">
            Generating...
          </span>
        </div>
        <div className="text-neutral-600 text-xs font-mono truncate text-center" title={model}>
          {shortModel}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <div className="aspect-square w-full bg-neutral-900 rounded-lg flex flex-col items-center justify-center gap-2 border border-red-900/50 p-3">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <span className="text-red-400 text-xs text-center line-clamp-3">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-1 px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs transition-colors"
            >
              Retry
            </button>
          )}
        </div>
        <div className="text-neutral-600 text-xs font-mono truncate text-center" title={model}>
          {shortModel}
        </div>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="flex flex-col gap-2">
        <div className="aspect-square w-full bg-neutral-900 rounded-lg border border-dashed border-neutral-700" />
        <div className="text-neutral-700 text-xs font-mono truncate text-center" title={model}>
          {shortModel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => onExpand(image, model)}
        className="aspect-square w-full overflow-hidden rounded-lg border border-neutral-700 hover:border-violet-500 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
        title={`View full size — ${shortModel}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.dataUri}
          alt={prompt}
          draggable
          onDragStart={(e) => {
            // Expose the data URI so ImageInput's drop handler can receive it
            // via text/uri-list (standard) and text/plain (broad compat).
            e.dataTransfer.setData("text/uri-list", image.dataUri);
            e.dataTransfer.setData("text/plain", image.dataUri);
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </button>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-neutral-500 text-xs font-mono truncate" title={model}>
          {shortModel}
        </span>
        <span className="text-neutral-600 text-xs shrink-0 ml-2">
          {(image.durationMs / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
