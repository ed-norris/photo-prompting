# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js version warning

This project uses **Next.js 16.2.2**, which has breaking changes from earlier versions. Before writing any Next.js-specific code (routing, API handlers, config, middleware), read the relevant guide in `node_modules/next/dist/docs/`. Do not rely on training-data knowledge of Next.js APIs.

## Commands

```bash
npm run dev      # start dev server on localhost:3000
npm run build    # production build
npm test         # run all Jest tests
npx jest src/__tests__/dispatch.test.ts   # run a single test file
npx jest --testNamePattern "resolveSize"  # run tests matching a name
```

## Environment variables

Create `.env.local` at the project root. Remote model APIs are only available if their key is set:

```
GEMINI_API_KEY=...    # enables gemini/gemini-3.1-flash-image-preview
OPENAI_API_KEY=...    # enables openai/gpt-image-1-mini
```

ComfyUI (localhost:8188) and LM Studio (localhost:1234) need no key; they must be running locally. LM Studio serves text LLMs only and is used solely for prompt variations — it cannot generate images.

## Architecture

### Model dispatch

All image generation goes through `src/lib/dispatch.ts`. Models are identified by a prefix that determines which backend client is called:

| Prefix | Backend | Client |
|--------|---------|--------|
| `gemini/` | Google Gemini API | `src/lib/gemini.ts` |
| `openai/` | OpenAI Images API | `src/lib/openai.ts` |
| `comfyui/` | ComfyUI REST (localhost:8188) | `src/lib/comfyui.ts` |

Names without one of these prefixes are rejected.

`/api/models` returns image models gated by API key (remote) plus ComfyUI, and `textModels` listed dynamically from LM Studio's LLMs (they populate the Variations panel's model picker). Static model list logic lives in `src/lib/models.ts`.

### Execution model: remote parallel, local serial

`/api/generate` splits the selected models into two groups:
- **Remote** (`gemini/`, `openai/`): all start immediately via `Promise.allSettled`
- **Local** (`comfyui/`): run one at a time (shared GPU); first starts concurrently with remotes

SSE events are emitted in completion order — the frontend renders images as they arrive, not left-to-right.

### Generation data flow

```
page.tsx: runGeneration()
  → streamGenerationEvents()         (SSE fetch helper, also used by handleRetry)
    → POST /api/generate
      → dispatchGenerate()           (splits remote/local, dispatches to clients)
        → lib/gemini|openai|comfyui.ts
  ← SSE events → applySSEEvent()    (pure row-result updater)
  ← updates PromptRow state in React
```

### Images are base64 data URIs — no filesystem

Every model client returns `{ dataUri: "data:image/png;base64,...", durationMs }`. Images are never written to disk; they live in React state for the session and are passed directly to `<img src>`.

### Key files that are non-obvious

- `src/lib/dispatch.ts` — the single routing point for all model calls; add new backends here
- `src/lib/models.ts` — `buildStaticImageModels(env)` controls which static models appear; takes env as a parameter so it's unit-testable without process.env mutation
- `src/lib/lmstudio.ts` — LM Studio client for prompt variations and LLM listing. Uses the native `/api/v1/chat` endpoint (not the OpenAI-compatible one) so reasoning can be turned off, and sends `reasoning: "off"` only when the model's capabilities allow it, because LM Studio errors otherwise. Also exports `parseVariations` (pure, tested).
- `src/app/page.tsx` — all generation state lives here; `runGeneration` is a raw async function (no lock); callers (`handleGenerate`, `handleRunVariations`, `handleRunQueue`) manage `isGenerating`

### Unit tests

Tests are in `src/__tests__/` and cover: dispatch routing, static model env-gating, OpenAI size resolution, variation string parsing, and the LM Studio client. Tests mock all HTTP calls — never hit real services. Jest config overrides `moduleResolution` to `node` for compatibility (the app uses `bundler`).
