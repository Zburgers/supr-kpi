/**
 * Schedule Configuration Component - Manage automation schedules
 */

import { useState, useCallback, useEffect } from 'react';
import { Clock, Play, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSchedules } from '@/hooks/useSchedules';
import type { CronPreset } from '@/types/ui';

interface ScheduleConfigProps {
  service: string;
  currentCron: string;
  enabled: boolean;
  timezone: string;
  onSave: (cron: string, enabled: boolean, timezone: string) => void;
}

const CRON_PRESETS: CronPreset[] = [
  { label: 'Every Hour', value: '0 * * * *', description: 'At minute 0 of every hour' },
  { label: 'Every 6 Hours', value: '0 */6 * * *', description: 'At minute 0 of every 6th hour' },
  { label: 'Daily at 2 AM', value: '0 2 * * *', description: 'At 2:00 AM every day' },
  { label: 'Daily at 6 AM', value: '0 6 * * *', description: 'At 6:00 AM every day' },
  { label: 'Twice Daily', value: '0 2,14 * * *', description: 'At 2:00 AM and 2:00 PM' },
  { label: 'Weekly (Sunday)', value: '0 2 * * 0', description: 'At 2:00 AM every Sunday' },
  { label: 'Custom', value: 'custom', description: 'Enter custom cron expression' },
];

export function ScheduleConfig({ service, currentCron, enabled, timezone, onSave }: ScheduleConfigProps) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [cronExpression, setCronExpression] = useState(currentCron);
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [timezoneValue, setTimezoneValue] = useState(timezone || 'Asia/Kolkata'); // Default to IST
  const [nextRun, setNextRun] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updateSchedule, runNow } = useSchedules();

  useEffect(() => {
    // Find matching preset
    const preset = CRON_PRESETS.find(p => p.value === currentCron);
    setSelectedPreset(preset?.value || 'custom');
  }, [currentCron]);

  useEffect(() => {
    // Calculate next run time (simplified)
    if (isEnabled && cronExpression) {
      // This is a placeholder - in production, use a library like 'cron-parser'
      setNextRun('Next run: Calculating...');
    } else {
      setNextRun(null);
    }
  }, [isEnabled, cronExpression]);

  const handlePresetChange = useCallback((value: string) => {
    setSelectedPreset(value);
    if (value !== 'custom') {
      setCronExpression(value);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!cronExpression.trim()) {
      setError('Please provide a cron expression');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateSchedule(service, {
        cron: cronExpression,
        enabled: isEnabled,
        timezone: timezoneValue,
      });
      onSave(cronExpression, isEnabled, timezoneValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  }, [service, cronExpression, isEnabled, timezoneValue, updateSchedule, onSave]);

  const handleRunNow = useCallback(async () => {
    setRunning(true);
    setError(null);

    try {
      await runNow(service);
      // Show success feedback
      alert('Sync started successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger run');
    } finally {
      setRunning(false);
    }
  }, [service, runNow]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Schedule Configuration</h3>
          <p className="text-sm text-gray-600">Configure automated sync for {service}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="schedule-enabled">Enabled</Label>
          <Switch
            id="schedule-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            disabled={saving}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="preset">Schedule Preset</Label>
          <select
            id="preset"
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          >
            {CRON_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label} - {preset.description}
              </option>
            ))}
          </select>
        </div>

        {selectedPreset === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="cron">Cron Expression</Label>
            <input
              id="cron"
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="0 2 * * *"
              disabled={saving}
            />
            <p className="text-xs text-gray-500">
              Format: minute hour day month weekday (e.g., "0 2 * * *" for 2 AM daily)
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezoneValue}
            onChange={(e) => setTimezoneValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          </select>
        </div>

        {nextRun && isEnabled && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-blue-700">{nextRun}</span>
          </div>
        )}

        {!isEnabled && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
            Scheduled sync is disabled. Enable it to run automatically.
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !cronExpression.trim()}
          className="flex-1"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Schedule
            </>
          )}
        </Button>
        <Button
          onClick={handleRunNow}
          variant="outline"
          disabled={running}
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Now
            </>
          )}
        </Button>
      </div>

      <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-md">
        <strong>Note:</strong> Cron expressions execute in the selected timezone. The "Run Now" button triggers
        an immediate sync regardless of the schedule.
      </div>
    </div>
  );
}
