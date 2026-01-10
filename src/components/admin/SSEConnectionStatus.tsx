'use client';

import { motion } from 'framer-motion';
import { SignalIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface SSEConnectionStatusProps {
  status: 'connecting' | 'connected' | 'error' | 'disconnected';
  message?: string;
}

export function SSEConnectionStatus({ status, message }: SSEConnectionStatusProps) {
  const statusConfig = {
    connecting: {
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      icon: SignalIcon,
      text: '연결 중...'
    },
    connected: {
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      icon: SignalIcon,
      text: '연결됨'
    },
    error: {
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      icon: ExclamationTriangleIcon,
      text: '연결 오류'
    },
    disconnected: {
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      icon: ExclamationTriangleIcon,
      text: '연결 끊김'
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg} border ${config.border}`}
    >
      <Icon className={`w-4 h-4 ${config.color}`} />
      <span className={`text-sm font-medium ${config.color}`}>
        {message || config.text}
      </span>
    </motion.div>
  );
}
