"use client";

import { useState } from "react";

interface VariationsPanelProps {
  basePrompt: string;
  textModels: string[];
  onRunVariations: (prompts: string[]) => void;
}

export default function VariationsPanel({
  basePrompt,
  textModels,
  onRunVariations,
}: VariationsPanelProps) {
  const [variations, setVariations] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const [model, setModel] = useState("");

  // Falls back to the first model until the user picks one, or if the pick disappears
  const activeModel = textModels.includes(model) ? model : textModels[0];

  async function handleSuggest() {
    if (!basePrompt.trim()) {
      setError("Enter a prompt first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setVariations([]);
    setSelected(new Set());

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: basePrompt, count, model: activeModel }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }

      const data = (await res.json()) as { variations: string[] };
      setVariations(data.variations);
      // Select all by default
      setSelected(new Set(data.variations.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suggest variations");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditValue(variations[index]);
  }

  function commitEdit() {
    if (editingIndex === null) return;
    setVariations((prev) => {
      const next = [...prev];
      next[editingIndex] = editValue;
      return next;
    });
    setEditingIndex(null);
  }

  function handleRunSelected() {
    const selectedPrompts = variations.filter((_, i) => selected.has(i));
    if (selectedPrompts.length > 0) {
      onRunVariations(selectedPrompts);
    }
  }

  const selectedCount = selected.size;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        {textModels.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-neutral-500 text-xs">Model:</label>
            <select
              value={activeModel}
              onChange={(e) => setModel(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:border-violet-500"
            >
              {textModels.map((m) => (
                <option key={m} value={m}>
                  {m.split("/").pop() ?? m}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-neutral-500 text-xs">Variations:</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:border-violet-500"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSuggest}
          disabled={isLoading || !basePrompt.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-300 text-xs transition-colors border border-neutral-700"
        >
          {isLoading ? (
            <>
              <span className="w-3 h-3 rounded-full border border-neutral-500 border-t-violet-400 animate-spin" />
              Thinking...
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 00-1.1 2.665v.14a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-.14a3.75 3.75 0 00-1.099-2.666l-.347-.346z"
                />
              </svg>
              Suggest Variations
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2 border border-red-900/50">
          {error}
        </p>
      )}

      {/* Variation chips */}
      {variations.length > 0 && (
        <div className="flex flex-col gap-2">
          {variations.map((v, i) => (
            <div
              key={i}
              className={`group flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer ${
                selected.has(i)
                  ? "bg-violet-950/40 border-violet-700/50 text-violet-200"
                  : "bg-neutral-900 border-neutral-800 text-neutral-500"
              }`}
              onClick={() => editingIndex !== i && toggleSelect(i)}
            >
              {/* Checkbox */}
              <div
                className={`mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors ${
                  selected.has(i)
                    ? "bg-violet-600 border-violet-500"
                    : "border-neutral-700"
                }`}
              >
                {selected.has(i) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Editable text */}
              {editingIndex === i ? (
                <textarea
                  className="flex-1 bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                  rows={2}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === "Escape") {
                      setEditingIndex(null);
                    }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-xs leading-relaxed">{v}</span>
              )}

              {/* Edit button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(i);
                }}
                className="shrink-0 text-neutral-700 hover:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
          ))}

          {/* Run selected */}
          <button
            onClick={handleRunSelected}
            disabled={selectedCount === 0}
            className="self-start mt-1 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            Run {selectedCount > 0 ? selectedCount : ""} Selected{" "}
            {selectedCount === 1 ? "Variation" : "Variations"}
          </button>
        </div>
      )}
    </div>
  );
}
