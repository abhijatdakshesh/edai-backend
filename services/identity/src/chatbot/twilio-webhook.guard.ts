import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const twilioSig = req.headers['x-twilio-signature'] as string | undefined;
    const authToken = process.env['TWILIO_AUTH_TOKEN'];

    // No Twilio token configured — allow (e.g. local dev without Twilio)
    if (!authToken) return true;
    // Escape hatch for debugging proxy/signature issues — remove once confirmed working
    if (process.env['TWILIO_SKIP_VALIDATION'] === 'true') return true;
    // Only bypass signature validation in test when explicitly opted in
    if (process.env['NODE_ENV'] === 'test' && process.env['ALLOW_WEBHOOK_IN_TEST'] === 'true') return true;
    if (!twilioSig) throw new ForbiddenException('Missing Twilio signature');

    try {
      // Dynamic import to avoid hard dependency when Twilio not configured
      const twilio = await import('twilio');
      const baseUrl = (process.env['TWILIO_WEBHOOK_BASE_URL'] ?? '').replace(/\/$/, '');
      const params = req.body as Record<string, string>;

      // Behind a proxy / path-rewrite (e.g. Vercel rewrites /api/:path* →
      // /api/[[...path]]), req.originalUrl can differ from the public URL that
      // Twilio actually signed (rewritten path, injected query params). Twilio's
      // HMAC is over the EXACT called URL, so we validate against a set of
      // canonical candidates and accept if any matches. Still real signature
      // validation — not a bypass.
      const host = req.get('host');
      const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] ?? req.protocol;
      const pathOnly = req.originalUrl.split('?')[0];
      // Drop Vercel's injected `path` rewrite query param if present.
      const cleanedOriginal = req.originalUrl
        .replace(/(^|[?&])path=[^&]*/g, '')
        .replace(/[?&]$/, '')
        .replace(/\?&/, '?');

      const candidates = Array.from(
        new Set(
          [
            baseUrl && `${baseUrl}${req.originalUrl}`,
            baseUrl && `${baseUrl}${cleanedOriginal}`,
            baseUrl && `${baseUrl}${pathOnly}`,
            host && `${proto}://${host}${req.originalUrl}`,
            host && `${proto}://${host}${pathOnly}`,
          ].filter(Boolean) as string[],
        ),
      );

      let valid = false;
      let matched = 'none';
      for (const url of candidates) {
        if (twilio.validateRequest(authToken, twilioSig, url, params)) {
          valid = true;
          matched = url;
          break;
        }
      }
      console.log(
        `[TwilioGuard] valid=${valid} matched=${matched} tried=${candidates.length} sig=${twilioSig?.slice(0, 8)}… bodyKeys=${Object.keys(params).join(',')}`,
      );
      if (!valid) throw new ForbiddenException('Invalid Twilio signature');
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      console.error('[TwilioGuard] validation threw:', err);
      throw new ForbiddenException('Twilio validation failed');
    }
  }
}
