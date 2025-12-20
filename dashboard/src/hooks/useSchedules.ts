/**
 * Custom hook for managing schedules and automation
 */

import { useState, useCallback } from 'react';
import type { Schedule, ScheduleUpdateRequest, ApiResponse } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function useSchedules() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSchedules = useCallback(async (): Promise<Schedule[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/schedules`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch schedules: ${response.statusText}`);
      }

      const data: ApiResponse<Schedule[]> = await response.json();
      return data.data || [];
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
        const response = await fetch(`${API_BASE_URL}/schedules/${service}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to update schedule');
        }

        const data: ApiResponse<Schedule> = await response.json();
        if (!data.data) {
          throw new Error('No schedule data returned');
        }
        return data.data;
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
      const response = await fetch(`${API_BASE_URL}/schedules/${service}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to trigger run');
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
