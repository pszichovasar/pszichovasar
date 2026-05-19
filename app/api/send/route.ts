import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'NO_API_KEY_IN_VERCEL' }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const MY_RESEND_EMAIL = 'obolongueuil@gmail.com';

    const { error: resendError } = await resend.emails.send({
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

    if (resendError) {
      return NextResponse.json({ error: `RESEND_ERROR: ${resendError.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: `SERVER_CRASH: ${error?.message || 'UNKNOWN'}` }, { status: 500 });
  }
}