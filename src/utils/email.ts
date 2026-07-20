// Email via Resend (https://resend.com). Free tier, no credits needed. If
// RESEND_API_KEY is unset we run in "log-only" mode so the SOS flow still works
// end-to-end in development — an SOS must never fail because notifications
// aren't configured.
const { RESEND_API_KEY, RESEND_FROM } = process.env;
const configured = Boolean(RESEND_API_KEY);
// Resend lets you send from onboarding@resend.dev without verifying a domain,
// but only to your own account email until a domain is verified. Set RESEND_FROM
// to a verified-domain address to email arbitrary contacts.
const FROM = RESEND_FROM || "Her Ashtra SOS <onboarding@resend.dev>";

if (!configured) {
  console.warn("[email] RESEND_API_KEY not set — emails will be logged, not sent.");
}

/**
 * Send one email via Resend. Never throws — on any failure it logs and returns
 * false, so a bad address or an API outage can't take down the SOS request.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!configured) {
    console.log(`[email:log-only] -> ${to}: ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !json.id) {
      console.error(`[email] Resend failed for ${to}:`, json.message || res.status);
      return false;
    }
    console.log(`[email] sent to ${to} (id ${json.id})`);
    return true;
  } catch (err) {
    console.error(`[email] error sending to ${to}:`, (err as Error).message);
    return false;
  }
}

/**
 * Notify every contact of an SOS by email. Uses allSettled so one failure can't
 * abort the batch, and the whole thing is fire-and-forget from the caller's view.
 */
export async function notifyContacts(
  recipients: Array<{ name: string; email: string }>,
  subject: string,
  html: string,
): Promise<void> {
  await Promise.allSettled(recipients.map((r) => sendEmail(r.email, subject, html)));
}
