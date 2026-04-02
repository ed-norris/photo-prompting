"use client";

import { useState } from "react";
import { SUGGESTION_CATEGORIES } from "@/lib/suggestions";

interface SuggestionsPanelProps {
  onInsert: (term: string) => void;
}

export default function SuggestionsPanel({ onInsert }: SuggestionsPanelProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set([SUGGESTION_CATEGORIES[0]?.name ?? ""])
  );

  function toggleCategory(name: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <aside className="flex flex-col gap-1">
      <h3 className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
        Photography Terms
      </h3>

      {SUGGESTION_CATEGORIES.map((category) => {
        const isOpen = openCategories.has(category.name);

        return (
          <div key={category.name} className="rounded-lg overflow-hidden border border-neutral-800">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900 hover:bg-neutral-800 transition-colors text-left"
            >
              <span className="text-neutral-300 text-sm font-medium">
                {category.name}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-150 ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Terms */}
            {isOpen && (
              <div className="px-2 py-2 bg-neutral-950 flex flex-wrap gap-1.5">
                {category.terms.map((term) => (
                  <button
                    key={term.label}
                    onClick={() => onInsert(term.label)}
                    title={term.description}
                    className="px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-violet-800/60 hover:text-violet-200 text-neutral-300 text-xs transition-colors border border-neutral-700 hover:border-violet-600"
                  >
                    {term.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
