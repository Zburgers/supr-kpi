/**
 * Settings Page - Dashboard for managing account, credentials, sheets, and automation
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  User,
  Key,
  FileSpreadsheet,
  Clock,
  Activity,
  Trash2,
  Plus,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  Loader2,
  Edit,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { navigate } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CredentialEditForm } from '@/components/settings/credential-edit-form';
import { CredentialAddDialog } from '@/components/settings/credential-add-dialog';
import { ScheduleConfig } from '@/components/settings/schedule-config';
import { ActivityLog } from '@/components/settings/activity-log';
import { SheetSelector } from '@/components/onboarding/sheet-selector';
import { useCredentials } from '@/hooks/useCredentials';
import { useSheetMappings } from '@/hooks/useSheetMappings';
import { useSchedules } from '@/hooks/useSchedules';
import type { Credential, SheetMapping, Schedule, ServiceType } from '@/types/api';

type SheetEditTarget = ServiceType | 'master_spreadsheet';

const SERVICE_LABELS: Record<ServiceType, string> = {
  google_sheets: 'Google Sheets',
  meta: 'Meta',
  ga4: 'Google Analytics 4',
  shopify: 'Shopify',
};

const SERVICE_COLORS: Record<ServiceType, { bg: string; border: string; text: string }> = {
  google_sheets: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600',
  },
  meta: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600',
  },
  ga4: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-600',
  },
  shopify: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600',
  },
};

export function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [sheetMappings, setSheetMappings] = useState<SheetMapping[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<{ credentials?: string; sheetMappings?: string; schedules?: string }>({});
  const [editingCredential, setEditingCredential] = useState<string | null>(null);
  const [addingCredential, setAddingCredential] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editingSheet, setEditingSheet] = useState<SheetEditTarget | null>(null);

  const {
    getCredentials,
    verifyCredential,
    deleteCredential: deleteCredentialApi,
  } = useCredentials();
  const { getSheetMappings, saveSheetMapping } = useSheetMappings();
  const { getSchedules } = useSchedules();

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadErrors({});
    try {
      console.log('[Settings] Loading credentials, sheet mappings, and schedules...');
      const [credsResult, sheetsResult, schedsResult] = await Promise.allSettled([
        getCredentials(),
        getSheetMappings(),
        getSchedules(),
      ]);

      if (credsResult.status === 'fulfilled') {
        setCredentials(credsResult.value);
      } else {
        console.error('[Settings] Failed to load credentials:', credsResult.reason);
        setCredentials([]);
        setLoadErrors((prev) => ({
          ...prev,
          credentials: credsResult.reason instanceof Error ? credsResult.reason.message : 'Failed to load credentials',
        }));
      }

      if (sheetsResult.status === 'fulfilled') {
        setSheetMappings(sheetsResult.value);
      } else {
        console.error('[Settings] Failed to load sheet mappings:', sheetsResult.reason);
        setSheetMappings([]);
        setLoadErrors((prev) => ({
          ...prev,
          sheetMappings: sheetsResult.reason instanceof Error ? sheetsResult.reason.message : 'Failed to load sheet mappings',
        }));
      }

      if (schedsResult.status === 'fulfilled') {
        setSchedules(schedsResult.value);
      } else {
        console.error('[Settings] Failed to load schedules:', schedsResult.reason);
        setSchedules([]);
        setLoadErrors((prev) => ({
          ...prev,
          schedules: schedsResult.reason instanceof Error ? schedsResult.reason.message : 'Failed to load schedules',
        }));
      }

      console.log('[Settings] Loaded:', {
        credentialsCount: credsResult.status === 'fulfilled' ? credsResult.value.length : 0,
        sheetsCount: sheetsResult.status === 'fulfilled' ? sheetsResult.value.length : 0,
        schedulesCount: schedsResult.status === 'fulfilled' ? schedsResult.value.length : 0,
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [getCredentials, getSheetMappings, getSchedules]);

  const handleCredentialAdded = useCallback(() => {
    console.log('[Settings] Credential added, refreshing data...');
    setAddingCredential(false);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

// TODO: Add Toast or notification for better UX

  const handleVerifyCredential = useCallback(
    async (credentialId: string) => {
      try {
        await verifyCredential(credentialId);
        // On success, still reload to show the updated status
      } catch (err) {
        console.error('Credential verification failed:', err);
        // Show user-friendly message about verification failure
        const errorMessage = err instanceof Error ? err.message : 'Verification failed';
        alert(`Verification failed: ${errorMessage}\n\nPlease check your token - if it's temporary, generate a new one. If it's permanent, verify it's correct. Consider removing and re-adding the token if issues persist.`);
      } finally {
        // Always reload data to reflect the current verification status
        await loadData();
      }
    },
    [verifyCredential, loadData]
  );

  const handleDeleteCredential = useCallback(
    async (credentialId: string) => {
      if (!confirm('Are you sure you want to delete this credential?')) return;

      try {
        await deleteCredentialApi(credentialId);
        await loadData();
      } catch (err) {
        console.error('Failed to delete credential:', err);
      }
    },
    [deleteCredentialApi, loadData]
  );

  const handleSaveSheet = useCallback(
    async (spreadsheetId: string, sheetName: string, _spreadsheetName: string) => {
      if (!editingSheet) return;

      const googleSheetsCredentialId = credentials.find((c) => c.service === 'google_sheets' && c.verified)?.id;
      if (!googleSheetsCredentialId) return;

      const masterSheetName = '__MASTER__';

      try {
        if (editingSheet === 'master_spreadsheet') {
          await saveSheetMapping({
            service: 'google_sheets',
            credential_id: googleSheetsCredentialId,
            spreadsheet_id: spreadsheetId,
            sheet_name: masterSheetName,
          });
          setEditingSheet(null);
          await loadData();
          return;
        }

        // Per-service destination sheet (inside the master spreadsheet)
        await saveSheetMapping({
          service: editingSheet,
          credential_id: googleSheetsCredentialId,
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
        });
        setEditingSheet(null);
        await loadData();
      } catch (err) {
        console.error('Failed to save sheet mapping:', err);
      }
    },
    [editingSheet, credentials, saveSheetMapping, loadData]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => {
                // Navigate back to the dashboard or previous page
                navigate('/');
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          </div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="w-8 h-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your account, credentials, and automation settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="account">
              <User className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="w-4 h-4 mr-2" />
              Credentials
            </TabsTrigger>
            <TabsTrigger value="sheets">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Sheet Mappings
            </TabsTrigger>
            <TabsTrigger value="automation">
              <Clock className="w-4 h-4 mr-2" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="w-4 h-4 mr-2" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <AccountSection />
          </TabsContent>

          <TabsContent value="credentials">
            <CredentialsSection
              credentials={credentials}
              onVerify={handleVerifyCredential}
              onEdit={setEditingCredential}
              onDelete={handleDeleteCredential}
              onAdd={() => setAddingCredential(true)}
            />
            {loadErrors.credentials && (
              <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded">
                {loadErrors.credentials}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sheets">
            <SheetMappingsSection
              mappings={sheetMappings}
              credentials={credentials}
              onEdit={setEditingSheet}
            />
            {loadErrors.sheetMappings && (
              <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded">
                {loadErrors.sheetMappings}
              </div>
            )}
          </TabsContent>

          <TabsContent value="automation">
            <AutomationSection
              schedules={schedules}
              sheetMappings={sheetMappings}
              onEdit={setEditingSchedule}
            />
            {loadErrors.schedules && (
              <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded">
                {loadErrors.schedules}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <ActivityLog autoRefresh={activeTab === 'activity'} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Credential Dialog */}
      <Dialog open={!!editingCredential} onOpenChange={() => setEditingCredential(null)}>
        <DialogContent className="max-w-2xl">
          {editingCredential && (
            <CredentialEditForm
              credentialId={editingCredential}
              service={credentials.find((c) => c.id === editingCredential)?.service || ''}
              onSave={() => {
                setEditingCredential(null);
                loadData();
              }}
              onCancel={() => setEditingCredential(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={() => setEditingSchedule(null)}>
        <DialogContent className="max-w-2xl">
          {editingSchedule && (
            <ScheduleConfig
              service={editingSchedule}
              currentCron={schedules.find((s) => s.service === editingSchedule)?.cron || '0 2 * * *'}
              enabled={schedules.find((s) => s.service === editingSchedule)?.enabled || false}
              timezone={schedules.find((s) => s.service === editingSchedule)?.timezone || 'Asia/Kolkata'}
              onSave={() => {
                setEditingSchedule(null);
                loadData();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sheet Dialog */}
      <Dialog open={!!editingSheet} onOpenChange={() => setEditingSheet(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSheet === 'master_spreadsheet'
                ? 'Select Master Spreadsheet'
                : `Select Destination Sheet for ${editingSheet ? SERVICE_LABELS[editingSheet] : ''}`}
            </DialogTitle>
            <DialogDescription>
              {editingSheet === 'master_spreadsheet'
                ? 'Choose the master Google Spreadsheet where all service tabs live'
                : 'Choose the sheet tab (e.g., RawMeta, RawGA, RawShopify) inside the master spreadsheet'}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            if (!editingSheet) return null;

            const googleSheetsCredentialId = credentials.find((c) => c.service === 'google_sheets' && c.verified)?.id || '';
            const masterMapping = sheetMappings.find((m) => m.service === 'google_sheets' && m.sheet_name === '__MASTER__') ||
              sheetMappings.find((m) => m.service === 'google_sheets') ||
              sheetMappings[0];
            const masterSpreadsheetId = masterMapping?.spreadsheet_id || '';
            const masterSpreadsheetName = masterMapping?.spreadsheet_name || masterSpreadsheetId;

            if (!googleSheetsCredentialId) {
              return (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-600">
                  Add and verify a Google Sheets credential first.
                </div>
              );
            }

            if (editingSheet === 'master_spreadsheet') {
              return (
                <SheetSelector
                  credentialId={googleSheetsCredentialId}
                  mode="spreadsheet_only"
                  onSelect={handleSaveSheet}
                />
              );
            }

            if (!masterSpreadsheetId) {
              return (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-600">
                  Select a master spreadsheet first.
                </div>
              );
            }

            return (
              <SheetSelector
                credentialId={googleSheetsCredentialId}
                mode="sheet_only"
                fixedSpreadsheetId={masterSpreadsheetId}
                fixedSpreadsheetName={masterSpreadsheetName}
                onSelect={handleSaveSheet}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Credential Dialog */}
      <CredentialAddDialog
        open={addingCredential}
        onOpenChange={setAddingCredential}
        onSuccess={handleCredentialAdded}
      />
    </div>
  );
}

// Account Section Component
function AccountSection() {
  const { user, isLoaded } = useUser();
  const { openUserProfile, signOut } = useClerk();

  const handleManageAccount = () => {
    openUserProfile();
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // Open Clerk user profile to the delete account section
      openUserProfile();
    }
  };

  if (!isLoaded) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Account Information</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Display Name</label>
            <div className="mt-1 text-foreground">
              {user?.fullName || user?.firstName || user?.username || 'Not set'}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Username</label>
            <div className="mt-1 text-foreground">
              {user?.username || 'Not set'}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <div className="mt-1 text-foreground">
              {user?.primaryEmailAddress?.emailAddress || 'Not set'}
            </div>
          </div>
          {user?.createdAt && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Member Since</label>
              <div className="mt-1 text-foreground">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-border space-y-3">
        <Button variant="outline" className="w-full" onClick={handleManageAccount}>
          <User className="w-4 h-4 mr-2" />
          Manage Account (Clerk)
        </Button>
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
        <Button variant="destructive" className="w-full" onClick={handleDeleteAccount}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </div>

      <div className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded-md">
        <strong>Note:</strong> Account management is handled through Clerk. Changes made there will
        be reflected here.
      </div>
    </div>
  );
}

// Credentials Section Component
interface CredentialsSectionProps {
  credentials: Credential[];
  onVerify: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

function CredentialsSection({ credentials, onVerify, onEdit, onDelete, onAdd }: CredentialsSectionProps) {
  console.log('[CredentialsSection] Rendering with credentials:', credentials);
  console.log('[CredentialsSection] Credentials length:', credentials.length);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Saved Credentials</h2>
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </Button>
      </div>

      {credentials.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
          No credentials saved yet
        </div>
      ) : (
        <div className="grid gap-4">
          {credentials.map((credential) => {
            const serviceColor = SERVICE_COLORS[credential.service];
            return (
              <div
                key={credential.id}
                className={`bg-card rounded-lg border p-6 ${serviceColor.border}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    {/* Service Badge */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${serviceColor.bg} ${serviceColor.border} border mb-3`}>
                      <span className={`text-sm font-medium ${serviceColor.text}`}>
                        {SERVICE_LABELS[credential.service]}
                      </span>
                    </div>
                    
                    {/* Credential Name */}
                    <h3 className="text-lg font-semibold text-foreground">{credential.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize mt-1">
                      {credential.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  
                  {/* Verification Status */}
                  {credential.verified ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <XCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Not Verified</span>
                    </div>
                  )}
                </div>

              {credential.verified_at && (
                <div className="text-sm text-muted-foreground mb-4">
                  Last verified: {new Date(credential.verified_at).toLocaleString()}
                </div>
              )}

                {credential.metadata?.email && (
                  <div className="text-sm text-muted-foreground mb-4">
                    Account: {credential.metadata.email}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVerify(credential.id)}
                  >
                    Test Connection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(credential.id)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Update
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(credential.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sheet Mappings Section Component
interface SheetMappingsSectionProps {
  mappings: SheetMapping[];
  credentials: Credential[];
  onEdit: (target: SheetEditTarget) => void;
}

function SheetMappingsSection({ mappings, credentials, onEdit }: SheetMappingsSectionProps) {
  const services: ServiceType[] = ['meta', 'ga4', 'shopify'];

  const masterMapping =
    mappings.find((m) => m.service === 'google_sheets' && m.sheet_name === '__MASTER__') ||
    mappings.find((m) => m.service === 'google_sheets') ||
    mappings[0];

  const masterSpreadsheetId = masterMapping?.spreadsheet_id || '';
  const masterSpreadsheetName = masterMapping?.spreadsheet_name || masterSpreadsheetId;
  const hasMasterSpreadsheet = !!masterSpreadsheetId;

  const hasGoogleSheetsCredential = credentials.some((c) => c.service === 'google_sheets' && c.verified);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Sheet Mappings</h2>
      <p className="text-muted-foreground">
        Select your master spreadsheet, then assign a destination sheet for each service
      </p>

      <div className="grid gap-4">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Master Spreadsheet</h3>
              {hasMasterSpreadsheet ? (
                <div className="mt-2 space-y-1">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Spreadsheet:</span> {masterSpreadsheetName || masterSpreadsheetId}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">No master spreadsheet configured</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit('master_spreadsheet')}
              disabled={!hasGoogleSheetsCredential}
            >
              {hasMasterSpreadsheet ? 'Change' : 'Configure'}
            </Button>
          </div>
          {!hasGoogleSheetsCredential && (
            <div className="mt-3 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
              Configure Google Sheets credentials first
            </div>
          )}
        </div>

        {services.map((service) => {
          const mapping = mappings.find((m) => m.service === service);
          const hasCredential = credentials.some((c) => c.service === service && c.verified);
          const canConfigure = hasGoogleSheetsCredential && hasMasterSpreadsheet && hasCredential;

          return (
            <div key={service} className="bg-card rounded-lg border border-border p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{SERVICE_LABELS[service]}</h3>
                  {mapping ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Destination Sheet:</span> {mapping.sheet_name}
                      </div>
                      <div className="text-xs text-muted-foreground/70 mt-2">
                        Last updated: {new Date(mapping.updated_at).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">No destination sheet configured</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(service)}
                  disabled={!canConfigure}
                >
                  {mapping ? 'Change' : 'Configure'}
                </Button>
              </div>

              {!hasGoogleSheetsCredential && (
                <div className="mt-3 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                  Configure Google Sheets credentials first
                </div>
              )}
              {hasGoogleSheetsCredential && !hasMasterSpreadsheet && (
                <div className="mt-3 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                  Select the master spreadsheet first
                </div>
              )}
              {hasGoogleSheetsCredential && hasMasterSpreadsheet && !hasCredential && (
                <div className="mt-3 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                  Configure {SERVICE_LABELS[service]} credentials first
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Automation Section Component
interface AutomationSectionProps {
  schedules: Schedule[];
  sheetMappings: SheetMapping[];
  onEdit: (service: string) => void;
}

function AutomationSection({ schedules, sheetMappings, onEdit }: AutomationSectionProps) {
  // Only show schedulable data services (meta, ga4, shopify)
  // google_sheets is only for sheet mappings, not for scheduling data syncs
  const schedulableServices: ServiceType[] = ['meta', 'ga4', 'shopify'];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Automation & Scheduling</h2>
      <p className="text-muted-foreground">
        Configure automated sync schedules for each data service
      </p>

      <div className="grid gap-4">
        {schedulableServices.map((service) => {
          const schedule = schedules.find((s) => s.service === service);
          const mapping = sheetMappings.find((m) => m.service === service);

          return (
            <div
              key={service}
              className="bg-card rounded-lg border border-border p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{SERVICE_LABELS[service]}</h3>
                  {schedule ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Schedule:</span> {schedule.cron}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Status:</span>{' '}
                        {schedule.enabled ? (
                          <span className="text-green-500">Enabled</span>
                        ) : (
                          <span className="text-muted-foreground">Disabled</span>
                        )}
                      </div>
                      {/* Show destination sheet info */}
                      {mapping ? (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Destination:</span> {mapping.sheet_name}
                        </div>
                      ) : (
                        <div className="text-sm text-amber-500">
                          <span className="font-medium">Warning:</span> No destination sheet configured
                        </div>
                      )}
                      {schedule.last_run_at && (
                        <div className="text-xs text-muted-foreground/70">
                          Last run: {new Date(schedule.last_run_at).toLocaleString()}
                        </div>
                      )}
                      {schedule.next_run_at && schedule.enabled && (
                        <div className="text-xs text-muted-foreground/70">
                          Next run: {new Date(schedule.next_run_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">No schedule configured</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => onEdit(service)}>
                  Configure
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
