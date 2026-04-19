import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface WhatsAppTemplateComponent {
  type: string;
  parameters: Array<{ type: string; text: string }>;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN ?? '';
  private readonly phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? '';

  async sendTemplate(
    to: string,
    templateName: string,
    language: string,
    components: WhatsAppTemplateComponent[],
  ): Promise<string | null> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn('WhatsApp not configured — skipping send to %s', to);
      return null;
    }
    try {
      const resp = await axios.post(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const messageId = resp.data?.messages?.[0]?.id as string | undefined;
      this.logger.log('WhatsApp sent: %s → msgId=%s', to, messageId);
      return messageId ?? null;
    } catch (err: unknown) {
      this.logger.error('WhatsApp send failed: %s', (err as Error).message);
      return null;
    }
  }

  async sendText(to: string, text: string): Promise<void> {
    if (!this.accessToken) return;
    await axios
      .post(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      )
      .catch((e: unknown) => this.logger.error('WhatsApp text failed: %s', (e as Error).message));
  }
}
