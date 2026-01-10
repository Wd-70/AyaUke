'use client';

import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useConfirm } from '@/components/ConfirmDialog';
import { LoadingButton } from '@/components/admin/LoadingButton';

interface ManualResetButtonProps {
  disabled: boolean;
  onReset: () => Promise<void>;
  isLoading?: boolean;
}

export default function ManualResetButton({ disabled, onReset, isLoading = false }: ManualResetButtonProps) {
  const { confirm } = useConfirm();

  const handleClick = async () => {
    const confirmed = await confirm({
      title: '오프셋 초기화',
      message: '설정된 타임라인 오프셋을 초기화하시겠습니까? 변환된 댓글도 원래 시간으로 돌아갑니다.',
      confirmText: '초기화',
      cancelText: '취소',
      type: 'warning'
    });

    if (confirmed) {
      await onReset();
    }
  };

  return (
    <LoadingButton
      onClick={handleClick}
      disabled={disabled}
      isLoading={isLoading}
      variant="secondary"
      icon={<ArrowPathIcon className="w-4 h-4" />}
      className="text-sm"
    >
      오프셋 초기화
    </LoadingButton>
  );
}
