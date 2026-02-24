'use client';

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Scroll Progress Bar
 * 
 * A premium scroll indicator that shows reading progress.
 * Features:
 * - Smooth spring animation
 * - Gold color matching brand
 * - Fixed at top of viewport
 * - Zero layout shift (uses transform)
 */
export const ScrollProgress: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  
  // Smooth spring animation for premium feel
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render on server to prevent hydration mismatch
  if (!isMounted) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-fcGold origin-left z-[100]"
      style={{ 
        scaleX,
        boxShadow: '0 0 10px rgba(197, 160, 89, 0.5)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    />
  );
};

export default ScrollProgress;
