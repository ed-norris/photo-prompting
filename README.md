# Image Prompt Workbench

A local web tool for evaluating and improving image and video generation prompts across multiple AI models. Built for a class in AI, photography, and cinema.

## Features

Three tabs, each with its own model set and results grid:

| Tab | Input | Purpose |
|-----|-------|---------|
| **Text** | Text prompt | Run a prompt through multiple models and compare side by side; includes a photography suggestions panel and auto-generated variations |
| **Text and Reference** | Text + reference image | Image-to-image — only models that accept image input (Gemini, GPT) |
| **Video** | Text + 0–3 reference images | Generate video via Gemini Veo models |

Results stream in as each model finishes. Per-cell retry on failure. Queue mode for running multiple prompts unattended.

## Prerequisites

- **Node.js 20+**
- **Local services** (optional — only needed for local models):
  - [Ollama](https://ollama.com) running on `localhost:11434`
  - [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running on `localhost:8188`
- **API keys** (optional — only needed for remote models):
  - `GEMINI_API_KEY` — enables Gemini image models and all Veo video models
  - `OPENAI_API_KEY` — enables `gpt-image-1-mini`

## Setup

```bash
npm install
```

Create `.env.local` at the project root with any API keys you want:

```
GEMINI_API_KEY=...
OPENAI_API_KEY=...
```

## Running

```bash
npm run dev       # dev server at http://localhost:3000
npm run build     # production build
npm start         # serve production build
npm test          # run unit tests
```

## Models

Remote models appear only when their API key is set. Local models appear only when the service is running.

| Model | Type | Requires |
|-------|------|----------|
| `gemini/gemini-3.1-flash-image-preview` | Text → Image, Text+Image → Image | `GEMINI_API_KEY` |
| `openai/gpt-image-1-mini` | Text → Image, Text+Image → Image | `OPENAI_API_KEY` |
| `comfyui/flux-dev1` | Text → Image | ComfyUI on :8188 |
| `x/flux2-klein:latest` | Text → Image | Ollama on :11434 |
| `x/z-image-turbo:latest` | Text → Image | Ollama on :11434 |
| `veo/veo-3.1-generate-preview` | Video | `GEMINI_API_KEY` |
| `veo/veo-3.1-fast-generate-preview` | Video | `GEMINI_API_KEY` |
| `veo/veo-2.0-generate-001` | Video | `GEMINI_API_KEY` |

## Architecture

See [SPEC.md](SPEC.md) for full feature details and [docs/architecture.md](docs/architecture.md) for design decisions.

All image generation is routed through `src/lib/dispatch.ts`. Remote models (Gemini, OpenAI) run in parallel; local models (ComfyUI, Ollama) run serially to avoid GPU contention. Results stream to the browser via SSE. Images are base64 data URIs in React state — nothing is written to disk except generated videos (`public/videos/`).
