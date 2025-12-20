/**
 * Sheet Selector Component - Select Google Spreadsheet and Sheet
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Sheet, FileSpreadsheet } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useServices } from '@/hooks/useServices';
import type { Spreadsheet, Sheet as SheetType } from '@/types/api';

interface SheetSelectorProps {
  credentialId: string;
  onSelect: (spreadsheetId: string, sheetName: string, spreadsheetName: string) => void;
  isLoading?: boolean;
}

export function SheetSelector({ credentialId, onSelect, isLoading: externalLoading }: SheetSelectorProps) {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [sheets, setSheets] = useState<SheetType[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState('');
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getSpreadsheets, getSheets } = useServices();

  // Load spreadsheets on mount
  useEffect(() => {
    const loadSpreadsheets = async () => {
      setLoadingSpreadsheets(true);
      setError(null);
      try {
        const data = await getSpreadsheets(credentialId);
        setSpreadsheets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load spreadsheets');
      } finally {
        setLoadingSpreadsheets(false);
      }
    };

    loadSpreadsheets();
  }, [credentialId, getSpreadsheets]);

  // Load sheets when spreadsheet is selected
  useEffect(() => {
    if (!selectedSpreadsheetId) {
      setSheets([]);
      setSelectedSheetName('');
      return;
    }

    const loadSheets = async () => {
      setLoadingSheets(true);
      setError(null);
      try {
        const data = await getSheets(credentialId, selectedSpreadsheetId);
        setSheets(data);
        // Auto-select first sheet
        if (data.length > 0) {
          setSelectedSheetName(data[0].name);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sheets');
      } finally {
        setLoadingSheets(false);
      }
    };

    loadSheets();
  }, [selectedSpreadsheetId, credentialId, getSheets]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!selectedSpreadsheetId || !selectedSheetName) {
        setError('Please select both a spreadsheet and a sheet');
        return;
      }

      const spreadsheet = spreadsheets.find(s => s.id === selectedSpreadsheetId);
      const spreadsheetName = spreadsheet?.name || selectedSpreadsheetId;

      onSelect(selectedSpreadsheetId, selectedSheetName, spreadsheetName);
    },
    [selectedSpreadsheetId, selectedSheetName, spreadsheets, onSelect]
  );

  const isLoading = externalLoading || loadingSpreadsheets || loadingSheets;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="spreadsheet">Select Spreadsheet</Label>
        {loadingSpreadsheets ? (
          <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-md">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-gray-600">Loading spreadsheets...</span>
          </div>
        ) : (
          <select
            id="spreadsheet"
            value={selectedSpreadsheetId}
            onChange={(e) => setSelectedSpreadsheetId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="">-- Select a spreadsheet --</option>
            {spreadsheets.map((spreadsheet) => (
              <option key={spreadsheet.id} value={spreadsheet.id}>
                {spreadsheet.name}
              </option>
            ))}
          </select>
        )}
        {spreadsheets.length === 0 && !loadingSpreadsheets && (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            No spreadsheets found. Make sure your credential has access to Google Sheets.
          </p>
        )}
      </div>

      {selectedSpreadsheetId && (
        <div className="space-y-2">
          <Label htmlFor="sheet">Select Sheet</Label>
          {loadingSheets ? (
            <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-gray-600">Loading sheets...</span>
            </div>
          ) : (
            <select
              id="sheet"
              value={selectedSheetName}
              onChange={(e) => setSelectedSheetName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="">-- Select a sheet --</option>
              {sheets.map((sheet) => (
                <option key={sheet.name} value={sheet.name}>
                  {sheet.name} ({sheet.rowCount} rows × {sheet.columnCount} cols)
                </option>
              ))}
            </select>
          )}
          {sheets.length === 0 && !loadingSheets && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Sheet className="w-4 h-4" />
              No sheets found in this spreadsheet.
            </p>
          )}
        </div>
      )}

      {selectedSpreadsheetId && selectedSheetName && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm font-medium text-blue-900">Selected:</div>
          <div className="text-sm text-blue-700 mt-1">
            {spreadsheets.find(s => s.id === selectedSpreadsheetId)?.name} → {selectedSheetName}
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading || !selectedSpreadsheetId || !selectedSheetName}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          'Save Selection'
        )}
      </Button>
    </form>
  );
}
