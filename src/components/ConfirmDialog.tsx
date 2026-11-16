'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { DialogTitle } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Sheet from '@/shared/motion/Sheet';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

interface ConfirmProviderProps {
  children: React.ReactNode;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '확인',
    cancelText: '취소',
    type: 'warning'
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        ...options,
        confirmText: options.confirmText || '확인',
        cancelText: options.cancelText || '취소',
        type: options.type || 'warning',
        isOpen: true,
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(true);
    }
    setConfirmState(prev => ({ ...prev, isOpen: false, resolve: undefined }));
  }, [confirmState.resolve]);

  const handleCancel = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(false);
    }
    setConfirmState(prev => ({ ...prev, isOpen: false, resolve: undefined }));
  }, [confirmState.resolve]);

  const getColors = (type: string) => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-500',
          confirmButton: 'bg-red-500 hover:bg-red-600 text-white',
          cancelButton: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
        };
      case 'warning':
        return {
          icon: 'text-yellow-500',
          confirmButton: 'bg-yellow-500 hover:bg-yellow-600 text-white',
          cancelButton: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
        };
      case 'info':
        return {
          icon: 'text-blue-500',
          confirmButton: 'bg-blue-500 hover:bg-blue-600 text-white',
          cancelButton: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
        };
      default:
        return {
          icon: 'text-yellow-500',
          confirmButton: 'bg-yellow-500 hover:bg-yellow-600 text-white',
          cancelButton: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
        };
    }
  };

  const colors = getColors(confirmState.type || 'warning');

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {/* 공용 시트: 모바일은 아래에서, 데스크톱은 가운데. 곡 상세(z-80) 등 다른 오버레이 위에 뜬다. */}
      <Sheet open={confirmState.isOpen} onClose={handleCancel} size="md" layer="z-[160]">
        <div className="flex items-start gap-3 px-6 pb-2 pt-2 sm:pt-6">
          <ExclamationTriangleIcon className={`mt-0.5 h-6 w-6 shrink-0 ${colors.icon}`} aria-hidden />
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {confirmState.title}
            </DialogTitle>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-600 dark:text-gray-300">
              {confirmState.message}
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 font-medium transition-[background-color,transform] duration-200 active:scale-[0.98] ${colors.cancelButton}`}
          >
            {confirmState.cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.98] ${colors.confirmButton}`}
          >
            {confirmState.confirmText}
          </button>
        </div>
      </Sheet>
    </ConfirmContext.Provider>
  );
};