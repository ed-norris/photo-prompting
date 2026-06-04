import * as fs from "fs";
import * as path from "path";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function parseDataUri(uri: string): { mimeType: string; data: string } {
  const comma = uri.indexOf(",");
  const header = uri.slice(0, comma);
  const data = uri.slice(comma + 1);
  const mimeType = header.split(":")[1]?.split(";")[0] ?? "image/png";
  return { mimeType, data };
}

export async function generateVideo(
  model: string,
  prompt: string,
  imageDataUris: string[],
  onProgress: (elapsedMs: number) => void
): Promise<{ filePath: string; durationMs: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  // Strip "veo/" prefix to get the underlying Gemini model name
  const modelName = model.replace(/^veo\//, "");
  const start = Date.now();

  // Build the request instance — reference images passed as inline base64
  const instance: Record<string, unknown> = { prompt };

  if (imageDataUris.length === 1) {
    const { mimeType, data } = parseDataUri(imageDataUris[0]);
    instance.image = { bytesBase64Encoded: data, mimeType };
  } else if (imageDataUris.length > 1) {
    instance.referenceImages = imageDataUris.map((uri) => {
      const { mimeType, data } = parseDataUri(uri);
      return {
        referenceType: "REFERENCE_TYPE_SUBJECT",
        referenceImage: { image: { bytesBase64Encoded: data, mimeType } },
      };
    });
  }

  // Submit the long-running job
  const submitRes = await fetch(
    `${GEMINI_BASE}/models/${modelName}:predictLongRunning?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [instance],
        parameters: { aspectRatio: "16:9" },
      }),
    }
  );

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`Veo submit returned ${submitRes.status}: ${text}`);
  }

  const submitData = (await submitRes.json()) as { name?: string };
  const operationName = submitData.name;
  if (!operationName) throw new Error("Veo did not return an operation name");

  // Poll every 10 seconds until the operation completes
  const POLL_INTERVAL_MS = 10_000;
  let videoUri: string | undefined;

  for (;;) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    onProgress(Date.now() - start);

    const pollRes = await fetch(`${GEMINI_BASE}/${operationName}`, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!pollRes.ok) {
      const text = await pollRes.text().catch(() => "");
      throw new Error(`Veo poll returned ${pollRes.status}: ${text}`);
    }

    const pollData = (await pollRes.json()) as {
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>;
        };
      };
    };

    if (pollData.error) {
      throw new Error(`Veo operation failed: ${pollData.error.message ?? "unknown error"}`);
    }

    if (pollData.done) {
      videoUri =
        pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      break;
    }
  }

  if (!videoUri) throw new Error("Veo completed but returned no video URI");

  // Download the video bytes using the API key in the header
  const downloadRes = await fetch(videoUri, {
    headers: { "x-goog-api-key": apiKey },
  });

  if (!downloadRes.ok) {
    throw new Error(`Video download returned ${downloadRes.status}`);
  }

  const videoBytes = await downloadRes.arrayBuffer();

  // Save to public/videos/ so Next.js static serving picks it up
  const videoId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fileName = `${videoId}.mp4`;
  const videosDir = path.join(process.cwd(), "public", "videos");

  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  fs.writeFileSync(path.join(videosDir, fileName), Buffer.from(videoBytes));

  return { filePath: `/videos/${fileName}`, durationMs: Date.now() - start };
}
