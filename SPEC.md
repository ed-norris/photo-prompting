# Image Prompt Workbench — Spec

> **Status:** Draft — iterating with user
> **Last updated:** 2026-06-04 (rev 5)
> **Confidence:** 95%

---

## 1. Overview

A personal web-based tool for evaluating and improving image and video generation prompts. The app has three modes, selected by a tab bar at the top of the page:

| Tab | Label | Purpose |
|-----|-------|---------|
| Text → Image | **Text** | Run text prompts through multiple models and compare results side by side |
| Text + Image → Image | **Text and Reference** | Supply a reference image alongside a text prompt; only models that support image input are shown |
| Text + Images → Video | **Video** | Supply a text prompt and 0–3 reference images to generate a video via Gemini Veo |

Built for a class in AI, photography, and cinema.

## 2. Goals

- Compare output across multiple image generation models for the same prompt
- Generate and test prompt variations to find optimal phrasing
- View results in a side-by-side grid (default: 1 image per model per prompt)
- Provide suggestions for photography-related prompt terms (lens types, f-stops, focal lengths, lighting setups, film stocks, composition techniques)
- Learn how camera/photography terminology translates into visual differences in AI-generated images
- Use a reference image alongside a text prompt to guide generation (Text and Reference mode)

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

### v1 — Remote (Gemini Veo — Video only)

| Model | Provider | Notes |
|-------|----------|-------|
| `veo/veo-3.1-generate-preview` | Google (Gemini API) | API key required via `GEMINI_API_KEY` env var |
| `veo/veo-3.1-fast-generate-preview` | Google (Gemini API) | API key required via `GEMINI_API_KEY` env var |
| `veo/veo-2.0-generate-001` | Google (Gemini API) | API key required via `GEMINI_API_KEY` env var |

- Video-only models; never appear in the Text or Text and Reference tabs
- Only appear when `GEMINI_API_KEY` is set in `.env.local`
- Generation is async (long-running operation) — see Section 6 for the flow

## 4. Prompt System

> Sections 4.2 and 4.3 apply to the **Text tab only**. The Text and Reference tab and the Video tab have a freeform text input but no suggestions panel and no variations.

### 4.1 Freeform Input
- Single text box for writing prompts
- User types whatever they want

### 4.2 Suggestions Panel _(Text only)_
Adjacent to the text box, a panel with clickable/browsable photography terms organized by category:

- **Lens type:** 50mm prime, 85mm portrait, 24mm wide-angle, 200mm telephoto, tilt-shift, macro, fisheye
- **Aperture/f-stop:** f/1.4 (shallow DOF, bokeh), f/5.6 (balanced), f/16 (deep DOF, landscape)
- **Focal length effects:** compression, distortion, field of view
- **Lighting:** golden hour, Rembrandt lighting, high-key, low-key, neon, studio softbox, natural window light
- **Film stock / look:** Kodak Portra 400, Fuji Velvia, Tri-X 400, cinematic color grade, cross-processed
- **Composition:** rule of thirds, centered, Dutch angle, leading lines, symmetry
- **Cinema styles:** anamorphic lens flare, 35mm film grain, IMAX, Wes Anderson palette

Clicking a suggestion appends it to the prompt (or inserts at cursor).

### 4.3 Auto-generated Variations _(Text only)_
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

### Tab Bar

A tab bar appears at the very top of the page, above all other content:

```
┌──────────────────────────────────────────────────┐
│  [ Text ]  [ Text and Reference ]  [ Video ]     │
└──────────────────────────────────────────────────┘
```

Switching tabs replaces the entire content area. The selected model list, advanced options, and results are independent per tab (not shared).

---

### Key Views

#### Text tab (text to image)

```
┌─────────────────────────────────────────────────┐
│  [ Text ]  [ Text and Reference ]  [ Video ]    │  ← tab bar
├─────────────────────────────────────────────────┤
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

#### Text and Reference tab (text + image to image)

```
┌─────────────────────────────────────────────────┐
│  [ Text ]  [ Text and Reference ]  [ Video ]    │  ← tab bar
├─────────────────────────────────────────────────┤
│  Model selector (Gemini and GPT only)           │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────┬───────────────────────┐│
│  │                     │                       ││
│  │   Image input       │   Text prompt         ││
│  │                     │                       ││
│  │  Drop / click to    │   [text area      ]   ││  ← taller row, split 50/50
│  │  upload, or paste   │                       ││
│  │                     │                       ││
│  │  [thumbnail when    │                       ││
│  │   image is loaded]  │                       ││
│  └─────────────────────┴───────────────────────┘│
│  [Generate]  ← disabled until image is provided │
├─────────────────────────────────────────────────┤
│  Results Grid (same component as Text)         │
│                                                 │
│  Prompt: "repaint in watercolour style"         │
│  ┌─────────────────┬─────────────────┐          │
│  │  gemini         │  openai         │          │
│  │                 │                 │          │
│  │   [img]         │   [img]         │          │
│  └─────────────────┴─────────────────┘          │
└─────────────────────────────────────────────────┘
```

**Constraints vs Text:**
- Single prompt row only (no queue, no variations)
- No photography suggestions panel
- Only models that support image input are shown: `gemini/gemini-3.1-flash-image-preview` and `openai/gpt-image-1-mini`
- Generate button is disabled until an image is loaded
- Results grid is the same shared component as Text

**Image input slot:**
- Left half of the prompt row, same height as the text side
- Empty state: drag-and-drop zone with "Drop image here, click to browse, or paste" hint
- Accepts:
  - **File picker** — any format the browser can decode (PNG, JPG, WebP, HEIC, GIF, …)
  - **Clipboard paste** — Cmd/Ctrl+V anywhere on the page
  - **Drag from Finder / filesystem** — file items, including those with no MIME type (e.g. Obsidian attachments)
  - **Drag from within the app** — generated result images expose their data URI via `text/uri-list` so they can be dragged directly into the slot
  - **Drag from other apps** — URI list (`text/uri-list`) and HTML `<img src>` fallback for apps that don't provide a file item
- Every image is decoded through a `<canvas>` and re-encoded as PNG. This normalises HEIC and any other format the browser supports, ensures API compatibility, and captures the image's natural pixel dimensions.
- The detected dimensions (width × height) are shown below the thumbnail and forwarded to the API so `resolveSize()` can pick the matching output aspect ratio (portrait / landscape / square).
- Loaded state: shows a thumbnail with hover controls — **Replace** (re-opens file picker) and **Remove** (clears the slot)
- Image stored as a base64 PNG data URI in React state; never written to disk

#### Video tab (text + 0–3 images → video)

```
┌─────────────────────────────────────────────────┐
│  [ Text ]  [ Text and Reference ]  [ Video ]    │  ← tab bar
├─────────────────────────────────────────────────┤
│  Model selector (Veo models only)               │
├─────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┐             │
│  │          │          │          │             │
│  │ Image 1  │ Image 2  │ Image 3  │  ← drop zones
│  │ (drop /  │ (drop /  │ (drop /  │
│  │  paste)  │  paste)  │  paste)  │             │
│  └──────────┴──────────┴──────────┘             │
│                                                 │
│  [Prompt text area                            ] │
│                                                 │
│  [Generate]  ⌘↵                                │
├─────────────────────────────────────────────────┤
│  Video Results                                  │
│                                                 │
│  Prompt: "make this man pick up the vase"       │
│  ┌─────────────────────────────────────────┐    │
│  │  veo-3.1-generate-preview  •  48s gen   │    │
│  │  ┌─────────────────────────────────┐    │    │
│  │  │  <video player>                 │    │    │
│  │  └─────────────────────────────────┘    │    │
│  │  [Download]                             │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  (repeat card for each generation run)          │
└─────────────────────────────────────────────────┘
```

**Constraints:**
- Single prompt at a time (no queue, no variations, no suggestions)
- Only Veo models shown (gated on `GEMINI_API_KEY`)
- 3 fixed image drop zones; all are optional (0 images = text-to-video)
- Generate button enabled as long as a prompt is entered and a model is selected
- One active generation at a time; button disabled while generating

**Reference image slots:**
- Same `ImageInput` component as the Text and Reference tab
- Each slot independently accepts drag-and-drop, file picker, and paste
- When an image is loaded, shows thumbnail with Replace / Remove controls
- Images passed to Veo as inline base64 data; Veo treats them as reference material (style, subjects, scenes) and/or animation start frames depending on the prompt

**Results:**
- Each generation appends a new card below
- Card shows: model name, generation time, inline `<video>` player (autoplay off, controls visible), and a Download button
- While generating, the card shows a spinner with elapsed seconds ticking up (generation takes 1–5 min)
- On error, the card shows the error message with no retry (user re-runs manually)
- Videos are saved to `public/videos/{id}.mp4` on the server and served as `/videos/{id}.mp4` by Next.js static file serving

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
    │       ├── gemini-3.1-flash-image-preview   (image generation)
    │       └── veo-3.1-*, veo-2.0-*             (video generation, long-running ops)
    │
    ├──► OpenAI API (api.openai.com)
    │       └── gpt-image-1-mini
    │
    └──► public/videos/                          (local video file storage)
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

For Text and Reference, the POST body includes an additional `imageDataUri` field (a base64 data URI). The dispatch layer passes this to the Gemini and OpenAI clients; local models (Ollama, ComfyUI) never appear in Text and Reference so they never receive it. The `imageDataUri` is optional in the API contract — its presence signals image-input mode.

### Video Generation Flow

Video generation uses a separate `/api/generate-video` SSE route (not `/api/generate`) because the Veo API is long-running and async:

1. User submits prompt + up to 3 reference image data URIs → POST `/api/generate-video` (SSE)
2. Backend POSTs to Gemini's `predictLongRunning` endpoint for the selected Veo model
3. Gemini immediately returns an operation name (e.g. `operations/abc123`)
4. Backend polls `GET /v1beta/{operation_name}` every 10 seconds until `done: true`
5. When done, the response contains a video URI (requires API key in `x-goog-api-key` header to download)
6. Backend downloads the video bytes and writes them to `public/videos/{id}.mp4`
7. Backend emits SSE done event with `{ filePath: "/videos/{id}.mp4", durationMs }`
8. Frontend renders a `<video>` player pointing at the local path

SSE events emitted during the flow:
- `{ status: "generating", elapsedMs }` — emitted every 10s during polling so the UI can show a live elapsed timer
- `{ status: "done", filePath, durationMs }` — generation complete, video ready
- `{ status: "error", error }` — generation or download failed

Reference images are passed inline as base64 in the `instances` array of the `predictLongRunning` request. With 0 images the request has only the text prompt (text-to-video). Veo treats all provided images as reference material for content, style, and subjects — the prompt instructs how they are used.

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
- **Text-only request:**
  ```json
  {"contents": [{"parts": [{"text": "..."}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}
  ```
- **Image input request (Text and Reference):** add an `inlineData` part alongside the text part:
  ```json
  {
    "contents": [{
      "parts": [
        {"text": "..."},
        {"inlineData": {"mimeType": "image/png", "data": "<base64>"}}
      ]
    }],
    "generationConfig": {"responseModalities": ["IMAGE"]}
  }
  ```
- **Response:** `candidates[0].content.parts[]` — find part with `inlineData.data` (base64) and `inlineData.mimeType`

### Gemini Veo (Video)
- **Submit endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning?key={GEMINI_API_KEY}`
- **Text-only request:**
  ```json
  {
    "instances": [{ "prompt": "..." }],
    "parameters": { "aspectRatio": "16:9" }
  }
  ```
- **With reference images:**
  ```json
  {
    "instances": [{
      "prompt": "...",
      "image": { "bytesBase64Encoded": "<base64>", "mimeType": "image/png" }
    }],
    "parameters": { "aspectRatio": "16:9" }
  }
  ```
  _(Multiple images: additional images passed as `referenceImages` array with `referenceType: "asset"`)_
- **Submit response:** `{ "name": "operations/abc123" }` — operation name for polling
- **Poll endpoint:** `GET https://generativelanguage.googleapis.com/v1beta/{operation_name}` with `x-goog-api-key: {GEMINI_API_KEY}` header
- **Poll response (in-progress):** `{ "done": false }`
- **Poll response (complete):**
  ```json
  {
    "done": true,
    "response": {
      "generateVideoResponse": {
        "generatedSamples": [{ "video": { "uri": "https://..." } }]
      }
    }
  }
  ```
- **Download:** `GET {uri}` with `x-goog-api-key: {GEMINI_API_KEY}` header → raw MP4 bytes
- Generated videos are stored on Google's servers for 2 days; the local copy in `public/videos/` persists for the session
- Poll interval: 10 seconds

### OpenAI
**Text-only (Text):**
- **Endpoint:** `POST https://api.openai.com/v1/images/generations`
- **Request:** `{"model": "gpt-image-1-mini", "prompt": "...", "n": 1, "size": "1024x1024", "response_format": "b64_json"}`
- **Response:** `data[0].b64_json` (base64 PNG)
- Auth: `Authorization: Bearer ${OPENAI_API_KEY}` header

**Image input (Text and Reference):**
- **Endpoint:** `POST https://api.openai.com/v1/images/edits`
- **Request:** `multipart/form-data` with fields: `model`, `prompt`, `n`, `size`, and `image` (PNG file bytes)
- The base64 data URI from the frontend is decoded to raw bytes and sent as a file field
- **Response:** `data[0].b64_json` (base64 PNG) — same shape as the generations endpoint
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
| Text and Reference model filtering | Only `gemini/` and `openai/` models returned for image-input mode |
| Video model filtering | Only `veo/` models returned for video mode; excluded when `GEMINI_API_KEY` unset |
| Base64 utilities | Encode/decode round-trips; data URI construction |
| Request builders | Correct shape of Ollama, ComfyUI, Gemini, and OpenAI payloads given a prompt + options |
| Gemini image input | Request includes `inlineData` part when `imageDataUri` is provided; omits it when not |
| OpenAI image input | Uses `/images/edits` endpoint (multipart) when `imageDataUri` provided; uses `/images/generations` otherwise |
| Veo request builder | Correct `predictLongRunning` shape with and without reference images |
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
