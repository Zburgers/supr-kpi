/**
 * Custom hook for managing schedules and automation
 * 
 * Uses centralized fetchApi for authentication (Clerk JWT)
 */

import { useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import type { Schedule, ScheduleUpdateRequest } from '@/types/api';

export function useSchedules() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSchedules = useCallback(async (): Promise<Schedule[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Schedule[]>('/schedules');
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch schedules');
      }
      return (result as { success: true; data: Schedule[] }).data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch schedules';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSchedule = useCallback(
    async (service: string, request: ScheduleUpdateRequest): Promise<Schedule> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchApi<Schedule>(`/schedules/${service}`, {
          method: 'PUT',
          body: JSON.stringify(request),
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to update schedule');
        }
        const data = (result as { success: true; data: Schedule }).data;
        if (!data) {
          throw new Error('No schedule data returned');
        }
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update schedule';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const runNow = useCallback(async (service: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<void>(`/schedules/${service}/run`, {
        method: 'POST',
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to trigger run');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger run';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getSchedules,
    updateSchedule,
    runNow,
  };
}
