// app/api/generate-image/route.ts
// Pollinations.ai — бесплатная генерация изображений без API ключа
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const PROMPTS = [
  "stained glass mosaic, abstract white line contours on black background, vivid flat colors: crimson, electric blue, emerald, gold, violet, cyan. no gradients, vector art",
  "vitrage artwork, white lines dividing black space into cells, each cell vivid flat color: ruby, sapphire, jade, amber, purple, turquoise. graphic art style",
  "geometric stained glass, white wireframe on black, areas filled: scarlet, cobalt, lime, ochre, magenta, teal. flat design, white borders prominent",
  "abstract mosaic, bright white contours on black, enclosed regions: crimson, ultramarine, chartreuse, saffron, violet, cerulean. minimal vector illustration",
];

export async function POST(req: NextRequest) {
  try {
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    const encoded = encodeURIComponent(prompt);

    // Pollinations.ai — GET запрос возвращает PNG напрямую, без ключей
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&model=flux&seed=${Math.floor(Math.random() * 99999)}&nologo=true`;

    // Проверяем что изображение доступно
    const check = await fetch(imageUrl, { method: "HEAD" });
    if (!check.ok) {
      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
