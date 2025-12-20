/**
 * Application Configuration
 * Centralized configuration management with environment variable support
 *
 * @module config
 */

import { AppConfig, DataSource, SourceConfig } from '../types/etl.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Get required environment variable or throw
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Parse boolean from environment variable
 */
function boolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer from environment variable
 */
function intEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Default spreadsheet ID (shared across sources)
const DEFAULT_SPREADSHEET_ID = optionalEnv(
  'GOOGLE_SPREADSHEET_ID',
  '1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8'
);

/**
 * Source-specific configurations
 */
const sourceConfigs: Record<DataSource, SourceConfig> = {
  meta: {
    enabled: boolEnv('META_ENABLED', true),
    spreadsheetId: optionalEnv('META_SPREADSHEET_ID', DEFAULT_SPREADSHEET_ID),
    sheetName: optionalEnv('META_SHEET_NAME', 'meta_raw_daily'),
    requiredEnvVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
  },
  ga4: {
    enabled: boolEnv('GA4_ENABLED', true),
    spreadsheetId: optionalEnv('GA4_SPREADSHEET_ID', DEFAULT_SPREADSHEET_ID),
    sheetName: optionalEnv('GA4_SHEET_NAME', 'Google'),
    requiredEnvVars: ['GOOGLE_ACCESS_TOKEN', 'GA4_PROPERTY_ID'],
  },
  shopify: {
    enabled: boolEnv('SHOPIFY_ENABLED', true),
    spreadsheetId: optionalEnv('SHOPIFY_SPREADSHEET_ID', DEFAULT_SPREADSHEET_ID),
    sheetName: optionalEnv('SHOPIFY_SHEET_NAME', 'Shopify'),
    requiredEnvVars: ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
  },
};

/**
 * Application configuration
 */
export const config: AppConfig = {
  // Redis configuration
  redisUrl: optionalEnv('REDIS_URL', 'redis://localhost:6379'),

  // Server configuration
  port: intEnv('PORT', 3001),

  // Scheduling configuration
  timezone: optionalEnv('TZ', 'Asia/Kolkata'),
  cronSchedule: optionalEnv('CRON_SCHEDULE', '0 2 * * *'), // 2:00 AM daily

  // Retry configuration
  maxRetries: intEnv('MAX_RETRIES', 3),

  // Source configurations
  sources: sourceConfigs,

  // Notification configuration
  notifications: {
    telegram: {
      enabled: boolEnv('TELEGRAM_ENABLED', false),
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    },
    email: {
      enabled: boolEnv('EMAIL_ENABLED', false),
      smtpHost: process.env.SMTP_HOST,
      smtpPort: intEnv('SMTP_PORT', 587),
      fromAddress: process.env.EMAIL_FROM,
      toAddresses: process.env.EMAIL_TO?.split(',').map((e) => e.trim()),
    },
  },
};

/**
 * Validate that required environment variables are present for enabled sources
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [source, sourceConfig] of Object.entries(config.sources)) {
    if (sourceConfig.enabled) {
      for (const envVar of sourceConfig.requiredEnvVars) {
        if (!process.env[envVar]) {
          errors.push(`${source}: Missing required env var ${envVar}`);
        }
      }
    }
  }

  // Validate notification configs if enabled
  if (config.notifications.telegram.enabled) {
    if (!config.notifications.telegram.botToken) {
      errors.push('Telegram enabled but TELEGRAM_BOT_TOKEN not set');
    }
    if (!config.notifications.telegram.chatId) {
      errors.push('Telegram enabled but TELEGRAM_CHAT_ID not set');
    }
  }

  if (config.notifications.email.enabled) {
    if (!config.notifications.email.smtpHost) {
      errors.push('Email enabled but SMTP_HOST not set');
    }
    if (!config.notifications.email.fromAddress) {
      errors.push('Email enabled but EMAIL_FROM not set');
    }
    if (!config.notifications.email.toAddresses?.length) {
      errors.push('Email enabled but EMAIL_TO not set');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get source-specific credentials from environment
 */
export function getSourceCredentials(source: DataSource): Record<string, string> {
  switch (source) {
    case 'meta':
      return {
        accessToken: process.env.META_ACCESS_TOKEN || '',
        adAccountId: process.env.META_AD_ACCOUNT_ID || '',
      };
    case 'ga4':
      return {
        accessToken: process.env.GOOGLE_ACCESS_TOKEN || '',
        propertyId: process.env.GA4_PROPERTY_ID || '',
      };
    case 'shopify':
      return {
        storeDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
      };
  }
}

/**
 * Log configuration (masking sensitive values)
 */
export function logConfig(): void {
  console.log('📋 Application Configuration:');
  console.log(`   Port: ${config.port}`);
  console.log(`   Timezone: ${config.timezone}`);
  console.log(`   Cron Schedule: ${config.cronSchedule}`);
  console.log(`   Redis URL: ${config.redisUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   Max Retries: ${config.maxRetries}`);
  console.log('');
  console.log('📊 Sources:');
  for (const [source, sourceConfig] of Object.entries(config.sources)) {
    const status = sourceConfig.enabled ? '✓ Enabled' : '✗ Disabled';
    console.log(`   ${source}: ${status} → ${sourceConfig.sheetName}`);
  }
  console.log('');
  console.log('🔔 Notifications:');
  console.log(`   Telegram: ${config.notifications.telegram.enabled ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`   Email: ${config.notifications.email.enabled ? '✓ Enabled' : '✗ Disabled'}`);
}

export default config;
