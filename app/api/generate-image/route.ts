// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { higgsfield, config } from "@higgsfield/client/v2";

export const maxDuration = 60;

const PROMPTS = [
  "Stained glass mosaic, abstract geometric white line contours on black background, each enclosed cell filled with vivid flat color: deep crimson, electric blue, emerald, gold, violet, cyan, orange. No gradients. Vector art style.",
  "Abstract stained glass window, black background with bright white line network forming irregular cells, each cell solid color: ruby red, sapphire blue, jade green, amber yellow, purple, turquoise. Graphic art.",
  "Vitrage mosaic artwork, intricate white lines dividing black space into colored regions: scarlet, cobalt, lime, ochre, magenta, teal. Flat design, no shadows, white borders prominent.",
  "Geometric stained glass pattern, white wireframe lines on black, enclosed areas filled with saturated random colors: crimson, ultramarine, chartreuse, saffron, violet, cerulean. Minimal vector illustration.",
];

export async function POST(req: NextRequest) {
  try {
    const KEY_ID = process.env.HIGGSFIELD_API_KEY_ID;
    const SECRET = process.env.HIGGSFIELD_API_SECRET;
    if (!KEY_ID || !SECRET) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    // Конфигурируем SDK — он сам добавит правильные заголовки для обхода Cloudflare
    config({ credentials: `${KEY_ID}:${SECRET}` });

    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

    // SDK сам знает правильный endpoint и добавляет User-Agent: higgsfield-server-js/2.0
    const jobSet = await higgsfield.subscribe("nano_banana_2", {
      input: { prompt, aspect_ratio: "1:1", resolution: "1k" },
      withPolling: true,
    });

    const url =
      (jobSet as any).jobs?.[0]?.results?.raw?.images?.[0]?.url ||
      (jobSet as any).jobs?.[0]?.results?.raw?.url ||
      (jobSet as any).images?.[0]?.url ||
      (jobSet as any).url;

    if (!url) {
      return NextResponse.json({ error: "No URL", jobSet }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
