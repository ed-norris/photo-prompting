"use client";

import { useRef, useCallback, useEffect } from "react";

export interface ImageDimensions {
  width: number;
  height: number;
}

interface ImageInputProps {
  value: string | null; // PNG data URI or null
  onChange: (dataUri: string | null, dimensions?: ImageDimensions) => void;
}

/**
 * Decode any image (including HEIC from Apple Photos) through a canvas and
 * return a PNG data URI together with the image's natural dimensions.
 *
 * Why canvas? The browser's image decoder handles every format it supports
 * (HEIC on macOS, AVIF, WebP, …). Re-encoding as PNG gives us a format that
 * every model API accepts, and lets us read the natural pixel dimensions so
 * callers can pick the right output aspect ratio.
 */
function normalizeImage(dataUri: string): Promise<{ dataUri: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({
        dataUri: canvas.toDataURL("image/png"),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = dataUri;
  });
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFile(file: File, onChange: ImageInputProps["onChange"]) {
  const raw = await fileToDataUri(file);
  const { dataUri, width, height } = await normalizeImage(raw);
  onChange(dataUri, { width, height });
}

export default function ImageInput({ value, onChange }: ImageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Global paste handler — catches Cmd+V anywhere on the tab
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      void processFile(file, onChange);
    },
    [onChange]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file, onChange);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();

    // 1. File items — covers Finder, Obsidian, and other Electron apps.
    //    Accept items with an image MIME type OR an empty type (Obsidian often
    //    omits the MIME type when dragging attachments).
    const items = Array.from(e.dataTransfer.items);
    const fileItem = items.find(
      (item) =>
        item.kind === "file" &&
        (item.type.startsWith("image/") || item.type === "")
    );
    if (fileItem) {
      const file = fileItem.getAsFile();
      if (file) {
        await processFile(file, onChange);
        return;
      }
    }

    // 2. URI list — covers:
    //    • data: URIs from dragged <img> elements (generated results in this app)
    //    • file:// or http:// URLs provided by some apps
    const uriList = e.dataTransfer.getData("text/uri-list");
    if (uriList) {
      const uris = uriList
        .split(/\r?\n/)
        .map((u) => u.trim())
        .filter((u) => u.length > 0 && !u.startsWith("#"));
      if (uris.length > 0) {
        const uri = uris[0];
        if (uri.startsWith("data:image/")) {
          // In-app generated image drag — data URI is already available
          const { dataUri, width, height } = await normalizeImage(uri);
          onChange(dataUri, { width, height });
          return;
        }
        // file:// or http:// — fetch and convert via canvas
        try {
          const resp = await fetch(uri);
          if (resp.ok) {
            const blob = await resp.blob();
            const raw = await fileToDataUri(
              new File([blob], "image", { type: blob.type || "image/png" })
            );
            const { dataUri, width, height } = await normalizeImage(raw);
            onChange(dataUri, { width, height });
            return;
          }
        } catch {
          /* cross-origin or unavailable — fall through */
        }
      }
    }

    // 3. HTML fallback — some apps (e.g. web browsers, Notion) put an
    //    <img src="..."> in text/html; extract and use the src.
    const html = e.dataTransfer.getData("text/html");
    if (html) {
      const match = html.match(/src=["']([^"']+)["']/i);
      if (match?.[1]) {
        const src = match[1];
        if (src.startsWith("data:image/")) {
          const { dataUri, width, height } = await normalizeImage(src);
          onChange(dataUri, { width, height });
        }
      }
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  if (value) {
    return (
      <div className="relative w-full h-full min-h-40 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Reference image"
          className="w-full h-full object-contain"
        />
        {/* Overlay controls */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="px-3 py-1.5 bg-red-900/80 hover:bg-red-800 text-red-200 rounded-lg text-xs font-medium transition-colors"
          >
            Remove
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="w-full h-full min-h-40 rounded-xl border-2 border-dashed border-neutral-700 hover:border-neutral-500 bg-neutral-900/50 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Upload reference image"
    >
      <svg
        className="w-8 h-8 text-neutral-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <div className="text-center">
        <p className="text-neutral-400 text-sm">Click, drag, or paste an image</p>
        <p className="text-neutral-600 text-xs mt-0.5">PNG, JPG, WebP, HEIC, GIF</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
