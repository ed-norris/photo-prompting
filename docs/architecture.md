# Image Prompt Workbench — Architecture

> **Version:** 1.0
> **Date:** 2026-04-02
> **Status:** Ready for implementation

---

## Requirements Summary

### Functional Requirements

1. **Prompt Input** — Freeform text input for image generation prompts
2. **Photography Suggestions** — Clickable panel of photography terms (lens, aperture, lighting, film stock, composition, cinema styles) that insert into the prompt
3. **Prompt Variations** — Auto-generate N variations of a base prompt using a local LLM, let user select which to run
4. **Multi-Model Generation** — Run each prompt through 2 local image models (flux2-klein, z-image-turbo), producing 2 images per model
5. **Side-by-Side Grid** — Display results in a grid: rows = prompts, columns = model outputs (4 images per row)
6. **Full-Size View** — Click any image to view at full resolution
7. **Accumulating Results** — Results persist in the session so users can scroll back and compare

### Non-Functional Requirements

- Runs locally (localhost), single user, no auth
- Must handle slow image generation gracefully (loading states, progress)
- Images served efficiently without filesystem management overhead

### Out of Scope (v1)

- Persistence / history / favorites (v2: SQLite)
- Remote model providers (v2: Gemini, DALL-E)
- User accounts / auth
- Image editing or post-processing
- Prompt version history / undo

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Browser (React)                    │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ PromptInput │  │ Suggestions  │  │ Variations  │ │
│  │ Component   │  │ Panel        │  │ Panel       │ │
│  └──────┬──────┘  └──────────────┘  └──────┬──────┘ │
│         │                                   │        │
│  ┌──────▼───────────────────────────────────▼──────┐ │
│  │              ResultsGrid Component              │ │
│  │  (rows of PromptRow → ImageCard components)     │ │
│  └─────────────────────┬───────────────────────────┘ │
│                        │                             │
│  ┌─────────────────────▼───────────────────────────┐ │
│  │           ImageModal (full-size view)            │ │
│  └─────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────┘
                         │ HTTP (fetch)
┌────────────────────────▼─────────────────────────────┐
│              Next.js API Routes (Backend)             │
│                                                      │
│  POST /api/generate    POST /api/suggest             │
│  POST /api/models                                    │
│         │                     │                      │
└─────────┼─────────────────────┼──────────────────────┘
          │                     │
┌─────────▼─────────────────────▼──────────────────────┐
│            Ollama REST API (localhost:11434)          │
│                                                      │
│  POST /api/generate                                  │
│  ├── x/flux2-klein:latest    (text → image)          │
│  ├── x/z-image-turbo:latest  (text → image)          │
│  └── gemma3:latest           (text → text, for       │
│                                variation suggestions) │
│                                                      │
│  GET /api/tags  (list available models)               │
└──────────────────────────────────────────────────────┘
```

### Image Generation Flow

1. User types prompt, clicks **Generate**
2. Frontend sends `POST /api/generate` with prompt text, selected models, image count, and optional width/height/steps
3. Backend calls Ollama `POST /api/generate` for each (model x imageCount) combination — **4 calls** by default (2 models x 2 images)
4. Ollama returns base64-encoded PNG in the `"image"` field of the JSON response
5. Backend collects all base64 images, returns them to the frontend as data URIs
6. Frontend renders the grid row

### Variation Suggestion Flow

1. User clicks **Suggest Variations**
2. Frontend sends `POST /api/suggest` with the base prompt and count
3. Backend calls Ollama with a text LLM (gemma3) with a system prompt asking for photography-focused variations
4. Backend parses the LLM response into individual variation strings
5. Frontend displays variations as selectable chips; user picks which to run
6. Selected variations are sent to `/api/generate` as a batch

### Key Insight: No Filesystem Needed for Images

Ollama returns images as base64 in JSON responses. The backend passes these directly to the frontend as data URIs. No need to save PNGs to disk or manage a `/public/generated/` directory. This simplifies the architecture significantly.

---

## Technology Stack

| Layer | Choice | Justification |
|-------|--------|---------------|
| Framework | **Next.js 15 (App Router)** | Full-stack React with API routes, spec requirement |
| Language | **TypeScript** | Type safety for API contracts and data models |
| Styling | **Tailwind CSS v4** | Rapid UI development, spec requirement |
| HTTP Client | **Built-in fetch** | Next.js server-side fetch is sufficient for Ollama calls |
| State Management | **React useState/useReducer** | Session-only state, no persistence needed — no need for a state library |
| Image Gen Backend | **Ollama** (localhost:11434) | Local, free, supports the required models |
| Text LLM | **gemma3** via Ollama | For prompt variation generation; fast, capable, runs locally |
| Package Manager | **npm** | Default, widely supported |

---

## Data Models

### Frontend State (TypeScript interfaces)

```typescript
// Photography suggestion data
interface SuggestionCategory {
  name: string;                    // e.g., "Lens Type"
  terms: SuggestionTerm[];
}

interface SuggestionTerm {
  label: string;                   // e.g., "85mm portrait"
  description?: string;            // e.g., "shallow DOF, classic portrait compression"
}

// Generation request/response
interface GenerateRequest {
  prompt: string;
  models: string[];                // e.g., ["x/flux2-klein:latest", "x/z-image-turbo:latest"]
  imagesPerModel: number;          // default: 2
  width?: number;                  // optional, e.g., 1024
  height?: number;                 // optional, e.g., 1024
  steps?: number;                  // optional diffusion steps
}

interface GenerateResponse {
  id: string;                      // unique ID for this generation batch
  prompt: string;
  results: ModelResult[];
}

interface ModelResult {
  model: string;
  images: GeneratedImage[];
  error?: string;                  // if this model failed
}

interface GeneratedImage {
  dataUri: string;                 // "data:image/png;base64,..."
  durationMs: number;              // how long generation took
}

// Variation suggestion
interface SuggestRequest {
  prompt: string;
  count: number;                   // how many variations (default: 4)
}

interface SuggestResponse {
  variations: string[];
}

// UI state
interface PromptRow {
  id: string;
  prompt: string;
  status: "pending" | "generating" | "complete" | "error";
  results: ModelResult[];
  timestamp: number;
}
```

---

## API / Interface Contracts

### `POST /api/generate`

Generate images for a prompt across multiple models.

**Request:**
```json
{
  "prompt": "a foggy pier at sunrise, 85mm f/1.4, Kodak Portra 400",
  "models": ["x/flux2-klein:latest", "x/z-image-turbo:latest"],
  "imagesPerModel": 2,
  "width": 1024,
  "height": 1024,
  "steps": 20
}
```

**Response (200):**
```json
{
  "id": "gen_1712044800_abc",
  "prompt": "a foggy pier at sunrise, 85mm f/1.4, Kodak Portra 400",
  "results": [
    {
      "model": "x/flux2-klein:latest",
      "images": [
        { "dataUri": "data:image/png;base64,...", "durationMs": 12500 },
        { "dataUri": "data:image/png;base64,...", "durationMs": 11800 }
      ]
    },
    {
      "model": "x/z-image-turbo:latest",
      "images": [
        { "dataUri": "data:image/png;base64,...", "durationMs": 8200 },
        { "dataUri": "data:image/png;base64,...", "durationMs": 7900 }
      ]
    }
  ]
}
```

**Response (500):**
```json
{
  "error": "Ollama is not running or unreachable at localhost:11434"
}
```

**Behavior:**
- Calls Ollama sequentially per model (Ollama processes one request at a time)
- If one model fails, the others still return — partial results are OK
- Streams progress events via Server-Sent Events (SSE) so the UI can show per-image progress

### `POST /api/suggest`

Generate prompt variations using a text LLM.

**Request:**
```json
{
  "prompt": "a foggy pier at sunrise",
  "count": 4
}
```

**Response (200):**
```json
{
  "variations": [
    "a foggy pier at sunrise, shot on 85mm f/1.4 with shallow depth of field, Kodak Portra 400 film",
    "a foggy pier at sunrise, wide-angle 24mm, deep focus f/16, dramatic low-key lighting",
    "a foggy pier at sunrise, anamorphic lens flare, cinematic color grade, 35mm film grain",
    "a foggy pier at sunrise, Rembrandt lighting, medium format, Fuji Velvia saturated colors"
  ]
}
```

### `GET /api/models`

List available Ollama models (for dynamic model selection).

**Response (200):**
```json
{
  "imageModels": [
    { "name": "x/flux2-klein:latest", "size": "8.2GB" },
    { "name": "x/z-image-turbo:latest", "size": "5.1GB" }
  ],
  "textModels": [
    { "name": "gemma3:latest", "size": "3.2GB" }
  ]
}
```

---

## File & Directory Structure

```
photo-prompting/
├── docs/
│   └── architecture.md            # this file
├── src/
│   ├── app/
│   │   ├── layout.tsx             # root layout with global styles
│   │   ├── page.tsx               # main prompt workbench page
│   │   ├── globals.css            # Tailwind imports
│   │   └── api/
│   │       ├── generate/
│   │       │   └── route.ts       # POST /api/generate — image generation
│   │       ├── suggest/
│   │       │   └── route.ts       # POST /api/suggest — prompt variations
│   │       └── models/
│   │           └── route.ts       # GET /api/models — list available models
│   ├── components/
│   │   ├── PromptInput.tsx        # text input + generate button
│   │   ├── SuggestionsPanel.tsx   # photography term categories
│   │   ├── VariationsPanel.tsx    # auto-generated variation chips
│   │   ├── ResultsGrid.tsx        # accumulating grid of prompt rows
│   │   ├── PromptRow.tsx          # single row: prompt label + images
│   │   ├── ImageCard.tsx          # single image with model label
│   │   └── ImageModal.tsx         # full-size image overlay
│   ├── lib/
│   │   ├── ollama.ts              # Ollama API client (generate, suggest, list models)
│   │   └── suggestions.ts         # static photography suggestion data
│   └── types/
│       └── index.ts               # shared TypeScript interfaces
├── public/
│   └── favicon.ico
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
└── .gitignore
```

---

## Key Architectural Decisions

### ADR-1: Base64 data URIs instead of saving PNGs to disk

**Decision:** Pass base64 image data from Ollama directly to the frontend as data URIs. Do not save images to the filesystem.

**Why:** Ollama returns images as base64 in JSON. Saving to disk adds complexity (naming, cleanup, path management, serving static files). For a session-only v1 with no persistence, data URIs are simpler and sufficient.

**Trade-off:** Large base64 strings in memory. For 4 images at 1024x1024, each ~1-3MB base64, this is ~12MB per generation batch. Acceptable for a local single-user tool. If persistence is added in v2, images should be saved to disk and served as URLs.

### ADR-2: Sequential Ollama calls, not parallel

**Decision:** Call Ollama sequentially (one image at a time), not in parallel.

**Why:** Ollama queues requests internally and processes one at a time (especially for GPU-bound image generation). Sending parallel requests would not speed things up and could cause timeouts.

**Mitigation:** Use SSE (Server-Sent Events) to stream progress to the frontend so the user sees images appear one at a time rather than waiting for all 4.

### ADR-3: SSE for generation progress instead of polling

**Decision:** The `/api/generate` endpoint uses Server-Sent Events to stream results as each image completes.

**Why:** Image generation takes 8-15+ seconds per image. With 4 images per prompt, the total wait is 30-60 seconds. SSE lets the UI show each image as it arrives, which is a much better UX than a spinner for 60 seconds followed by all 4 images at once.

**Implementation:** The API route uses a ReadableStream. Each time an image completes, it emits an SSE event with that image's data. The frontend uses EventSource or fetch with streaming to consume events and update the grid incrementally.

### ADR-4: Static suggestion data instead of a database

**Decision:** Photography suggestions are defined as a static TypeScript data file (`lib/suggestions.ts`), not fetched from a database or API.

**Why:** The suggestion set is curated and small (~50-100 terms across 7 categories). It changes rarely. A static file is simpler, faster, and easy to edit.

### ADR-5: gemma3 for variations instead of a larger model

**Decision:** Use gemma3 (small, fast) for generating prompt variations, not a larger model.

**Why:** Variation generation is a simple text task (rewrite a prompt with different photography terms). A small model is fast (~1-2s) and good enough. The user can always edit the suggestions before running them.

---

## Risks & Open Questions

### Risks

1. **Ollama image gen is experimental** — The `width`, `height`, `steps` parameters and image generation support are marked experimental. API could change.
   - *Mitigation:* Wrap Ollama calls in an abstraction layer (`lib/ollama.ts`) so changes are isolated.

2. **Large base64 payloads** — Streaming 4 large base64 strings per generation batch. If users generate many batches, browser memory could grow.
   - *Mitigation:* Consider a "clear results" button. In v2, save to disk and use URLs instead.

3. **Ollama model availability** — Both models are in the `x/` (community) namespace, not official. They could be removed.
   - *Mitigation:* The model list comes from `/api/models` which queries Ollama dynamically. The UI should gracefully handle missing models.

4. **Generation speed** — 8-15s per image means 30-60s for a full 4-image set. SSE helps UX but it's still slow.
   - *Mitigation:* Show per-image progress (diffusion steps) from Ollama's streaming response.

### Open Questions (Resolved)

| # | Question | Resolution |
|---|----------|------------|
| 1 | Ollama image API format | `POST /api/generate`, base64 in `"image"` field |
| 2 | How many variations? | Default 4, configurable |
| 3 | Image resolution options | `width`, `height`, `steps` top-level params (experimental) |

### Open Questions (Remaining)

| # | Question | Impact |
|---|----------|--------|
| 1 | MLX runner error for models | Blocking — models must work locally before the app is useful. User needs to verify `ollama run x/flux2-klein` works. |
| 2 | Default resolution per model | Need to test what each model supports and what defaults produce good results |
| 3 | Variation LLM model choice | Spec says qwen3.5 or gemma3 — need to verify which is installed. Architecture assumes gemma3. |
