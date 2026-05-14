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
    // Only bypass signature validation in test when explicitly opted in
    if (process.env['NODE_ENV'] === 'test' && process.env['ALLOW_WEBHOOK_IN_TEST'] === 'true') return true;
    if (!twilioSig) throw new ForbiddenException('Missing Twilio signature');

    try {
      // Dynamic import to avoid hard dependency when Twilio not configured
      const twilio = await import('twilio');
      // Behind Azure Container Apps / any TLS-terminating proxy, req.protocol
      // is 'http'. Use X-Forwarded-Proto (set by the ingress) to get the
      // scheme Twilio actually signed against.
      const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ?? req.protocol;
      const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host');
      const fullUrl = `${proto}://${host}${req.originalUrl}`;
      const params = req.body as Record<string, string>;
      const valid = twilio.validateRequest(authToken, twilioSig, fullUrl, params);
      if (!valid) throw new ForbiddenException('Invalid Twilio signature');
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException('Twilio validation failed');
    }
  }
}
