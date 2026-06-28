// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const HF_KEY_ID = process.env.HIGGSFIELD_API_KEY_ID!;
const HF_SECRET = process.env.HIGGSFIELD_API_SECRET!;
const HF_BASE = "https://platform.higgsfield.ai";
const AUTH = `Key ${HF_KEY_ID}:${HF_SECRET}`;

// Шаг 1: получаем presigned S3 URL для загрузки
async function getUploadUrl(): Promise<{ upload_url: string; media_id: string }> {
  const res = await fetch(`${HF_BASE}/media`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "trail.png",
      content_type: "image/png",
      method: "upload_url",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload URL error: ${res.status} ${text}`);
  }
  const data = await res.json();
  // API возвращает массив или объект — обрабатываем оба варианта
  const item = Array.isArray(data) ? data[0] : data;
  const upload_url = item.upload_url || item.url;
  const media_id = item.media_id || item.id;
  if (!upload_url || !media_id) throw new Error(`Bad upload response: ${JSON.stringify(data)}`);
  return { upload_url, media_id };
}

// Шаг 2: загружаем PNG по presigned S3 URL
async function uploadPng(uploadUrl: string, pngData: Uint8Array): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: pngData.buffer as ArrayBuffer,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
}

// Шаг 3: подтверждаем загрузку в Higgsfield
async function confirmUpload(mediaId: string): Promise<void> {
  const res = await fetch(`${HF_BASE}/media/${mediaId}/confirm`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "image" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confirm failed: ${res.status} ${text}`);
  }
}

// Шаг 4: запускаем генерацию Nano Banana
async function submitJob(mediaId: string): Promise<string> {
  const res = await fetch(`${HF_BASE}/jobs`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nano_banana_2",
      arguments: {
        prompt:
          "Stained glass mosaic artwork. Keep the exact white line contours from the reference image as cell borders. Fill every enclosed region with a vivid randomly chosen solid color: deep red, electric blue, emerald green, golden yellow, violet, orange, cyan. Black background. No gradients, flat color fills only. White lines stay bright white on top as borders. Ultra detailed graphic art.",
        aspect_ratio: "1:1",
        resolution: "1k",
      },
      medias: [{ role: "image", value: mediaId }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const jobId = data.id || data.job_id || data.generation_id;
  if (!jobId) throw new Error(`No job ID: ${JSON.stringify(data)}`);
  return jobId;
}

// Шаг 5: polling до завершения (макс 55 сек)
async function pollJob(jobId: string): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < 55000) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${HF_BASE}/jobs/${jobId}`, {
      headers: { Authorization: AUTH },
    });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
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
      throw new Error(`No URL in result: ${JSON.stringify(data)}`);
    }
    if (["failed", "error", "cancelled"].includes(status)) {
      throw new Error(`Job ${status}: ${data.error ?? JSON.stringify(data)}`);
    }
  }
  throw new Error("Timeout: 55s exceeded");
}

export async function POST(req: NextRequest) {
  try {
    if (!HF_KEY_ID || !HF_SECRET) {
      return NextResponse.json({ error: "Missing HIGGSFIELD env vars" }, { status: 500 });
    }

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) {
      return NextResponse.json({ error: "No imageDataUrl" }, { status: 400 });
    }

    // base64 → Uint8Array (только Web API, без Buffer)
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
