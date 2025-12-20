/**
 * Settings Page - Dashboard for managing account, credentials, sheets, and automation
 */

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CredentialEditForm } from '@/components/settings/credential-edit-form';
import { ScheduleConfig } from '@/components/settings/schedule-config';
import { ActivityLog } from '@/components/settings/activity-log';
import { SheetSelector } from '@/components/onboarding/sheet-selector';
import { useCredentials } from '@/hooks/useCredentials';
import { useSheetMappings } from '@/hooks/useSheetMappings';
import { useSchedules } from '@/hooks/useSchedules';
import type { Credential, SheetMapping, Schedule, ServiceType } from '@/types/api';

const SERVICE_LABELS: Record<ServiceType, string> = {
  google_sheets: 'Google Sheets',
  meta: 'Meta',
  ga4: 'Google Analytics 4',
  shopify: 'Shopify',
};

export function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [sheetMappings, setSheetMappings] = useState<SheetMapping[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredential, setEditingCredential] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editingSheet, setEditingSheet] = useState<ServiceType | null>(null);

  const {
    getCredentials,
    verifyCredential,
    deleteCredential: deleteCredentialApi,
  } = useCredentials();
  const { getSheetMappings, saveSheetMapping } = useSheetMappings();
  const { getSchedules } = useSchedules();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [creds, sheets, scheds] = await Promise.all([
        getCredentials(),
        getSheetMappings(),
        getSchedules(),
      ]);
      setCredentials(creds);
      setSheetMappings(sheets);
      setSchedules(scheds);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [getCredentials, getSheetMappings, getSchedules]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerifyCredential = useCallback(
    async (credentialId: string) => {
      try {
        await verifyCredential(credentialId);
        await loadData();
      } catch (err) {
        console.error('Failed to verify credential:', err);
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
    async (spreadsheetId: string, sheetName: string) => {
      if (!editingSheet) return;

      const credential = credentials.find((c) => c.service === editingSheet);
      if (!credential) return;

      try {
        await saveSheetMapping({
          service: editingSheet,
          credential_id: credential.id,
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8" />
            Settings
          </h1>
          <p className="text-gray-600 mt-2">
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
            />
          </TabsContent>

          <TabsContent value="sheets">
            <SheetMappingsSection
              mappings={sheetMappings}
              credentials={credentials}
              onEdit={setEditingSheet}
            />
          </TabsContent>

          <TabsContent value="automation">
            <AutomationSection
              schedules={schedules}
              onEdit={setEditingSchedule}
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityLog autoRefresh />
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
            <DialogTitle>Select Sheet for {editingSheet && SERVICE_LABELS[editingSheet]}</DialogTitle>
            <DialogDescription>
              Choose which Google Sheet to use for storing data
            </DialogDescription>
          </DialogHeader>
          {editingSheet && (
            <SheetSelector
              credentialId={credentials.find((c) => c.service === editingSheet)?.id || ''}
              onSelect={handleSaveSheet}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Account Section Component
function AccountSection() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Display Name</label>
            <div className="mt-1 text-gray-900">John Doe</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <div className="mt-1 text-gray-900">john.doe@example.com</div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 space-y-3">
        <Button variant="outline" className="w-full">
          <User className="w-4 h-4 mr-2" />
          Manage Account (Clerk)
        </Button>
        <Button variant="outline" className="w-full">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
        <Button variant="destructive" className="w-full">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </div>

      <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-md">
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
}

function CredentialsSection({ credentials, onVerify, onEdit, onDelete }: CredentialsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Saved Credentials</h2>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </Button>
      </div>

      {credentials.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No credentials saved yet
        </div>
      ) : (
        <div className="grid gap-4">
          {credentials.map((credential) => (
            <div
              key={credential.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{credential.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">
                    {SERVICE_LABELS[credential.service]} · {credential.type.replace(/_/g, ' ')}
                  </p>
                </div>
                {credential.verified ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm">Not Verified</span>
                  </div>
                )}
              </div>

              {credential.verified_at && (
                <div className="text-sm text-gray-500 mb-4">
                  Last verified: {new Date(credential.verified_at).toLocaleString()}
                </div>
              )}

              {credential.metadata?.email && (
                <div className="text-sm text-gray-600 mb-4">
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
          ))}
        </div>
      )}
    </div>
  );
}

// Sheet Mappings Section Component
interface SheetMappingsSectionProps {
  mappings: SheetMapping[];
  credentials: Credential[];
  onEdit: (service: ServiceType) => void;
}

function SheetMappingsSection({ mappings, credentials, onEdit }: SheetMappingsSectionProps) {
  const services: ServiceType[] = ['google_sheets', 'meta', 'ga4', 'shopify'];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sheet Mappings</h2>
      <p className="text-gray-600">
        Configure which Google Sheets are used to store data from each service
      </p>

      <div className="grid gap-4">
        {services.map((service) => {
          const mapping = mappings.find((m) => m.service === service);
          const hasCredential = credentials.some((c) => c.service === service && c.verified);

          return (
            <div
              key={service}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{SERVICE_LABELS[service]}</h3>
                  {mapping ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Spreadsheet:</span> {mapping.spreadsheet_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Sheet:</span> {mapping.sheet_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Last updated: {new Date(mapping.updated_at).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">No sheet configured</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(service)}
                  disabled={!hasCredential}
                >
                  {mapping ? 'Change' : 'Configure'}
                </Button>
              </div>
              {!hasCredential && (
                <div className="mt-3 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  Configure credentials first
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
  onEdit: (service: string) => void;
}

function AutomationSection({ schedules, onEdit }: AutomationSectionProps) {
  const services: ServiceType[] = ['google_sheets', 'meta', 'ga4', 'shopify'];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Automation & Scheduling</h2>
      <p className="text-gray-600">
        Configure automated sync schedules for each service
      </p>

      <div className="grid gap-4">
        {services.map((service) => {
          const schedule = schedules.find((s) => s.service === service);

          return (
            <div
              key={service}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{SERVICE_LABELS[service]}</h3>
                  {schedule ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Schedule:</span> {schedule.cron}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Status:</span>{' '}
                        {schedule.enabled ? (
                          <span className="text-green-600">Enabled</span>
                        ) : (
                          <span className="text-gray-500">Disabled</span>
                        )}
                      </div>
                      {schedule.last_run_at && (
                        <div className="text-xs text-gray-500">
                          Last run: {new Date(schedule.last_run_at).toLocaleString()}
                        </div>
                      )}
                      {schedule.next_run_at && schedule.enabled && (
                        <div className="text-xs text-gray-500">
                          Next run: {new Date(schedule.next_run_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">No schedule configured</p>
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
