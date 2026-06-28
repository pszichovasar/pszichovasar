// app/api/generate-image/route.ts
// Версия без загрузки файла — text-to-image через Nano Banana.
// Промпт описывает витражную мозаику в абстрактном стиле.
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const HF_BASE = "https://platform.higgsfield.ai";

const PROMPTS = [
  "Stained glass mosaic, abstract geometric white line contours on black background, each enclosed cell filled with vivid flat color: deep crimson, electric blue, emerald, gold, violet, cyan, orange. No gradients. Vector art style.",
  "Abstract stained glass window, black background with bright white line network forming irregular cells, each cell solid color: ruby red, sapphire blue, jade green, amber yellow, purple, turquoise. Graphic art, ultra detailed.",
  "Vitrage mosaic artwork, intricate white lines dividing black space into colored regions: scarlet, cobalt, lime, ochre, magenta, teal. Flat design, no shadows, white borders prominent.",
  "Geometric stained glass pattern, white wireframe lines on black, enclosed areas filled with saturated random colors: crimson, ultramarine, chartreuse, saffron, violet, cerulean. Minimal, graphic, vector illustration.",
];

export async function POST(req: NextRequest) {
  try {
    const AUTH = `Key ${process.env.HIGGSFIELD_API_KEY_ID}:${process.env.HIGGSFIELD_API_SECRET}`;

    if (!process.env.HIGGSFIELD_API_KEY_ID || !process.env.HIGGSFIELD_API_SECRET) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

    // Генерация text-to-image без загрузки файла
    const submitRes = await fetch(`${HF_BASE}/jobs`, {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nano_banana_2",
        arguments: { prompt, aspect_ratio: "1:1", resolution: "1k" },
      }),
    });

    if (!submitRes.ok) {
      const t = await submitRes.text();
      return NextResponse.json({ error: `Submit: ${submitRes.status} ${t}` }, { status: 500 });
    }

    const submitData = await submitRes.json();
    const jobId = submitData.id || submitData.job_id || submitData.generation_id;
    if (!jobId) {
      return NextResponse.json({ error: "No jobId", submitData }, { status: 500 });
    }

    // Polling
    const start = Date.now();
    while (Date.now() - start < 55000) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(`${HF_BASE}/jobs/${jobId}`, {
        headers: { Authorization: AUTH },
      });
      if (!pollRes.ok) continue;
      const d = await pollRes.json();
      const status = (d.status ?? "").toLowerCase();
      if (["completed", "done", "succeeded"].includes(status)) {
        const url = d.result?.images?.[0]?.url ?? d.result?.url ?? d.images?.[0]?.url ?? d.url;
        if (url) return NextResponse.json({ url });
        return NextResponse.json({ error: "No URL", d }, { status: 500 });
      }
      if (["failed", "error", "cancelled"].includes(status)) {
        return NextResponse.json({ error: `Job ${status}`, d }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Timeout" }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
