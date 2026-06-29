// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) {
      return NextResponse.json({ error: "No imageDataUrl" }, { status: 400 });
    }

    // 1. Загружаем PNG трейла на Pollinations чтобы получить публичный URL
    const base64 = (imageDataUrl as string).replace(/^data:image\/png;base64,/, "");
    const binaryStr = Buffer.from(base64, "base64");

    const uploadRes = await fetch("https://gen.pollinations.ai/upload", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: binaryStr,
    });

    let referenceImageUrl: string | null = null;
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      referenceImageUrl = uploadData.url || uploadData.hash_url || null;
    }

    // 2. Генерируем мозаику — с референсом если удалось загрузить, иначе text-only
    const prompt = encodeURIComponent(
      "stained glass mosaic vitrage. " +
      "keep all white line contours from the reference exactly as borders. " +
      "fill every enclosed cell with vivid flat solid color: crimson, electric blue, emerald, gold, violet, orange, cyan, magenta. " +
      "black background. no gradients. no textures. white lines stay white on top. graphic art."
    );

    const seed = Math.floor(Math.random() * 99999);
    let imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&model=flux&seed=${seed}&nologo=true`;

    // Добавляем референс если есть
    if (referenceImageUrl) {
      imageUrl += `&image=${encodeURIComponent(referenceImageUrl)}`;
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: `Generation failed: ${imgRes.status}` }, { status: 500 });
    }

    const buffer = await imgRes.arrayBuffer();
    const b64 = Buffer.from(buffer).toString("base64");

    return NextResponse.json({ url: `data:image/png;base64,${b64}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
