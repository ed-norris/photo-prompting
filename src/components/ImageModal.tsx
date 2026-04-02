"use client";

import { useEffect, useCallback } from "react";

interface ImageModalProps {
  dataUri: string;
  model: string;
  prompt: string;
  durationMs: number;
  onClose: () => void;
}

export default function ImageModal({
  dataUri,
  model,
  prompt,
  durationMs,
  onClose,
}: ImageModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-neutral-400 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          <span>Close</span>
          <kbd className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </button>

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri}
          alt={prompt}
          className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Meta bar */}
        <div className="flex items-center justify-between bg-neutral-900/80 rounded-lg px-4 py-2 text-sm">
          <span className="text-neutral-300 font-mono text-xs truncate max-w-[60%]" title={model}>
            {model}
          </span>
          <span className="text-neutral-500 text-xs">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        </div>

        {/* Prompt */}
        <p className="text-neutral-400 text-xs text-center px-2 line-clamp-2" title={prompt}>
          {prompt}
        </p>
      </div>
    </div>
  );
}
