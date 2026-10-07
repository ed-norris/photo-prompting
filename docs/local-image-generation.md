# Local Image Generation Options

> **Researched:** 2026-10-06, for the M3 Max (64 GB) this app is developed on. These projects change quickly, so re-check versions before acting on the details below.

ComfyUI (`comfyui/flux-dev1`) is the app's only local image backend. The other local tools the app has used can't fill that role:

- **LM Studio** serves LLMs and embedding models only. Its `GET /api/v1/models` lists no image models, so the app uses it just for prompt variations.
- **Ollama** removed its experimental image generation in v0.32.6 (2026-08-04) in [ollama/ollama#16615](https://github.com/ollama/ollama/pull/16615), whose whole description is "To be re-introduced on the new MLX runner in the future." No release since has brought it back (checked 2026-10-06), and the `x/z-image-turbo` page on ollama.com doesn't mention the removal.

## Comparison

| Option | Engine | Z-Image Turbo | FLUX.2 Klein | HTTP API | Work to add it to this app |
|--------|--------|---------------|--------------|----------|----------------------------|
| ComfyUI | PyTorch on Metal (MPS) | Yes | Yes | `POST /prompt`, poll `/history/{id}` | A workflow builder per model in `src/lib/comfyui.ts` |
| Draw Things | Native Metal app | Yes | Not confirmed | Optional, Automatic1111-compatible, port 7860 | New client and prefix |
| mflux | MLX (Python) | Yes | Yes (4B and 9B) | None built in | Run the CLI from a route handler, or wrap the library in a server |
| stable-diffusion.cpp | C++ on Metal | Yes | Yes | `sd-server`, OpenAI-style and Automatic1111-style (default port 1234 clashes with LM Studio) | New client and prefix; you manage the model files |
| Ollama 0.32.5, pinned | MLX | Yes | Yes | `POST /api/generate` | Restore the Ollama client removed in `dd24be0`; frozen at that version |

**Recommendation:** try Draw Things first (see [TODO.md](../TODO.md)). You download models inside its own interface, and its Automatic1111-style API returns base64 images, which matches the app's data-URI contract, so it needs only a small client. If FLUX.2 Klein matters and Draw Things doesn't have it, stable-diffusion.cpp's server is the next easiest to integrate.

Any new backend follows the existing pattern: a client in `src/lib/` that returns `{ dataUri, durationMs }`, a prefix branch in `src/lib/dispatch.ts`, and an entry in `buildStaticImageModels` in `src/lib/models.ts`. `/api/generate` treats every prefix other than `gemini/` and `openai/` as local, so a new local backend runs serially with ComfyUI without further changes.

## ComfyUI

- ComfyUI's core supports both models (the `ZImage` and `Flux2` classes in `comfy/supported_models.py`), so adding them means two more workflow builders next to the Flux Dev one in `src/lib/comfyui.ts`.
- It runs on PyTorch's Metal backend, which is usually slower on a Mac than tools built specifically for Apple Silicon, such as Draw Things and mflux.
- As of this writing, ComfyUI Desktop isn't installed on the dev machine. Its settings remain in `~/Library/Application Support/ComfyUI`, but the `~/Documents/ComfyUI` folder they point to is gone. `comfyui/flux-dev1` will fail until ComfyUI is reinstalled along with the model files the workflow loads: `flux1-dev.safetensors`, `ae.safetensors`, `clip_l.safetensors` and `t5xxl_fp16.safetensors`.

## Draw Things

- A Mac App Store app with its own Metal inference engine and a built-in model downloader.
- Turn on the API server in Settings (gear icon). It listens on `http://127.0.0.1:7860` by default and follows the Automatic1111 API: `POST /sdapi/v1/txt2img` with `prompt`, `negative_prompt`, `steps`, `sampler_name`, `cfg_scale`, `width`, `height`, `batch_size` and `seed`.
- Its developers report their Z-Image Turbo is up to 54% faster than other implementations on Apple devices, and that a 6-bit quantized build takes about 4 GiB of RAM.

Things to check when testing it:

- Whether FLUX.2 Klein is in its model list.
- That `/sdapi/v1/txt2img` returns base64 PNGs in an `images` array, as Automatic1111 does.
- How the model is chosen: per request, or whatever is selected in the app.
- How `width`, `height` and `steps` from the app's Advanced options map onto its settings.
- Whether the API keeps working while the app is in the background.
- Time for a 1024×1024 image compared with ComfyUI's Flux Dev.

## mflux

- A Python CLI and library built on MLX, Apple's machine-learning framework and the same one Ollama's image generation used. Release 0.21.0 came out 2026-10-03.
- Runs Z-Image (Turbo and Base), FLUX.2 Klein (4B and 9B), Qwen-Image 2.1, FIBO and FLUX.1.
- Install with `uv tool install --upgrade mflux`, then generate with, for example, `mflux-generate-z-image-turbo --prompt "..."`.
- It has no built-in HTTP server. `mflux.web` is only a namespace for third-party UI packages, and community front ends such as MFLUX-WEBUI exist. To use it here, a route handler would run the CLI and read back the PNG it writes, which would be the only place this app writes images to disk, or a small Python server would wrap the library.

## stable-diffusion.cpp

- A C/C++ engine with a Metal backend. Releases are continuous builds from master, and the current one includes a prebuilt macOS arm64 binary.
- Supports FLUX.2-dev and FLUX.2 Klein (since 2026-01-18), Z-Image (since 2025-12-01) and Qwen-Image 2.1 (since 2026-09-20).
- Its server (`examples/server`) has a native async API under `/sdcpp/v1/...` and compatibility APIs under `/v1/...` (OpenAI-style, e.g. `/v1/images/generations`) and `/sdapi/v1/...` (Automatic1111-style).
- The server listens on port 1234 by default, the same port as LM Studio, so start it with `--listen-port` set to something else.
- You download the model files yourself and point the server at them.

## Ollama 0.32.5, pinned

- The last release with experimental image generation. It runs `x/z-image-turbo` and `x/flux2-klein` through `POST /api/generate`, which this app called before commit `dd24be0`.
- Pinning it brings both models back, but it won't get fixes, and the app's Ollama client would need restoring from git history.

## Sources

- [ollama/ollama#16615: mlx: remove experimental image generation code for now](https://github.com/ollama/ollama/pull/16615)
- [Ollama v0.32.6 release notes](https://github.com/ollama/ollama/releases/tag/v0.32.6)
- [ComfyUI `supported_models.py`](https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py)
- [Draw Things API server overview](https://playbooks.com/skills/openclaw/skills/drawthings)
- [Draw Things: Quantify Z Image Turbo efficiency gains](https://releases.drawthings.ai/p/quantify-z-image-turbo-efficiency)
- [mflux](https://github.com/filipstrand/mflux)
- [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)
