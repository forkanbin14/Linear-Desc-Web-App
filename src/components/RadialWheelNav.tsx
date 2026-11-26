import { useEffect, useState, type WheelEvent } from 'react';
import {
  Activity,
  BookOpen,
  ChevronDown,
  Coins,
  FolderKanban,
  GitCompare,
  Languages,
  Layers,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Sliders,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useLanguage, type AppCurrency } from '../i18n/LanguageContext.tsx';
import type { ProjectSummary } from '../shared/types.ts';
import type { SidebarNavTab } from './Sidebar.tsx';

interface RadialWheelNavProps {
  open: boolean;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  creatingProject: boolean;
  activeTab: SidebarNavTab;
  hasActiveModel: boolean;
  solving: boolean;
  onSelectTab: (tab: SidebarNavTab) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onOpenAiDraft: () => void;
  onOpenTemplates: () => void;
  onOpenShare: () => void;
  onExecuteSolve: () => void;
  onClose: () => void;
}

const WHEEL_ANGLES_DEG = [-90, -18, 54, 126, 198] as const;

export function RadialWheelNav({
  open,
  projects,
  selectedProjectId,
  creatingProject,
  activeTab,
  hasActiveModel,
  solving,
  onSelectTab,
  onSelectProject,
  onDeleteProject,
  onOpenCreateProject,
  onOpenAiDraft,
  onOpenTemplates,
  onOpenShare: _onOpenShare,
  onExecuteSolve,
  onClose,
}: RadialWheelNavProps) {
  const { lang, setLang, currency, setCurrency, t } = useLanguage();
  const [hoveredTab, setHoveredTab] = useState<SidebarNavTab | null>(null);
  const [spinSteps, setSpinSteps] = useState(0);
  const [showProjectsTray, setShowProjectsTray] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      setIsMobileViewport(window.innerWidth < 640);
      setIsCompactViewport(window.innerWidth < 400 || window.innerHeight < 700);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!open) {
      setHoveredTab(null);
      setShowProjectsTray(false);
    }
  }, [open]);

  const navItems: Array<{
    id: SidebarNavTab;
    label: string;
    shortLabel: string;
    icon: typeof Layers;
    accentHex: string;
  }> = [
    {
      id: 'builder',
      label: t.nav.builder,
      shortLabel: lang === 'bn' ? 'স্টুডিও' : 'Studio',
      icon: Layers,
      accentHex: '#0f766e',
    },
    {
      id: 'solve',
      label: t.nav.solve,
      shortLabel: lang === 'bn' ? 'সমাধান' : 'Solve',
      icon: Activity,
      accentHex: '#0d9488',
    },
    {
      id: 'sensitivity',
      label: t.nav.sensitivity,
      shortLabel: lang === 'bn' ? 'সেন্সিটিভিটি' : 'Sensitivity',
      icon: Sliders,
      accentHex: '#0284c7',
    },
    {
      id: 'transport',
      label: t.nav.transport,
      shortLabel: lang === 'bn' ? 'ট্রান্সপোর্ট' : 'Transport',
      icon: Truck,
      accentHex: '#059669',
    },
    {
      id: 'compare',
      label: t.nav.compare,
      shortLabel: lang === 'bn' ? 'তুলনা' : 'Compare',
      icon: GitCompare,
      accentHex: '#4f46e5',
    },
  ];

  const currentTab: SidebarNavTab = creatingProject ? 'builder' : activeTab;
  const focusedTab = hoveredTab ?? currentTab;
  const focusedIdx = Math.max(
    0,
    navItems.findIndex((item) => item.id === focusedTab)
  );
  const focusedItem = navItems[focusedIdx];

  const orbitRadius = isCompactViewport ? 94 : isMobileViewport ? 108 : 154;
  const wheelBoxSize = isCompactViewport ? 276 : isMobileViewport ? 314 : 436;

  const handleSpinBy = (delta: number) => {
    setSpinSteps((prev) => prev + delta);
    const nextIdx = (focusedIdx + delta + navItems.length) % navItems.length;
    setHoveredTab(navItems[nextIdx].id);
  };

  const handleWheelScroll = (e: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
    const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
    handleSpinBy(dir);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'bn' ? 'সার্কুলার হুইল নেভিগেশন মেনু' : 'Circular Wheel Navigation Menu'}
        >
          {/* Backdrop Scrim (avoid heavy blur on mobile GPUs) */}
          <motion.div
            key="radial-wheel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/65 sm:backdrop-blur-sm"
          />

          {/* Top Floating Close Button */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.1 }}
            className="relative z-10 w-full max-w-lg flex items-center justify-end mb-1.5 sm:mb-3 px-1 shrink-0"
          >
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label={lang === 'bn' ? 'মেনু বন্ধ করুন' : 'Close menu'}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center transition-colors active:scale-95 touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* CapCut / Filmora Style Rotary Circle Wheel */}
          <motion.div
            key="radial-wheel-stage"
            initial={{ scale: 0.82, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.86, rotate: 14, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onWheel={handleWheelScroll}
            style={{ width: wheelBoxSize, height: wheelBoxSize }}
            className="relative z-10 flex items-center justify-center select-none shrink-0 will-change-transform"
          >
            {/* Outer Glossy Ring Frame */}
            <div className="absolute inset-4 sm:inset-5 rounded-full bg-slate-900/95 border border-white/15 shadow-2xl shadow-teal-950/50" />

            {/* SVG Precision Dial Rings and Tick Marks */}
            <svg
              viewBox="0 0 420 420"
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden="true"
            >

              {/* Concentric studio dial tracks */}
              <circle cx="210" cy="210" r="190" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle
                cx="210"
                cy="210"
                r="148"
                fill="none"
                stroke="rgba(45,212,191,0.22)"
                strokeWidth="1.25"
                strokeDasharray="4 6"
              />
              <circle cx="210" cy="210" r="88" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.25" />

              {/* 60 Precision Perimeter Ticks */}
              {Array.from({ length: 60 }).map((_, idx) => {
                const deg = idx * 6;
                const isMajor = idx % 12 === 0;
                const rad = ((deg - 90) * Math.PI) / 180;
                const rOuter = 186;
                const rInner = isMajor ? 174 : 180;
                return (
                  <line
                    key={idx}
                    x1={210 + Math.cos(rad) * rInner}
                    y1={210 + Math.sin(rad) * rInner}
                    x2={210 + Math.cos(rad) * rOuter}
                    y2={210 + Math.sin(rad) * rOuter}
                    stroke={isMajor ? 'rgba(45,212,191,0.75)' : 'rgba(255,255,255,0.22)'}
                    strokeWidth={isMajor ? 2 : 1}
                    strokeLinecap="round"
                  />
                );
              })}

            </svg>

            {/* 5 Orbital Circular Wheel Nodes */}
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const angleDeg = WHEEL_ANGLES_DEG[idx] + spinSteps * 72;
              const rad = (angleDeg * Math.PI) / 180;
              const x = Math.cos(rad) * orbitRadius;
              const y = Math.sin(rad) * orbitRadius;
              const isSelected = currentTab === item.id;
              const isFocused = focusedTab === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ x: x * 0.55, y: y * 0.55, scale: 0.65, opacity: 0 }}
                  animate={{ x, y, scale: 1, opacity: 1 }}
                  exit={{ x: 0, y: 0, scale: 0.55, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute z-20 flex flex-col items-center"
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ duration: 0.1 }}
                    onMouseEnter={() => setHoveredTab(item.id)}
                    onFocus={() => setHoveredTab(item.id)}
                    onClick={() => {
                      onSelectTab(item.id);
                      onClose();
                    }}
                    aria-label={item.label}
                    className={`group relative flex flex-col items-center focus:outline-none`}
                  >
                    <span
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 transition-all duration-100 shadow-lg ${
                        isSelected
                          ? 'bg-teal-500 border-white text-slate-950 shadow-teal-500/40 ring-4 ring-teal-400/30'
                          : isFocused
                          ? 'bg-slate-800 border-teal-400 text-teal-300 shadow-teal-500/25'
                          : 'bg-slate-900/95 border-slate-600/80 text-slate-200 hover:border-teal-400/80 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5" />
                    </span>

                    <span
                      className={`mt-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold whitespace-nowrap shadow-md transition-colors ${
                        isSelected
                          ? 'bg-teal-400 text-slate-950'
                          : isFocused
                          ? 'bg-white text-slate-900'
                          : 'bg-slate-900/95 text-slate-100 border border-white/15'
                      }`}
                    >
                      {item.shortLabel}
                    </span>
                  </motion.button>
                </motion.div>
              );
            })}

            {/* Center Hub Core */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.1 }}
              onClick={() => {
                onSelectTab(focusedItem.id);
                onClose();
              }}
              className="relative z-30 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 border-2 border-teal-400/60 shadow-2xl shadow-black/60 flex flex-col items-center justify-center text-center px-2 group focus-visible:outline-2 focus-visible:outline-teal-400"
            >
              <motion.span
                key={focusedItem.id}
                initial={{ scale: 0.84, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.09 }}
                className="flex flex-col items-center gap-0.5 sm:gap-1"
              >
                {(() => {
                  const FocusedIcon = focusedItem.icon;
                  return <FocusedIcon className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-teal-300" />;
                })()}
                <span className="text-[10px] sm:text-xs font-bold text-white leading-tight line-clamp-2">
                  {focusedItem.label}
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono text-teal-300/90 tabular-nums">
                  {currency === 'BDT' ? '৳ BDT' : '$ USD'}
                </span>
              </motion.span>
            </motion.button>
          </motion.div>

          {/* Bottom Utility Control Dock (Wheel Spin, EN/বাংলা, ৳ BDT/$ USD, Quick Actions & Projects) */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.12, delay: 0.015, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 mt-1.5 sm:mt-3 w-full max-w-lg bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl p-2.5 sm:p-3 space-y-2 sm:space-y-2.5 shrink-0"
          >
            {/* Controls Row 1: Wheel Spin + Language + Capital Currency */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Wheel Spin Controls */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSpinBy(-1)}
                  title={lang === 'bn' ? 'বামে ঘোরান' : 'Rotate Left'}
                  className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                  {lang === 'bn' ? 'হুইল ঘোরান' : 'Spin Wheel'}
                </span>
                <button
                  type="button"
                  onClick={() => handleSpinBy(1)}
                  title={lang === 'bn' ? 'ডানে ঘোরান' : 'Rotate Right'}
                  className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bilingual Switch + Currency Switch */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center p-0.5 bg-slate-100 rounded-xl">
                  <Languages className="w-3.5 h-3.5 text-teal-700 mx-1.5" />
                  {(['en', 'bn'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        lang === code ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {code === 'en' ? 'EN' : 'বাংলা'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center p-0.5 bg-slate-100 rounded-xl">
                  <Coins className="w-3.5 h-3.5 text-teal-700 mx-1.5" />
                  {(['BDT', 'USD'] as AppCurrency[]).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setCurrency(cur)}
                      className={`px-2 py-1 text-[11px] font-semibold font-mono rounded-lg transition-colors whitespace-nowrap ${
                        currency === cur ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cur === 'BDT' ? '৳ BDT' : '$ USD'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls Row 2: Quick Workspace Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Button
                type="button"
                onClick={() => {
                  onOpenCreateProject();
                  onClose();
                }}
                className="h-8.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.actions.newProject}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onOpenAiDraft();
                  onClose();
                }}
                className="h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                {t.actions.aiDraft}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onOpenTemplates();
                  onClose();
                }}
                className="h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-medium"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                {t.actions.examples}
              </Button>

              {hasActiveModel && !creatingProject ? (
                <button
                  type="button"
                  disabled={solving}
                  onClick={() => {
                    onExecuteSolve();
                    onClose();
                  }}
                  className="h-8.5 px-3 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{solving ? t.actions.solving : t.actions.solveModel}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowProjectsTray((prev) => !prev)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors whitespace-nowrap"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t.sidebar.yourProjects}</span>
                  <span className="font-mono text-[11px] text-slate-500">({projects.length})</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showProjectsTray ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>

            {/* Expandable Projects Switcher when Active Model exists or clicked */}
            {(hasActiveModel && !creatingProject) && (
              <button
                type="button"
                onClick={() => setShowProjectsTray((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-teal-700" />
                  {t.sidebar.yourProjects} ({projects.length})
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showProjectsTray ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            <AnimatePresence>
              {showProjectsTray && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="max-h-40 overflow-y-auto border-t border-slate-200 pt-2 space-y-1"
                >
                  {projects.length === 0 ? (
                    <div className="py-3 text-center text-xs text-slate-500">
                      {t.sidebar.noProjectsTitle} — {t.sidebar.noProjectsDesc}
                    </div>
                  ) : (
                    projects.map((p) => {
                      const active = !creatingProject && p.id === selectedProjectId;
                      return (
                        <div
                          key={p.id}
                          className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${
                            active
                              ? 'bg-teal-50/80 border-teal-200 text-slate-900'
                              : 'border-transparent hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProject(p.id);
                              onClose();
                            }}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left"
                          >
                            <FolderKanban
                              className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`}
                            />
                            <span className="text-xs font-medium truncate">{p.name}</span>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              v{p.latestVersionNumber}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(p.id)}
                            aria-label={`Delete ${p.name}`}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
