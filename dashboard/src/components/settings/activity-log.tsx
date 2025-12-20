/**
 * Activity Log Viewer - Display sync history and activity
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useActivityLog } from '@/hooks/useActivityLog';
import type { ActivityLogEntry, ServiceType } from '@/types/api';

interface ActivityLogProps {
  autoRefresh?: boolean;
}

export function ActivityLog({ autoRefresh = false }: ActivityLogProps) {
  const [serviceFilter, setServiceFilter] = useState<ServiceType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActivityLogEntry['status'] | 'all'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const { loading, error, entries, total, getActivityLog, downloadCsv } = useActivityLog(autoRefresh);

  useEffect(() => {
    const filters = {
      service: serviceFilter !== 'all' ? serviceFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      limit: 50,
    };
    getActivityLog(filters);
  }, [serviceFilter, statusFilter, getActivityLog]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDownload = useCallback(() => {
    downloadCsv(entries, `activity-log-${new Date().toISOString()}.csv`);
  }, [entries, downloadCsv]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusIcon = (status: ActivityLogEntry['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failure':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Activity Log</h3>
          <p className="text-sm text-gray-600">
            View sync history and activity ({total} total entries)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={entries.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-filter">Service</Label>
              <select
                id="service-filter"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Services</option>
                <option value="google_sheets">Google Sheets</option>
                <option value="meta">Meta</option>
                <option value="ga4">Google Analytics 4</option>
                <option value="shopify">Shopify</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          No activity logs found
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                        {entry.service.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(entry.status)}
                          <span className="capitalize">{entry.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entry.record_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDuration(entry.duration)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {entry.error_message && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRow(entry.id)}
                          >
                            {expandedRows.has(entry.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(entry.id) && entry.error_message && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-red-50">
                          <div className="text-sm">
                            <strong className="text-red-600">Error:</strong>
                            <pre className="mt-2 text-red-700 whitespace-pre-wrap font-mono text-xs">
                              {entry.error_message}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {autoRefresh && (
        <div className="text-xs text-gray-500 text-center">
          Auto-refreshing every 10 seconds
        </div>
      )}
    </div>
  );
}
