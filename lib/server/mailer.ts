// Pluggable email sender. Uses Resend when RESEND_API_KEY is set; otherwise it
// "previews" (logs subject + recipient) so the digest pipeline is fully runnable
// in development without an email provider.
//
// Server-only.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  /** true if actually dispatched; false if previewed (no provider configured) */
  sent: boolean;
  provider: "resend" | "preview";
  id?: string;
  error?: string;
}

const FROM = process.env.DIGEST_FROM ?? "Game Deal Curator <onboarding@resend.dev>";

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mailer:preview] → ${msg.to} :: ${msg.subject}`);
    return { sent: false, provider: "preview" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      return { sent: false, provider: "resend", error: `Resend ${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { sent: true, provider: "resend", id: data.id };
  } catch (e) {
    return {
      sent: false,
      provider: "resend",
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}
