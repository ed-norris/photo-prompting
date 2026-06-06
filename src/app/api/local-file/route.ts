import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Only serve image files — guards against accidental exposure of other content.
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic|avif|bmp|tiff?)$/i;

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  avif: "image/avif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawPath = request.nextUrl.searchParams.get("path");

  if (!rawPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const filePath = path.resolve(decodeURIComponent(rawPath));

  if (!IMAGE_EXT.test(filePath)) {
    return NextResponse.json({ error: "Not an image file" }, { status: 400 });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeType = EXT_TO_MIME[ext] ?? "image/png";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found or unreadable" }, { status: 404 });
  }
}
