// app/api/solve/route.ts
//
// "Problem solver" — принимает текст проблемы от клиента, просит модель
// ответить РОВНО одним словом (самое конкретное, полезное действие/совет),
// возвращает это слово. Ключ API — только на сервере (переменная окружения
// ANTHROPIC_API_KEY), никогда не попадает в клиентский код.
//
// Куда положить: app/api/solve/route.ts в корне проекта (рядом с уже
// существующим app/page.tsx — если у вас App Router, что почти наверняка
// так, раз page.tsx начинается с "use client").
//
// Настройка: добавьте в .env.local (создать в корне проекта, если его ещё
// нет; в .gitignore он обычно уже есть по умолчанию у create-next-app):
//   ANTHROPIC_API_KEY=sk-ant-...
// Получить ключ: https://console.anthropic.com/settings/keys
//
// Модель ниже (claude-haiku-4-5-20251001) — самая быстрая и дешёвая на
// момент написания, чего более чем достаточно для ответа в одно слово.
// Актуальный список моделей и их названия — https://docs.claude.com.

import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "Тебе присылают личную проблему человека. Ответь СТРОГО ОДНИМ словом — " +
  "самым конкретным, полезным советом или действием, что человеку делать в " +
  "этой ситуации. Только одно слово. Без знаков препинания, без кавычек, " +
  "без пояснений, без вступлений. Отвечай на том же языке, что и вопрос.";

export async function POST(req: NextRequest) {
  let problem: string;
  try {
    const body = await req.json();
    problem = typeof body?.problem === "string" ? body.problem.trim() : "";
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!problem) {
    return NextResponse.json({ error: "empty problem" }, { status: 400 });
  }
  // Защита от чрезмерно длинных сообщений — не влияет на суть ответа
  // (он всё равно должен быть одним словом), просто ограничивает размер
  // запроса к API.
  problem = problem.slice(0, 1000);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY не задан — см. инструкцию в начале файла");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: problem }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => "");
      console.error("Anthropic API error:", apiRes.status, errText);
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }

    const data = await apiRes.json();
    const rawText: string = data?.content?.find((b: any) => b.type === "text")?.text ?? "";
    // Подстраховка: даже если модель случайно ответит больше, чем одним
    // словом (несмотря на системный промпт) — берём только первое слово и
    // убираем завершающую пунктуацию.
    const word = rawText.trim().split(/\s+/)[0]?.replace(/^[.,!?;:"'«»()]+|[.,!?;:"'«»()]+$/g, "") || "?";

    return NextResponse.json({ word });
  } catch (e) {
    console.error("Ошибка запроса к Anthropic API:", e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
