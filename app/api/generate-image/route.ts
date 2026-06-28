// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";

const HF_KEY_ID = process.env.HIGGSFIELD_API_KEY_ID!;
const HF_SECRET = process.env.HIGGSFIELD_API_SECRET!;
const HF_BASE = "https://platform.higgsfield.ai";
const AUTH = `Key ${HF_KEY_ID}:${HF_SECRET}`;

async function getUploadUrl(): Promise<{ upload_url: string; media_id: string }> {
  const res = await fetch(`${HF_BASE}/media/upload`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "image", content_type: "image/png" }),
  });
  if (!res.ok) throw new Error(`Upload URL error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function uploadPng(uploadUrl: string, pngData: Uint8Array): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: pngData.buffer as ArrayBuffer,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

async function confirmUpload(mediaId: string): Promise<void> {
  const res = await fetch(`${HF_BASE}/media/${mediaId}/confirm`, {
    method: "POST",
    headers: { Authorization: AUTH },
  });
  if (!res.ok) throw new Error(`Confirm failed: ${res.status}`);
}

async function submitJob(mediaId: string): Promise<string> {
  const res = await fetch(`${HF_BASE}/jobs`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nano_banana_2",
      arguments: {
        prompt:
          "Stained glass mosaic artwork. Keep the exact white line contours from the reference image as borders. Fill every enclosed region with a vivid randomly chosen solid color — deep red, electric blue, emerald green, golden yellow, violet, orange, cyan. Black background. No gradients, flat color fills only. The white lines remain bright white on top. Ultra detailed, graphic design art, vector illustration style.",
        aspect_ratio: "1:1",
        resolution: "1k",
      },
      medias: [{ role: "image", value: mediaId }],
    }),
  });
  if (!res.ok) throw new Error(`Submit error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const jobId = data.id || data.job_id || data.generation_id;
  if (!jobId) throw new Error("No job ID in response");
  return jobId;
}

async function pollJob(jobId: string, maxWaitMs = 90000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${HF_BASE}/jobs/${jobId}`, {
      headers: { Authorization: AUTH },
    });
    if (!res.ok) throw new Error(`Poll error: ${res.status}`);
    const data = await res.json();
    const status = (data.status ?? "").toLowerCase();
    if (["completed", "done", "succeeded"].includes(status)) {
      const url =
        data.result?.images?.[0]?.url ??
        data.result?.url ??
        data.output?.url ??
        data.images?.[0]?.url ??
        data.url;
      if (url) return url;
      throw new Error("No image URL in completed job");
    }
    if (["failed", "error", "cancelled"].includes(status)) {
      throw new Error(`Job ${status}: ${data.error ?? JSON.stringify(data)}`);
    }
  }
  throw new Error("Timeout: image not ready in 90s");
}

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) {
      return NextResponse.json({ error: "No imageDataUrl" }, { status: 400 });
    }

    // base64 → Uint8Array, используя только Web API (без Buffer)
    const base64 = (imageDataUrl as string).replace(/^data:image\/png;base64,/, "");
    const binaryStr = atob(base64);
    const pngData = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      pngData[i] = binaryStr.charCodeAt(i);
    }

    const { upload_url, media_id } = await getUploadUrl();
    await uploadPng(upload_url, pngData);
    await confirmUpload(media_id);

    const jobId = await submitJob(media_id);
    const imageUrl = await pollJob(jobId);

    return NextResponse.json({ url: imageUrl });
  } catch (err: any) {
    console.error("generate-image error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
