/**
 * Shared TSOA Model Types
 * 
 * Common interfaces used across controllers
 * These are automatically converted to OpenAPI schemas
 */

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, any>;
}

// ============================================================================
// CREDENTIAL TYPES
// ============================================================================

export type ServiceType = 'google_sheets' | 'meta' | 'ga4' | 'shopify';

export interface SaveCredentialRequest {
  /** JSON string of credential data */
  credentialJson: string;
  /** Human-readable name for the credential */
  credentialName: string;
  /** Service type */
  service: ServiceType;
}

export interface SaveCredentialResponse {
  credentialId: string;
  service: string;
  name: string;
  type: string;
  verified: boolean;
  created_at: string;
}

export interface CredentialListItem {
  id: string;
  service: string;
  name: string;
  type: string;
  verified: boolean;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GetCredentialResponse {
  id: string;
  service: string;
  name: string;
  type: string;
  verified: boolean;
  verified_at?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  encrypted: false;
}

export interface UpdateCredentialRequest {
  credentialJson?: string;
  credentialName?: string;
}

export interface UpdateCredentialResponse {
  id: string;
  service: string;
  name: string;
  type: string;
  verified: boolean;
  updated_at: string;
}

export interface DeleteCredentialResponse {
  success: boolean;
  message: string;
}

export interface VerifyCredentialResponse {
  verified: boolean;
  message: string;
  connectedAs?: string;
  expiresAt?: string;
}

export interface VerifyStatusResponse {
  credentialId: string;
  verified: boolean;
  verified_at?: string;
  expires_at?: string;
  last_verified_at?: string;
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface EnableServiceRequest {
  credentialId: number;
}

export interface EnableServiceResponse {
  service: string;
  enabled: boolean;
  credentialId: number;
}

export interface DisableServiceResponse {
  service: string;
  enabled: boolean;
}

export interface ServiceItem {
  name: string;
  enabled: boolean;
  credential?: {
    id: number;
    name: string;
    verified: boolean;
  };
}

export interface ListServicesResponse {
  services: ServiceItem[];
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface UserStatusResponse {
  id: number;
  email: string;
  onboardingComplete: boolean;
}

export interface OnboardingResponse {
  onboardingComplete: boolean;
}

// ============================================================================
// HEALTH TYPES
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  redis: {
    connected: boolean;
    latencyMs?: number;
  };
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface SyncRequest {
  targetDate?: string;
  spreadsheetId?: string;
  sheetName?: string;
}

export interface SyncJobInfo {
  jobId: string | undefined;
  source: string;
  targetDate: string;
}

export interface SyncAllResponse {
  success: boolean;
  message: string;
  data: {
    jobs: SyncJobInfo[];
  };
}

export interface SyncResponse {
  success: boolean;
  message: string;
  data: SyncJobInfo;
}

export interface JobStatusData {
  status: string;
  progress: number;
  data?: any;
  result?: any;
  failedReason?: string;
}

export interface JobStatusResponse {
  success: boolean;
  data: JobStatusData;
}

// ============================================================================
// SCHEDULER TYPES
// ============================================================================

export interface SchedulerStatusData {
  isActive: boolean;
  schedule: string;
  timezone: string;
  nextRun?: string;
}

export interface SchedulerStatusResponse {
  success: boolean;
  data: SchedulerStatusData;
}

export interface SchedulerActionResponse {
  success: boolean;
  message: string;
  data?: {
    schedule: string;
    timezone: string;
  };
}

export interface NotificationTestResponse {
  success: boolean;
  data: {
    telegram: boolean;
    email: boolean;
  };
  message: string;
}

// ============================================================================
// API WRAPPER TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
