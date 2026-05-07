# Image Prompt Workbench — Spec

> **Status:** Draft — iterating with user
> **Last updated:** 2026-05-05 (rev 2)
> **Confidence:** 90%

---

## 1. Overview

A personal web-based tool for evaluating and improving image generation prompts. Run prompts and prompt variations through multiple image generation models, view results side by side, and learn how photography terminology (lens, f-stop, focal length, lighting, film stock) affects generated images.

Built for a class in AI, photography, and cinema.

## 2. Goals

- Compare output across multiple image generation models for the same prompt
- Generate and test prompt variations to find optimal phrasing
- View results in a side-by-side grid (default: 1 image per model per prompt)
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

### v1 — Local (ComfyUI)

| Model | Type | Interface |
|-------|------|-----------|
| `comfyui/flux-dev1` | Text → Image (Flux Dev 1) | ComfyUI REST API on localhost:8188 |

- Workflow file: `flux_dev_checkpoint_example.json` (Flux Dev 1 checkpoint workflow)
- API format: POST to `/prompt` with flat node dict (subgraph expanded), poll `/history/{prompt_id}`, fetch image from `/view`
- Returns raw image bytes; converted to base64 data URI in the backend
- Default resolution: 1024×1024 (overridable via Advanced options)

### v1 — Remote (Gemini)

| Model | Provider | Notes |
|-------|----------|-------|
| `gemini/gemini-3.1-flash-image-preview` | Google (Gemini API) | API key required via `GEMINI_API_KEY` env var |

- Uses `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Request sets `responseModalities: ["IMAGE"]`; response includes `inlineData` with base64 PNG
- Width/height/steps not supported by this API; advanced options are ignored for this model
- Only appears in the model list when `GEMINI_API_KEY` is set in `.env.local`

### v1 — Remote (OpenAI)

| Model | Provider | Notes |
|-------|----------|-------|
| `openai/gpt-image-1-mini` | OpenAI API | API key required via `OPENAI_API_KEY` env var |

- Uses `https://api.openai.com/v1/images/generations`
- Request: `{"model": "gpt-image-1-mini", "prompt": "...", "n": 1, "size": "1024x1024", "response_format": "b64_json"}`
- Response: `data[0].b64_json` (base64 PNG)
- Only appears in the model list when `OPENAI_API_KEY` is set in `.env.local`
- Size can be overridden via Advanced options (1024×1024, 512×512); steps not supported

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
- Given a base prompt, the app suggests N variations using `gemma4:e4b` via Ollama
- Variations adjust style, lighting, composition, or camera parameters
- Each variation is shown with a checkbox; user selects which to run
- "Run Selected" generates one row per checked variation
- Variations inherit the current Advanced options (width/height/steps) from the last Generate

## 5. UI / Platform

### Platform
- Web app, runs locally (localhost)
- Single user, no auth needed
- Session-only — rows are not persisted across page reloads (by design; sessions are short ~30 min working blocks)

### Tech Stack
- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Next.js API routes (call Ollama/ComfyUI/Gemini, manage generated images)
- **Persistence:** None (session-only). SQLite possible for v2 if history/favorites are wanted.

### Key Views

#### Prompt View (main screen)
```
┌─────────────────────────────────────────────────┐
│  [Freeform prompt text box                    ] │
│  [Generate] [# variations: 2]                   │
├────────────────────┬────────────────────────────┤
│  Suggestions       │  Variation suggestions     │
│  Panel             │  (auto-generated,          │
│  (photography      │   checkbox to select,      │
│  terms by          │   inline-editable)         │
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

- Each row = one prompt (including each variation run as its own row)
- Columns = model outputs (configurable images/model, default 1)
- Click an image to view full size
- Rows accumulate as you generate more, so you can scroll and compare

### Error Handling
- Per-model errors are shown inline in the results grid cell (not a toast)
- Each failed cell shows the error message and a **Retry** button
- Retry reruns generation for that single model + prompt only; the cell returns to loading state while retrying
- On retry success the error is replaced by the generated image; on retry failure the error is updated
- Fatal/unexpected errors (e.g. bad request) still surface as a toast

## 6. Architecture

```
Browser (Next.js frontend)
    │
    ▼
Next.js API Routes (backend)
    │
    ├──► Ollama REST API (localhost:11434)
    │       └── x/flux2-klein, x/z-image-turbo  (image generation)
    │       └── gemma4:e4b                       (variation suggestions)
    │
    ├──► ComfyUI REST API (localhost:8188)
    │       └── flux-dev1 (Flux Dev 1 checkpoint)
    │
    ├──► Gemini API (generativelanguage.googleapis.com)
    │       └── gemini-3.1-flash-image-preview
    │
    └──► OpenAI API (api.openai.com)
            └── gpt-image-1-mini
```

### Model Classification: Remote vs Local

| Class | Prefix / type | Execution |
|-------|--------------|-----------|
| Remote | `gemini/`, `openai/` | Parallel — all start immediately |
| Local | `comfyui/`, bare Ollama names | Serial — one at a time (shared GPU) |

Remote and local groups run concurrently with each other; only models within the local group are serialised.

### Image Generation Flow
1. User submits prompt → POST /api/generate
2. Backend splits the model list into **remote** and **local** groups
3. Remote models are all dispatched immediately via `Promise.allSettled`
4. Local models are dispatched one at a time in order; the first starts immediately (concurrently with the remotes), each subsequent one waits for the previous to finish
5. As each call completes (in any order), the backend emits an SSE event with the result or error
6. Frontend renders images in the grid as events arrive — cells fill in as they complete, not left-to-right

**Example** — gemini, openai, flux2-klein, z-image-turbo selected:
```
t=0   gemini   ─────────────────────►  (remote, parallel)
t=0   openai   ──────────────────────────►  (remote, parallel)
t=0   flux2-klein  ────────────►  (local #1, starts immediately)
t=?                              z-image-turbo  ──────────►  (local #2, starts when flux2-klein finishes)
```

### Retry Flow
1. User clicks **Retry** on a failed image cell
2. Frontend POSTs `/api/generate` with the original prompt, the single failed model, and `imagesPerModel: 1`
3. The cell resets to loading state and streams the result exactly as a normal generation
4. The original `debugParams` for the row are reused (model + options are unchanged)

### Variation Suggestion Flow
1. User clicks "Suggest Variations" → POST /api/suggest
2. Backend sends the base prompt to `gemma4:e4b` (Ollama) asking for N variations
3. Returns variation strings to the frontend
4. User selects which to run via checkboxes; "Run Selected" generates one row per variation
5. Variations use the same models and Advanced options as the last Generate

### Model Dispatch
- Model names are prefixed by backend: `gemini/...`, `openai/...`, `comfyui/...`, or bare name (Ollama)
- `/api/generate` splits models into remote (`gemini/`, `openai/`) and local (`comfyui/`, bare) then dispatches accordingly (see execution model above)
- `/api/models` returns Ollama models dynamically + ComfyUI, Gemini, and OpenAI as static entries
  - Gemini only included when `GEMINI_API_KEY` is set
  - OpenAI only included when `OPENAI_API_KEY` is set

## 7. Verified API Details

### Ollama
- **Endpoint:** `POST http://localhost:11434/api/generate`
- **Request:** `{"model": "x/flux2-klein:latest", "prompt": "...", "stream": false}`
- **Response:** JSON with `model`, `created_at`, `response`, `done`, `done_reason`, `total_duration`, `load_duration`, `image` (base64 PNG)
- **Both models tested and working** (2026-04-02)
- flux2-klein output: ~480KB PNG
- z-image-turbo output: ~570KB PNG
- **Note:** Ollama broke with their latest update as of 2026-04-14; on hold

### ComfyUI
- **Endpoint:** `POST http://localhost:8188/prompt`
- **Request:** `{"prompt": <API-format workflow dict>}`
- **Response:** `{"prompt_id": "...", ...}`
- Poll `GET /history/{prompt_id}` until `status.completed = true`
- Fetch image: `GET /view?filename=...&subfolder=...&type=output` → raw image bytes
- Workflow source: `flux_dev_checkpoint_example.json` (subgraph expanded to flat API format at runtime)

### Gemini
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}`
- **Request:** `{"contents": [{"parts": [{"text": "..."}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}`
- **Response:** `candidates[0].content.parts[]` — find part with `inlineData.data` (base64) and `inlineData.mimeType`

### OpenAI
- **Endpoint:** `POST https://api.openai.com/v1/images/generations`
- **Request:** `{"model": "gpt-image-1-mini", "prompt": "...", "n": 1, "size": "1024x1024", "response_format": "b64_json"}`
- **Response:** `data[0].b64_json` (base64 PNG)
- Auth: `Authorization: Bearer ${OPENAI_API_KEY}` header

## 8. Debug Panel

A collapsible debug panel shown below each result row (or as a drawer) displaying the exact parameters sent to each model for that generation.

### Contents
- Model name and backend prefix
- Full prompt text (after any variation substitution)
- All request parameters: `size`, `steps`, `n`, and any model-specific fields (e.g. `response_format`, `responseModalities`)
- Timestamp and approximate generation duration

### Behavior
- Collapsed by default; user expands per-row with a "Debug" toggle
- Read-only, copy-to-clipboard button for the raw JSON payload
- Helps users understand what was actually sent when results look unexpected

### Server-side error logging
When any model backend returns a non-200 HTTP status, the API route logs the details via `console.log` — visible in the terminal running `next dev`. Log line includes the model name, HTTP status code, and raw response body. This is in addition to the error being surfaced in the UI cell.

## 9. Unit Tests

### Scope
Unit tests cover the backend API route logic and utility functions. UI components are not unit-tested (manual browser testing is sufficient for this personal tool).

### Framework
- **Jest** with `ts-jest` for TypeScript support
- Test files colocated as `*.test.ts` alongside source files, or grouped under `__tests__/`

### What to Test

| Area | Examples |
|------|---------|
| Model dispatch | `gemini/...` routes to Gemini client; `openai/...` routes to OpenAI client; bare name routes to Ollama |
| Model list filtering | Gemini excluded when `GEMINI_API_KEY` unset; OpenAI excluded when `OPENAI_API_KEY` unset |
| Base64 utilities | Encode/decode round-trips; data URI construction |
| Request builders | Correct shape of Ollama, ComfyUI, Gemini, and OpenAI payloads given a prompt + options |
| Variation parser | LLM response string → array of clean variation strings |

### What Not to Test
- Actual HTTP calls to external services (mock the fetch/axios layer)
- Next.js routing and middleware (framework responsibility)
- UI rendering

## 10. Prompt Queue

Allows the user to line up multiple prompts in advance and walk away while they run sequentially.

### UI

```
┌──────────────────────────────────────────┐
│ Prompt Queue                             │
│                                          │
│ [prompt text input                ] [Add]│
│                                          │
│  1. a foggy pier at dawn            [✕]  │
│  2. golden hour on a beach          [✕]  │
│  3. rainy city street at night      [✕]  │
│                                          │
│  [Run Queue (3)]           [Clear all]   │
└──────────────────────────────────────────┘
```

- Text input + **Add** button; each press appends the prompt to the list
- Each queued item has a remove (✕) button, available only before the queue starts
- **Run Queue** is disabled when the list is empty
- While running, items and the Add button are locked; **Run Queue** becomes **Stop**
- **Stop** cancels the queue after the current generation finishes (does not mid-stream abort)
- After the queue finishes (or is stopped), the list clears automatically

### Behaviour
- All queued prompts run with the models and Advanced options that are active at the moment **Run Queue** is clicked — settings do not need to match what's in the main prompt box
- Prompts execute one at a time in list order; each produces a new row in the Results Grid as it completes
- On failure, the row shows the error (retry button available as normal) and the queue continues to the next prompt
- Queue state is session-only (not persisted across reloads)

### Architecture note
- Reuses the existing `runGeneration()` frontend function, called in a loop (same pattern as variation runs)
- No new API endpoints needed

## 11. Open Questions

1. **How many variations to suggest?** Starting with 3-5 seems reasonable.
2. **Persistence for v2** — save history, favorites, ratings?
3. **Remote model integration** — API key management, cost tracking?
4. **Image resolution/size options** — does Ollama expose these for image models?
5. **Generation time** — each image takes several seconds. Show progress/spinners per cell.
6. **Ollama breakage** — blocked on Ollama fixing their latest update before Ollama-backed models can be tested again.
