"use client";

import { useState } from "react";

interface QueuePanelProps {
  queue: string[];
  isRunning: boolean;
  onAdd: (prompt: string) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onRun: () => void;
  onStop: () => void;
}

export default function QueuePanel({
  queue,
  isRunning,
  onAdd,
  onRemove,
  onClear,
  onRun,
  onStop,
}: QueuePanelProps) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAdd();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a prompt to the queue…"
          disabled={isRunning}
          className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleAdd}
          disabled={isRunning || !input.trim()}
          className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {/* Queue list */}
      {queue.length > 0 && (
        <ol className="flex flex-col gap-1">
          {queue.map((prompt, i) => (
            <li
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800/60 border border-neutral-800 group"
            >
              <span className="text-neutral-600 text-xs font-mono w-4 shrink-0 text-right">
                {i + 1}
              </span>
              <span className="flex-1 text-neutral-300 text-sm truncate">{prompt}</span>
              {!isRunning && (
                <button
                  onClick={() => onRemove(i)}
                  className="text-neutral-700 hover:text-neutral-400 transition-colors shrink-0"
                  aria-label="Remove"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Action row */}
      {(queue.length > 0 || isRunning) && (
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={onStop}
              className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 text-red-400 text-sm font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <>
              <button
                onClick={onRun}
                disabled={queue.length === 0}
                className="px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Run Queue ({queue.length})
              </button>
              <button
                onClick={onClear}
                className="text-neutral-600 hover:text-neutral-400 text-xs transition-colors"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
