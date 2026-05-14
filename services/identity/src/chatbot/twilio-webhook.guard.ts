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
      const fullUrl = baseUrl
        ? `${baseUrl}${req.originalUrl}`
        : `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const params = req.body as Record<string, string>;
      const valid = twilio.validateRequest(authToken, twilioSig, fullUrl, params);
      // Temporary diagnostic log — remove after confirmed working
      console.log(`[TwilioGuard] url=${fullUrl} sig=${twilioSig?.slice(0, 8)}… valid=${valid} bodyKeys=${Object.keys(params).join(',')}`);
      if (!valid) throw new ForbiddenException('Invalid Twilio signature');
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      console.error('[TwilioGuard] validation threw:', err);
      throw new ForbiddenException('Twilio validation failed');
    }
  }
}
