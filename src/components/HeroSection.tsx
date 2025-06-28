'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
// import LiveIndicator from './LiveIndicator';
import { PlayIcon } from '@heroicons/react/24/solid';

export default function HeroSection() {
  const socialLinks = [
    {
      name: 'Chzzk',
      url: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc',
      icon: '🎮',
      color: 'from-green-400 to-green-600'
    },
    {
      name: 'YouTube',
      url: 'https://youtube.com/@AyaUke_Projecti',
      icon: '📺',
      color: 'from-red-500 to-red-700'
    },
    {
      name: 'X (Twitter)',
      url: 'https://twitter.com/AyaUke_V',
      icon: '🐦',
      color: 'from-blue-400 to-blue-600'
    }
  ];

  return (
    <section className="relative h-[900px] flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-light-primary/30 via-light-accent/20 to-light-purple/30 
                      dark:from-dark-primary/30 dark:via-dark-accent/20 dark:to-dark-purple/30"></div>
      
      {/* Animated background shapes */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-light-accent/10 dark:bg-dark-accent/10 
                        rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-light-secondary/10 dark:bg-dark-secondary/10 
                        rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-light-purple/10 dark:bg-dark-purple/10 
                        rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <LiveIndicator />
        </motion.div> */}

        {/* Character placeholder - 실제 구현시 일러스트 이미지로 교체 */}
        {/* <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="mb-12"
        >
          <div className="relative mx-auto w-64 h-64 sm:w-80 sm:h-80 mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-light-accent to-light-purple 
                            dark:from-dark-accent to-dark-purple rounded-full opacity-20 blur-2xl 
                            animate-pulse"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-light-primary to-light-accent 
                            dark:from-dark-primary to-dark-accent rounded-full flex items-center justify-center
                            shadow-2xl border-4 border-white/20 backdrop-blur-sm">
              <span className="text-6xl">🎵</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-5xl sm:text-7xl font-bold mb-4 font-display">
            <span className="gradient-text">아야</span>
            <span className="text-light-text dark:text-dark-text"> AyaUke</span>
          </h1>
          <p className="text-xl sm:text-2xl text-light-text/80 dark:text-dark-text/80 mb-6 font-medium">
            HONEYZ의 따뜻한 목소리, 게임과 노래를 사랑하는 버튜버
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-sm text-light-text/60 dark:text-dark-text/60">
            <span className="px-3 py-1 bg-light-primary/20 dark:bg-dark-primary/20 rounded-full">노래방송</span>
            <span className="px-3 py-1 bg-light-accent/20 dark:bg-dark-accent/20 rounded-full">게임방송</span>
            <span className="px-3 py-1 bg-light-secondary/20 dark:bg-dark-secondary/20 rounded-full">저스트채팅</span>
            <span className="px-3 py-1 bg-light-purple/20 dark:bg-dark-purple/20 rounded-full">ISFP</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          {socialLinks.map((link) => (
            <motion.a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={`inline-flex items-center gap-3 px-6 py-3 rounded-full 
                         bg-gradient-to-r ${link.color} text-white font-medium 
                         shadow-lg hover:shadow-xl transition-all duration-300
                         backdrop-blur-sm border border-white/20`}
            >
              <span className="text-xl">{link.icon}</span>
              <span>{link.name}</span>
            </motion.a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex justify-center"
        >
          <Link
            href="/songbook"
            className="group relative inline-flex items-center gap-3 px-8 py-4 
                     bg-gradient-to-r from-light-accent to-light-purple 
                     dark:from-dark-accent dark:to-dark-purple
                     text-white font-semibold rounded-full shadow-xl 
                     hover:shadow-2xl transform hover:-translate-y-1 
                     transition-all duration-300"
          >
            <PlayIcon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            <span>노래책 둘러보기</span>
            <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 
                           group-hover:opacity-100 transition-opacity duration-300"></div>
          </Link>
        </motion.div> */}
      </div>

      {/* Scroll indicator */}
      {/* <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <div className="w-6 h-10 border-2 border-light-text/30 dark:border-dark-text/30 
                        rounded-full flex justify-center">
          <div className="w-1 h-3 bg-light-accent dark:bg-dark-accent rounded-full mt-2 
                          animate-bounce"></div>
        </div>
      </motion.div> */}
    </section>
  );
}