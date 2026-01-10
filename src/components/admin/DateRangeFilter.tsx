'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CalendarIcon } from '@heroicons/react/24/outline';

interface DateRangeFilterProps {
  onDateChange: (dateFrom?: string, dateTo?: string) => void;
}

type PresetType = 'all' | '7d' | '30d' | '3m' | '6m' | 'custom';

export default function DateRangeFilter({ onDateChange }: DateRangeFilterProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const presets = [
    { value: 'all', label: '전체 기간' },
    { value: '7d', label: '최근 7일' },
    { value: '30d', label: '최근 30일' },
    { value: '3m', label: '최근 3개월' },
    { value: '6m', label: '최근 6개월' },
    { value: 'custom', label: '사용자 지정' }
  ];

  const handlePresetChange = (preset: PresetType) => {
    setSelectedPreset(preset);
    setShowCustomPicker(preset === 'custom');

    if (preset === 'all') {
      onDateChange(undefined, undefined);
      return;
    }

    if (preset === 'custom') {
      return; // Wait for custom date selection
    }

    const now = new Date();
    let dateFrom: Date;

    switch (preset) {
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6m':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      default:
        return;
    }

    onDateChange(dateFrom.toISOString(), now.toISOString());
  };

  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate) {
      onDateChange(customStartDate.toISOString(), customEndDate.toISOString());
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetChange(preset.value as PresetType)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPreset === preset.value
                ? 'bg-light-accent dark:bg-dark-accent text-white'
                : 'bg-white/30 dark:bg-gray-800/30 text-light-text dark:text-dark-text hover:bg-white/50 dark:hover:bg-gray-800/50'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {showCustomPicker && (
        <div className="flex items-center gap-3 p-4 bg-white/30 dark:bg-gray-900/30 rounded-lg border border-light-primary/20 dark:border-dark-primary/20">
          <CalendarIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
          <div className="flex items-center gap-2 flex-1">
            <DatePicker
              selected={customStartDate}
              onChange={(date) => setCustomStartDate(date)}
              selectsStart
              startDate={customStartDate}
              endDate={customEndDate}
              placeholderText="시작일"
              className="px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
            />
            <span className="text-light-text/60 dark:text-dark-text/60">~</span>
            <DatePicker
              selected={customEndDate}
              onChange={(date) => setCustomEndDate(date)}
              selectsEnd
              startDate={customStartDate}
              endDate={customEndDate}
              minDate={customStartDate}
              placeholderText="종료일"
              className="px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
            />
          </div>
          <button
            onClick={handleCustomDateChange}
            disabled={!customStartDate || !customEndDate}
            className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            적용
          </button>
        </div>
      )}
    </div>
  );
}
