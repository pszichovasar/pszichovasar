// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";

const HF_KEY_ID = process.env.HIGGSFIELD_API_KEY_ID!;
const HF_SECRET = process.env.HIGGSFIELD_API_SECRET!;
const HF_BASE = "https://platform.higgsfield.ai";
const AUTH = `Key ${HF_KEY_ID}:${HF_SECRET}`;

export async function POST(req: NextRequest) {
  try {
    // Шаг 1: проверяем ключи
    if (!HF_KEY_ID || !HF_SECRET) {
      return NextResponse.json({ error: "Missing API keys", HF_KEY_ID: !!HF_KEY_ID, HF_SECRET: !!HF_SECRET }, { status: 500 });
    }

    // Шаг 2: получаем imageDataUrl
    const body = await req.json();
    const { imageDataUrl } = body;
    if (!imageDataUrl) {
      return NextResponse.json({ error: "No imageDataUrl in body" }, { status: 400 });
    }

    // Шаг 3: base64 → Uint8Array
    const base64 = (imageDataUrl as string).replace(/^data:image\/png;base64,/, "");
    const binaryStr = atob(base64);
    const pngData = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      pngData[i] = binaryStr.charCodeAt(i);
    }

    // Шаг 4: получаем upload URL
    const uploadUrlRes = await fetch(`${HF_BASE}/media/upload`, {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "image", content_type: "image/png" }),
    });
    const uploadUrlText = await uploadUrlRes.text();
    if (!uploadUrlRes.ok) {
      return NextResponse.json({ error: "Upload URL failed", status: uploadUrlRes.status, body: uploadUrlText }, { status: 500 });
    }
    const { upload_url, media_id } = JSON.parse(uploadUrlText);

    // Шаг 5: загружаем PNG
    const uploadRes = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: pngData.buffer as ArrayBuffer,
    });
    if (!uploadRes.ok) {
      return NextResponse.json({ error: "Upload failed", status: uploadRes.status }, { status: 500 });
    }

    // Шаг 6: подтверждаем
    const confirmRes = await fetch(`${HF_BASE}/media/${media_id}/confirm`, {
      method: "POST",
      headers: { Authorization: AUTH },
    });
    const confirmText = await confirmRes.text();
    if (!confirmRes.ok) {
      return NextResponse.json({ error: "Confirm failed", status: confirmRes.status, body: confirmText }, { status: 500 });
    }

    // Шаг 7: запускаем генерацию
    const submitRes = await fetch(`${HF_BASE}/jobs`, {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nano_banana_2",
        arguments: {
          prompt: "Stained glass mosaic artwork. Keep the exact white line contours from the reference image as borders. Fill every enclosed region with a vivid randomly chosen solid color — deep red, electric blue, emerald green, golden yellow, violet, orange, cyan. Black background. No gradients, flat color fills only. The white lines remain bright white on top. Ultra detailed, graphic design art, vector illustration style.",
          aspect_ratio: "1:1",
          resolution: "1k",
        },
        medias: [{ role: "image", value: media_id }],
      }),
    });
    const submitText = await submitRes.text();
    if (!submitRes.ok) {
      return NextResponse.json({ error: "Submit failed", status: submitRes.status, body: submitText }, { status: 500 });
    }
    const submitData = JSON.parse(submitText);
    const jobId = submitData.id || submitData.job_id || submitData.generation_id;
    if (!jobId) {
      return NextResponse.json({ error: "No job ID", submitData }, { status: 500 });
    }

    // Шаг 8: polling
    const start = Date.now();
    while (Date.now() - start < 90000) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`${HF_BASE}/jobs/${jobId}`, {
        headers: { Authorization: AUTH },
      });
      const pollData = await pollRes.json();
      const status = (pollData.status ?? "").toLowerCase();
      if (["completed", "done", "succeeded"].includes(status)) {
        const url = pollData.result?.images?.[0]?.url ?? pollData.result?.url ?? pollData.output?.url ?? pollData.images?.[0]?.url ?? pollData.url;
        if (url) return NextResponse.json({ url });
        return NextResponse.json({ error: "No URL in result", pollData }, { status: 500 });
      }
      if (["failed", "error", "cancelled"].includes(status)) {
        return NextResponse.json({ error: `Job ${status}`, pollData }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Timeout 90s" }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
