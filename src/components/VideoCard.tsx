"use client";

import { useState, useEffect } from "react";
import type { VideoRow } from "@/types";

interface VideoCardProps {
  row: VideoRow;
  onRemove: () => void;
}

export default function VideoCard({ row, onRemove }: VideoCardProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (row.status !== "generating") return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - row.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [row.status, row.startedAt]);

  const modelShort = row.model.split("/").pop() ?? row.model;

  return (
    <div className="bg-neutral-900/50 rounded-2xl p-5 border border-neutral-800">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-neutral-400">{modelShort}</span>
          {row.durationMs !== undefined && (
            <span className="text-neutral-600 text-xs tabular-nums">
              {Math.round(row.durationMs / 1000)}s generation time
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-neutral-600 hover:text-neutral-400 transition-colors text-xs"
        >
          Remove
        </button>
      </div>

      {/* Prompt */}
      <p className="text-neutral-500 text-xs mb-4 line-clamp-2 leading-relaxed">
        {row.prompt}
      </p>

      {/* Generating state */}
      {row.status === "generating" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl bg-neutral-900 border border-neutral-800">
          <span className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
          <span className="text-neutral-500 text-sm tabular-nums">{elapsed}s</span>
          <span className="text-neutral-600 text-xs">Veo is generating your video…</span>
        </div>
      )}

      {/* Complete state */}
      {row.status === "complete" && row.filePath && (
        <div className="flex flex-col gap-2">
          <video
            src={row.filePath}
            controls
            playsInline
            className="w-full rounded-xl bg-neutral-900"
          />
          <div className="flex justify-end">
            <a
              href={row.filePath}
              download
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Download MP4
            </a>
          </div>
        </div>
      )}

      {/* Error state */}
      {row.status === "error" && (
        <div className="rounded-xl bg-red-950/30 border border-red-900/50 px-4 py-3 text-red-400 text-sm">
          {row.error ?? "Generation failed"}
        </div>
      )}
    </div>
  );
}
