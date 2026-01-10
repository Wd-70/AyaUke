import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export default function StatCard({
  label,
  value,
  subtitle,
  icon,
  trend,
  trendValue
}: StatCardProps) {
  return (
    <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20 transition-all hover:shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm text-light-text/60 dark:text-dark-text/60 font-medium mb-1">
            {label}
          </p>
          <p className="text-3xl font-bold text-light-text dark:text-dark-text">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-12 h-12 bg-light-accent/10 dark:bg-dark-accent/10 rounded-lg flex items-center justify-center text-light-accent dark:text-dark-accent">
            {icon}
          </div>
        )}
      </div>
      {trend && trendValue && (
        <div className={`flex items-center gap-1 text-sm ${
          trend === 'up' ? 'text-green-500' :
          trend === 'down' ? 'text-red-500' :
          'text-light-text/60 dark:text-dark-text/60'
        }`}>
          {trend === 'up' && <ArrowUpIcon className="w-4 h-4" />}
          {trend === 'down' && <ArrowDownIcon className="w-4 h-4" />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
