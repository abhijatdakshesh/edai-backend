import {
  isLocalWebhookBase,
  resolveTwilioWebhookBase,
} from './twilio-webhook.util';

describe('twilio-webhook.util', () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it('resolveTwilioWebhookBase prefers TWILIO_WEBHOOK_BASE_URL', () => {
    process.env['TWILIO_WEBHOOK_BASE_URL'] = 'https://tunnel.example.com/';
    process.env['APP_URL'] = 'https://app.example.com';
    expect(resolveTwilioWebhookBase()).toBe('https://tunnel.example.com');
  });

  it('isLocalWebhookBase detects localhost', () => {
    expect(isLocalWebhookBase('http://localhost:3001')).toBe(true);
    expect(isLocalWebhookBase('https://tunnel.example.com')).toBe(false);
  });
});
