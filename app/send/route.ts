import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // ВНИМАНИЕ: Замени этот email на ТОТ, на который ты регистрировал аккаунт Resend!
    const MY_RESEND_EMAIL = 'obolongueuil@gmail.com';

    // 1. ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ ТЕБЕ
    await resend.emails.send({
      from: 'Portfolio Form <onboarding@resend.dev>',
      to: MY_RESEND_EMAIL,
      subject: `🔥 NEW ORDER FROM ${name.toUpperCase()}`,
      html: `
        <div style="font-family: sans-serif; background: #000; color: #fff; padding: 30px; text-transform: uppercase;">
          <h2 style="border-bottom: 2px solid #fff; padding-bottom: 10px;">NEW PROJECT REQUEST</h2>
          <p><strong>NAME:</strong> ${name}</p>
          <p><strong>EMAIL:</strong> ${email}</p>
          <p style="margin-top: 20px;"><strong>MESSAGE:</strong></p>
          <div style="background: #222; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${message}</div>
        </div>
      `,
    });

    // 2. ОТПРАВЛЯЕМ ТЕСТОВЫЙ АВТООТВЕТ ТОЖЕ ТЕБЕ (чтобы Resend Sandbox не блокировал запрос)
    await resend.emails.send({
      from: 'Artem Design <onboarding@resend.dev>',
      to: MY_RESEND_EMAIL, // Временно шлем себе, проверяя верстку письма
      subject: `[TEST AUTO-RESPONSE FOR ${name.toUpperCase()}] THANK YOU FOR YOUR MESSAGE!`,
      html: `
        <div style="font-family: sans-serif; background: #fff; color: #000; padding: 40px; text-transform: uppercase; border: 10px solid #000;">
          <h1 style="font-size: 28px; margin-bottom: 20px; letter-spacing: -0.02em;">HELLO ${name}!</h1>
          <p style="font-size: 16px; line-height: 1.4;">I HAVE SUCCESSFULLY RECEIVED YOUR MESSAGE FROM EMAIL: ${email}.</p>
          <p style="font-size: 16px; line-height: 1.4; margin-bottom: 30px;">I WILL REVIEW THE DETAILS AND GET BACK TO YOU AS SOON AS POSSIBLE.</p>
          <br />
          <p style="font-size: 14px; letter-spacing: 0.1em; font-weight: bold; border-top: 1px solid #000; padding-top: 20px;">
            BEST REGARDS,<br />ARTEM DESIGN
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}