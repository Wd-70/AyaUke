'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AddSongModal from './AddSongModal';

interface AddSongButtonProps {
  onSongAdded: () => void;
}

export default function AddSongButton({ onSongAdded }: AddSongButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSongAdded = () => {
    onSongAdded();
    setIsModalOpen(false);
  };

  return (
    <>
      <motion.button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple
                   text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
      >
        <PlusIcon className="w-6 h-6" />
      </motion.button>

      <AddSongModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSongAdded={handleSongAdded}
      />
    </>
  );
}