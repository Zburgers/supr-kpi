/**
 * API Type Definitions for KPI ETL Platform
 */

export type ServiceType = 'google_sheets' | 'meta' | 'ga4' | 'shopify';

export type CredentialType = 'service_account' | 'oauth_token' | 'api_key';

export interface Credential {
  id: string;
  service: ServiceType;
  name: string;
  type: CredentialType;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  // Never includes actual credential data
  metadata?: {
    email?: string;
    account_name?: string;
  };
}

export interface CredentialCreateRequest {
  service: ServiceType;
  name: string;
  type: CredentialType;
  credentials: string; // JSON string or token
}

export interface CredentialVerificationResponse {
  success: boolean;
  verified: boolean;
  metadata?: {
    email?: string;
    account_name?: string;
    error?: string;
  };
}

export interface ServiceConfig {
  service: ServiceType;
  enabled: boolean;
  credential: Credential | null;
  configured: boolean;
}

export interface SheetMapping {
  id: string;
  service: ServiceType;
  spreadsheet_id: string;
  spreadsheet_name: string;
  sheet_name: string;
  created_at: string;
  updated_at: string;
}

export interface SheetMappingRequest {
  service: ServiceType;
  credential_id: string;
  spreadsheet_id: string;
  sheet_name: string;
}

export interface Spreadsheet {
  id: string;
  name: string;
  url: string;
}

export interface Sheet {
  name: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface Schedule {
  id: string;
  service: ServiceType;
  cron: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleUpdateRequest {
  cron: string;
  enabled: boolean;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  service: ServiceType;
  status: 'success' | 'failure' | 'pending' | 'running';
  record_count: number;
  duration: number; // seconds
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface ActivityLogFilters {
  service?: ServiceType;
  status?: ActivityLogEntry['status'];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityLogResponse {
  entries: ActivityLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
