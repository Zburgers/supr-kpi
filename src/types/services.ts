/**
 * Common types for all services
 * 
 * This file contains shared type definitions used across all services
 * to ensure consistency and prevent conflicts.
 */

export interface AppendResult {
  success: boolean;
  error?: string;
  mode?: 'append' | 'update' | 'skip';
  rowNumber?: number;
  id?: string; // Using string for UUID
}

export interface ServiceAccountStatus {
  verified: boolean;
  email?: string | null;
  scopes?: string[];
  error?: string;
}