/**
 * SCHEDULER DATABASE TEST SUITE
 * 
 * Tests the scheduler system's database integration
 * Verifies that schedules are properly stored and retrieved
 */

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

// Test the scheduler database functionality
export function runSchedulerDatabaseTests() {
  console.log("\n📋 SCHEDULER DATABASE TESTS\n");

  testCase("Job schedules table should exist", async () => {
    try {
      const result = await executeQuery('SELECT 1 FROM job_schedules LIMIT 1');
      console.log(`✅ Job schedules table exists and is accessible`);
    } catch (error) {
      // If the table doesn't exist, this is an error
      throw error;
    }
  });

  testCase("Scheduler should be able to create a schedule", async () => {
    // Use a test user ID (we'll use a mock ID for testing)
    const testUserId = 999999; // Using a high number to avoid conflicts
    const testService = 'meta';
    const testCron = '0 2 * * *'; // Daily at 2 AM
    const testEnabled = true;
    const testTimezone = 'UTC';

    try {
      // Create a test schedule
      const schedule = await enhancedScheduler.createSchedule(
        testUserId,
        testService,
        testCron,
        testEnabled,
        testTimezone
      );

      // Verify the schedule was created
      assert(!!schedule, 'Schedule should be created successfully');
      assert(schedule.user_id === testUserId, 'User ID should match');
      assert(schedule.service === testService, 'Service should match');
      assert(schedule.cron_expression === testCron, 'Cron expression should match');
      assert(schedule.enabled === testEnabled, 'Enabled status should match');
      assert(schedule.timezone === testTimezone, 'Timezone should match');

      console.log(`✅ Schedule created successfully with ID: ${schedule.id}`);
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  });

  testCase("Scheduler should be able to get schedules for a user", async () => {
    const testUserId = 999999; // Same test user as above

    try {
      const schedules = await enhancedScheduler.getSchedulesForUser(testUserId);
      
      // Should find at least the schedule we created above
      assert(Array.isArray(schedules), 'Schedules should be an array');
      assert(schedules.length >= 1, 'Should have at least one schedule for test user');
      
      const foundSchedule = schedules.find(s => s.user_id === testUserId);
      assert(!!foundSchedule, 'Should find schedule for test user');
      
      console.log(`✅ Found ${schedules.length} schedules for user ${testUserId}`);
    } catch (error) {
      console.error('Error getting schedules:', error);
      throw error;
    }
  });

  testCase("Scheduler should be able to update a schedule", async () => {
    const testUserId = 999999;
    const testService = 'meta';

    try {
      // First, get the schedule we created
      const schedules = await enhancedScheduler.getSchedulesForUser(testUserId);
      const scheduleToUpdate = schedules.find(s => s.user_id === testUserId && s.service === testService);
      
      if (!scheduleToUpdate) {
        throw new Error('Could not find schedule to update');
      }

      const newCron = '0 3 * * *'; // Changed to 3 AM
      const newEnabled = false; // Disabled
      const newTimezone = 'Asia/Kolkata'; // Changed timezone

      // Update the schedule
      await enhancedScheduler.updateSchedule(
        scheduleToUpdate.id,
        testUserId,
        testService,
        newCron,
        newEnabled,
        newTimezone
      );

      // Verify the update by fetching again
      const updatedSchedules = await enhancedScheduler.getSchedulesForUser(testUserId);
      const updatedSchedule = updatedSchedules.find(s => s.id === scheduleToUpdate.id);

      assert(!!updatedSchedule, 'Updated schedule should exist');
      if (updatedSchedule) {
        assert(updatedSchedule.cron_expression === newCron, 'Cron expression should be updated');
        assert(updatedSchedule.enabled === newEnabled, 'Enabled status should be updated');
        assert(updatedSchedule.timezone === newTimezone, 'Timezone should be updated');
      }

      console.log(`✅ Schedule updated successfully`);
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  });

  testCase("Scheduler should handle multiple services per user", async () => {
    const testUserId = 999998; // Different user ID for this test
    const services = ['meta', 'ga4', 'shopify'];
    
    try {
      // Create schedules for all services
      for (const service of services) {
        await enhancedScheduler.createSchedule(
          testUserId,
          service,
          '0 2 * * *',
          true,
          'UTC'
        );
      }

      // Get all schedules for the user
      const userSchedules = await enhancedScheduler.getSchedulesForUser(testUserId);
      
      // Verify we have schedules for all services
      assert(userSchedules.length === 3, 'Should have 3 schedules for the user');
      
      const serviceNames = userSchedules.map(s => s.service);
      for (const service of services) {
        assert(serviceNames.includes(service), `Should have schedule for ${service}`);
      }

      console.log(`✅ Multiple services handled correctly for user ${testUserId}`);
    } catch (error) {
      console.error('Error testing multiple services:', error);
      throw error;
    }
  });

  testCase("Scheduler should handle user isolation", async () => {
    const testUserId1 = 999997;
    const testUserId2 = 999996;
    
    try {
      // Create a schedule for user 1
      await enhancedScheduler.createSchedule(
        testUserId1,
        'meta',
        '0 2 * * *',
        true,
        'UTC'
      );

      // Create a schedule for user 2
      await enhancedScheduler.createSchedule(
        testUserId2,
        'ga4',
        '0 3 * * *',
        true,
        'UTC'
      );

      // Get schedules for each user
      const user1Schedules = await enhancedScheduler.getSchedulesForUser(testUserId1);
      const user2Schedules = await enhancedScheduler.getSchedulesForUser(testUserId2);

      // Verify each user only sees their own schedules
      assert(user1Schedules.length === 1, 'User 1 should have 1 schedule');
      assert(user1Schedules[0].service === 'meta', 'User 1 should have meta schedule');
      
      assert(user2Schedules.length === 1, 'User 2 should have 1 schedule');
      assert(user2Schedules[0].service === 'ga4', 'User 2 should have ga4 schedule');

      console.log(`✅ User isolation working correctly`);
    } catch (error) {
      console.error('Error testing user isolation:', error);
      throw error;
    }
  });

  testCase("Scheduler should handle disabled schedules", async () => {
    const testUserId = 999995;
    
    try {
      // Create a disabled schedule
      await enhancedScheduler.createSchedule(
        testUserId,
        'shopify',
        '0 4 * * *',
        false, // Disabled
        'UTC'
      );

      // Get the schedule
      const schedules = await enhancedScheduler.getSchedulesForUser(testUserId);
      
      assert(schedules.length === 1, 'Should have 1 schedule');
      assert(schedules[0].enabled === false, 'Schedule should be disabled');

      console.log(`✅ Disabled schedule handled correctly`);
    } catch (error) {
      console.error('Error testing disabled schedule:', error);
      throw error;
    }
  });

  console.log("\n✅ Scheduler database test suite completed\n");
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runSchedulerDatabaseTests();
}