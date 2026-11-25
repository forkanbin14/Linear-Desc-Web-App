import { motion } from 'motion/react';

export function InitialWorkspaceSkeleton({ label }: { label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-5"
    >
      {/* Top Indeterminate Wave Progress Strip + Studio Header Skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
      >
        <div className="h-1 w-full bg-slate-100 overflow-hidden relative">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 skeleton-wave-bar" />
        </div>
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2.5 flex-1 min-w-[220px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
              <span className="text-[11px] font-semibold tracking-wide text-teal-800">
                {label || 'Systonic Linear Desc · Initializing Workspace...'}
              </span>
            </div>
            <div className="h-6 w-72 max-w-full rounded-lg skeleton-shimmer" />
            <div className="h-3.5 w-[460px] max-w-full rounded-md skeleton-shimmer" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-32 rounded-xl skeleton-shimmer" />
            <div className="h-9 w-28 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </motion.div>

      {/* Staggered 4-Column KPI Shimmer Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 + idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded skeleton-shimmer" />
              <div className="w-7 h-7 rounded-lg skeleton-shimmer" />
            </div>
            <div className="h-7 w-28 rounded-lg skeleton-shimmer" />
            <div className="h-3 w-36 rounded skeleton-shimmer" />
          </motion.div>
        ))}
      </div>

      {/* Dual Builder / Visual Analytics Skeleton Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-48 rounded skeleton-shimmer" />
            <div className="h-7 w-28 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-10 sm:col-span-2 rounded-xl skeleton-shimmer" />
            <div className="h-10 rounded-xl skeleton-shimmer" />
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="h-10 w-full rounded-xl skeleton-shimmer" />
            <div className="h-10 w-full rounded-xl skeleton-shimmer" />
            <div className="h-10 w-5/6 rounded-xl skeleton-shimmer" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="h-4 w-40 rounded skeleton-shimmer" />
          <div className="h-36 w-full rounded-xl skeleton-shimmer" />
          <div className="flex gap-2">
            <div className="h-8 flex-1 rounded-lg skeleton-shimmer" />
            <div className="h-8 flex-1 rounded-lg skeleton-shimmer" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-3 w-48 rounded skeleton-shimmer" />
          <div className="h-6 w-72 rounded skeleton-shimmer" />
          <div className="h-3.5 w-96 rounded skeleton-shimmer" />
        </div>
        <div className="h-9 w-56 rounded-lg skeleton-shimmer" />
      </div>
      <SolveWorkspaceSkeleton />
    </motion.div>
  );
}

export function SolveWorkspaceSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* 4-Column KPI Shimmer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="h-3 w-24 rounded skeleton-shimmer" />
            <div className="h-7 w-32 rounded skeleton-shimmer" />
            <div className="h-3 w-36 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* 2-Column Visual Charts Shimmer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0, 1].map((idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="h-4 w-48 rounded skeleton-shimmer" />
            <div className="space-y-2.5 pt-2">
              <div className="h-5 w-full rounded skeleton-shimmer" />
              <div className="h-5 w-11/12 rounded skeleton-shimmer" />
              <div className="h-5 w-4/5 rounded skeleton-shimmer" />
              <div className="h-5 w-3/4 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Decision Table Shimmer */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between">
          <div className="h-4 w-44 rounded skeleton-shimmer" />
          <div className="h-4 w-20 rounded skeleton-shimmer" />
        </div>
        <div className="p-4 space-y-2.5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-8 w-full rounded skeleton-shimmer" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function MatrixSolveSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="h-3 w-28 rounded skeleton-shimmer" />
            <div className="h-7 w-24 rounded skeleton-shimmer" />
            <div className="h-3 w-32 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="h-4 w-56 rounded skeleton-shimmer" />
          <div className="h-48 w-full rounded-lg skeleton-shimmer" />
        </div>
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="h-4 w-44 rounded skeleton-shimmer" />
          <div className="h-48 w-full rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </motion.div>
  );
}

export function AiTextSkeleton() {
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
      <div className="h-3.5 w-11/12 rounded skeleton-shimmer" />
      <div className="h-3.5 w-full rounded skeleton-shimmer" />
      <div className="h-3.5 w-4/5 rounded skeleton-shimmer" />
      <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
    </div>
  );
}
