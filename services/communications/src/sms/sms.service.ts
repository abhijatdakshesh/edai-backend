import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly karixApiKey = process.env.KARIX_API_KEY ?? '';

  async sendSms(to: string, message: string, senderId = 'EDAI'): Promise<void> {
    if (!this.karixApiKey) {
      this.logger.warn('SMS not configured — skipping send to %s: %s', to, message);
      return;
    }
    // Production: POST to Karix or Gupshup API with DLT template ID
    this.logger.log('SMS → %s: %s', to, message.slice(0, 60));
  }
}
