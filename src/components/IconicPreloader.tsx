import { motion } from 'motion/react';

interface IconicPreloaderProps {
  lang?: 'en' | 'bn';
}

const LIGHT_DOTS = [
  { id: 0, angleDeg: -90, color: 'bg-teal-600 shadow-teal-600/35' },
  { id: 1, angleDeg: 30, color: 'bg-emerald-500 shadow-emerald-500/35' },
  { id: 2, angleDeg: 150, color: 'bg-slate-900 shadow-slate-900/25' },
];

const DARK_DOTS = [
  { id: 0, angleDeg: -90, color: 'bg-teal-400 shadow-teal-400/45' },
  { id: 1, angleDeg: 30, color: 'bg-emerald-400 shadow-emerald-400/45' },
  { id: 2, angleDeg: 150, color: 'bg-white shadow-white/40' },
];

export interface OrbitalThreeDotsProps {
  restRadius?: number;
  peakRadius?: number;
  dotSizeClass?: string;
  stageSizeClass?: string;
  duration?: number;
  surface?: 'light' | 'dark';
}

/**
 * 3 dots arranged symmetrically in a circle orbit 360° while expanding outward
 * and contracting smoothly back to their starting positions.
 */
export function OrbitalThreeDots({
  restRadius = 16,
  peakRadius = 28,
  dotSizeClass = 'w-3.5 h-3.5',
  stageSizeClass = 'w-20 h-20',
  duration = 1.25,
  surface = 'light',
}: OrbitalThreeDotsProps) {
  const dots = surface === 'dark' ? DARK_DOTS : LIGHT_DOTS;

  return (
    <motion.div
      animate={{ rotate: [0, 360] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: [0.65, 0, 0.35, 1],
      }}
      className={`relative ${stageSizeClass} flex items-center justify-center`}
    >
      {dots.map((dot) => {
        const rad = (dot.angleDeg * Math.PI) / 180;
        const restX = Math.cos(rad) * restRadius;
        const restY = Math.sin(rad) * restRadius;
        const peakX = Math.cos(rad) * peakRadius;
        const peakY = Math.sin(rad) * peakRadius;

        return (
          <motion.span
            key={dot.id}
            aria-hidden="true"
            animate={{
              x: [restX, peakX, restX],
              y: [restY, peakY, restY],
              scale: [1, 1.22, 1],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease: [0.65, 0, 0.35, 1],
            }}
            className={`absolute ${dotSizeClass} rounded-full shadow-md ${dot.color}`}
          />
        );
      })}
    </motion.div>
  );
}

/**
 * Pure, text-free 3-dot orbital spinning preloader shown before entering the app.
 */
export function IconicPreloader({ lang = 'en' }: IconicPreloaderProps) {
  return (
    <motion.div
      key="systonic-3dot-preloader"
      role="status"
      aria-live="polite"
      aria-label={lang === 'bn' ? 'লোড হচ্ছে' : 'Loading'}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] bg-[#f1f5f9] flex items-center justify-center select-none overflow-hidden"
    >
      <OrbitalThreeDots />
    </motion.div>
  );
}
