---
name: Image Prompt Workbench - Project Context
description: Key facts about the photo-prompting project structure, tech stack, and implementation decisions
type: project
---

This is "Image Prompt Workbench" — a local Next.js 16 (App Router) app for testing image generation prompts across Ollama models with a photography suggestions panel.

**Why:** Solo local tool, no auth, no persistence in v1. Ollama runs on localhost:11434.

**How to apply:** Keep all state in React (no external state lib). Keep all images as data URIs (no disk writes). All Ollama calls go through `src/lib/ollama.ts` abstraction.

Key implementation facts:
- Next.js 16.2.2 scaffolded with no `src/` dir initially — moved to `src/` layout manually. tsconfig paths alias `@/*` → `./src/*`
- Image models: `x/flux2-klein:latest`, `x/z-image-turbo:latest` (community namespace, may not be installed)
- Text model (variations): `gemma3:latest`
- Generation endpoint (`/api/generate`) uses SSE streaming — each image emits as it completes
- `/api/models` dynamically queries Ollama `/api/tags` and categorizes by name patterns
- Static photography suggestion data in `src/lib/suggestions.ts` (~72 terms across 6 categories)
- `src/app/page.tsx` is a `"use client"` page that owns all session state (rows, modal, prompt)
- v2 plans: SQLite persistence, remote providers (Gemini, DALL-E), image saving to disk
