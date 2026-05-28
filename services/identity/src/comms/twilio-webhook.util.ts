/**
 * Twilio webhook base URL helpers.
 * Quick Cloudflare tunnels (trycloudflare.com) expire when the process stops;
 * Twilio then plays "an application error has occurred" on answer.
 */

const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

export function resolveTwilioWebhookBase(): string {
  const raw =
    process.env['TWILIO_WEBHOOK_BASE_URL'] ??
    process.env['APP_URL'] ??
    'http://localhost:3001';
  return raw.replace(/\/$/, '');
}

export function isLocalWebhookBase(baseUrl: string): boolean {
  return LOCAL_HOST_RE.test(baseUrl);
}

/** HEAD /api/health — verifies Twilio can reach TwiML + audio URLs on this host. */
export async function isTwilioWebhookReachable(baseUrl: string): Promise<boolean> {
  if (isLocalWebhookBase(baseUrl)) return false;
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(4_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
