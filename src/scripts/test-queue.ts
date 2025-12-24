#!/usr/bin/env node

/**
 * Test script to verify queue functionality
 * This script helps test the queue and worker functionality
 */

import { etlQueue } from '../lib/queue.js';
import { logger } from '../lib/logger.js';

async function testQueue() {
  console.log('🧪 Testing queue functionality...\n');
  
  try {
    // Initialize the queue
    console.log('🔌 Initializing queue...');
    await etlQueue.initialize();
    console.log('✅ Queue initialized successfully!\n');
    
    // Check queue stats
    console.log('📊 Getting queue statistics...');
    const stats = await etlQueue.getStats();
    console.log('Queue statistics:');
    console.log(`   Waiting: ${stats.waiting}`);
    console.log(`   Active: ${stats.active}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Delayed: ${stats.delayed}\n`);
    
    // Test enqueueing a job
    console.log('📤 Testing job enqueue...');
    const job = await etlQueue.enqueueSync('meta', { targetDate: '2025-12-23' });
    console.log(`✅ Job enqueued successfully!`);
    console.log(`   Job ID: ${job.id || 'N/A'}`);
    console.log(`   Job data:`, job.data, '\n');
    
    // Get job status
    console.log('📋 Getting job status...');
    const status = await etlQueue.getJobStatus(job.id!);
    console.log('Job status:', status, '\n');
    
    console.log('✅ Queue functionality test completed successfully!\n');
  } catch (error: any) {
    console.error('❌ Error during queue test:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test function if this script is executed directly
if (require.main === module) {
  testQueue().catch(console.error);
}

export { testQueue };