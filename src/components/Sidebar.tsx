import {
  Activity,
  BookOpen,
  Coins,
  FolderKanban,
  GitCompare,
  Languages,
  Layers,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage, type AppCurrency } from '../i18n/LanguageContext.tsx';
import type { ProjectSummary } from '../shared/types.ts';

export type SidebarNavTab = 'builder' | 'solve' | 'sensitivity' | 'transport' | 'compare';

interface SidebarProps {
  instanceId?: string;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  creatingProject: boolean;
  activeTab: SidebarNavTab;
  onSelectTab: (tab: SidebarNavTab) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onOpenAiDraft: () => void;
  onOpenTemplates: () => void;
  onClose?: () => void;
}

export function Sidebar({
  instanceId = 'drawer',
  projects,
  selectedProjectId,
  creatingProject,
  activeTab,
  onSelectTab,
  onSelectProject,
  onDeleteProject,
  onOpenCreateProject,
  onOpenAiDraft,
  onOpenTemplates,
  onClose,
}: SidebarProps) {
  const { lang, setLang, currency, setCurrency, t } = useLanguage();

  const navItems: Array<{ id: SidebarNavTab; label: string; icon: typeof Layers }> = [
    { id: 'builder', label: t.nav.builder, icon: Layers },
    { id: 'solve', label: t.nav.solve, icon: Activity },
    { id: 'sensitivity', label: t.nav.sensitivity, icon: Sliders },
    { id: 'transport', label: t.nav.transport, icon: Truck },
    { id: 'compare', label: t.nav.compare, icon: GitCompare },
  ];

  return (
    <aside className="w-76 max-w-[88vw] bg-white border-r border-slate-200/90 flex flex-col h-full select-none shadow-2xl shadow-slate-950/15">
      {/* Drawer Brand Header */}
      <div className="px-4 h-14 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-gradient-to-r from-slate-900 to-teal-950 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-mono text-[10px] font-bold shrink-0">
            SLD
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight truncate">{t.brand}</div>
            <div className="text-[10px] text-teal-300/90 font-mono truncate">LP · MIP · QP Engine</div>
          </div>
        </div>

        {onClose && (
          <motion.button
            whileHover={{ scale: 1.08, rotate: 90 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            type="button"
            onClick={onClose}
            aria-label={lang === 'bn' ? 'মেনু বন্ধ করুন' : 'Close navigation drawer'}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Staggered Scrollable Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80">
        {/* Workspace Navigation Links */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
          className="p-3 space-y-1"
        >
          <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {t.sidebar.workspaceMenu}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = creatingProject ? item.id === 'builder' : activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  active ? 'text-white font-semibold' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`${instanceId}-drawer-nav-pill`}
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 bg-slate-900 rounded-lg shadow-xs"
                  />
                )}
                <Icon className={`w-4 h-4 relative z-10 ${active ? 'text-teal-300' : 'text-slate-400'}`} />
                <span className="relative z-10">{item.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Language & Capital Currency Selectors */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, delay: 0.07, ease: [0.16, 1, 0.3, 1] }}
          className="p-3.5 space-y-3"
        >
          {/* Bilingual Language Switch (EN <-> বাংলা) */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-teal-700" />
                {t.sidebar.language}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg relative">
              {(['en', 'bn'] as const).map((code) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className={`relative z-10 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      active ? 'text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={`${instanceId}-lang-switch-pill`}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        className="absolute inset-0 bg-white rounded-md shadow-xs -z-10"
                      />
                    )}
                    {code === 'en' ? 'English' : 'বাংলা'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capital Currency Switch (BDT ৳ <-> USD $) */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-teal-700" />
                {t.sidebar.capitalCurrency}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg relative">
              {(['BDT', 'USD'] as AppCurrency[]).map((cur) => {
                const active = currency === cur;
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={`relative z-10 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      active ? 'text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={`${instanceId}-currency-switch-pill`}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        className="absolute inset-0 bg-white rounded-md shadow-xs -z-10"
                      />
                    )}
                    {cur === 'BDT' ? t.sidebar.bdtLabel : t.sidebar.usdLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, delay: 0.11, ease: [0.16, 1, 0.3, 1] }}
          className="p-3.5 space-y-2"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onOpenCreateProject}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.actions.newProject}
          </motion.button>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onOpenAiDraft}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
              {t.actions.aiDraft}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onOpenTemplates}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              {t.actions.examples}
            </motion.button>
          </div>
        </motion.div>

        {/* Projects List */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="p-3"
        >
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-slate-500">{t.sidebar.yourProjects}</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">{projects.length}</span>
          </div>

          {projects.length === 0 ? (
            <div className="px-3 py-5 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 space-y-1.5">
              <div className="text-xs font-medium text-slate-700">{t.sidebar.noProjectsTitle}</div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {t.sidebar.noProjectsDesc}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <AnimatePresence initial={false}>
                {projects.map((p) => {
                  const active = !creatingProject && p.id === selectedProjectId;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18 }}
                      className={`group flex items-start gap-1 px-2.5 py-2 rounded-lg transition-colors border ${
                        active
                          ? 'bg-teal-50/70 border-teal-200 text-slate-900'
                          : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectProject(p.id)}
                        className="flex items-start gap-2 min-w-0 flex-1 text-left"
                      >
                        <FolderKanban
                          className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-snug truncate">{p.name}</div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 truncate">
                            <span>{p.domain}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">v{p.latestVersionNumber}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {p.totalRuns} {t.sidebar.runs}
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(p.id)}
                        title={`Delete ${p.name}`}
                        className="p-1 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0 bg-slate-50/60">
        <span>{t.sidebar.solverLabel}</span>
        <span className="font-mono text-slate-600">{currency === 'BDT' ? '৳ BDT' : '$ USD'}</span>
      </div>
    </aside>
  );
}
