'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import ProgressBar from './ProgressBar';
import ProgressStats from './ProgressStats';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: {
    isActive: boolean;
    stage: string;
    currentVideo: number;
    totalVideos: number;
    processedVideos: number;
    currentVideoTitle: string;
    currentVideoThumbnail: string;
    totalComments: number;
    timelineComments: number;
    errors: Array<{ videoNo: number; videoTitle: string; error: string }>;
    estimatedTimeRemaining: number | null;
  };
  onCancel: () => void;
}

const STAGE_MESSAGES: Record<string, string> = {
  connecting: 'Connecting to server...',
  fetching_videos: 'Fetching channel videos...',
  videos_fetched: 'Videos fetched, starting processing...',
  processing_video: 'Processing video...',
  fetching_comments: 'Fetching comments...',
  complete: 'Sync completed successfully!',
  error: 'An error occurred during sync',
  cancelled: 'Sync was cancelled',
};

export default function SyncProgressModal({
  isOpen,
  onClose,
  progress,
  onCancel,
}: SyncProgressModalProps) {
  const percentage = progress.totalVideos > 0
    ? Math.round((progress.processedVideos / progress.totalVideos) * 100)
    : 0;

  const canClose = !progress.isActive || progress.stage === 'complete' || progress.stage === 'error';

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={canClose ? onClose : () => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all border border-light-primary/20 dark:border-dark-primary/20">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title
                    as="h3"
                    className="text-xl font-bold text-light-text dark:text-dark-text"
                  >
                    Channel Sync Progress
                  </Dialog.Title>
                  {canClose && (
                    <button
                      onClick={onClose}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent"
                      aria-label="Close"
                    >
                      <XMarkIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <ProgressBar
                  percentage={percentage}
                  isActive={progress.isActive}
                />

                {/* Stats */}
                <ProgressStats
                  current={progress.currentVideo}
                  total={progress.totalVideos}
                  totalComments={progress.totalComments}
                  timelineComments={progress.timelineComments}
                  estimatedTimeRemaining={progress.estimatedTimeRemaining}
                />

                {/* Current Video */}
                {progress.isActive && progress.currentVideoTitle && (
                  <div className="mt-6 p-4 bg-light-accent/5 dark:bg-dark-accent/5 rounded-lg border border-light-accent/10 dark:border-dark-accent/10">
                    <p className="text-sm font-medium text-light-text/60 dark:text-dark-text/60 mb-2">
                      {STAGE_MESSAGES[progress.stage] || 'Processing...'}
                    </p>
                    <div className="flex items-center gap-3">
                      {progress.currentVideoThumbnail && (
                        <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden">
                          <Image
                            src={progress.currentVideoThumbnail}
                            alt={progress.currentVideoTitle}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                          {progress.currentVideoTitle}
                        </p>
                        <p className="text-xs text-light-text/60 dark:text-dark-text/60">
                          Video {progress.currentVideo} of {progress.totalVideos}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {progress.errors.length > 0 && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg" role="alert">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                          {progress.errors.length} error(s) occurred:
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {progress.errors.map((err, idx) => (
                            <p key={idx} className="text-xs text-red-600/80 dark:text-red-400/80">
                              • {err.videoTitle}: {err.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {progress.stage === 'complete' && (
                  <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg" role="status">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Sync completed successfully!
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-3">
                  {progress.isActive && progress.stage !== 'complete' && (
                    <button
                      onClick={onCancel}
                      className="px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/20 transition-colors font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent"
                    >
                      Cancel
                    </button>
                  )}
                  {canClose && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent"
                    >
                      Close
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
