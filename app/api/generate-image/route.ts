// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const PROMPTS = [
  "Stained glass mosaic, abstract geometric white line contours on black background, each enclosed cell filled with vivid flat color: deep crimson, electric blue, emerald, gold, violet, cyan, orange. No gradients. Vector art style.",
  "Abstract stained glass window, black background with bright white line network forming irregular cells, each cell solid color: ruby red, sapphire blue, jade green, amber yellow, purple, turquoise. Graphic art.",
  "Vitrage mosaic artwork, intricate white lines dividing black space into colored regions: scarlet, cobalt, lime, ochre, magenta, teal. Flat design, no shadows, white borders prominent.",
  "Geometric stained glass pattern, white wireframe lines on black, enclosed areas filled with saturated random colors: crimson, ultramarine, chartreuse, saffron, violet, cerulean. Minimal vector illustration.",
];

// Пробуем несколько возможных базовых URL
const BASES = [
  "https://api.higgsfield.ai",
  "https://platform.higgsfield.ai",
];

async function tryGenerate(base: string, auth: string, prompt: string): Promise<{ base: string; path: string; jobId: string } | { error: string } | null> {
  // Пробуем разные пути для submit
  const paths = ["/jobs", "/v1/jobs", "/api/jobs", "/generate"];
  for (const path of paths) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nano_banana_2",
        arguments: { prompt, aspect_ratio: "1:1", resolution: "1k" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const jobId = data.id || data.job_id || data.generation_id;
      if (jobId) return { base, path, jobId };
    }
    const status = res.status;
    if (status !== 404) {
      // Не 404 — значит нашли endpoint но другая ошибка
      const text = await res.text();
      return { error: `${base}${path}: ${status} ${text}` };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const KEY_ID = process.env.HIGGSFIELD_API_KEY_ID;
    const SECRET = process.env.HIGGSFIELD_API_SECRET;
    if (!KEY_ID || !SECRET) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }
    const AUTH = `Key ${KEY_ID}:${SECRET}`;
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

    // Перебираем базовые URL и пути
    let found: { base: string; path: string; jobId: string } | null = null;
    const errors: string[] = [];

    for (const base of BASES) {
      const result = await tryGenerate(base, AUTH, prompt);
      if (result && "jobId" in result) { found = result; break; }
      if (result && "error" in result) errors.push(result.error);
    }

    if (!found) {
      return NextResponse.json({ error: "No working endpoint found", errors }, { status: 500 });
    }

    const { base, jobId } = found;

    // Polling
    const start = Date.now();
    while (Date.now() - start < 55000) {
      await new Promise(r => setTimeout(r, 3000));
      // Пробуем разные пути для получения статуса
      for (const pollPath of [`/jobs/${jobId}`, `/v1/jobs/${jobId}`, `/requests/${jobId}/status`]) {
        const pollRes = await fetch(`${base}${pollPath}`, {
          headers: { Authorization: AUTH },
        });
        if (!pollRes.ok) continue;
        const d = await pollRes.json();
        const status = (d.status ?? "").toLowerCase();
        if (["completed", "done", "succeeded"].includes(status)) {
          const url = d.result?.images?.[0]?.url ?? d.result?.url ?? d.images?.[0]?.url ?? d.url;
          if (url) return NextResponse.json({ url });
        }
        if (["failed", "error", "cancelled"].includes(status)) {
          return NextResponse.json({ error: `Job ${status}`, d }, { status: 500 });
        }
        break; // нашли рабочий poll endpoint, ждём следующей итерации
      }
    }
    return NextResponse.json({ error: "Timeout" }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
