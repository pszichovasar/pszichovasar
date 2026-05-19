import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'FIELDS_MISSING' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'NO_API_KEY_IN_VERCEL' }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    // Укажи здесь свою почту, на которую регистрировал Resend!
    const MY_RESEND_EMAIL = 'твой-email-регистрации@gmail.com';

    // Отправляем ОДНО тестовое письмо, чтобы минимизировать риски блокировки
    const { error: resendError } = await resend.emails.send({
      from: 'Portfolio Form <onboarding@resend.dev>',
      to: MY_RESEND_EMAIL,
      subject: `🔥 NEW ORDER FROM ${name.toUpperCase()}`,
      html: `
        <div style="font-family: sans-serif; background: #000; color: #fff; padding: 30px; text-transform: uppercase;">
          <h2>NEW PROJECT REQUEST</h2>
          <p><strong>NAME:</strong> ${name}</p>
          <p><strong>EMAIL:</strong> ${email}</p>
          <p><strong>MESSAGE:</strong> ${message}</p>
        </div>
      `,
    });

    if (resendError) {
      return NextResponse.json({ error: `RESEND_ERROR: ${resendError.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: `SERVER_CRASH: ${err?.message || 'UNKNOWN'}` }, { status: 500 });
  }
}