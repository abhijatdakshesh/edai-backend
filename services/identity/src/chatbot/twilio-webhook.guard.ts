import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const twilioSig = req.headers['x-twilio-signature'] as string | undefined;
    const authToken = process.env['TWILIO_AUTH_TOKEN'];

    // Skip validation in test/dev mode when no credentials configured
    if (!authToken || process.env['NODE_ENV'] === 'test') return true;
    if (!twilioSig) throw new ForbiddenException('Missing Twilio signature');

    try {
      // Dynamic import to avoid hard dependency when Twilio not configured
      const twilio = await import('twilio');
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
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
