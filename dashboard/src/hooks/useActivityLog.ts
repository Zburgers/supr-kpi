/**
 * Custom hook for managing activity logs
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActivityLogEntry, ActivityLogFilters, ActivityLogResponse, ApiResponse } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const POLLING_INTERVAL = 10000; // 10 seconds

export function useActivityLog(autoRefresh = false) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const getActivityLog = useCallback(
    async (filters?: ActivityLogFilters): Promise<ActivityLogResponse> => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.service) params.append('service', filters.service);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.startDate) params.append('start_date', filters.startDate);
        if (filters?.endDate) params.append('end_date', filters.endDate);
        if (filters?.limit) params.append('limit', filters.limit.toString());
        if (filters?.offset) params.append('offset', filters.offset.toString());

        const response = await fetch(`${API_BASE_URL}/activity-log?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch activity log: ${response.statusText}`);
        }

        const data: ApiResponse<ActivityLogResponse> = await response.json();
        const result = data.data || { entries: [], total: 0, limit: 50, offset: 0 };
        
        setEntries(result.entries);
        setTotal(result.total);
        
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch activity log';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const exportToCsv = useCallback((entries: ActivityLogEntry[]): string => {
    const headers = ['Timestamp', 'Service', 'Status', 'Records', 'Duration (s)', 'Error'];
    const rows = entries.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.service,
      entry.status,
      entry.record_count.toString(),
      entry.duration.toString(),
      entry.error_message || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }, []);

  const downloadCsv = useCallback((entries: ActivityLogEntry[], filename = 'activity-log.csv') => {
    const csv = exportToCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [exportToCsv]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        getActivityLog();
      }, POLLING_INTERVAL);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, getActivityLog]);

  return {
    loading,
    error,
    entries,
    total,
    getActivityLog,
    downloadCsv,
  };
}
