// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { config, higgsfield } from "@higgsfield/client/v2";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.HIGGSFIELD_API_KEY_ID || !process.env.HIGGSFIELD_API_SECRET) {
      return NextResponse.json({ error: "Missing HIGGSFIELD env vars" }, { status: 500 });
    }

    config({
      credentials: `${process.env.HIGGSFIELD_API_KEY_ID}:${process.env.HIGGSFIELD_API_SECRET}`,
    });

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) {
      return NextResponse.json({ error: "No imageDataUrl" }, { status: 400 });
    }

    // base64 → Uint8Array → загружаем через /media/batch (реальный endpoint)
    const base64 = (imageDataUrl as string).replace(/^data:image\/png;base64,/, "");
    const binaryStr = atob(base64);
    const pngData = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      pngData[i] = binaryStr.charCodeAt(i);
    }

    const HF_BASE = "https://platform.higgsfield.ai";
    const AUTH = `Key ${process.env.HIGGSFIELD_API_KEY_ID}:${process.env.HIGGSFIELD_API_SECRET}`;

    // Шаг 1: получаем presigned URL через /media/batch
    const batchRes = await fetch(`${HF_BASE}/media/batch`, {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify([{ filename: "trail.png", content_type: "image/png" }]),
    });
    if (!batchRes.ok) {
      const t = await batchRes.text();
      return NextResponse.json({ error: `media/batch failed: ${batchRes.status} ${t}` }, { status: 500 });
    }
    const batchData = await batchRes.json();
    // batch возвращает массив [{media_id, upload_url}]
    const item = Array.isArray(batchData) ? batchData[0] : batchData;
    const { media_id, upload_url } = item;
    if (!media_id || !upload_url) {
      return NextResponse.json({ error: "Bad batch response", batchData }, { status: 500 });
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

    // Шаг 3: генерируем через SDK (он знает правильный endpoint для генерации)
    const jobSet = await higgsfield.subscribe("nano_banana_2", {
      input: {
        prompt:
          "Stained glass mosaic artwork. Keep the exact white line contours from the reference image as cell borders. Fill every enclosed region with a vivid randomly chosen solid color: deep red, electric blue, emerald green, golden yellow, violet, orange, cyan. Black background. No gradients, flat color fills only. White lines stay bright white on top as borders.",
        aspect_ratio: "1:1",
        resolution: "1k",
        medias: [{ role: "image", value: media_id }],
      },
      withPolling: true,
    });

    // Извлекаем URL из ответа SDK
    const job = (jobSet as any).jobs?.[0];
    const url =
      job?.results?.raw?.images?.[0]?.url ||
      job?.results?.raw?.url ||
      (jobSet as any).images?.[0]?.url ||
      (jobSet as any).url;

    if (!url) {
      return NextResponse.json({ error: "No URL in result", jobSet }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("generate-image error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
