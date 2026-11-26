import { Activity, BookOpen, Compass, GitCompare, Languages, Layers, Play, Plus, Share2, Sliders, Sparkles, Truck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { AiAutopilotConsole, type AiCommandHistoryItem, type ProjectDiscoveryTrigger } from './components/AiAutopilotConsole.tsx';
import { AiDraftModal } from './components/AiDraftModal.tsx';
import { BatchAndApiPanel } from './components/BatchAndApiPanel.tsx';
import { CreateProjectStudio } from './components/CreateProjectStudio.tsx';
import { IconicPreloader, OrbitalThreeDots } from './components/IconicPreloader.tsx';
import { ModelBuilder } from './components/ModelBuilder.tsx';
import { RadialWheelNav } from './components/RadialWheelNav.tsx';
import { ScenarioCompare } from './components/ScenarioCompare.tsx';
import { SensitivityAndIis } from './components/SensitivityAndIis.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { InitialWorkspaceSkeleton, ProjectDetailSkeleton } from './components/SkeletonLoaders.tsx';
import { SolveWorkspace } from './components/SolveWorkspace.tsx';
import { TemplatesModal } from './components/TemplatesModal.tsx';
import { TransportationStudio } from './components/TransportationStudio.tsx';
import { useLanguage } from './i18n/LanguageContext.tsx';
import type { ModelTemplate } from './shared/templates.ts';
import type {
  AiAutomationResponse,
  AssignmentInput,
  AssignmentResult,
  BatchSolveItemResult,
  ModelSpec,
  ProjectAnalyzeBuildResponse,
  ProjectDetail,
  ProjectSummary,
  SolverParams,
  TransportationInput,
  TransportationResult,
  WhatIfPoint,
} from './shared/types.ts';
import { fmtDate } from './utils/format.ts';

type NavTab = 'builder' | 'solve' | 'sensitivity' | 'transport' | 'compare';
type CompareSubTab = 'whatif' | 'batch';

const DEFAULT_PARAMS: SolverParams = {
  solverId: 'highs-wasm',
  timeLimitSec: 60,
  mipRelGap: 1e-4,
  presolve: 'on',
  autoScale: true,
  computeRanging: true,
  computeIis: true,
};

export default function App() {
  const { lang, setLang, toggleLang, currency, toggleCurrency, t } = useLanguage();
  const [booting, setBooting] = useState(true);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [draftSpec, setDraftSpec] = useState<ModelSpec | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [creatingProject, setCreatingProject] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('builder');
  const [compareSubTab, setCompareSubTab] = useState<CompareSubTab>('whatif');
  const [solverParams, setSolverParams] = useState<SolverParams>(DEFAULT_PARAMS);

  const [loadingProject, setLoadingProject] = useState(false);
  const [solving, setSolving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [leftNavOpen, setLeftNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [floatingNavOpen, setFloatingNavOpen] = useState(false);
  const [floatingNavPinned, setFloatingNavPinned] = useState(false);
  const [floatingWheelCompact, setFloatingWheelCompact] = useState(false);
  const floatingNavLeaveTimerRef = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // Full-system AI Autopilot state
  const [autopilotExpanded, setAutopilotExpanded] = useState(false);
  const [autopilotBusy, setAutopilotBusy] = useState(false);
  const [autopilotHistory, setAutopilotHistory] = useState<AiCommandHistoryItem[]>([]);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const [discoveryTrigger, setDiscoveryTrigger] = useState<ProjectDiscoveryTrigger | null>(null);
  const [externalWhatIf, setExternalWhatIf] = useState<{
    key: number;
    targetType: 'constraint_rhs' | 'objective_coef';
    targetName: string;
    minVal: number;
    maxVal: number;
    steps: number;
    points: WhatIfPoint[];
  } | null>(null);
  const [externalTransport, setExternalTransport] = useState<{
    key: number;
    input: TransportationInput;
    result: TransportationResult;
  } | null>(null);
  const [externalAssignment, setExternalAssignment] = useState<{
    key: number;
    input: AssignmentInput;
    result: AssignmentResult;
  } | null>(null);
  const [externalBatch, setExternalBatch] = useState<{
    key: number;
    batchText: string;
    summary: { total: number; optimalCount: number; failedCount: number; totalTimeMs: number };
    results: BatchSolveItemResult[];
  } | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const winY = window.scrollY || document.documentElement.scrollTop || 0;
      const mainY = mainRef.current?.scrollTop ?? 0;
      const y = Math.max(winY, mainY);
      setIsScrolled((prev) => {
        const next = prev ? y > 20 : y > 48;
        if (!next) {
          setFloatingNavOpen(false);
          setFloatingNavPinned(false);
        }
        return next;
      });
    };

    const handleViewport = () => {
      setFloatingWheelCompact(window.innerWidth < 640);
    };

    handleScroll();
    handleViewport();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleViewport, { passive: true });
    const mainEl = mainRef.current;
    mainEl?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (floatingNavLeaveTimerRef.current) {
        window.clearTimeout(floatingNavLeaveTimerRef.current);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleViewport);
      mainEl?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const clearFloatingLeaveTimer = () => {
    if (floatingNavLeaveTimerRef.current) {
      window.clearTimeout(floatingNavLeaveTimerRef.current);
      floatingNavLeaveTimerRef.current = null;
    }
  };

  const closeFloatingWheel = () => {
    clearFloatingLeaveTimer();
    setFloatingNavPinned(false);
    setFloatingNavOpen(false);
  };

  useEffect(() => {
    if (!leftNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeftNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [leftNavOpen]);

  const loadProjects = useCallback(async (preferredId?: string) => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      const list = (data.projects || []) as ProjectSummary[];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) => {
          if (preferredId && list.some((p) => p.id === preferredId)) return preferredId;
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0].id;
        });
      } else {
        setSelectedProjectId(null);
        setProjectDetail(null);
        setDraftSpec(null);
        setSelectedVersionId('');
        setSelectedRunId('');
      }
    } finally {
      setProjectsLoaded(true);
    }
  }, []);

  const loadProjectDetail = useCallback(async (projectId: string) => {
    setLoadingProject(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to load project');
      const data = await res.json();
      const detail = data.project as ProjectDetail;
      setProjectDetail(detail);

      const latestVer = detail.versions[detail.versions.length - 1];
      if (latestVer) {
        setSelectedVersionId(latestVer.id);
        setDraftSpec(JSON.parse(JSON.stringify(latestVer.spec)));
        setIsDirty(false);
      }
      const latestRun = detail.runs[0];
      setSelectedRunId(latestRun ? latestRun.id : '');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to fetch project');
    } finally {
      setLoadingProject(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const urlProject = new URLSearchParams(window.location.search).get('project') || undefined;
    Promise.all([
      loadProjects(urlProject),
      new Promise<void>((resolve) => setTimeout(resolve, 1250)),
    ]).finally(() => {
      if (active) setBooting(false);
    });
    return () => {
      active = false;
    };
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetail(selectedProjectId);
    }
  }, [selectedProjectId, loadProjectDetail]);

  const activeVersion =
    projectDetail?.versions.find((v) => v.id === selectedVersionId) ??
    projectDetail?.versions[projectDetail.versions.length - 1] ??
    null;

  const activeRun =
    projectDetail?.runs.find((r) => r.id === selectedRunId) ??
    projectDetail?.runs.find((r) => r.modelVersionId === activeVersion?.id) ??
    projectDetail?.runs[0] ??
    null;

  const isStandaloneToolActive =
    activeTab === 'transport' || (activeTab === 'compare' && compareSubTab === 'batch');

  const showCreateStudio =
    projectsLoaded && (creatingProject || (projects.length === 0 && activeTab === 'builder'));

  const handleSelectNavTab = (tabId: NavTab) => {
    setCreatingProject(false);
    setActiveTab(tabId);
    if (tabId === 'compare' && projects.length === 0) {
      setCompareSubTab('batch');
    }
  };

  const handleOpenCreator = () => {
    setCreatingProject(true);
    setActiveTab('builder');
  };

  const handleSelectVersion = (verId: string) => {
    if (!projectDetail) return;
    const ver = projectDetail.versions.find((v) => v.id === verId);
    if (!ver) return;
    setSelectedVersionId(ver.id);
    setDraftSpec(JSON.parse(JSON.stringify(ver.spec)));
    setIsDirty(false);
    const matchingRun = projectDetail.runs.find((r) => r.modelVersionId === ver.id);
    if (matchingRun) setSelectedRunId(matchingRun.id);
  };

  const handleChangeDraftSpec = (next: ModelSpec) => {
    setDraftSpec(next);
    setIsDirty(true);
  };

  const handleRevertDraft = () => {
    if (!activeVersion) return;
    setDraftSpec(JSON.parse(JSON.stringify(activeVersion.spec)));
    setIsDirty(false);
  };

  const handleCommitVersion = async (
    commitMessage: string,
    overrideSpec?: ModelSpec,
    actionType?: 'MODEL_VERSIONED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED',
  ) => {
    const specToCommit = overrideSpec ?? draftSpec;
    if (!projectDetail || !specToCommit) return;
    setCommitting(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/projects/${projectDetail.id}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: specToCommit,
          commitMessage,
          actor: 'workspace@a2z.corp',
          role: 'modeler',
          actionType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save version');
      await loadProjects(projectDetail.id);
      await loadProjectDetail(projectDetail.id);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleExecuteSolve = async () => {
    if (!activeVersion) return;
    setCreatingProject(false);
    if (isDirty && draftSpec) {
      await handleCommitVersion(`Auto-saved edits before solve (v${activeVersion.versionNumber + 1})`);
      return;
    }
    setSolving(true);
    setErrorBanner(null);
    setActiveTab('solve');
    try {
      const res = await fetch(`/api/models/${activeVersion.id}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: solverParams,
          actor: 'workspace@a2z.corp',
          role: 'modeler',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Solve failed');
      await loadProjects(activeVersion.projectId);
      await loadProjectDetail(activeVersion.projectId);
      setSelectedRunId(data.run.id);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Solve execution error');
    } finally {
      setSolving(false);
    }
  };

  const handleSolveLatestAfterCommit = async (
    nextSpec: ModelSpec,
    commitMsg: string,
    actionType?: 'MODEL_VERSIONED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED',
  ) => {
    if (!projectDetail) return;
    setCommitting(true);
    try {
      const res = await fetch(`/api/projects/${projectDetail.id}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: nextSpec,
          commitMessage: commitMsg,
          actor: 'workspace@a2z.corp',
          role: 'modeler',
          actionType,
        }),
      });
      const verData = await res.json();
      if (!res.ok) throw new Error(verData.error || 'Commit failed');
      const newVerId = verData.version.id as string;

      setSolving(true);
      const solveRes = await fetch(`/api/models/${newVerId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: solverParams,
          actor: 'workspace@a2z.corp',
          role: 'modeler',
        }),
      });
      const solveData = await solveRes.json();
      await loadProjects(projectDetail.id);
      await loadProjectDetail(projectDetail.id);
      if (solveRes.ok && solveData.run) {
        setSelectedRunId(solveData.run.id);
        setActiveTab('solve');
      }
    } finally {
      setCommitting(false);
      setSolving(false);
    }
  };

  const handleCreateProject = async (
    name: string,
    domain: string,
    description: string,
    spec: ModelSpec,
    actionType: 'MODEL_CREATED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED' = 'MODEL_CREATED',
    autoSolve = false,
  ) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        domain,
        description,
        spec,
        actor: 'workspace@a2z.corp',
        role: 'modeler',
        actionType,
        autoSolve,
        params: solverParams,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create project');
    const created = data.project as ProjectDetail;
    setCreatingProject(false);
    await loadProjects(created.id);
    setSelectedProjectId(created.id);
    await loadProjectDetail(created.id);
    setActiveTab(autoSolve ? 'solve' : 'builder');
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      await loadProjects();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete project');
    }
  };

  const handleCloneTemplate = async (tpl: ModelTemplate) => {
    await handleCreateProject(
      tpl.title,
      tpl.category,
      tpl.summary,
      tpl.spec,
      'MODEL_CREATED',
      true,
    );
  };

  const handleExplainRun = async (runId: string, lang: 'en' | 'bn'): Promise<string> => {
    const res = await fetch('/api/ai/explain-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, language: lang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Explanation failed');
    if (projectDetail) {
      await loadProjectDetail(projectDetail.id);
    }
    return data.explanation;
  };

  const handleDebugInfeasible = async (runId: string, langCode: 'en' | 'bn'): Promise<string> => {
    const res = await fetch('/api/ai/debug-infeasible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, language: langCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Infeasibility debug failed');
    return data.diagnosis;
  };

  const handleAbortAiAutomation = () => {
    aiAbortControllerRef.current?.abort();
  };

  const handleExecuteAiAutomation = async (instruction: string) => {
    aiAbortControllerRef.current?.abort();
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    setAutopilotBusy(true);
    setErrorBanner(null);
    const id = `ai_${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const res = await fetch('/api/ai/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          instruction,
          uiLanguage: lang,
          uiCurrency: currency,
          activeProjectId: projectDetail?.id ?? null,
          params: solverParams,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI automation request failed');

      const auto = data as AiAutomationResponse;

      if (auto.targetLanguage) {
        setLang(auto.targetLanguage);
      }

      if (auto.deletedProjectId) {
        if (selectedProjectId === auto.deletedProjectId) {
          setSelectedProjectId(null);
          setProjectDetail(null);
          setDraftSpec(null);
        }
        await loadProjects();
      }

      if (auto.project) {
        const proj = auto.project;
        setCreatingProject(false);
        void loadProjects(proj.id);
        setSelectedProjectId(proj.id);
        setProjectDetail(proj);
        const latestVer = proj.versions[proj.versions.length - 1];
        if (latestVer) {
          setSelectedVersionId(latestVer.id);
          setDraftSpec(JSON.parse(JSON.stringify(latestVer.spec)));
          setIsDirty(false);
        }
        if (auto.run) {
          setSelectedRunId(auto.run.id);
        } else if (proj.runs[0]) {
          setSelectedRunId(proj.runs[0].id);
        }
      }

      if (auto.whatIfPayload) {
        setExternalWhatIf({ key: Date.now(), ...auto.whatIfPayload });
      }
      if (auto.transportationPayload) {
        setExternalAssignment(null);
        setExternalTransport({ key: Date.now(), ...auto.transportationPayload });
      }
      if (auto.assignmentPayload) {
        setExternalTransport(null);
        setExternalAssignment({ key: Date.now(), ...auto.assignmentPayload });
      }
      if (auto.batchPayload) {
        setExternalBatch({ key: Date.now(), ...auto.batchPayload });
      }

      if (auto.openUiAction === 'create_project') {
        handleOpenCreator();
      } else if (auto.openUiAction === 'examples_modal') {
        setTemplatesModalOpen(true);
      } else if (auto.targetTab) {
        setCreatingProject(false);
        setActiveTab(auto.targetTab);
      }

      if (auto.targetSubTab) {
        setCompareSubTab(auto.targetSubTab);
      }

      if (auto.actionType === 'START_PROJECT_DISCOVERY') {
        setDiscoveryTrigger({
          key: Date.now(),
          descriptionHint: auto.discoveryPrefill?.descriptionHint,
          category: auto.discoveryPrefill?.category,
          businessCategory: auto.discoveryPrefill?.businessCategory,
          sector: auto.discoveryPrefill?.sector,
        });
      }

      setAutopilotHistory((prev) => [{ id, instruction, timestamp, response: auto }, ...prev.slice(0, 14)]);
    } catch (err) {
      if ((err instanceof DOMException || err instanceof Error) && err.name === 'AbortError') {
        const stoppedResp: AiAutomationResponse = {
          actionType: 'NAVIGATE_AND_CONFIGURE',
          replyLanguage: lang,
          replyMessage:
            lang === 'bn' ? 'প্রক্রিয়াটি থামানো হয়েছে।' : 'Generation stopped.',
          steps: [],
        };
        setAutopilotHistory((prev) => [
          { id, instruction, timestamp, response: stoppedResp },
          ...prev.slice(0, 14),
        ]);
      } else {
        const msg = err instanceof Error ? err.message : 'AI automation failed';
        setAutopilotHistory((prev) => [{ id, instruction, timestamp, error: msg }, ...prev.slice(0, 14)]);
        if (!autopilotExpanded) {
          setErrorBanner(msg);
        }
      }
    } finally {
      if (aiAbortControllerRef.current === controller) {
        aiAbortControllerRef.current = null;
      }
      setAutopilotBusy(false);
    }
  };

  const handleProjectAnalyzeBuildSuccess = async (
    built: ProjectAnalyzeBuildResponse,
    userBriefLabel: string,
  ) => {
    const proj = built.project;
    setCreatingProject(false);
    void loadProjects(proj.id);
    setSelectedProjectId(proj.id);
    setProjectDetail(proj);

    const latestVer = proj.versions[proj.versions.length - 1];
    if (latestVer) {
      setSelectedVersionId(latestVer.id);
      setDraftSpec(JSON.parse(JSON.stringify(latestVer.spec)));
      setIsDirty(false);
    }
    if (built.run) {
      setSelectedRunId(built.run.id);
    } else if (proj.runs[0]) {
      setSelectedRunId(proj.runs[0].id);
    }
    setActiveTab(built.targetTab);

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const historyItem: AiCommandHistoryItem = {
      id: `ai_wiz_${Date.now()}`,
      instruction: userBriefLabel,
      timestamp,
      response: {
        actionType: 'CREATE_AND_SOLVE_PROJECT',
        replyMessage: built.replyMessage,
        replyLanguage: built.replyLanguage,
        steps: built.steps,
        reasoningSteps: built.reasoningSteps,
        reasoningDurationMs: built.reasoningDurationMs,
        analysisSummary: built.analysisSummary,
        project: built.project,
        run: built.run,
        explanation: built.explanation,
        targetTab: built.targetTab,
      },
    };
    setAutopilotHistory((prev) => [historyItem, ...prev.slice(0, 14)]);
  };

  const navItems: Array<{ id: NavTab; label: string; shortLabel: string; icon: typeof Layers }> = [
    { id: 'builder', label: t.nav.builder, shortLabel: lang === 'bn' ? 'স্টুডিও' : 'Studio', icon: Layers },
    { id: 'solve', label: t.nav.solve, shortLabel: lang === 'bn' ? 'সমাধান' : 'Solve', icon: Activity },
    { id: 'sensitivity', label: t.nav.sensitivity, shortLabel: lang === 'bn' ? 'সেন্সিটিভিটি' : 'Sensitivity', icon: Sliders },
    { id: 'transport', label: t.nav.transport, shortLabel: lang === 'bn' ? 'ট্রান্সপোর্ট' : 'Transport', icon: Truck },
    { id: 'compare', label: t.nav.compare, shortLabel: lang === 'bn' ? 'তুলনা' : 'Compare', icon: GitCompare },
  ];

  const isInitialLoading = booting || !projectsLoaded;

  const activeViewKey = isInitialLoading
    ? 'loading-initial'
    : showCreateStudio
      ? 'create-studio'
      : loadingProject && !isStandaloneToolActive && projects.length > 0
        ? 'loading-project'
        : `${selectedProjectId ?? 'none'}_${activeTab}_${activeTab === 'compare' ? compareSubTab : ''}`;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderEmptyProjectActionCard = (titleEn: string, titleBn: string) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="bg-white border-slate-200 rounded-2xl p-10 text-center space-y-4 ring-0 shadow-xs">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-slate-900">
            {lang === 'bn' ? titleBn : titleEn}
          </h2>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            {lang === 'bn'
              ? 'সমাধান ও গ্রাফ দেখার জন্য প্রথমে একটি নতুন প্রজেক্ট তৈরি করুন, Syston দিয়ে মডেল ড্রাফট করুন অথবা উদাহরণ টেমপ্লেট লোড করুন।'
              : 'Create your first optimization model, draft one with Syston, or load a ready-made example to solve and inspect results.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button
            type="button"
            onClick={handleOpenCreator}
            className="h-9 px-4 rounded-xl text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.actions.newProject}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAiModalOpen(true)}
            className="h-9 px-3.5 rounded-xl text-xs font-medium text-slate-800"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            {t.actions.aiDraft}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setTemplatesModalOpen(true)}
            className="h-9 px-3.5 rounded-xl text-xs font-medium text-slate-800"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-600" />
            {t.actions.examples}
          </Button>
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      <AnimatePresence>
        {isInitialLoading && <IconicPreloader lang={lang} />}
      </AnimatePresence>

      {/* Default Top Header Bar (Returns here automatically when scrolled back to top) */}
      <header className="h-14 bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-6 relative z-30 shrink-0">
        <motion.div
          animate={{
            opacity: isScrolled ? 0 : 1,
            y: isScrolled ? -8 : 0,
            pointerEvents: isScrolled ? 'none' : 'auto',
          }}
          transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="h-full flex items-center justify-between gap-2 sm:gap-4"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Top-Left Animated Nav Trigger (All screen sizes) */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 720, damping: 36, mass: 0.45 }}
              onClick={() => setLeftNavOpen((v) => !v)}
              aria-expanded={leftNavOpen}
              aria-label={lang === 'bn' ? 'প্রজেক্ট ও নেভিগেশন মেনু খুলুন' : 'Toggle navigation drawer'}
              className={`group flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 min-h-[38px] sm:min-h-0 rounded-xl border transition-colors duration-100 shrink-0 ${
                leftNavOpen
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
            >
              <span className="w-4 h-4 flex flex-col items-center justify-center gap-[3.5px] relative">
                <motion.span
                  animate={leftNavOpen ? { rotate: 45, y: 5.5 } : { rotate: 0, y: 0 }}
                  transition={{ type: 'spring', stiffness: 720, damping: 36, mass: 0.45 }}
                  className={`w-3.5 h-[1.75px] rounded-full block ${leftNavOpen ? 'bg-white' : 'bg-slate-700'}`}
                />
                <motion.span
                  animate={leftNavOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.08 }}
                  className={`w-3.5 h-[1.75px] rounded-full block ${leftNavOpen ? 'bg-white' : 'bg-teal-700'}`}
                />
                <motion.span
                  animate={leftNavOpen ? { rotate: -45, y: -5.5 } : { rotate: 0, y: 0 }}
                  transition={{ type: 'spring', stiffness: 720, damping: 36, mass: 0.45 }}
                  className={`w-3.5 h-[1.75px] rounded-full block ${leftNavOpen ? 'bg-white' : 'bg-slate-700'}`}
                />
              </span>
              <span className="hidden sm:inline text-xs font-semibold">
                {lang === 'bn' ? 'মেনু' : 'Menu'}
              </span>
              {projects.length > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                    leftNavOpen ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {projects.length}
                </span>
              )}
            </motion.button>

            <a
              href="/"
              className="inline-flex items-center gap-1.5 sm:gap-2 font-display text-sm sm:text-base font-bold tracking-tight text-slate-900 min-w-0"
            >
              <OrbitalThreeDots
                surface="light"
                stageSizeClass="w-7 h-7 shrink-0"
                dotSizeClass="w-1.5 h-1.5"
                restRadius={4.5}
                peakRadius={8.5}
                duration={1.4}
              />
              <span className="truncate">{t.brand}</span>
            </a>
          </div>

          <nav className="hidden md:flex items-center gap-5 lg:gap-6 shrink-0">
            {isInitialLoading
              ? [0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="h-4 w-20 rounded-md skeleton-shimmer" />
                ))
              : navItems.map((item) => {
                  const active = creatingProject
                    ? item.id === 'builder'
                    : activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNavTab(item.id)}
                      className={`relative py-4 text-xs font-medium transition-colors duration-100 whitespace-nowrap shrink-0 ${
                        active ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                      {active && (
                        <motion.span
                          layoutId="top-nav-underline"
                          transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                          className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-700 rounded-full"
                        />
                      )}
                    </button>
                  );
                })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isInitialLoading ? (
              <>
                <div className="hidden sm:block h-8 w-16 rounded-lg skeleton-shimmer" />
                <div className="hidden sm:block h-8 w-14 rounded-lg skeleton-shimmer" />
                <div className="h-8 w-20 rounded-lg skeleton-shimmer" />
                <div className="h-8 w-28 rounded-lg skeleton-shimmer" />
              </>
            ) : (
              <>
                {/* Quick Capital Currency Switch (BDT ৳ <-> USD $) */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={toggleCurrency}
                  title={t.sidebar.capitalCurrency}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span className="font-mono text-teal-700">{currency === 'BDT' ? '৳' : '$'}</span>
                  <span>{currency}</span>
                </motion.button>

                {/* Quick Language Switch */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={toggleLang}
                  className="hidden sm:inline-flex px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  {lang === 'en' ? 'বাংলা' : 'EN'}
                </motion.button>

                {activeVersion && !showCreateStudio ? (
                  <button
                    type="button"
                    disabled={solving}
                    onClick={handleExecuteSolve}
                    className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 min-h-[38px] sm:min-h-0 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-full transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{solving ? t.actions.solving : t.actions.solveModel}</span>
                  </button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={handleOpenCreator}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[38px] sm:min-h-0 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.actions.newProject}</span>
                  </motion.button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </header>

      {/* Scroll-Triggered Top-Right Rotary Wheel Menu (Filmora / Guest-Mode Circle Menubar on Hover or Click) */}
      <AnimatePresence>
        {isScrolled && floatingNavOpen && (
          <motion.div
            key="floating-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            onClick={closeFloatingWheel}
            className="fixed inset-0 z-40"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScrolled && (
          <motion.div
            key="floating-top-right-container"
            initial={{ opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 720, damping: 36, mass: 0.45 }}
            onMouseEnter={() => {
              clearFloatingLeaveTimer();
              if (!floatingNavOpen) {
                setFloatingNavOpen(true);
              }
            }}
            onMouseLeave={() => {
              if (floatingNavPinned) return;
              clearFloatingLeaveTimer();
              floatingNavLeaveTimerRef.current = window.setTimeout(() => {
                setFloatingNavOpen(false);
              }, 160);
            }}
            className="fixed top-2.5 sm:top-3 right-2.5 sm:right-5 z-50"
          >
            {/* Quarter-Circle Rotary Wheel Fan-out anchored behind the top-right trigger */}
            <AnimatePresence>
              {floatingNavOpen && (() => {
                const dialSize = floatingWheelCompact ? 268 : 308;
                const hubOffset = 24;
                const outerR = floatingWheelCompact ? 192 : 226;
                const innerR = floatingWheelCompact ? 104 : 124;
                const outerAngles = [171, 153, 135, 117, 99];
                const innerAngles = [166, 145, 125, 104];

                const utilityOrbs = [
                  {
                    id: 'solve_or_new',
                    label:
                      activeVersion && !showCreateStudio
                        ? solving
                          ? t.actions.solving
                          : lang === 'bn'
                            ? 'সমাধান'
                            : 'Solve'
                        : lang === 'bn'
                          ? 'নতুন'
                          : 'New',
                    active: false,
                    highlight: 'primary' as const,
                    onClick: () => {
                      if (activeVersion && !showCreateStudio) {
                        handleExecuteSolve();
                      } else {
                        handleOpenCreator();
                      }
                      closeFloatingWheel();
                    },
                    renderIcon: () =>
                      activeVersion && !showCreateStudio ? (
                        <Play className="w-4 h-4 fill-current" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      ),
                  },
                  {
                    id: 'syston_ai',
                    label: 'Syston',
                    active: autopilotExpanded,
                    highlight: 'ai' as const,
                    onClick: () => {
                      setAutopilotExpanded(true);
                      closeFloatingWheel();
                    },
                    renderIcon: () => (
                      <span className="w-6 h-6 rounded-full overflow-hidden bg-white border border-teal-200 flex items-center justify-center">
                        <OrbitalThreeDots
                          surface="light"
                          stageSizeClass="w-6 h-6"
                          dotSizeClass="w-[4.5px] h-[4.5px]"
                          restRadius={3.8}
                          peakRadius={6.5}
                        />
                      </span>
                    ),
                  },
                  {
                    id: 'share_ws',
                    label: t.actions.share,
                    active: false,
                    highlight: 'emerald' as const,
                    onClick: () => {
                      setShareModalOpen(true);
                      closeFloatingWheel();
                    },
                    renderIcon: () => <Share2 className="w-3.5 h-3.5" />,
                  },
                  {
                    id: 'toggle_lang',
                    label: lang === 'en' ? 'বাংলা' : 'EN',
                    active: false,
                    highlight: 'neutral' as const,
                    onClick: () => {
                      toggleLang();
                    },
                    renderIcon: () => <Languages className="w-3.5 h-3.5" />,
                  },
                ];

                return (
                  <motion.div
                    key="floating-quarter-wheel"
                    initial={{ rotate: -86, scale: 0.24, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: -78, scale: 0.24, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.5 }}
                    style={{
                      width: dialSize,
                      height: dialSize,
                      transformOrigin: `${dialSize - hubOffset}px ${hubOffset}px`,
                    }}
                    className="absolute top-0 right-0 pointer-events-auto select-none"
                  >
                    {/* Translucent Obsidian Quarter-Circle Dial Surface */}
                    <div
                      className="absolute inset-0 bg-slate-950/88 backdrop-blur-xl border border-teal-400/25 shadow-2xl shadow-slate-950/45"
                      style={{
                        borderRadius: `26px 26px 26px ${dialSize}px`,
                      }}
                    />

                    {/* Subtle Concentric Wheel Tracks & Perimeter Ticks */}
                    <svg
                      viewBox={`0 0 ${dialSize} ${dialSize}`}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      aria-hidden="true"
                    >
                      <circle
                        cx={dialSize - hubOffset}
                        cy={hubOffset}
                        r={outerR}
                        fill="none"
                        stroke="rgba(45,212,191,0.22)"
                        strokeWidth="1.25"
                        strokeDasharray="4 6"
                      />
                      <circle
                        cx={dialSize - hubOffset}
                        cy={hubOffset}
                        r={innerR}
                        fill="none"
                        stroke="rgba(255,255,255,0.14)"
                        strokeWidth="1"
                      />
                      {Array.from({ length: 19 }).map((_, idx) => {
                        const deg = 92 + idx * 4.5;
                        const rad = (deg * Math.PI) / 180;
                        const r1 = outerR + 18;
                        const r2 = idx % 3 === 0 ? outerR + 28 : outerR + 23;
                        const cx = dialSize - hubOffset;
                        const cy = hubOffset;
                        return (
                          <line
                            key={idx}
                            x1={cx + Math.cos(rad) * r1}
                            y1={cy + Math.sin(rad) * r1}
                            x2={cx + Math.cos(rad) * r2}
                            y2={cy + Math.sin(rad) * r2}
                            stroke={idx % 3 === 0 ? 'rgba(45,212,191,0.65)' : 'rgba(255,255,255,0.2)'}
                            strokeWidth={idx % 3 === 0 ? 1.75 : 1}
                            strokeLinecap="round"
                          />
                        );
                      })}
                    </svg>

                    {/* Outer Rotary Arc: 5 Primary Navigation Views */}
                    {navItems.map((item, idx) => {
                      const Icon = item.icon;
                      const active = creatingProject ? item.id === 'builder' : activeTab === item.id;
                      const rad = (outerAngles[idx] * Math.PI) / 180;
                      const xFromLeft = dialSize - hubOffset + Math.cos(rad) * outerR;
                      const yFromTop = hubOffset + Math.sin(rad) * outerR;

                      return (
                        <div
                          key={item.id}
                          style={{ left: xFromLeft, top: yFromTop }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                        >
                          <motion.button
                            type="button"
                            initial={{ scale: 0.45, rotate: -48, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 640,
                              damping: 32,
                              mass: 0.45,
                              delay: 0.015 + idx * 0.016,
                            }}
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => {
                              handleSelectNavTab(item.id);
                              closeFloatingWheel();
                            }}
                            title={item.label}
                            className="flex flex-col items-center group focus:outline-none"
                          >
                            <span
                              className={`w-9 h-9 sm:w-10.5 sm:h-10.5 rounded-full flex items-center justify-center border-2 transition-all shadow-lg ${
                                active
                                  ? 'bg-teal-400 border-white text-slate-950 ring-2 ring-teal-300/40'
                                  : 'bg-slate-900/95 border-slate-600/80 text-slate-100 group-hover:border-teal-400 group-hover:text-teal-300'
                              }`}
                            >
                              <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                            </span>
                            <span
                              className={`mt-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold whitespace-nowrap shadow ${
                                active
                                  ? 'bg-teal-400 text-slate-950'
                                  : 'bg-slate-900/95 text-slate-100 border border-white/15 group-hover:bg-white group-hover:text-slate-900'
                              }`}
                            >
                              {item.shortLabel}
                            </span>
                          </motion.button>
                        </div>
                      );
                    })}

                    {/* Inner Rotary Arc: 4 Quick Utility Orbs */}
                    {utilityOrbs.map((orb, idx) => {
                      const rad = (innerAngles[idx] * Math.PI) / 180;
                      const xFromLeft = dialSize - hubOffset + Math.cos(rad) * innerR;
                      const yFromTop = hubOffset + Math.sin(rad) * innerR;

                      const orbCircleStyle =
                        orb.highlight === 'primary'
                          ? 'bg-teal-600 border-teal-300 text-white hover:bg-teal-500'
                          : orb.highlight === 'ai'
                            ? 'bg-white border-teal-300 text-slate-900 hover:border-teal-400'
                            : orb.highlight === 'emerald'
                              ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-300 hover:border-emerald-300'
                              : 'bg-slate-800/95 border-slate-500/80 text-slate-100 hover:border-teal-400';

                      return (
                        <div
                          key={orb.id}
                          style={{ left: xFromLeft, top: yFromTop }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                        >
                          <motion.button
                            type="button"
                            initial={{ scale: 0.4, rotate: -35, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 640,
                              damping: 32,
                              mass: 0.45,
                              delay: 0.02 + idx * 0.014,
                            }}
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={orb.onClick}
                            title={orb.label}
                            className="flex flex-col items-center group focus:outline-none"
                          >
                            <span
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 transition-all shadow-md ${orbCircleStyle}`}
                            >
                              {orb.renderIcon()}
                            </span>
                            <span className="mt-0.5 px-1.5 py-px rounded-full text-[8.5px] sm:text-[9.5px] font-semibold whitespace-nowrap bg-slate-900/90 text-slate-100 border border-white/10 group-hover:bg-white group-hover:text-slate-900">
                              {orb.label}
                            </span>
                          </motion.button>
                        </div>
                      );
                    })}
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Top-Right Center Hub Trigger Pill / Close Orb */}
            <motion.button
              key="floating-nav-trigger"
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 720, damping: 36, mass: 0.45 }}
              onClick={() => {
                clearFloatingLeaveTimer();
                if (!floatingNavOpen) {
                  setFloatingNavOpen(true);
                  setFloatingNavPinned(true);
                } else if (!floatingNavPinned) {
                  setFloatingNavPinned(true);
                } else {
                  closeFloatingWheel();
                }
              }}
              aria-expanded={floatingNavOpen}
              aria-label={
                floatingNavOpen
                  ? lang === 'bn'
                    ? 'মেনু বন্ধ করুন'
                    : 'Close menu'
                  : lang === 'bn'
                    ? 'নেভিগেশন মেনু খুলুন'
                    : 'Open navigation menu'
              }
              className={`relative z-30 flex items-center gap-2 rounded-full transition-colors shadow-lg ${
                floatingNavOpen
                  ? 'w-11 h-11 justify-center bg-teal-500 hover:bg-teal-400 border-2 border-white text-slate-950 shadow-teal-950/30'
                  : 'bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-slate-900/10 hover:border-teal-600/50 pl-3 pr-3.5 py-2 text-xs font-semibold text-slate-900'
              }`}
            >
              {floatingNavOpen ? (
                <motion.span
                  initial={{ rotate: -90, scale: 0.7 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 680, damping: 30 }}
                  className="inline-flex items-center justify-center"
                >
                  <X className="w-4.5 h-4.5" />
                </motion.span>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    aria-hidden="true"
                    className="w-4 h-4 text-teal-700"
                  >
                    <path d="M14.5 5L7.5 12l7 7" />
                  </svg>
                  <span>{lang === 'bn' ? 'মেনু' : 'Menu'}</span>
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace + CapCut / Filmora Style Circle Wheel Navigation */}
      <div className="flex-1 flex min-h-0 relative">
        <RadialWheelNav
          open={leftNavOpen}
          projects={projects}
          selectedProjectId={selectedProjectId}
          creatingProject={showCreateStudio}
          activeTab={activeTab}
          hasActiveModel={Boolean(activeVersion)}
          solving={solving}
          onSelectTab={(tab) => {
            handleSelectNavTab(tab);
          }}
          onSelectProject={(id) => {
            setCreatingProject(false);
            setSelectedProjectId(id);
          }}
          onDeleteProject={handleDeleteProject}
          onOpenCreateProject={() => {
            handleOpenCreator();
          }}
          onOpenAiDraft={() => {
            setAiModalOpen(true);
          }}
          onOpenTemplates={() => {
            setTemplatesModalOpen(true);
          }}
          onOpenShare={() => {
            setShareModalOpen(true);
          }}
          onExecuteSolve={() => {
            handleExecuteSolve();
          }}
          onClose={() => setLeftNavOpen(false)}
        />

        {/* Primary Viewport */}
        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[1220px] mx-auto px-3 pt-3 pb-24 sm:p-5 sm:pb-24 lg:p-6 lg:pb-10 space-y-4 sm:space-y-5">
            {/* Mobile-First Touch Navigation Strip + Quick Settings Bar */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto no-scrollbar">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = creatingProject
                    ? item.id === 'builder'
                    : activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNavTab(item.id)}
                      className={`relative flex items-center gap-1.5 px-3 min-h-[38px] text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors duration-100 ${
                        active ? 'text-white font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="mobile-nav-pill"
                          transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                          className="absolute inset-0 bg-slate-900 rounded-lg"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="sm:hidden flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleCurrency}
                  className="px-2.5 min-h-[36px] text-xs font-semibold font-mono bg-white border border-slate-200 rounded-xl text-slate-800 whitespace-nowrap hover:bg-slate-50"
                >
                  {currency === 'BDT' ? '৳ BDT' : '$ USD'}
                </button>
                <button
                  type="button"
                  onClick={toggleLang}
                  className="px-2.5 min-h-[36px] text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 whitespace-nowrap hover:bg-slate-50"
                >
                  {lang === 'en' ? 'বাংলা' : 'EN'}
                </button>
              </div>
            </div>

            {errorBanner && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800 flex items-center justify-between gap-2">
                <span>{errorBanner}</span>
                <button type="button" onClick={() => setErrorBanner(null)} className="font-semibold underline shrink-0">
                  {t.actions.dismiss}
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeViewKey}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4 sm:space-y-5"
              >
                {isInitialLoading ? (
                  <InitialWorkspaceSkeleton
                    label={
                      lang === 'bn'
                        ? 'Systonic Linear Desc · ওয়ার্কস্পেস লোড হচ্ছে...'
                        : 'Systonic Linear Desc · Initializing Workspace...'
                    }
                  />
                ) : showCreateStudio ? (
                  <CreateProjectStudio
                    hasExistingProjects={projects.length > 0}
                    onCancel={() => setCreatingProject(false)}
                    onCreateProject={async (p) => {
                      await handleCreateProject(
                        p.name,
                        p.domain || 'Custom',
                        p.description,
                        p.spec,
                        p.actionType,
                        p.autoSolve,
                      );
                    }}
                    onJumpToTransport={() => handleSelectNavTab('transport')}
                    onJumpToBatch={() => {
                      setCreatingProject(false);
                      setActiveTab('compare');
                      setCompareSubTab('batch');
                    }}
                  />
                ) : (
                  <>
                    {/* Contextual Project & Immutable Version Sub-Header */}
                    {projectDetail && !isStandaloneToolActive && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-200">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-500">
                            <span>{projectDetail.domain}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{activeVersion?.validation.problemClass ?? 'LP'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{lang === 'bn' ? 'আপডেট:' : 'Updated'} {fmtDate(projectDetail.updatedAt)}</span>
                          </div>
                          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight break-words">
                            {projectDetail.name}
                          </h1>
                          <p className="text-xs text-slate-600 max-w-3xl">{projectDetail.description}</p>
                        </div>

                        <div className="flex items-center gap-2 text-xs w-full sm:w-auto min-w-0">
                          <span className="text-slate-500 shrink-0">{lang === 'bn' ? 'ভার্সন:' : 'Version:'}</span>
                          <select
                            value={activeVersion?.id ?? ''}
                            onChange={(e) => handleSelectVersion(e.target.value)}
                            className="flex-1 sm:flex-initial min-w-0 max-w-full px-3 py-1.5 min-h-[38px] sm:min-h-0 font-mono bg-white border border-slate-200 rounded-lg text-slate-900 truncate"
                          >
                            {projectDetail.versions
                              .slice()
                              .reverse()
                              .map((v) => (
                                <option key={v.id} value={v.id}>
                                  v{v.versionNumber} ({v.hash}) — {v.commitMessage}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {loadingProject && !isStandaloneToolActive && projects.length > 0 ? (
                      <ProjectDetailSkeleton />
                    ) : (
                      <>
                        {activeTab === 'builder' && (
                          draftSpec && activeVersion ? (
                            <ModelBuilder
                              spec={draftSpec}
                              isDirty={isDirty}
                              versionNumber={activeVersion.versionNumber}
                              versionId={activeVersion.id}
                              onChangeSpec={handleChangeDraftSpec}
                              onRevertDraft={handleRevertDraft}
                              onCommitVersion={(msg) => handleCommitVersion(msg)}
                              onExcelImportedSpec={(imported, filename) =>
                                handleSolveLatestAfterCommit(imported, `Imported Excel workbook: ${filename}`, 'EXCEL_IMPORTED')
                              }
                              committing={committing}
                            />
                          ) : (
                            renderEmptyProjectActionCard(
                              'No Active Project Selected Yet',
                              'এখনো কোনো প্রজেক্ট তৈরি হয়নি',
                            )
                          )
                        )}

                        {activeTab === 'solve' && (
                          draftSpec ? (
                            <SolveWorkspace
                              spec={draftSpec}
                              activeRun={activeRun}
                              runs={projectDetail?.runs ?? []}
                              onSelectRun={(id) => setSelectedRunId(id)}
                              solverParams={solverParams}
                              onChangeParams={setSolverParams}
                              onExecuteSolve={handleExecuteSolve}
                              solving={solving}
                              isDirty={isDirty}
                              onJumpToIis={() => setActiveTab('sensitivity')}
                              onExplainRun={handleExplainRun}
                              onOpenShare={() => setShareModalOpen(true)}
                            />
                          ) : (
                            renderEmptyProjectActionCard(
                              'Solve & Visual Graphs Workspace',
                              'সমাধান ও গ্রাফ ওয়ার্কস্পেস',
                            )
                          )
                        )}

                        {activeTab === 'sensitivity' && (
                          draftSpec ? (
                            <SensitivityAndIis
                              spec={draftSpec}
                              activeRun={activeRun}
                              onApplyMinimalRelaxation={(nextSpec, msg) =>
                                handleSolveLatestAfterCommit(nextSpec, msg, 'MODEL_VERSIONED')
                              }
                              onDebugInfeasible={handleDebugInfeasible}
                            />
                          ) : (
                            renderEmptyProjectActionCard(
                              'Sensitivity Analysis & IIS Conflict Diagnostics',
                              'সেন্সিটিভিটি ও IIS ডায়াগনস্টিকস',
                            )
                          )
                        )}

                        {activeTab === 'transport' && (
                          <TransportationStudio
                            externalTransport={externalTransport}
                            externalAssignment={externalAssignment}
                          />
                        )}

                        {activeTab === 'compare' && (
                          <div className="space-y-5">
                            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg w-full sm:w-fit overflow-x-auto no-scrollbar text-xs">
                              <button
                                type="button"
                                onClick={() => setCompareSubTab('whatif')}
                                className={`relative px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                                  compareSubTab === 'whatif' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {compareSubTab === 'whatif' && (
                                  <motion.span
                                    layoutId="compare-subtab-pill"
                                    transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                                    className="absolute inset-0 bg-slate-900 rounded-md"
                                  />
                                )}
                                <span className="relative z-10">{t.compare.tabWhatIf}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompareSubTab('batch')}
                                className={`relative px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                                  compareSubTab === 'batch' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {compareSubTab === 'batch' && (
                                  <motion.span
                                    layoutId="compare-subtab-pill"
                                    transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                                    className="absolute inset-0 bg-slate-900 rounded-md"
                                  />
                                )}
                                <span className="relative z-10">{t.compare.tabBatch}</span>
                              </button>
                            </div>

                            {compareSubTab === 'whatif' && (
                              draftSpec && activeVersion ? (
                                <ScenarioCompare
                                  spec={draftSpec}
                                  versionId={activeVersion.id}
                                  runs={projectDetail?.runs ?? []}
                                  externalWhatIf={externalWhatIf}
                                />
                              ) : (
                                renderEmptyProjectActionCard(
                                  'Create a Project First to Run What-If & Scenario Comparisons',
                                  'What-If ও তুলনামূলক বিশ্লেষণ চালাতে প্রথমে একটি প্রজেক্ট তৈরি করুন',
                                )
                              )
                            )}
                            {compareSubTab === 'batch' && (
                              <BatchAndApiPanel externalBatch={externalBatch} />
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AiDraftModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        hasActiveProject={Boolean(projectDetail)}
        onConfirmAsNewProject={async (spec) => {
          await handleCreateProject(
            spec.name,
            spec.domain || 'Custom',
            spec.description || 'AI-drafted optimization model',
            spec,
            'AI_SPEC_CONFIRMED',
            true,
          );
        }}
        onConfirmAsNewVersion={async (spec, msg) => {
          await handleSolveLatestAfterCommit(spec, msg, 'AI_SPEC_CONFIRMED');
        }}
      />

      <TemplatesModal
        open={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={handleCloneTemplate}
      />

      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        projectId={selectedProjectId}
        spec={draftSpec}
        activeRun={activeRun}
      />

      {/* Bottom-Right Animated Framing & Waving Syton AI Chat Bubble */}
      <AiAutopilotConsole
        expanded={autopilotExpanded}
        onToggleExpand={() => setAutopilotExpanded((v) => !v)}
        busy={autopilotBusy}
        history={autopilotHistory}
        onExecuteInstruction={handleExecuteAiAutomation}
        onAbortInstruction={handleAbortAiAutomation}
        hasActiveProject={Boolean(projectDetail)}
        activeProjectName={projectDetail?.name ?? null}
        onClearHistory={() => setAutopilotHistory([])}
        discoveryTrigger={discoveryTrigger}
        solverParams={solverParams}
        onProjectAnalyzeBuildSuccess={handleProjectAnalyzeBuildSuccess}
      />

      <Toaster position="bottom-left" richColors closeButton />
    </div>
  );
}
