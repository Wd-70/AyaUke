import { motion } from 'framer-motion';

interface ProgressBarProps {
  percentage: number;
  isActive: boolean;
  className?: string;
}

export default function ProgressBar({ percentage, isActive, className = '' }: ProgressBarProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-light-text/60 dark:text-dark-text/60">
          Progress
        </span>
        <span className="text-sm font-bold text-light-accent dark:text-dark-accent">
          {percentage}%
        </span>
      </div>

      <div className="h-3 bg-light-primary/20 dark:bg-dark-secondary/20 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-light-accent to-light-primary dark:from-dark-accent dark:to-dark-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {isActive && percentage < 100 && (
            <motion.div
              className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
