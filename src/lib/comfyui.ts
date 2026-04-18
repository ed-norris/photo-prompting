import type { GeneratedImage } from "@/types";

const COMFYUI_BASE = "http://localhost:8188";

// Builds the ComfyUI API-format workflow for Flux Dev 1.
// Expanded from flux_dev_checkpoint_example.json (subgraph nodes 47-54 + SaveImage node 9).
function buildWorkflow(
  prompt: string,
  options?: { width?: number; height?: number; steps?: number }
): Record<string, unknown> {
  const width = options?.width ?? 1024;
  const height = options?.height ?? 1024;
  const steps = options?.steps ?? 20;
  const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  return {
    "47": {
      class_type: "VAELoader",
      inputs: { vae_name: "ae.safetensors" },
    },
    "48": {
      class_type: "UNETLoader",
      inputs: { unet_name: "flux1-dev.safetensors", weight_dtype: "default" },
    },
    "49": {
      class_type: "DualCLIPLoader",
      inputs: {
        clip_name1: "clip_l.safetensors",
        clip_name2: "t5xxl_fp16.safetensors",
        type: "flux",
        device: "default",
      },
    },
    "50": {
      class_type: "EmptySD3LatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "51": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["49", 0], text: prompt },
    },
    "54": {
      class_type: "ConditioningZeroOut",
      inputs: { conditioning: ["51", 0] },
    },
    "52": {
      class_type: "KSampler",
      inputs: {
        model: ["48", 0],
        positive: ["51", 0],
        negative: ["54", 0],
        latent_image: ["50", 0],
        seed,
        steps,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
      },
    },
    "53": {
      class_type: "VAEDecode",
      inputs: { samples: ["52", 0], vae: ["47", 0] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { images: ["53", 0], filename_prefix: "flux-dev1" },
    },
  };
}

export async function generateImage(
  _model: string,
  prompt: string,
  options?: { width?: number; height?: number; steps?: number }
): Promise<GeneratedImage> {
  const start = Date.now();

  // Submit workflow
  const submitRes = await fetch(`${COMFYUI_BASE}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: buildWorkflow(prompt, options) }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`ComfyUI /prompt returned ${submitRes.status}: ${text}`);
  }

  const { prompt_id } = (await submitRes.json()) as { prompt_id: string };

  // Poll /history until the prompt is done
  const imageFilename = await pollUntilDone(prompt_id);

  // Fetch the image bytes
  const imageRes = await fetch(
    `${COMFYUI_BASE}/view?filename=${encodeURIComponent(imageFilename.filename)}&subfolder=${encodeURIComponent(imageFilename.subfolder)}&type=output`
  );

  if (!imageRes.ok) {
    throw new Error(`ComfyUI /view returned ${imageRes.status} for ${imageFilename.filename}`);
  }

  const mimeType = imageRes.headers.get("content-type") ?? "image/png";
  const arrayBuffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    dataUri: `data:${mimeType};base64,${base64}`,
    durationMs: Date.now() - start,
  };
}

interface ImageFile {
  filename: string;
  subfolder: string;
}

async function pollUntilDone(promptId: string): Promise<ImageFile> {
  const POLL_INTERVAL_MS = 2000;
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${COMFYUI_BASE}/history/${promptId}`);
    if (!res.ok) continue;

    const history = (await res.json()) as Record<
      string,
      {
        outputs?: Record<string, { images?: ImageFile[] }>;
        status?: { completed?: boolean };
      }
    >;

    const entry = history[promptId];
    if (!entry?.status?.completed) continue;

    // Node 9 is SaveImage — find its output images
    const images = entry.outputs?.["9"]?.images;
    if (images && images.length > 0) {
      return images[0];
    }

    throw new Error("ComfyUI completed but no images found in output");
  }

  throw new Error(`ComfyUI generation timed out after 5 minutes for prompt ${promptId}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
