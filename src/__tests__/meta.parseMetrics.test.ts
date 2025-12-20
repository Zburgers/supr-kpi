/**
 * DETERMINISTIC REVENUE TEST SUITE
 * ================================
 * These tests ensure that Meta insights parsing produces consistent,
 * auditable results using canonical action sources (not summing variants).
 *
 * Test Fixture: Actual curl response from 2025-12-14
 * This is the ground truth for validating the parsing logic.
 *
 * Note: This test file uses simple mock functions instead of Jest
 * to avoid dependencies. It can be run with any test runner or directly.
 */

import { metaInsightsWorkflow } from "../services/meta.js";

// Mock assertion functions for TypeScript compatibility
const createExpect = (value: any) => ({
  toBe: (expected: any) => {
    if (value !== expected) {
      throw new Error(`Expected ${value} to be ${expected}`);
    }
  },
  toBeDefined: () => {
    if (value === undefined) {
      throw new Error(`Expected ${value} to be defined`);
    }
  },
  not: {
    toBe: (expected: any) => {
      if (value === expected) {
        throw new Error(`Expected ${value} NOT to be ${expected}`);
      }
    },
  },
  toStrictEqual: (expected: any) => {
    const actual = JSON.stringify(value);
    const exp = JSON.stringify(expected);
    if (actual !== exp) {
      throw new Error(`Expected ${actual} to equal ${exp}`);
    }
  },
});

const testCase = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(e);
  }
};

/**
 * Ground truth sample from curl request on 2025-12-14
 * This is the actual data returned by Meta Graph API
 */
const SAMPLE_META_RESPONSE = {
  data: [
    {
      date_start: "2025-12-14",
      date_stop: "2025-12-14",
      spend: "13899.48",
      reach: "20926",
      impressions: "32479",
      clicks: "1293",
      actions: [
        { action_type: "onsite_conversion.total_messaging_connection", value: "4" },
        { action_type: "web_in_store_purchase", value: "10" },
        { action_type: "omni_search", value: "19" },
        { action_type: "offsite_conversion.fb_pixel_search", value: "19" },
        { action_type: "omni_purchase", value: "10" },
        { action_type: "link_click", value: "1311" },
        { action_type: "omni_add_to_cart", value: "108" },
        { action_type: "omni_initiated_checkout", value: "33" },
        { action_type: "page_engagement", value: "3976" },
        { action_type: "purchase", value: "10" },
        { action_type: "landing_page_view", value: "1026" },
        { action_type: "add_to_cart", value: "108" },
        { action_type: "omni_landing_page_view", value: "1026" },
        { action_type: "onsite_web_app_add_to_cart", value: "108" },
        { action_type: "onsite_web_view_content", value: "1487" },
        { action_type: "onsite_web_add_to_cart", value: "108" },
        { action_type: "onsite_conversion.post_unlike", value: "5" },
        { action_type: "post_engagement", value: "3976" },
        { action_type: "offsite_conversion.fb_pixel_add_payment_info", value: "15" },
        { action_type: "onsite_web_app_purchase", value: "10" },
        { action_type: "post_interaction_gross", value: "59" },
        { action_type: "onsite_conversion.messaging_user_depth_2_message_send", value: "4" },
        { action_type: "view_content", value: "1487" },
        { action_type: "onsite_conversion.messaging_user_depth_3_message_send", value: "1" },
        { action_type: "web_app_in_store_purchase", value: "10" },
        { action_type: "offsite_search_add_meta_leads", value: "19" },
        { action_type: "post", value: "18" },
        { action_type: "onsite_conversion.post_save", value: "6" },
        { action_type: "onsite_conversion.post_net_like", value: "30" },
        { action_type: "onsite_web_initiate_checkout", value: "33" },
        { action_type: "onsite_conversion.post_net_save", value: "6" },
        { action_type: "onsite_web_app_view_content", value: "1487" },
        { action_type: "offsite_content_view_add_meta_leads", value: "1487" },
        { action_type: "onsite_web_purchase", value: "10" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "2" },
        { action_type: "add_payment_info", value: "15" },
        { action_type: "search", value: "19" },
        { action_type: "video_view", value: "2606" },
        { action_type: "omni_view_content", value: "1487" },
        { action_type: "offsite_conversion.fb_pixel_view_content", value: "1487" },
        { action_type: "offsite_conversion.fb_pixel_add_to_cart", value: "108" },
        { action_type: "post_reaction", value: "35" },
        { action_type: "offsite_conversion.fb_pixel_initiate_checkout", value: "33" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "10" },
        { action_type: "initiate_checkout", value: "33" },
      ],
      action_values: [
        { action_type: "onsite_web_app_purchase", value: "15742.14" },
        { action_type: "onsite_web_app_add_to_cart", value: "427202.5" },
        { action_type: "onsite_web_initiate_checkout", value: "112186.19" },
        { action_type: "add_payment_info", value: "28041.19" },
        { action_type: "omni_initiated_checkout", value: "112186.19" },
        { action_type: "offsite_conversion.fb_pixel_view_content", value: "7370344.98" },
        { action_type: "web_app_in_store_purchase", value: "1.57" },
        { action_type: "omni_view_content", value: "7370344.98" },
        { action_type: "add_to_cart", value: "427202.5" },
        { action_type: "onsite_web_purchase", value: "15742.14" },
        { action_type: "offsite_conversion.fb_pixel_add_to_cart", value: "427202.5" },
        { action_type: "purchase", value: "15742.14" }, // ← CANONICAL REVENUE SOURCE
        { action_type: "view_content", value: "7370344.98" },
        { action_type: "offsite_conversion.fb_pixel_initiate_checkout", value: "112186.19" },
        { action_type: "offsite_conversion.fb_pixel_add_payment_info", value: "28041.19" },
        { action_type: "onsite_web_view_content", value: "7370344.98" },
        { action_type: "onsite_web_app_view_content", value: "7370344.98" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "15742.14" },
        { action_type: "initiate_checkout", value: "112186.19" },
        { action_type: "omni_add_to_cart", value: "427202.5" },
        { action_type: "omni_purchase", value: "15742.14" },
        { action_type: "web_in_store_purchase", value: "15742.14" },
        { action_type: "onsite_web_add_to_cart", value: "427202.5" },
      ],
    },
  ],
  paging: {
    cursors: {
      before: "MAZDZD",
      after: "MAZDZD",
    },
  },
};

// ============================================================================
// TEST SUITE EXECUTION
// ============================================================================

export function runMetaDeterministicTests() {
  console.log("\n📋 DETERMINISTIC REVENUE PARSING TESTS\n");

  // Test 1: Revenue canonical source
  testCase("Revenue: should be canonical purchase (15742.14, NOT 94452.84)", () => {
    const workflow = metaInsightsWorkflow as any;
    const result = workflow.parseMetrics(SAMPLE_META_RESPONSE);
    const expect = createExpect(result.revenue);

    expect.toBe(15742.14);
    expect.toBeDefined();

    // Verify NOT summed
    const buggySum = 15742.14 * 6; // All 6 purchase variants
    const expectNotSum = createExpect(result.revenue);
    expectNotSum.not.toBe(buggySum);
  });

  // Test 2: Revenue source tracked
  testCase("Revenue: audit trail shows canonical source is 'purchase'", () => {
    const workflow = metaInsightsWorkflow as any;
    const result = workflow.parseMetrics(SAMPLE_META_RESPONSE);
    const expect = createExpect(result.metricSources?.revenue_source);

    expect.toBe("purchase");
  });

  // Test 3: Purchase count
  testCase("Purchases: should pick canonical (10, not 50)", () => {
    const workflow = metaInsightsWorkflow as any;
    const result = workflow.parseMetrics(SAMPLE_META_RESPONSE);
    const expect = createExpect(result.purchases);

    expect.toBe(10);
  });

  // Test 4: Landing page views
  testCase("Landing Page Views: restricted to landing_page_view (1026), not view_content", () => {
    const workflow = metaInsightsWorkflow as any;
    const result = workflow.parseMetrics(SAMPLE_META_RESPONSE);
    const expect = createExpect(result.landing_page_views);

    expect.toBe(1026);

    const expectNotInflated = createExpect(result.landing_page_views);
    expectNotInflated.not.toBe(7370344.98); // NOT view_content
  });

  // Test 5: Complete row
  testCase("Complete row: all metrics match canonical sources with audit trail", () => {
    const workflow = metaInsightsWorkflow as any;
    const result = workflow.parseMetrics(SAMPLE_META_RESPONSE);

    const expect = createExpect(result);
    expect.toStrictEqual({
      date: "2025-12-14",
      spend: 13899.48,
      reach: 20926,
      impressions: 32479,
      clicks: 1293,
      landing_page_views: 1026,
      add_to_cart: 108,
      initiate_checkout: 33,
      purchases: 10,
      revenue: 15742.14,
      metricSources: {
        landing_page_views_source: "landing_page_view",
        add_to_cart_source: "add_to_cart",
        initiate_checkout_source: "initiate_checkout",
        purchases_source: "purchase",
        revenue_source: "purchase",
      },
    });
  });

  console.log("\n✅ Test suite completed\n");
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMetaDeterministicTests();
}
