/**
 * SHEET NAME NORMALIZATION TESTS
 * Validates A1 quoting and escaping for sheet names.
 */

import { sheetsService } from "../services/sheets.js";

// Simple assertion utilities (to avoid adding a test framework)
const createExpect = (value: any) => ({
  toBe: (expected: any) => {
    if (value !== expected) {
      throw new Error(`Expected ${value} to be ${expected}`);
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

const normalize = (s: string) => (sheetsService as any).normalizeSheetName(s);
const a1 = (sheet: string, range: string) => (sheetsService as any).a1(sheet, range);

export function runSheetNameTests() {
  console.log("\n📋 SHEET NAME NORMALIZATION TESTS\n");

  testCase("meta_raw_daily stays quoted", () => {
    const range = a1("meta_raw_daily", "A1:Z");
    createExpect(range).toBe("'meta_raw_daily'!A1:Z");
  });

  testCase("Trailing quote is stripped", () => {
    const range = a1("meta_raw_daily'", "A1:Z");
    createExpect(range).toBe("'meta_raw_daily'!A1:Z");
  });

  testCase("Leading+trailing quotes are stripped", () => {
    const range = a1("'meta_raw_daily'", "A1:Z");
    createExpect(range).toBe("'meta_raw_daily'!A1:Z");
  });

  testCase("Internal quotes are escaped", () => {
    const normalized = normalize("Jenny's Sheet");
    createExpect(normalized).toBe("Jenny''s Sheet");
    const range = a1("Jenny's Sheet", "A1:Z");
    createExpect(range).toBe("'Jenny''s Sheet'!A1:Z");
  });
}
