/**
 * Notification Service
 * Sends alerts via Telegram and Email
 *
 * @module lib/notifier
 */

import { config } from '../config/index.js';
import { logger, events } from './logger.js';
import { DataSource, IsoDate } from '../types/etl.js';

/**
 * Notifier class
 * Handles sending notifications through various channels
 */
class Notifier {
  private cooldownMap = new Map<string, number>();
  private cooldownMs = 5 * 60 * 1000; // 5 minute cooldown per source

  /**
   * Check if notification is in cooldown
   */
  private isInCooldown(key: string): boolean {
    const lastSent = this.cooldownMap.get(key);
    if (!lastSent) return false;
    return Date.now() - lastSent < this.cooldownMs;
  }

  /**
   * Set cooldown for a notification key
   */
  private setCooldown(key: string): void {
    this.cooldownMap.set(key, Date.now());
  }

  /**
   * Send Telegram message
   */
  private async sendTelegram(message: string): Promise<boolean> {
    const { enabled, botToken, chatId } = config.notifications.telegram;

    if (!enabled || !botToken || !chatId) {
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
      }

      events.emit('NOTIFICATION_SENT', { metadata: { channel: 'telegram' } });
      return true;
    } catch (error) {
      logger.error('Failed to send Telegram notification', {
        error: error instanceof Error ? error.message : String(error),
      });
      events.emit('NOTIFICATION_FAILED', {
        error: error instanceof Error ? error.message : String(error),
        metadata: { channel: 'telegram' },
      });
      return false;
    }
  }

  /**
   * Send Email notification
   * Note: Requires SMTP setup - placeholder implementation
   */
  private async sendEmail(subject: string, body: string): Promise<boolean> {
    const { enabled, smtpHost, smtpPort, fromAddress, toAddresses } = config.notifications.email;

    if (!enabled || !smtpHost || !fromAddress || !toAddresses?.length) {
      return false;
    }

    try {
      // Placeholder for email implementation
      // In production, use nodemailer or similar
      logger.info('Email notification (not implemented)', {
        subject,
        to: toAddresses,
      });

      // For now, just log the intention
      events.emit('NOTIFICATION_SENT', { metadata: { channel: 'email' } });
      return true;
    } catch (error) {
      logger.error('Failed to send email notification', {
        error: error instanceof Error ? error.message : String(error),
      });
      events.emit('NOTIFICATION_FAILED', {
        error: error instanceof Error ? error.message : String(error),
        metadata: { channel: 'email' },
      });
      return false;
    }
  }

  /**
   * Send sync failure notification
   */
  async sendSyncFailure(source: DataSource, date: IsoDate, error: string): Promise<void> {
    const cooldownKey = `failure-${source}`;

    if (this.isInCooldown(cooldownKey)) {
      logger.debug('Notification in cooldown, skipping', { source });
      return;
    }

    const message = `🚨 <b>ETL Sync Failed</b>

<b>Source:</b> ${source.toUpperCase()}
<b>Date:</b> ${date}
<b>Error:</b> ${this.escapeHtml(error)}
<b>Time:</b> ${new Date().toISOString()}

Please check the logs for more details.`;

    const emailSubject = `[KPI ETL] Sync Failed: ${source.toUpperCase()}`;
    const emailBody = `ETL Sync Failed\n\nSource: ${source}\nDate: ${date}\nError: ${error}\nTime: ${new Date().toISOString()}`;

    await Promise.all([
      this.sendTelegram(message),
      this.sendEmail(emailSubject, emailBody),
    ]);

    this.setCooldown(cooldownKey);
  }

  /**
   * Send sync success summary
   */
  async sendDailySummary(results: Array<{
    source: DataSource;
    success: boolean;
    date: IsoDate;
    mode?: string;
    rowNumber?: number;
    error?: string;
  }>): Promise<void> {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    let message = `📊 <b>Daily ETL Summary</b>\n\n`;

    if (successful.length > 0) {
      message += `✅ <b>Successful (${successful.length}):</b>\n`;
      successful.forEach((r) => {
        message += `  • ${r.source.toUpperCase()}: ${r.mode} at row ${r.rowNumber}\n`;
      });
      message += '\n';
    }

    if (failed.length > 0) {
      message += `❌ <b>Failed (${failed.length}):</b>\n`;
      failed.forEach((r) => {
        message += `  • ${r.source.toUpperCase()}: ${this.escapeHtml(r.error || 'Unknown error')}\n`;
      });
    }

    message += `\n<b>Time:</b> ${new Date().toISOString()}`;

    await this.sendTelegram(message);
  }

  /**
   * Send token expiry alert
   */
  async sendTokenExpiryAlert(source: DataSource): Promise<void> {
    const cooldownKey = `token-${source}`;

    if (this.isInCooldown(cooldownKey)) {
      return;
    }

    const message = `⚠️ <b>Token Expired</b>

<b>Source:</b> ${source.toUpperCase()}
<b>Time:</b> ${new Date().toISOString()}

Please refresh the access token for ${source}.`;

    await this.sendTelegram(message);
    this.setCooldown(cooldownKey);
  }

  /**
   * Send rate limit alert
   */
  async sendRateLimitAlert(source: DataSource): Promise<void> {
    const cooldownKey = `ratelimit-${source}`;

    if (this.isInCooldown(cooldownKey)) {
      return;
    }

    const message = `⏳ <b>Rate Limited</b>

<b>Source:</b> ${source.toUpperCase()}
<b>Time:</b> ${new Date().toISOString()}

The ${source} API is rate limiting requests. Syncs will be retried automatically.`;

    await this.sendTelegram(message);
    this.setCooldown(cooldownKey);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Test notification channels
   */
  async testNotifications(): Promise<{
    telegram: boolean;
    email: boolean;
  }> {
    const testMessage = `🧪 <b>Test Notification</b>\n\nKPI ETL Pipeline notification test.\nTime: ${new Date().toISOString()}`;

    const telegram = await this.sendTelegram(testMessage);
    const email = await this.sendEmail('KPI ETL Test', 'This is a test notification.');

    return { telegram, email };
  }
}

// Export singleton instance
export const notifier = new Notifier();

export { Notifier };
