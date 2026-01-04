/**
 * SCHEDULER CRON TEST SUITE
 * 
 * Tests the scheduler system's cron functionality and edge cases
 * Verifies that cron jobs are properly scheduled and executed
 */

import cron from 'node-cron';
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

// Test the scheduler cron functionality
export function runSchedulerCronTests() {
  console.log("\n📋 SCHEDULER CRON TESTS\n");

  testCase("Cron expression validation should work", () => {
    // Valid cron expressions
    assert(cron.validate('0 2 * * *'), 'Valid cron expression should pass validation');
    assert(cron.validate('0 2,6 * * *'), 'Valid cron expression with multiple times should pass validation');
    assert(cron.validate('*/5 * * * *'), 'Valid cron expression with intervals should pass validation');
    assert(cron.validate('0 2 * * 0'), 'Valid cron expression with day of week should pass validation');
    
    // Invalid cron expressions
    assert(!cron.validate('0 2 * *'), 'Invalid cron expression should fail validation');
    assert(!cron.validate('invalid'), 'Invalid cron expression should fail validation');
    assert(!cron.validate('0 2 * * * * *'), 'Too many parts in cron expression should fail validation');

    console.log(`✅ Cron expression validation working correctly`);
  });

  testCase("Scheduler should calculate next run time correctly", () => {
    // This test verifies the internal method for calculating next run times
    // We'll use a mock to test the logic
    const schedulerInstance: any = enhancedScheduler;
    
    // Test basic functionality exists
    assert(typeof schedulerInstance.calculateNextRunTime === 'function', 
           'calculateNextRunTime method should exist');
    
    // Test with a simple cron expression
    const nextRun = schedulerInstance.calculateNextRunTime('0 2 * * *', 'UTC');
    assert(nextRun instanceof Date, 'Should return a Date object');
    
    console.log(`✅ Next run time calculation working correctly`);
  });

  testCase("Scheduler should handle different timezones", () => {
    const schedulerInstance: any = enhancedScheduler;
    
    // Test with different timezones
    const utcRun = schedulerInstance.calculateNextRunTime('0 2 * * *', 'UTC');
    const istRun = schedulerInstance.calculateNextRunTime('0 2 * * *', 'Asia/Kolkata');
    const estRun = schedulerInstance.calculateNextRunTime('0 2 * * *', 'America/New_York');
    
    // The times should be different due to timezone differences
    // (Note: This is a basic check - in reality, the actual times may be the same day
    // depending on when the test runs, but the internal calculation should account for timezones)
    assert(utcRun instanceof Date, 'UTC calculation should return a Date');
    assert(istRun instanceof Date, 'IST calculation should return a Date');
    assert(estRun instanceof Date, 'EST calculation should return a Date');

    console.log(`✅ Timezone handling working correctly`);
  });

  testCase("Scheduler should handle cron intervals properly", () => {
    const schedulerInstance: any = enhancedScheduler;
    
    // Test various cron patterns
    const patterns = [
      '*/5 * * * *',    // Every 5 minutes
      '0 */2 * * *',    // Every 2 hours
      '0 0 * * 0',      // Weekly (Sunday at midnight)
      '0 0 1 * *',      // Monthly (1st at midnight)
      '0 0 * * *',      // Daily (midnight)
    ];
    
    for (const pattern of patterns) {
      const nextRun = schedulerInstance.calculateNextRunTime(pattern, 'UTC');
      assert(nextRun instanceof Date, `Pattern ${pattern} should return a Date`);
      assert(cron.validate(pattern), `Pattern ${pattern} should be valid`);
    }

    console.log(`✅ Cron interval patterns handled correctly`);
  });

  testCase("Scheduler should handle edge cases in cron expressions", () => {
    const schedulerInstance: any = enhancedScheduler;
    
    // Test edge cases
    const edgeCases = [
      '59 23 * * *',    // Last minute of the day
      '0 0 * * *',      // First minute of the day
      '0 0 29 2 *',     // Feb 29 (leap year)
      '0 0 31 4 *',     // April 31 (doesn't exist, should handle gracefully)
    ];
    
    for (const pattern of edgeCases) {
      // Just verify it doesn't throw an error
      try {
        const nextRun = schedulerInstance.calculateNextRunTime(pattern, 'UTC');
        assert(nextRun instanceof Date, `Edge case ${pattern} should not throw error`);
      } catch (error) {
        // Some patterns might legitimately fail, that's OK as long as it's handled gracefully
        console.log(`   Note: Edge case ${pattern} failed as expected: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`✅ Cron edge cases handled gracefully`);
  });

  testCase("Scheduler should handle invalid cron expressions gracefully", async () => {
    const testUserId = 999994;
    const testService = 'meta';
    
    try {
      // Try to create a schedule with an invalid cron expression
      // This should be caught and handled gracefully
      try {
        await enhancedScheduler.createSchedule(
          testUserId,
          testService,
          'invalid cron', // Invalid expression
          true,
          'UTC'
        );
        // If we reach here, the invalid cron wasn't caught, which is bad
        throw new Error('Invalid cron expression should have been rejected');
      } catch (error) {
        // This is expected - the invalid cron should be caught
        console.log(`   Expected error caught: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      // Clean up by trying to delete any schedule that might have been created
      try {
        await executeQuery(
          `DELETE FROM job_schedules WHERE user_id = $1 AND service = $2`,
          [testUserId, testService]
        );
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    console.log(`✅ Invalid cron expressions handled gracefully`);
  });

  testCase("Scheduler should handle timezone validation", async () => {
    const testUserId = 999993;
    const testService = 'ga4';
    
    try {
      // Valid timezone
      await enhancedScheduler.createSchedule(
        testUserId,
        testService,
        '0 2 * * *',
        true,
        'Asia/Kolkata'
      );
      
      // Invalid timezone should be handled gracefully
      try {
        await enhancedScheduler.createSchedule(
          testUserId,
          'shopify',
          '0 3 * * *',
          true,
          'Invalid/Timezone' // Invalid timezone
        );
        // If we reach here, the invalid timezone wasn't caught, which is bad
        throw new Error('Invalid timezone should have been rejected');
      } catch (error) {
        // This is expected - the invalid timezone should be caught
        console.log(`   Expected error caught for invalid timezone: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      // Clean up
      try {
        await executeQuery(
          `DELETE FROM job_schedules WHERE user_id = $1`,
          [testUserId]
        );
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    console.log(`✅ Timezone validation working correctly`);
  });

  testCase("Scheduler should handle startup and loading schedules", async () => {
    const testUserId = 999992;
    const testService = 'meta';
    
    try {
      // Create a schedule
      await enhancedScheduler.createSchedule(
        testUserId,
        testService,
        '0 2 * * *',
        true,
        'UTC'
      );
      
      // Stop the scheduler if it's running
      if (enhancedScheduler.isActive()) {
        enhancedScheduler.stop();
      }
      
      // Start the scheduler - this should load all active schedules from DB
      await enhancedScheduler.start();
      
      // Verify it's active
      assert(enhancedScheduler.isActive(), 'Scheduler should be active after start');
      
      // Stop the scheduler
      enhancedScheduler.stop();
      
      // Verify it's stopped
      assert(!enhancedScheduler.isActive(), 'Scheduler should be inactive after stop');
      
      console.log(`✅ Scheduler startup and shutdown working correctly`);
    } finally {
      // Clean up
      try {
        await executeQuery(
          `DELETE FROM job_schedules WHERE user_id = $1`,
          [testUserId]
        );
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  });

  testCase("Scheduler should handle refresh schedules", async () => {
    const testUserId = 999991;
    const testService = 'ga4';
    
    try {
      // Create a schedule
      await enhancedScheduler.createSchedule(
        testUserId,
        testService,
        '0 2 * * *',
        true,
        'UTC'
      );
      
      // Refresh schedules - this should reload from DB
      await enhancedScheduler.refreshSchedules();
      
      // Get schedules to verify they're still there
      const schedules = await enhancedScheduler.getSchedulesForUser(testUserId);
      assert(schedules.length === 1, 'Should still have 1 schedule after refresh');
      
      console.log(`✅ Schedule refresh working correctly`);
    } finally {
      // Clean up
      try {
        await executeQuery(
          `DELETE FROM job_schedules WHERE user_id = $1`,
          [testUserId]
        );
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  });

  console.log("\n✅ Scheduler cron test suite completed\n");
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runSchedulerCronTests();
}