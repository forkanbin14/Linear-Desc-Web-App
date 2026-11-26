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

export interface SingleDotOrbitProps {
  radius?: number;
  dotSizeClass?: string;
  stageSizeClass?: string;
  duration?: number;
  surface?: 'light' | 'dark';
}

/**
 * Single dot orbiting infinitely in a crisp circular path — shown inside the AI chatbox
 * whenever Syston is actively thinking, reasoning, or chatting.
 */
export function SingleDotOrbit({
  radius = 7,
  dotSizeClass = 'w-2 h-2',
  stageSizeClass = 'w-6 h-6',
  duration = 0.9,
  surface = 'light',
}: SingleDotOrbitProps) {
  const trackBorder =
    surface === 'dark' ? 'border-teal-400/25' : 'border-teal-500/25';
  const dotColor =
    surface === 'dark'
      ? 'bg-teal-300 shadow-[0_0_8px_rgba(94,234,212,0.85)]'
      : 'bg-teal-600 shadow-[0_0_6px_rgba(13,148,136,0.55)]';

  return (
    <div
      aria-hidden="true"
      className={`relative ${stageSizeClass} flex items-center justify-center shrink-0`}
    >
      <span
        style={{ width: radius * 2, height: radius * 2 }}
        className={`absolute rounded-full border ${trackBorder} pointer-events-none`}
      />
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="relative w-full h-full flex items-center justify-center"
      >
        <span
          style={{ transform: `translateY(-${radius}px)` }}
          className={`rounded-full ${dotSizeClass} ${dotColor}`}
        />
      </motion.div>
    </div>
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
