/**
 * SCHEDULER NOTIFICATIONS TEST SUITE
 * 
 * Tests the scheduler system and notification functionality
 * Verifies that notifications are sent properly for various events
 */

import { notifier } from '../lib/notifier.js';
import { scheduler } from '../lib/scheduler.js';
import { enhancedScheduler } from '../lib/enhanced-scheduler.js';
import { executeQuery } from '../lib/database.js';
import { logger } from '../lib/logger.js';

// Simple assertion utilities (to avoid adding a test framework)
const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const testCase = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Test the notification system
export function runSchedulerNotificationTests() {
  console.log("\n📋 SCHEDULER NOTIFICATIONS TESTS\n");

  testCase("Notifier should have sendDiscord method", () => {
    assert(typeof notifier.sendDiscord === 'function', 'sendDiscord method should exist');
  });

  testCase("Notifier should have testNotifications method", () => {
    assert(typeof notifier.testNotifications === 'function', 'testNotifications method should exist');
  });

  testCase("Scheduler should have triggerNow method with userId and service parameters", () => {
    assert(typeof scheduler.triggerNow === 'function', 'triggerNow method should exist');
    // Check if the method accepts the right parameters by checking its length
    assert(scheduler.triggerNow.length >= 2, 'triggerNow should accept userId and service parameters');
  });

  testCase("Enhanced scheduler should have triggerNow method", () => {
    assert(typeof enhancedScheduler.triggerNow === 'function', 'enhancedScheduler.triggerNow method should exist');
  });

  testCase("Enhanced scheduler should have start/stop methods", () => {
    assert(typeof enhancedScheduler.start === 'function', 'enhancedScheduler.start method should exist');
    assert(typeof enhancedScheduler.stop === 'function', 'enhancedScheduler.stop method should exist');
  });

  testCase("Enhanced scheduler should have updateSchedule method", () => {
    assert(typeof enhancedScheduler.updateSchedule === 'function', 'enhancedScheduler.updateSchedule method should exist');
  });

  testCase("Enhanced scheduler should have createSchedule method", () => {
    assert(typeof enhancedScheduler.createSchedule === 'function', 'enhancedScheduler.createSchedule method should exist');
  });

  testCase("Enhanced scheduler should have getSchedulesForUser method", () => {
    assert(typeof enhancedScheduler.getSchedulesForUser === 'function', 'enhancedScheduler.getSchedulesForUser method should exist');
  });

  // Test notification sending (without actually sending to avoid spam)
  testCase("Test notification sending functionality", async () => {
    // Mock the fetch function to avoid actually sending notifications
    const originalFetch = global.fetch;
    let fetchCalled = false;
    let fetchUrl = '';
    let fetchOptions: any = {};

    // @ts-ignore - we're extending the global type for testing
    global.fetch = async (url: string, options: any) => {
      fetchCalled = true;
      fetchUrl = url;
      fetchOptions = options;

      return {
        ok: true,
        json: async () => ({}),
        text: async () => 'OK'
      };
    };

    try {
      const testMessage = `🧪 **Test Notification**\n\nScheduler notification test.\nTime: ${new Date().toISOString()}`;
      const result = await notifier.sendDiscord(testMessage);

      assert(fetchCalled, 'fetch should be called when sending Discord notification');
      assert(fetchUrl.includes('discord.com/api/webhooks'), 'fetch should be called with Discord webhook URL');
      assert(fetchOptions.method === 'POST', 'fetch should use POST method');
      assert(result === true, 'sendDiscord should return true when successful');

      // Restore original fetch
      // @ts-ignore
      global.fetch = originalFetch;
    } catch (error) {
      // Restore original fetch in case of error
      // @ts-ignore
      global.fetch = originalFetch;
      throw error;
    }
  });

  // Test sync failure notification
  testCase("Test sync failure notification", async () => {
    // Mock the fetch function to avoid actually sending notifications
    const originalFetch = global.fetch;
    let fetchCalled = false;

    // @ts-ignore - we're extending the global type for testing
    global.fetch = async (url: string, options: any) => {
      fetchCalled = true;
      return {
        ok: true,
        json: async () => ({}),
        text: async () => 'OK'
      };
    };

    try {
      await notifier.sendSyncFailure('meta', '2023-01-01', 'Test error message');
      assert(fetchCalled, 'fetch should be called when sending sync failure notification');
      
      // Restore original fetch
      // @ts-ignore
      global.fetch = originalFetch;
    } catch (error) {
      // Restore original fetch in case of error
      // @ts-ignore
      global.fetch = originalFetch;
      throw error;
    }
  });

  // Test token expiry notification
  testCase("Test token expiry notification", async () => {
    // Mock the fetch function to avoid actually sending notifications
    const originalFetch = global.fetch;
    let fetchCalled = false;

    // @ts-ignore - we're extending the global type for testing
    global.fetch = async (url: string, options: any) => {
      fetchCalled = true;
      return {
        ok: true,
        json: async () => ({}),
        text: async () => 'OK'
      };
    };

    try {
      await notifier.sendTokenExpiryAlert('ga4');
      assert(fetchCalled, 'fetch should be called when sending token expiry notification');
      
      // Restore original fetch
      // @ts-ignore
      global.fetch = originalFetch;
    } catch (error) {
      // Restore original fetch in case of error
      // @ts-ignore
      global.fetch = originalFetch;
      throw error;
    }
  });

  // Test rate limit notification
  testCase("Test rate limit notification", async () => {
    // Mock the fetch function to avoid actually sending notifications
    const originalFetch = global.fetch;
    let fetchCalled = false;

    // @ts-ignore - we're extending the global type for testing
    global.fetch = async (url: string, options: any) => {
      fetchCalled = true;
      return {
        ok: true,
        json: async () => ({}),
        text: async () => 'OK'
      };
    };

    try {
      await notifier.sendRateLimitAlert('shopify');
      assert(fetchCalled, 'fetch should be called when sending rate limit notification');
      
      // Restore original fetch
      // @ts-ignore
      global.fetch = originalFetch;
    } catch (error) {
      // Restore original fetch in case of error
      // @ts-ignore
      global.fetch = originalFetch;
      throw error;
    }
  });

  // Test daily summary notification
  testCase("Test daily summary notification", async () => {
    // Mock the fetch function to avoid actually sending notifications
    const originalFetch = global.fetch;
    let fetchCalled = false;

    // @ts-ignore - we're extending the global type for testing
    global.fetch = async (url: string, options: any) => {
      fetchCalled = true;
      return {
        ok: true,
        json: async () => ({}),
        text: async () => 'OK'
      };
    };

    try {
      await notifier.sendDailySummary([
        { source: 'meta', success: true, date: '2023-01-01', mode: 'append', rowNumber: 10 },
        { source: 'ga4', success: false, date: '2023-01-01', error: 'API Error' }
      ]);
      assert(fetchCalled, 'fetch should be called when sending daily summary notification');
      
      // Restore original fetch
      // @ts-ignore
      global.fetch = originalFetch;
    } catch (error) {
      // Restore original fetch in case of error
      // @ts-ignore
      global.fetch = originalFetch;
      throw error;
    }
  });

  console.log("\n✅ Scheduler notification test suite completed\n");
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runSchedulerNotificationTests();
}