// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const HF_KEY_ID = process.env.HIGGSFIELD_API_KEY_ID!;
const HF_SECRET = process.env.HIGGSFIELD_API_SECRET!;
const HF_BASE = "https://platform.higgsfield.ai";
const AUTH = `Key ${HF_KEY_ID}:${HF_SECRET}`;

export async function POST(req: NextRequest) {
  try {
    if (!HF_KEY_ID || !HF_SECRET) {
      return NextResponse.json({ error: "Missing HIGGSFIELD env vars" }, { status: 500 });
    }

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) {
      return NextResponse.json({ error: "No imageDataUrl" }, { status: 400 });
    }

    // base64 → Uint8Array
    const base64 = (imageDataUrl as string).replace(/^data:image\/png;base64,/, "");
    const binaryStr = atob(base64);
    const pngData = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      pngData[i] = binaryStr.charCodeAt(i);
    }

    // Шаг 1: получаем presigned upload URL
    const uploadReq = await fetch(`${HF_BASE}/media/upload-url`, {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "trail.png", content_type: "image/png" }),
    });

    // Пробуем альтернативные endpoints если первый не работает
    let uploadData: any;
    if (!uploadReq.ok) {
      // Пробуем /v1/media/upload-url
      const uploadReq2 = await fetch(`${HF_BASE}/v1/media/upload-url`, {
        method: "POST",
        headers: { Authorization: AUTH, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "trail.png", content_type: "image/png" }),
      });
      if (!uploadReq2.ok) {
        const t1 = await uploadReq.text();
        const t2 = await uploadReq2.text();
        return NextResponse.json({
          error: "Upload URL failed on both endpoints",
          endpoint1: { status: uploadReq.status, body: t1 },
          endpoint2: { status: uploadReq2.status, body: t2 },
        }, { status: 500 });
      }
      uploadData = await uploadReq2.json();
    } else {
      uploadData = await uploadReq.json();
    }

    const upload_url = uploadData.upload_url || uploadData.url || uploadData.presigned_url;
    const media_id = uploadData.media_id || uploadData.id;

    if (!upload_url || !media_id) {
      return NextResponse.json({ error: "Bad upload response", uploadData }, { status: 500 });
    }

    // Шаг 2: загружаем PNG на S3
    const s3Res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: pngData.buffer as ArrayBuffer,
    });
    if (!s3Res.ok) {
      return NextResponse.json({ error: `S3 upload failed: ${s3Res.status}` }, { status: 500 });
    }

    // Шаг 3: подтверждаем загрузку
    const confirmRes = await fetch(`${HF_BASE}/media/${media_id}/confirm`, {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "image" }),
    });
    if (!confirmRes.ok) {
      const t = await confirmRes.text();
      return NextResponse.json({ error: `Confirm failed: ${confirmRes.status} ${t}` }, { status: 500 });
    }

    // Шаг 4: генерируем мозаику
    const submitRes = await fetch(`${HF_BASE}/jobs`, {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nano_banana_2",
        arguments: {
          prompt: "Stained glass mosaic artwork. Keep the exact white line contours from the reference image as cell borders. Fill every enclosed region with a vivid randomly chosen solid color: deep red, electric blue, emerald green, golden yellow, violet, orange, cyan. Black background. No gradients, flat color fills only. White lines stay bright white on top as borders.",
          aspect_ratio: "1:1",
          resolution: "1k",
        },
        medias: [{ role: "image", value: media_id }],
      }),
    });
    if (!submitRes.ok) {
      const t = await submitRes.text();
      return NextResponse.json({ error: `Submit failed: ${submitRes.status} ${t}` }, { status: 500 });
    }
    const submitData = await submitRes.json();
    const jobId = submitData.id || submitData.job_id || submitData.generation_id;
    if (!jobId) {
      return NextResponse.json({ error: "No job ID", submitData }, { status: 500 });
    }

    // Шаг 5: polling
    const start = Date.now();
    while (Date.now() - start < 55000) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`${HF_BASE}/jobs/${jobId}`, {
        headers: { Authorization: AUTH },
      });
      if (!pollRes.ok) {
        return NextResponse.json({ error: `Poll failed: ${pollRes.status}` }, { status: 500 });
      }
      const pollData = await pollRes.json();
      const status = (pollData.status ?? "").toLowerCase();
      if (["completed", "done", "succeeded"].includes(status)) {
        const url = pollData.result?.images?.[0]?.url ?? pollData.result?.url ?? pollData.images?.[0]?.url ?? pollData.url;
        if (url) return NextResponse.json({ url });
        return NextResponse.json({ error: "No URL in result", pollData }, { status: 500 });
      }
      if (["failed", "error", "cancelled"].includes(status)) {
        return NextResponse.json({ error: `Job ${status}`, pollData }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Timeout 55s" }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
