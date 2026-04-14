# Image Prompt Workbench — Spec

> **Status:** Draft — iterating with user
> **Last updated:** 2026-04-02
> **Confidence:** 80%

---

## 1. Overview

A personal web-based tool for evaluating and improving image generation prompts. Run prompts and prompt variations through multiple local image generation models, view results side by side, and learn how photography terminology (lens, f-stop, focal length, lighting, film stock) affects generated images.

Built for a class in AI, photography, and cinema.

## 2. Goals

- Compare output across multiple image generation models for the same prompt
- Generate and test prompt variations to find optimal phrasing
- View results in a side-by-side grid (2 images per model per prompt)
- Provide suggestions for photography-related prompt terms (lens types, f-stops, focal lengths, lighting setups, film stocks, composition techniques)
- Learn how camera/photography terminology translates into visual differences in AI-generated images

## 3. Models

### v1 — Local (Ollama)

| Model | Type | Interface |
|-------|------|-----------|
| `x/flux2-klein:latest` | Text → Image (safetensors, Flux2KleinPipeline) | Ollama API on localhost:11434 |
| `x/z-image-turbo:latest` | Text → Image (safetensors) | Ollama API on localhost:11434 |

- Ollama's `POST /api/generate` endpoint: `{"model": "<name>", "prompt": "<text>", "stream": false}`
- Response JSON includes an `image` field containing the PNG as a **base64-encoded string**
- No file I/O needed — the app decodes base64 and serves images directly to the browser (or stores as data URIs)

### v2 — Remote (future)

| Model | Provider | Notes |
|-------|----------|-------|
| Imagen (nano banana 2) | Google (Gemini API) | API key required |
| DALL-E | OpenAI API | API key required, TBD |

## 4. Prompt System

### 4.1 Freeform Input
- Single text box for writing prompts
- User types whatever they want

### 4.2 Suggestions Panel
Adjacent to the text box, a panel with clickable/browsable photography terms organized by category:

- **Lens type:** 50mm prime, 85mm portrait, 24mm wide-angle, 200mm telephoto, tilt-shift, macro, fisheye
- **Aperture/f-stop:** f/1.4 (shallow DOF, bokeh), f/5.6 (balanced), f/16 (deep DOF, landscape)
- **Focal length effects:** compression, distortion, field of view
- **Lighting:** golden hour, Rembrandt lighting, high-key, low-key, neon, studio softbox, natural window light
- **Film stock / look:** Kodak Portra 400, Fuji Velvia, Tri-X 400, cinematic color grade, cross-processed
- **Composition:** rule of thirds, centered, Dutch angle, leading lines, symmetry
- **Cinema styles:** anamorphic lens flare, 35mm film grain, IMAX, Wes Anderson palette

Clicking a suggestion appends it to the prompt (or inserts at cursor).

### 4.3 Auto-generated Variations
- Given a base prompt, the app suggests N variations (using a local LLM via Ollama, e.g., qwen3.5 or gemma3)
- Variations might adjust style, lighting, composition, or camera parameters
- User picks which variations to run

## 5. UI / Platform

### Platform
- Web app, runs locally (localhost)
- Single user, no auth needed

### Tech Stack
- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Next.js API routes (call Ollama, manage generated images)
- **Persistence:** None for v1 (session-only). SQLite possible for v2 if history/favorites are wanted.

### Key Views

#### Prompt View (main screen)
```
┌─────────────────────────────────────────────────┐
│  [Freeform prompt text box                    ] │
│  [Generate] [# variations: 2]                   │
├────────────────────┬────────────────────────────┤
│  Suggestions       │  Variation suggestions     │
│  Panel             │  (auto-generated,          │
│  (photography      │   click to select/edit)    │
│  terms by          │                            │
│  category)         │                            │
├────────────────────┴────────────────────────────┤
│  Results Grid                                   │
│                                                 │
│  Prompt: "a foggy pier at sunrise, 85mm f/1.4"  │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ flux2    │ flux2    │ z-image  │ z-image  │  │
│  │ klein #1 │ klein #2 │ turbo #1 │ turbo #2 │  │
│  │          │          │          │          │  │
│  │  [img]   │  [img]   │  [img]   │  [img]   │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
│                                                 │
│  (repeat row for each prompt/variation)         │
└─────────────────────────────────────────────────┘
```

- Each row = one prompt
- Columns = model outputs (2 per model)
- Click an image to view full size
- Rows accumulate as you generate more, so you can scroll and compare

## 6. Architecture

```
Browser (Next.js frontend)
    │
    ▼
Next.js API Routes (backend)
    │
    ├──► Ollama REST API (localhost:11434)
    │       └── x/flux2-klein, x/z-image-turbo
    │       └── qwen3.5 / gemma3 (for variation suggestions)
    │
    └──► Returns base64 PNGs directly (no file storage needed)
```

### Image Generation Flow
1. User submits prompt → POST /api/generate
2. Backend calls Ollama `POST /api/generate` for each model (2 images each = 4 calls, parallelized)
3. Ollama returns JSON with `image` field (base64-encoded PNG)
4. Backend returns base64 image data to frontend
5. Frontend renders images in the grid using data URIs (`data:image/png;base64,...`)

### Variation Suggestion Flow
1. User clicks "Suggest Variations" → POST /api/suggest
2. Backend sends the base prompt to a local LLM (qwen3.5) asking for N variations
3. Returns variation strings to the frontend
4. User selects which to run

## 7. Verified API Details

- **Ollama endpoint:** `POST http://localhost:11434/api/generate`
- **Request:** `{"model": "x/flux2-klein:latest", "prompt": "...", "stream": false}`
- **Response:** JSON with `model`, `created_at`, `response`, `done`, `done_reason`, `total_duration`, `load_duration`, `image` (base64 PNG)
- **Both models tested and working** (2026-04-02)
- flux2-klein output: ~480KB PNG
- z-image-turbo output: ~570KB PNG

## 8. Open Questions

1. **How many variations to suggest?** Starting with 3-5 seems reasonable.
2. **Persistence for v2** — save history, favorites, ratings?
3. **Remote model integration** — API key management, cost tracking?
4. **Image resolution/size options** — does Ollama expose these for image models?
5. **Generation time** — each image takes several seconds. Show progress/spinners per cell.
