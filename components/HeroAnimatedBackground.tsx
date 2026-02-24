/**
 * Premium Animated Background for Hero Section
 * Subtle, calm gradient motion that feels expensive and modern
 * 
 * Features:
 * - 2-3 soft radial gradients with low opacity (0.06-0.12)
 * - Slow drift motion (20-40 seconds per cycle)
 * - Respects prefers-reduced-motion
 * - Performance optimized with CSS gradients
 * - Brand colors desaturated 40-60%
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface GradientLayer {
  id: string;
  color: string;
  position: { x: number; y: number };
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

export const HeroAnimatedBackground: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Desaturated brand colors (40-60% desaturation)
  // Warm tone: fcGold (#C5A059) -> desaturated warm beige
  // Cool tone: slate blue for contrast
  const gradients: GradientLayer[] = [
    {
      id: 'gradient-1',
      color: 'rgba(197, 160, 89, 0.18)', // Desaturated gold - visible but subtle
      position: { x: 10, y: 10 }, // Top-left (visible on screen)
      size: 1000,
      opacity: 1, // Opacity is in the color itself
      duration: 30,
      delay: 0,
    },
    {
      id: 'gradient-2',
      color: 'rgba(100, 116, 139, 0.15)', // Desaturated cool slate - visible but subtle
      position: { x: 90, y: 90 }, // Bottom-right (visible on screen)
      size: 1100,
      opacity: 1, // Opacity is in the color itself
      duration: 35,
      delay: 5,
    },
    {
      id: 'gradient-3',
      color: 'rgba(197, 160, 89, 0.12)', // Center gradient - visible but subtle
      position: { x: 50, y: 50 }, // Center
      size: 800,
      opacity: 1, // Opacity is in the color itself
      duration: 40,
      delay: 10,
    },
  ];

  // Animation variants - slow drift with reverse loop
  const getAnimationVariants = (gradient: GradientLayer) => {
    if (prefersReducedMotion || !isClient) {
      return {
        x: 0,
        y: 0,
      };
    }

    // Slow drift: 10-40px movement over 30-40 seconds
    return {
      x: [0, 25, -15, 0], // Relative movement in pixels
      y: [0, -20, 30, 0], // Relative movement in pixels
    };
  };

  const getTransition = (gradient: GradientLayer) => {
    if (prefersReducedMotion || !isClient) {
      return { duration: 0 };
    }

    return {
      duration: gradient.duration,
      delay: gradient.delay,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'reverse' as const,
    };
  };

  return (
    <div 
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden="true"
    >
      {gradients.map((gradient) => (
        <motion.div
          key={gradient.id}
          className="absolute rounded-full"
          style={{
            width: `${gradient.size}px`,
            height: `${gradient.size}px`,
            background: `radial-gradient(circle, ${gradient.color} 0%, transparent 65%)`,
            opacity: 1, // Full opacity, color already has opacity built in
            willChange: prefersReducedMotion || !isClient ? 'auto' : 'transform',
            left: `${gradient.position.x}%`,
            top: `${gradient.position.y}%`,
          }}
          animate={getAnimationVariants(gradient)}
          transition={getTransition(gradient) as any}
          initial={{ x: 0, y: 0 }}
          transformTemplate={({ x, y }) => {
            const xValue = typeof x === 'number' ? x : 0;
            const yValue = typeof y === 'number' ? y : 0;
            return `translate(calc(-50% + ${xValue}px), calc(-50% + ${yValue}px))`;
          }}
        />
      ))}
    </div>
  );
};

export default HeroAnimatedBackground;
