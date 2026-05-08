import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as https from 'https';
import axios from 'axios';

const VTU_BASE = 'https://vtu.ac.in';
const NOTIFICATIONS_PATH = '/ict-circular-notification/';
const HOME_PATH = '/';
const CACHE_TTL_MS = 30 * 60 * 1000;            // 30 min
const HARD_TIMEOUT_MS = 12_000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface VtuNotification {
  title: string;
  link: string;
  date?: string | null;
  source: 'notifications' | 'home';
}

/**
 * Pulls the latest notifications/circulars from VTU's public WordPress site
 * and exposes them to every portal in EduStack. Cached in-memory so we don't
 * hammer VTU on every page load. Add the @Cron decorator + a refresh()
 * scheduler when long-running cron is in place.
 */
@Injectable()
export class VtuNotificationsService {
  private readonly logger = new Logger(VtuNotificationsService.name);
  private cache: { items: VtuNotification[]; fetchedAt: number } | null = null;

  // Static fallback so the UI is never empty even if VTU is unreachable.
  private readonly fallback: VtuNotification[] = [
    { title: 'VTU NEP-2020 Curriculum Implementation Guidelines', link: 'https://vtu.ac.in/pdf/NEP2020.pdf', date: null, source: 'notifications' },
    { title: 'Even Semester Examination Time Table', link: 'https://vtu.ac.in/even-sem-tt/', date: null, source: 'notifications' },
    { title: 'Revised Academic Calendar 2025-26', link: 'https://vtu.ac.in/academic-calendar/', date: null, source: 'notifications' },
  ];

  async getNotifications(): Promise<{ items: VtuNotification[]; fetchedAt: string; cached: boolean }> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return { items: this.cache.items, fetchedAt: new Date(this.cache.fetchedAt).toISOString(), cached: true };
    }
    try {
      const items = await this.scrape();
      this.cache = { items, fetchedAt: Date.now() };
      return { items, fetchedAt: new Date(this.cache.fetchedAt).toISOString(), cached: false };
    } catch (err) {
      this.logger.warn(`VTU scrape failed: ${(err as Error).message}; returning fallback`);
      return { items: this.fallback, fetchedAt: new Date().toISOString(), cached: false };
    }
  }

  private async scrape(): Promise<VtuNotification[]> {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const headers = { 'User-Agent': USER_AGENT };
    const items: VtuNotification[] = [];

    // 1. The dedicated notifications page
    try {
      const res = await axios.get(VTU_BASE + NOTIFICATIONS_PATH, { httpsAgent, headers, timeout: HARD_TIMEOUT_MS });
      const $ = cheerio.load(res.data);
      $('article a, .entry-title a, h2 a, h3 a').each((_, a) => {
        const title = $(a).text().trim();
        const href = $(a).attr('href');
        if (title && href && title.length > 8) {
          items.push({ title, link: href, date: null, source: 'notifications' });
        }
      });
      // PDFs in the body too
      $('a[href$=".pdf"]').each((_, a) => {
        const title = $(a).text().trim();
        const href = $(a).attr('href');
        if (title && href && title.length > 8) {
          items.push({ title, link: href, date: null, source: 'notifications' });
        }
      });
    } catch (err) {
      this.logger.warn(`Notifications page fetch failed: ${(err as Error).message}`);
    }

    // 2. Notifications block on the home page (rolling marquee)
    try {
      const res = await axios.get(VTU_BASE + HOME_PATH, { httpsAgent, headers, timeout: HARD_TIMEOUT_MS });
      const $ = cheerio.load(res.data);
      $('marquee a, #webc a, .marquee a').each((_, a) => {
        const title = $(a).text().trim();
        const href = $(a).attr('href');
        if (title && href && title.length > 8) {
          items.push({ title, link: href, date: null, source: 'home' });
        }
      });
    } catch (err) {
      this.logger.warn(`Home page fetch failed: ${(err as Error).message}`);
    }

    // De-duplicate by link, cap at 30
    const seen = new Set<string>();
    const unique: VtuNotification[] = [];
    for (const item of items) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      unique.push(item);
      if (unique.length >= 30) break;
    }
    if (unique.length === 0) throw new Error('Empty result');
    return unique;
  }
}
