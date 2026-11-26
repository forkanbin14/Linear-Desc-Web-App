import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Cpu,
  Hand,
  Languages,
  Maximize2,
  Mic,
  Minimize2,
  RotateCcw,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { OrbitalThreeDots, SingleDotOrbit } from './IconicPreloader.tsx';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type {
  AiAutomationResponse,
  ProjectAnalyzeBuildResponse,
  ProjectDiscoveryIntake,
  ReasoningAnswerItem,
  SolverParams,
} from '../shared/types.ts';

function SytonAiAvatar({
  className = '',
  size = 'sm',
  busy = false,
}: {
  className?: string;
  size?: 'sm' | 'md';
  busy?: boolean;
}) {
  return (
    <div
      aria-label="Syston"
      className={`overflow-hidden bg-white flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {size === 'md' ? (
        <OrbitalThreeDots
          surface="light"
          stageSizeClass="w-8 h-8"
          dotSizeClass="w-1.5 h-1.5"
          restRadius={5.5}
          peakRadius={9.5}
          duration={busy ? 0.85 : 1.25}
        />
      ) : (
        <OrbitalThreeDots
          surface="light"
          stageSizeClass="w-7 h-7"
          dotSizeClass="w-[5px] h-[5px]"
          restRadius={4.2}
          peakRadius={7.4}
          duration={busy ? 0.85 : 1.25}
        />
      )}
    </div>
  );
}

function LiveReasoningProcessCard({
  mode,
  lang,
}: {
  mode: 'command' | 'project_build';
  lang: 'en' | 'bn';
  currency?: 'BDT' | 'USD';
  contextText?: string;
  intakeSummary?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.14 }}
      className="flex items-start gap-2.5"
    >
      <div className="relative w-7 h-7 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-teal-500/40">
        <motion.span
          animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-xl border border-teal-400/60 pointer-events-none"
        />
        <SingleDotOrbit
          surface="dark"
          stageSizeClass="w-6 h-6"
          dotSizeClass="w-2 h-2"
          radius={7}
          duration={0.9}
        />
      </div>

      <div className="inline-flex items-center bg-white border border-teal-200/90 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-xs">
        <motion.span
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-xs font-semibold text-slate-800"
        >
          {mode === 'project_build'
            ? lang === 'bn'
              ? 'Syston প্রজেক্ট তৈরি করছে...'
              : 'Syston is building...'
            : lang === 'bn'
              ? 'Syston চিন্তা করছে...'
              : 'Syston is thinking...'}
        </motion.span>
      </div>
    </motion.div>
  );
}

export interface AiCommandHistoryItem {
  id: string;
  instruction: string;
  timestamp: string;
  response?: AiAutomationResponse;
  error?: string;
}

export interface ProjectDiscoveryTrigger {
  key: number;
  descriptionHint?: string;
  category?: string;
  businessCategory?: string;
  sector?: string;
}

interface AiAutopilotConsoleProps {
  expanded: boolean;
  onToggleExpand: () => void;
  busy: boolean;
  history: AiCommandHistoryItem[];
  onExecuteInstruction: (instruction: string) => Promise<void>;
  onAbortInstruction?: () => void;
  hasActiveProject: boolean;
  activeProjectName?: string | null;
  onClearHistory?: () => void;
  discoveryTrigger?: ProjectDiscoveryTrigger | null;
  solverParams?: SolverParams;
  onProjectAnalyzeBuildSuccess?: (
    result: ProjectAnalyzeBuildResponse,
    userBriefLabel: string,
  ) => Promise<void> | void;
}

interface SelectOption {
  value: string;
  en: string;
  bn: string;
}

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'Production & Manufacturing', en: 'Production & LP', bn: 'উৎপাদন ও LP' },
  { value: 'Finance & Budget', en: 'Finance & Budget', bn: 'ফাইন্যান্স ও বাজেট' },
  { value: 'Supply Chain & Logistics', en: 'Supply Chain', bn: 'সাপ্লাই চেইন' },
  { value: 'Operations & Scheduling', en: 'Operations', bn: 'অপারেশনস' },
  { value: 'Portfolio & Investment', en: 'Portfolio (QP)', bn: 'পোর্টফোলিও (QP)' },
  { value: 'Risk & Credit', en: 'Risk & Credit', bn: 'ঝুঁকি ও ক্রেডিট' },
];

const DIFFICULTY_OPTIONS: SelectOption[] = [
  { value: 'Beginner', en: 'Beginner', bn: 'সহজ (Beginner)' },
  { value: 'Intermediate', en: 'Intermediate', bn: 'মধ্যম (Intermediate)' },
  { value: 'Advanced', en: 'Advanced', bn: 'উন্নত (Advanced)' },
  { value: 'Enterprise', en: 'Enterprise', bn: 'এন্টারপ্রাইজ' },
];

const LEVEL_OPTIONS: SelectOption[] = [
  { value: 'Academic / HSC & University', en: 'Academic / HSC', bn: 'একাডেমিক / HSC' },
  { value: 'Startup / SME Business', en: 'Startup / SME', bn: 'স্টার্টআপ / SME' },
  { value: 'Industrial Plant Scale', en: 'Industrial Scale', bn: 'ইন্ডাস্ট্রিয়াল স্কেল' },
  { value: 'Corporate Portfolio', en: 'Corporate', bn: 'কর্পোরেট' },
];

const QUANTITY_OPTIONS: SelectOption[] = [
  { value: 'Small (2-3 Decision Variables)', en: 'Small (2–3 vars)', bn: 'ছোট (২–৩ ভেরিয়েবল)' },
  { value: 'Medium (4-5 Decision Variables)', en: 'Medium (4–5 vars)', bn: 'মাঝারি (৪–৫ ভেরিয়েবল)' },
  { value: 'Large (6-8 Decision Variables)', en: 'Large (6–8 vars)', bn: 'বড় (৬–৮ ভেরিয়েবল)' },
  { value: 'Multi-Unit Batch Scale', en: 'Multi-Unit Scale', bn: 'মাল্টি-ইউনিট স্কেল' },
];

const BUSINESS_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'Manufacturing', en: 'Manufacturing', bn: 'উৎপাদন শিল্প' },
  { value: 'Retail & E-Commerce', en: 'Retail & E-Com', bn: 'রিটেইল ও ই-কমার্স' },
  { value: 'Logistics & Fleet', en: 'Logistics', bn: 'লজিস্টিকস' },
  { value: 'Financial Services', en: 'Financial', bn: 'আর্থিক সেবা' },
  { value: 'Service & Workforce', en: 'Service / Staff', bn: 'সার্ভিস ও জনবল' },
  { value: 'Agribusiness', en: 'Agribusiness', bn: 'কৃষি ব্যবসা' },
];

const SECTOR_OPTIONS: SelectOption[] = [
  { value: 'Garments & Textile', en: 'Garments & Textile', bn: 'গার্মেন্টস ও টেক্সটাইল' },
  { value: 'FMCG & Food', en: 'FMCG & Food', bn: 'খাদ্য ও FMCG' },
  { value: 'Healthcare & Pharma', en: 'Healthcare & Pharma', bn: 'স্বাস্থ্য ও ফার্মা' },
  { value: 'Energy & Power', en: 'Energy & Power', bn: 'বিদ্যুৎ ও জ্বালানি' },
  { value: 'IT & SaaS', en: 'IT & SaaS', bn: 'আইটি ও সফটওয়্যার' },
  { value: 'Agriculture & Dairy', en: 'Agriculture & Dairy', bn: 'কৃষি ও ডেইরি' },
];

const GOAL_SCOPE_OPTIONS: SelectOption[] = [
  {
    value: 'Maximize Profit within Capital & Resource Limits',
    en: 'Maximize Profit',
    bn: 'সর্বোচ্চ মুনাফা (বাজেটের মধ্যে)',
  },
  {
    value: 'Minimize Total Operating, Production & Logistics Cost',
    en: 'Minimize Total Cost',
    bn: 'সর্বনিম্ন উৎপাদন ও পরিবহন খরচ',
  },
  {
    value: 'Optimize Resource Allocation & Meet Minimum Demand',
    en: 'Resource & Demand Balance',
    bn: 'সর্বোচ্চ আউটপুট ও ডিমান্ড পূরণ',
  },
  {
    value: 'Balanced Risk-Adjusted Return & Safety Reserve',
    en: 'Risk vs Return Balance',
    bn: 'ঝুঁকি নিয়ন্ত্রণ ও ব্যালেন্সড রিটার্ন',
  },
];

type IntakeFieldKey =
  | 'category'
  | 'difficulty'
  | 'level'
  | 'quantity'
  | 'businessCategory'
  | 'sector'
  | 'goalScope'
  | 'description';

interface IntakeStepDef {
  key: Exclude<IntakeFieldKey, 'description'>;
  labelEn: string;
  labelBn: string;
  questionEn: string;
  questionBn: string;
  options: SelectOption[];
}

const INTAKE_STEPS: IntakeStepDef[] = [
  {
    key: 'category',
    labelEn: 'Category',
    labelBn: 'ক্যাটাগরি',
    questionEn:
      'Great! Let’s build your project in 7 quick steps, then submit your Project Description.\n\nStep 1/7 — Choose or type the **Category**:',
    questionBn:
      'দারুণ! চলুন ৭টি ধাপে প্রজেক্টের তথ্য সাজাই, তারপর প্রজেক্টের বর্ণনা লিখে সাবমিট করলে প্রজেক্ট তৈরি হবে।\n\nধাপ ১/৭ — প্রথমে প্রজেক্টের **ক্যাটাগরি (Category)** সিলেক্ট করুন বা মেসেজে লিখুন:',
    options: CATEGORY_OPTIONS,
  },
  {
    key: 'difficulty',
    labelEn: 'Difficulty',
    labelBn: 'ডিফিকাল্টি',
    questionEn: 'Step 2/7 — Choose or type the **Difficulty** level:',
    questionBn: 'ধাপ ২/৭ — প্রজেক্টের **ডিফিকাল্টি (Difficulty)** কোন পর্যায়ের হবে?',
    options: DIFFICULTY_OPTIONS,
  },
  {
    key: 'level',
    labelEn: 'Level',
    labelBn: 'লেভেল',
    questionEn: 'Step 3/7 — Choose or type your **Project Level**:',
    questionBn: 'ধাপ ৩/৭ — প্রজেক্টের **লেভেল (Level)** কোনটি হবে?',
    options: LEVEL_OPTIONS,
  },
  {
    key: 'quantity',
    labelEn: 'Quantity',
    labelBn: 'পরিমাণ / স্কেল',
    questionEn: 'Step 4/7 — What **Quantity / Scale** (variables or batch size) should I model?',
    questionBn: 'ধাপ ৪/৭ — প্রজেক্টের **পরিমাণ বা স্কেল (Quantity)** কত বড় হবে?',
    options: QUANTITY_OPTIONS,
  },
  {
    key: 'businessCategory',
    labelEn: 'Business Category',
    labelBn: 'ব্যবসার ধরন',
    questionEn: 'Step 5/7 — Select or type your **Business Category**:',
    questionBn: 'ধাপ ৫/৭ — আপনার **ব্যবসার ধরন (Business Category)** কোনটি?',
    options: BUSINESS_CATEGORY_OPTIONS,
  },
  {
    key: 'sector',
    labelEn: 'Sector',
    labelBn: 'সেক্টর',
    questionEn: 'Step 6/7 — Which **Sector** is your project in?',
    questionBn: 'ধাপ ৬/৭ — আপনার প্রজেক্টের **সেক্টর (Sector)** কোনটি?',
    options: SECTOR_OPTIONS,
  },
  {
    key: 'goalScope',
    labelEn: 'Goal & Budget Scope',
    labelBn: 'মূল লক্ষ্য ও বাজেট',
    questionEn:
      'Step 7/7 — Choose or type your **Optimization Goal & Budget/Reasoning Scope** (last setup step before your Description):',
    questionBn:
      'ধাপ ৭/৭ — শেষ ধাপ: আপনার **মূল লক্ষ্য ও বাজেট/রিজনিং সীমা** সিলেক্ট করুন বা মেসেজে লিখুন:',
    options: GOAL_SCOPE_OPTIONS,
  },
];

interface InterviewTurn {
  id: string;
  sender: 'user' | 'mr-error';
  text: string;
  timestamp: string;
  stepBadge?: string;
  hint?: string;
  options?: Array<{ label: string; value: string }>;
  answered?: boolean;
}

type InterviewStage =
  | 'idle'
  | 'intake_step'
  | 'final_description'
  | 'building_project';

export function AiAutopilotConsole({
  expanded,
  onToggleExpand,
  busy,
  history,
  onExecuteInstruction,
  onAbortInstruction,
  hasActiveProject: _hasActiveProject,
  activeProjectName: _activeProjectName,
  onClearHistory,
  discoveryTrigger,
  solverParams,
  onProjectAnalyzeBuildSuccess,
}: AiAutopilotConsoleProps) {
  const { lang, toggleLang, currency, toggleCurrency, t } = useLanguage();
  const [input, setInput] = useState('');
  const [activeCommandText, setActiveCommandText] = useState('');
  const [hoveredBubble, setHoveredBubble] = useState(false);
  const [theaterWide, setTheaterWide] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [bubbleOnLeft, setBubbleOnLeft] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'recording' | 'transcribing'>('idle');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const constraintsRef = useRef<HTMLDivElement | null>(null);
  const didDragRef = useRef(false);
  const buildAbortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<{
    stop: () => void;
    abort?: () => void;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const baseVoiceTextRef = useRef('');

  const bubbleX = useMotionValue(0);
  const bubbleY = useMotionValue(0);

  const clampBubbleOffset = (rawX: number, rawY: number) => {
    if (typeof window === 'undefined') return { x: rawX, y: rawY };
    const margin = window.innerWidth >= 640 ? 40 : 24;
    const bubbleSize = 58;
    const minX = -Math.max(0, window.innerWidth - bubbleSize - margin);
    const minY = -Math.max(0, window.innerHeight - bubbleSize - margin);
    return {
      x: Math.min(0, Math.max(minX, rawX)),
      y: Math.min(0, Math.max(minY, rawY)),
    };
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('syton_bubble_pos');
      if (saved) {
        const parsed = JSON.parse(saved) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clamped = clampBubbleOffset(parsed.x, parsed.y);
          bubbleX.set(clamped.x);
          bubbleY.set(clamped.y);
          setBubbleOnLeft(clamped.x < -window.innerWidth * 0.45);
        }
      }
    } catch {
      // Ignore storage errors
    }

    const handleResize = () => {
      const clamped = clampBubbleOffset(bubbleX.get(), bubbleY.get());
      animate(bubbleX, clamped.x, { type: 'spring', stiffness: 420, damping: 30, mass: 0.65 });
      animate(bubbleY, clamped.y, { type: 'spring', stiffness: 420, damping: 30, mass: 0.65 });
      setBubbleOnLeft(clamped.x < -window.innerWidth * 0.45);
    };

    let saveTimer: number | undefined;
    const syncSettled = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        const clamped = clampBubbleOffset(bubbleX.get(), bubbleY.get());
        setBubbleOnLeft(clamped.x < -window.innerWidth * 0.45);
        try {
          localStorage.setItem('syton_bubble_pos', JSON.stringify(clamped));
        } catch {
          // Ignore storage errors
        }
      }, 150);
    };

    const unsubX = bubbleX.on('change', syncSettled);
    const unsubY = bubbleY.on('change', syncSettled);

    window.addEventListener('resize', handleResize);
    return () => {
      window.clearTimeout(saveTimer);
      unsubX();
      unsubY();
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guided 7-Step Setup + Final Project Description Chat Flow
  const [interviewStage, setInterviewStage] = useState<InterviewStage>('idle');
  const [interviewTurns, setInterviewTurns] = useState<InterviewTurn[]>([]);
  const [intakeStepIdx, setIntakeStepIdx] = useState(0);
  const [descriptionHint, setDescriptionHint] = useState<string | undefined>(undefined);
  const [intakeData, setIntakeData] = useState<Record<IntakeFieldKey, string>>({
    category: '',
    difficulty: '',
    level: '',
    quantity: '',
    businessCategory: '',
    sector: '',
    goalScope: '',
    description: '',
  });
  const [retryAction, setRetryAction] = useState<'build' | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const isInterviewBusy = interviewStage === 'building_project';
  const isInterviewActive = interviewStage !== 'idle';

  // Reverse chronological history is stored newest-first; render oldest -> newest inside chat
  const chronologicalHistory = history.slice().reverse();

  const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const makeStepOptions = (
    step: IntakeStepDef,
    uiLang: 'en' | 'bn',
    suggestedValue?: string,
  ): Array<{ label: string; value: string }> => {
    const mapped = step.options.map((opt) => ({
      label: uiLang === 'bn' ? opt.bn : opt.en,
      value: opt.value,
    }));
    if (suggestedValue) {
      const idx = mapped.findIndex((m) => m.value === suggestedValue);
      if (idx > 0) {
        const [found] = mapped.splice(idx, 1);
        mapped.unshift({
          label: `${found.label} (${uiLang === 'bn' ? 'প্রস্তাবিত' : 'Suggested'})`,
          value: found.value,
        });
      }
    }
    return mapped;
  };

  const resetInterview = () => {
    setInterviewStage('idle');
    setInterviewTurns([]);
    setIntakeStepIdx(0);
    setDescriptionHint(undefined);
    setIntakeData({
      category: '',
      difficulty: '',
      level: '',
      quantity: '',
      businessCategory: '',
      sector: '',
      goalScope: '',
      description: '',
    });
    setRetryAction(null);
    setWizardError(null);
  };

  const startConversationalInterview = (prefill?: {
    descriptionHint?: string;
    category?: string;
    businessCategory?: string;
    sector?: string;
  }) => {
    const firstStep = INTAKE_STEPS[0];
    setWizardError(null);
    setRetryAction(null);
    setDescriptionHint(prefill?.descriptionHint);
    setIntakeData({
      category: prefill?.category || '',
      difficulty: '',
      level: '',
      quantity: '',
      businessCategory: prefill?.businessCategory || '',
      sector: prefill?.sector || '',
      goalScope: '',
      description: '',
    });
    setIntakeStepIdx(0);
    setInterviewTurns([
      {
        id: `mre_step0_${Date.now()}`,
        sender: 'mr-error',
        text: lang === 'bn' ? firstStep.questionBn : firstStep.questionEn,
        timestamp: nowTime(),
        stepBadge: lang === 'bn' ? 'ধাপ ১/৭ · ক্যাটাগরি' : 'Step 1/7 · Category',
        options: makeStepOptions(firstStep, lang, prefill?.category),
        answered: false,
      },
    ]);
    setInterviewStage('intake_step');
  };

  useEffect(() => {
    if (discoveryTrigger && discoveryTrigger.key > 0) {
      startConversationalInterview(discoveryTrigger);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryTrigger]);

  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [expanded, history.length, busy, interviewTurns.length, interviewStage, wizardError]);

  const executeAnalyzeAndBuildStepByStep = async (completedIntake: Record<IntakeFieldKey, string>) => {
    setWizardError(null);
    setRetryAction(null);
    setInterviewStage('building_project');
    try {
      const intakePayload: ProjectDiscoveryIntake = {
        description: completedIntake.description,
        category: completedIntake.category,
        difficulty: completedIntake.difficulty,
        level: completedIntake.level,
        quantity: completedIntake.quantity,
        businessCategory: completedIntake.businessCategory,
        sector: completedIntake.sector,
        currency,
        language: lang,
      };

      const answersPayload: ReasoningAnswerItem[] = completedIntake.goalScope
        ? [
            {
              id: 'step7_goal_scope',
              question: 'Primary Optimization Goal & Capital/Reasoning Scope',
              answer: completedIntake.goalScope,
            },
          ]
        : [];

      buildAbortRef.current?.abort();
      const controller = new AbortController();
      buildAbortRef.current = controller;

      const res = await fetch('/api/ai/project-analyze-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          intake: intakePayload,
          answers: answersPayload,
          params: solverParams,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze and build project');

      const built = data as ProjectAnalyzeBuildResponse;
      const briefLabel = `${completedIntake.description} (${completedIntake.sector} · ${completedIntake.category} · ${completedIntake.difficulty} · ${completedIntake.level})`;

      if (onProjectAnalyzeBuildSuccess) {
        await onProjectAnalyzeBuildSuccess(built, briefLabel);
      }

      toast.success(
        lang === 'bn'
          ? `Syston "${built.project.name}" তৈরি ও সমাধান করেছে!`
          : `Syston built & solved "${built.project.name}"!`,
      );
      resetInterview();
    } catch (err) {
      if ((err instanceof DOMException || err instanceof Error) && err.name === 'AbortError') {
        setWizardError(null);
        setRetryAction(null);
        setInterviewStage('final_description');
      } else {
        setWizardError(err instanceof Error ? err.message : 'Failed to analyze and build project');
        setRetryAction('build');
        setInterviewStage('final_description');
      }
    } finally {
      buildAbortRef.current = null;
    }
  };

  const handleInterviewUserReply = async (rawValue: string, displayLabel?: string) => {
    const val = rawValue.trim();
    const userDisplay = (displayLabel ?? val).trim();
    if (!val || isInterviewBusy || retryAction !== null) return;

    const userMsg: InterviewTurn = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: userDisplay,
      timestamp: nowTime(),
    };

    if (interviewStage === 'intake_step') {
      const currentStep = INTAKE_STEPS[intakeStepIdx];
      const updatedIntake: Record<IntakeFieldKey, string> = {
        ...intakeData,
        [currentStep.key]: val,
      };
      setIntakeData(updatedIntake);

      const nextIdx = intakeStepIdx + 1;
      if (nextIdx < INTAKE_STEPS.length) {
        const nextStep = INTAKE_STEPS[nextIdx];
        const suggested =
          nextStep.key === 'businessCategory'
            ? updatedIntake.businessCategory
            : nextStep.key === 'sector'
              ? updatedIntake.sector
              : nextStep.key === 'category'
                ? updatedIntake.category
                : undefined;

        const nextQuestionTurn: InterviewTurn = {
          id: `mre_step_${nextIdx}_${Date.now()}`,
          sender: 'mr-error',
          text: lang === 'bn' ? nextStep.questionBn : nextStep.questionEn,
          timestamp: nowTime(),
          stepBadge:
            lang === 'bn'
              ? `ধাপ ${nextIdx + 1}/7 · ${nextStep.labelBn}`
              : `Step ${nextIdx + 1}/7 · ${nextStep.labelEn}`,
          options: makeStepOptions(nextStep, lang, suggested),
          answered: false,
        };
        setIntakeStepIdx(nextIdx);
        setInterviewTurns((prev) => [
          ...prev.map((m) => ({ ...m, answered: true })),
          userMsg,
          nextQuestionTurn,
        ]);
      } else {
        // All 7 steps completed -> Ask for final Project Description submission!
        const recapBn =
          `চমৎকার! ৭টি ধাপ সফলভাবে পূরণ হয়েছে:\n` +
          `১) ক্যাটাগরি: ${updatedIntake.category}\n` +
          `২) ডিফিকাল্টি: ${updatedIntake.difficulty}\n` +
          `৩) লেভেল: ${updatedIntake.level}\n` +
          `৪) পরিমাণ: ${updatedIntake.quantity}\n` +
          `৫) ব্যবসার ধরন: ${updatedIntake.businessCategory}\n` +
          `৬) সেক্টর: ${updatedIntake.sector}\n` +
          `৭) লক্ষ্য/বাজেট: ${updatedIntake.goalScope}\n\n` +
          `এখন আপনার **প্রজেক্টের পূর্ণাঙ্গ বর্ণনা (Project Description)** লিখে নিচে **সাবমিট (পাঠান)** করুন — মেসেজটি পাঠালেই আমি বিশ্লেষণ করে প্রজেক্ট তৈরি ও সমাধান করে দেব!`;

        const recapEn =
          `Awesome! All 7 steps are complete:\n` +
          `1) Category: ${updatedIntake.category}\n` +
          `2) Difficulty: ${updatedIntake.difficulty}\n` +
          `3) Level: ${updatedIntake.level}\n` +
          `4) Quantity: ${updatedIntake.quantity}\n` +
          `5) Business: ${updatedIntake.businessCategory}\n` +
          `6) Sector: ${updatedIntake.sector}\n` +
          `7) Goal & Scope: ${updatedIntake.goalScope}\n\n` +
          `Now write your **Project Description** below and press **Send / Submit** — I will analyze everything and build & solve your project automatically!`;

        const finalDescOptions: Array<{ label: string; value: string }> = descriptionHint
          ? [{ label: descriptionHint, value: descriptionHint }]
          : lang === 'bn'
            ? [
                {
                  label: 'গার্মেন্টস ফ্যাক্টরিতে উৎপাদন ও সর্বোচ্চ মুনাফার মডেল',
                  value: 'আমার ফ্যাক্টরিতে সীমিত বাজেট, শ্রম ঘণ্টা ও কাঁচামালের মধ্যে সর্বোচ্চ লাভের উৎপাদন পরিকল্পনা তৈরি করো।',
                },
                {
                  label: 'সাপ্লাই চেইন ও পরিবহন খরচ কমানোর মডেল',
                  value: 'সকল চাহিদা পূরণ করে সর্বনিম্ন উৎপাদন ও পরিবহন খরচের অপটিমাইজেশন মডেল তৈরি করো।',
                },
              ]
            : [
                {
                  label: 'Maximize production profit under labor & budget limits',
                  value: 'Build a realistic profit-maximization production plan within capital budget, labor hours, and material capacity.',
                },
                {
                  label: 'Minimize supply chain & operating costs',
                  value: 'Minimize total operating and distribution cost while meeting all minimum demand commitments.',
                },
              ];

        const finalTurn: InterviewTurn = {
          id: `mre_final_desc_${Date.now()}`,
          sender: 'mr-error',
          text: lang === 'bn' ? recapBn : recapEn,
          hint:
            lang === 'bn'
              ? 'নিজের মতো করে বর্ণনা লিখুন (যেমন বাজেট, পণ্যের সংখ্যা বা বিশেষ শর্ত থাকলে উল্লেখ করুন) অথবা নিচের একটি সাজেশন বেছে নিন।'
              : 'Write your detailed project description in the message box below (include any budget, capacities, or special rules) or tap a quick suggestion.',
          timestamp: nowTime(),
          stepBadge: lang === 'bn' ? 'চূড়ান্ত ধাপ · প্রজেক্ট বর্ণনা' : 'Final Step · Description',
          options: finalDescOptions,
          answered: false,
        };
        setInterviewStage('final_description');
        setInterviewTurns((prev) => [
          ...prev.map((m) => ({ ...m, answered: true })),
          userMsg,
          finalTurn,
        ]);
      }
      return;
    }

    if (interviewStage === 'final_description') {
      const completedIntake: Record<IntakeFieldKey, string> = {
        ...intakeData,
        description: val,
      };
      setIntakeData(completedIntake);
      setInterviewTurns((prev) => [...prev.map((m) => ({ ...m, answered: true })), userMsg]);
      await executeAnalyzeAndBuildStepByStep(completedIntake);
    }
  };

  const stopVoiceCapture = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    recognitionRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore recorder stop errors
      }
      return;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
    }
    setVoiceState((prev) => (prev === 'transcribing' ? prev : 'idle'));
  };

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // Ignore unmount abort errors
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore errors
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  const startMediaRecorderTranscription = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error(
        lang === 'bn'
          ? 'এই ব্রাউজারে মাইক্রোফোন অডিও রেকর্ডিং সাপোর্টেড নয়।'
          : 'Microphone audio recording is not supported in this browser.',
      );
      setVoiceState('idle');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const candidateMimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime = candidateMimes.find((m) =>
        typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m),
      );
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        const mimeType = recorder.mimeType || supportedMime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        if (blob.size < 200) {
          setVoiceState('idle');
          return;
        }

        setVoiceState('transcribing');
        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to read recorded audio'));
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/ai/transcribe-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType,
              language: lang,
            }),
          });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) throw new Error(data.error || 'Transcription failed');
          const spoken = (data.text || '').trim();
          if (spoken) {
            setInput((prev) => {
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${spoken}` : spoken;
            });
          } else {
            toast.message(
              lang === 'bn' ? 'কোনো কথা শনাক্ত হয়নি।' : 'No clear speech was detected.',
            );
          }
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : lang === 'bn'
                ? 'ভয়েস টেক্সটে রূপান্তর ব্যর্থ হয়েছে।'
                : 'Speech transcription failed.',
          );
        } finally {
          setVoiceState('idle');
        }
      };

      recorder.start(250);
      setVoiceState('recording');
    } catch (err) {
      setVoiceState('idle');
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      toast.error(
        isDenied
          ? lang === 'bn'
            ? 'মাইক্রোফোনের অনুমতি (Permission) দেওয়া হয়নি।'
            : 'Microphone permission was denied.'
          : lang === 'bn'
            ? 'মাইক্রোফোন চালু করা যায়নি।'
            : 'Could not access microphone.',
      );
    }
  };

  const handleToggleVoiceInput = async () => {
    if (voiceState === 'transcribing') return;
    if (voiceState === 'listening' || voiceState === 'recording') {
      stopVoiceCapture();
      return;
    }

    type SpeechRecognitionCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((ev: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void) | null;
      onerror: ((ev: { error?: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
      abort: () => void;
    };

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      await startMediaRecorderTranscription();
      return;
    }

    try {
      const recognition = new RecognitionCtor();
      recognitionRef.current = recognition;
      baseVoiceTextRef.current = input.trim();
      recognition.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      let switchedToFallback = false;

      recognition.onresult = (event) => {
        let transcriptText = '';
        for (let i = 0; i < event.results.length; i++) {
          transcriptText += event.results[i][0].transcript;
        }
        const cleanTranscript = transcriptText.trim();
        const base = baseVoiceTextRef.current;
        setInput(base ? (cleanTranscript ? `${base} ${cleanTranscript}` : base) : cleanTranscript);
      };

      recognition.onerror = (ev) => {
        const code = ev?.error || '';
        if (code === 'not-allowed' || code === 'audio-capture') {
          recognitionRef.current = null;
          setVoiceState('idle');
          toast.error(
            lang === 'bn'
              ? 'মাইক্রোফোনের অনুমতি (Permission) দেওয়া হয়নি।'
              : 'Microphone permission was denied.',
          );
          return;
        }
        if (
          code === 'service-not-allowed' ||
          code === 'network' ||
          code === 'language-not-supported'
        ) {
          switchedToFallback = true;
          try {
            recognition.abort();
          } catch {
            // Ignore abort error
          }
          recognitionRef.current = null;
          void startMediaRecorderTranscription();
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        if (!switchedToFallback) {
          setVoiceState((cur) => (cur === 'listening' ? 'idle' : cur));
        }
      };

      recognition.start();
      setVoiceState('listening');
    } catch {
      recognitionRef.current = null;
      await startMediaRecorderTranscription();
    }
  };

  const submit = async (textOverride?: string) => {
    if (voiceState === 'listening' || voiceState === 'recording') {
      stopVoiceCapture();
    }
    const command = (textOverride ?? input).trim();
    if (!command || busy || isInterviewBusy) return;
    if (isInterviewActive && retryAction !== null) return;
    if (!textOverride) setInput('');
    if (isInterviewActive) {
      await handleInterviewUserReply(command);
      return;
    }
    setActiveCommandText(command);
    try {
      await onExecuteInstruction(command);
    } finally {
      setActiveCommandText('');
    }
  };

  const handleCopyReply = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success(lang === 'bn' ? 'উত্তর কপি হয়েছে!' : 'Agent output copied!');
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div
      ref={constraintsRef}
      className="fixed inset-3 sm:inset-5 z-50 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="ai-agent-workspace-panel"
            layout
            initial={{ opacity: 0, scale: 0.84, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 18 }}
            transition={{
              duration: 0.24,
              ease: [0.16, 1, 0.3, 1],
              layout: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
            }}
            style={{ transformOrigin: 'bottom right' }}
            className={`pointer-events-auto flex flex-col transition-[width,height] duration-200 will-change-transform ${
              theaterWide
                ? 'fixed inset-x-2 bottom-2 h-[86dvh] sm:inset-auto sm:absolute sm:bottom-0 sm:right-0 sm:w-[680px] sm:h-[82vh] sm:max-h-[780px]'
                : 'fixed inset-x-2 bottom-2 h-[84dvh] sm:inset-auto sm:absolute sm:bottom-0 sm:right-0 sm:w-[465px] sm:h-[610px] sm:max-h-[84vh]'
            }`}
          >
            <Card className="h-full p-0 gap-0 bg-white border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-950/25 flex flex-col overflow-hidden ring-1 ring-slate-900/5">
              {/* Mega-Project AI Agent Obsidian Header */}
              <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Animated Syton AI Core Emblem */}
                    <div className="relative flex items-center justify-center shrink-0">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: busy ? 3 : 14, repeat: Infinity, ease: 'linear' }}
                        className="absolute -inset-1 rounded-xl border border-dashed border-teal-400/50 pointer-events-none"
                      />
                      <SytonAiAvatar
                        size="md"
                        busy={busy || isInterviewBusy}
                        className="w-9 h-9 rounded-xl border border-teal-300/60 shadow-sm"
                      />
                    </div>

                    <span className="text-sm font-bold tracking-tight text-white truncate">
                      {t.autopilot.badge}
                    </span>
                  </div>

                  {/* Header Utility Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setTheaterWide((w) => !w)}
                      title={
                        theaterWide
                          ? lang === 'bn'
                            ? 'কম্প্যাক্ট সাইজ'
                            : 'Compact View'
                          : lang === 'bn'
                            ? 'বড় এজেন্ট ভিউ'
                            : 'Expand Agent View'
                      }
                      className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
                    >
                      {theaterWide ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    {(history.length > 0 || isInterviewActive) && onClearHistory && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          resetInterview();
                          onClearHistory();
                        }}
                        title={lang === 'bn' ? 'চ্যাট ক্লিয়ার করুন' : 'Clear session'}
                        className="text-slate-300 hover:text-red-300 hover:bg-white/10 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={onToggleExpand}
                      aria-label={t.autopilot.hideStudio}
                      className="text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Conversation & Execution Feed */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/75">
                {/* Structured Agent Welcome & Quick Action Matrix */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  <div className="flex items-start gap-2.5">
                    <SytonAiAvatar className="w-7 h-7 rounded-xl mt-0.5 shadow-xs border border-slate-200" />
                    <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm p-3.5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">Syston</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {lang === 'bn' ? 'বাংলা / EN / বাংলিশ' : 'EN / বাংলা / Banglish'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {lang === 'bn'
                          ? 'হ্যালো! আমি Syston — আপনার স্বয়ংক্রিয় অপটিমাইজেশন এজেন্ট। নতুন প্রজেক্ট তৈরি করতে চাইলে অথবা যেকোনো অপটিমাইজেশন নির্দেশনা দিতে চাইলে নিচে মেসেজ লিখুন।'
                          : "Hello! I'm Syston — your autonomous optimization agent. Type a message below to create a new project step-by-step or run any optimization command."}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Conversation Turn Timeline */}
                {chronologicalHistory.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-3"
                  >
                    {/* User Instruction Bubble */}
                    <div className="flex justify-end">
                      <div className="bg-slate-900 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-xs max-w-[85%] shadow-xs space-y-1">
                        <div className="leading-relaxed">{item.instruction}</div>
                        <div className="text-[10px] text-slate-400 font-mono text-right tabular-nums">
                          {item.timestamp}
                        </div>
                      </div>
                    </div>

                    {/* Syton AI Execution Trace Card */}
                    <div className="flex items-start gap-2.5">
                      <SytonAiAvatar className="w-7 h-7 rounded-xl mt-0.5 shadow-xs border border-teal-200" />

                      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm p-3.5 shadow-xs space-y-2.5 max-w-[90%]">
                        {item.error ? (
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50/80 border border-red-200 rounded-xl p-2.5">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{item.error}</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              disabled={busy}
                              onClick={() => submit(item.instruction)}
                              className="text-xs font-semibold rounded-lg"
                            >
                              <RotateCcw className="w-3 h-3 text-teal-700" />
                              <span>{lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Retry Instruction'}</span>
                            </Button>
                          </div>
                        ) : item.response ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-slate-900">Syston</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyReply(
                                    item.id,
                                    [item.response?.replyMessage, item.response?.explanation]
                                      .filter(Boolean)
                                      .join('\n\n'),
                                  )
                                }
                                title={lang === 'bn' ? 'কপি করুন' : 'Copy reply'}
                                className="p-1 text-slate-400 hover:text-slate-800 rounded-md transition-colors shrink-0"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <p className="text-xs text-slate-800 leading-relaxed font-medium">
                              {item.response.replyMessage}
                            </p>

                            {/* Connected Vertical Execution Timeline */}
                            {item.response.steps.length > 0 && (
                              <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
                                {item.response.steps.map((st, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-2 text-[11px] text-slate-700"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span className="leading-snug">{st.label}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {item.response.explanation && (
                              <div className="p-2.5 bg-teal-50/40 border border-teal-200/70 rounded-xl text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                                {item.response.explanation}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Step-by-Step Conversational Interview Thread inside Syton AI Chat */}
                <AnimatePresence initial={false}>
                  {interviewTurns.map((turn) => (
                    <motion.div
                      key={turn.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {turn.sender === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-slate-900 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-xs max-w-[85%] shadow-xs space-y-1">
                            <div className="leading-relaxed">{turn.text}</div>
                            <div className="text-[10px] text-slate-400 font-mono text-right tabular-nums">
                              {turn.timestamp}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2.5">
                          <SytonAiAvatar className="w-7 h-7 rounded-xl mt-0.5 shadow-xs border border-teal-200" />
                          <div className="flex-1 bg-white border border-teal-200/90 rounded-2xl rounded-tl-sm p-3.5 shadow-xs space-y-2.5 max-w-[90%]">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-slate-900">Syston</span>
                                {turn.stepBadge && (
                                  <Badge
                                    variant="secondary"
                                    className="h-4.5 px-1.5 text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-200/80"
                                  >
                                    {turn.stepBadge}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{turn.timestamp}</span>
                            </div>

                            <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                              {turn.text}
                            </div>

                            {turn.hint && (
                              <div className="text-[11px] text-slate-500 leading-snug bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
                                {turn.hint}
                              </div>
                            )}

                            {!turn.answered && turn.options && turn.options.length > 0 && !isInterviewBusy && retryAction === null && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {turn.options.map((opt) => (
                                  <motion.button
                                    key={opt.value + opt.label}
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => handleInterviewUserReply(opt.value, opt.label)}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-slate-50 hover:bg-teal-50 text-slate-800 hover:text-teal-900 border border-slate-200 hover:border-teal-400 transition-all text-left shadow-2xs"
                                  >
                                    {opt.label}
                                  </motion.button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Live Animated Step-by-Step Reasoning for 7-Step Project Build */}
                <AnimatePresence>
                  {interviewStage === 'building_project' && (
                    <LiveReasoningProcessCard
                      mode="project_build"
                      lang={lang}
                      currency={currency}
                      intakeSummary={[
                        intakeData.sector,
                        intakeData.category,
                        intakeData.difficulty,
                        intakeData.quantity,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  )}
                </AnimatePresence>

                {wizardError && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5"
                  >
                    <div className="w-7 h-7 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 bg-white border border-red-200 rounded-2xl rounded-tl-sm p-3 max-w-[90%] space-y-2 shadow-xs">
                      <div className="text-xs text-red-700 leading-relaxed">{wizardError}</div>
                      <div className="flex items-center gap-2">
                        {retryAction === 'build' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => executeAnalyzeAndBuildStepByStep(intakeData)}
                            className="text-xs font-semibold rounded-lg"
                          >
                            <RotateCcw className="w-3 h-3 text-teal-700" />
                            <span>{lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Retry Build'}</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={resetInterview}
                          className="text-xs text-slate-500 rounded-lg"
                        >
                          <span>{lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}</span>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Live Animated Step-by-Step Reasoning for General Agent Commands */}
                <AnimatePresence>
                  {busy && (
                    <LiveReasoningProcessCard
                      mode="command"
                      lang={lang}
                      currency={currency}
                      contextText={activeCommandText}
                    />
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Pro Agent Command Composer Dock */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
                {isInterviewActive && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200/80 rounded-xl text-[11px]">
                    <span className="font-semibold text-teal-900 truncate">
                      {retryAction === 'build'
                        ? lang === 'bn'
                          ? 'সব তথ্য সংরক্ষিত · রিট্রাই করার জন্য প্রস্তুত'
                          : 'All 7 steps + description saved · Click Retry above'
                        : interviewStage === 'intake_step'
                          ? lang === 'bn'
                            ? `ধাপে ধাপে তথ্য: ${intakeStepIdx + 1}/7 · ${INTAKE_STEPS[intakeStepIdx]?.labelBn}`
                            : `Step ${intakeStepIdx + 1}/7 · ${INTAKE_STEPS[intakeStepIdx]?.labelEn}`
                          : interviewStage === 'final_description'
                            ? lang === 'bn'
                              ? '৭/৭ ধাপ সম্পন্ন · এখন প্রজেক্টের বর্ণনা লিখে সাবমিট করুন'
                              : '7/7 Steps Done · Submit Project Description to Build'
                            : lang === 'bn'
                              ? 'Syston প্রজেক্ট তৈরি ও সমাধান করছে...'
                              : 'Syston building & solving project...'}
                    </span>
                    {!isInterviewBusy && (
                      <button
                        type="button"
                        onClick={resetInterview}
                        className="text-[10px] font-semibold text-slate-600 hover:text-red-700 shrink-0"
                      >
                        {lang === 'bn' ? 'বাতিল ✕' : 'Cancel ✕'}
                      </button>
                    )}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 focus-within:bg-white focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 transition-all p-2 space-y-2"
                >
                  <Textarea
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={busy || isInterviewBusy || retryAction !== null}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    placeholder={
                      isInterviewActive
                        ? interviewStage === 'final_description'
                          ? lang === 'bn'
                            ? 'আপনার প্রজেক্টের পূর্ণাঙ্গ বর্ণনা লিখে Enter / সাবমিট চাপুন...'
                            : 'Write your full Project Description and press Enter / Submit...'
                          : lang === 'bn'
                            ? 'আপনার উত্তর মেসেজে লিখুন অথবা উপরের অপশনে ক্লিক করুন...'
                            : 'Type your reply message or click an option above...'
                        : lang === 'bn'
                          ? 'Syston-কে বাংলা বা ইংরেজিতে নির্দেশ দিন...'
                          : 'Command Syston in English, Bangla, or Banglish...'
                    }
                    className="min-h-[46px] max-h-28 resize-none border-0 bg-transparent shadow-none p-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                  />

                  <Separator className="bg-slate-200/70" />

                  <div className="flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={toggleLang}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
                      >
                        <Languages className="w-3 h-3 text-teal-700" />
                        <span>{lang === 'en' ? 'EN' : 'বাংলা'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleCurrency}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold font-mono text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
                      >
                        <Coins className="w-3 h-3 text-teal-700" />
                        <span>{currency === 'BDT' ? '৳ BDT' : '$ USD'}</span>
                      </button>

                      {(voiceState === 'listening' ||
                        voiceState === 'recording' ||
                        voiceState === 'transcribing') && (
                        <span className="hidden sm:inline text-[10px] text-slate-400 ml-1">
                          {voiceState === 'transcribing'
                            ? lang === 'bn'
                              ? 'রূপান্তর হচ্ছে...'
                              : 'Transcribing...'
                            : lang === 'bn'
                              ? 'শুনছি... বলতে থাকুন'
                              : 'Listening...'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Speech-to-Text Microphone Button */}
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={handleToggleVoiceInput}
                        disabled={busy || isInterviewBusy || retryAction !== null || voiceState === 'transcribing'}
                        title={
                          voiceState === 'listening' || voiceState === 'recording'
                            ? lang === 'bn'
                              ? 'ভয়েস বন্ধ করুন'
                              : 'Stop dictation'
                            : voiceState === 'transcribing'
                              ? lang === 'bn'
                                ? 'কথা টেক্সটে রূপান্তর হচ্ছে...'
                                : 'Transcribing speech...'
                              : lang === 'bn'
                                ? 'ভয়েস দিয়ে লিখুন (Speech to Text)'
                                : 'Dictate with voice (Speech to Text)'
                        }
                        aria-label={
                          voiceState === 'listening' || voiceState === 'recording'
                            ? lang === 'bn'
                              ? 'ভয়েস বন্ধ করুন'
                              : 'Stop dictation'
                            : lang === 'bn'
                              ? 'ভয়েস ইনপুট'
                              : 'Voice input'
                        }
                        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${
                          voiceState === 'listening' || voiceState === 'recording'
                            ? 'bg-black border-emerald-500/70 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.28)]'
                            : voiceState === 'transcribing'
                              ? 'bg-teal-50 border-teal-300 text-teal-700'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white shadow-xs disabled:opacity-45'
                        }`}
                      >
                        {(voiceState === 'listening' || voiceState === 'recording') && (
                          <motion.span
                            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                            className="absolute inset-0 rounded-full bg-emerald-500/35 pointer-events-none"
                          />
                        )}
                        {voiceState === 'transcribing' ? (
                          <SingleDotOrbit
                            surface="light"
                            stageSizeClass="w-4 h-4"
                            dotSizeClass="w-1.5 h-1.5"
                            radius={4.5}
                            duration={0.8}
                          />
                        ) : voiceState === 'listening' || voiceState === 'recording' ? (
                          <span
                            aria-hidden="true"
                            className="relative z-10 flex items-center justify-center gap-[2px] h-4"
                          >
                            {[
                              { heights: [5, 11, 6, 9, 5], dur: 0.56, delay: 0 },
                              { heights: [9, 16, 8, 14, 9], dur: 0.64, delay: 0.08 },
                              { heights: [13, 7, 15, 9, 13], dur: 0.58, delay: 0.14 },
                              { heights: [8, 14, 6, 12, 8], dur: 0.66, delay: 0.05 },
                              { heights: [5, 10, 5, 11, 5], dur: 0.54, delay: 0.11 },
                            ].map((bar, idx) => (
                              <motion.span
                                key={idx}
                                animate={{ height: bar.heights }}
                                transition={{
                                  duration: bar.dur,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: bar.delay,
                                }}
                                className={`w-[2.5px] rounded-full shadow-[0_0_5px_rgba(34,197,94,0.7)] ${
                                  idx % 2 === 0 ? 'bg-emerald-400' : 'bg-green-400'
                                }`}
                              />
                            ))}
                          </span>
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                      </motion.button>

                      <motion.div whileTap={{ scale: 0.94 }}>
                        {busy || isInterviewBusy ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (isInterviewBusy) buildAbortRef.current?.abort();
                              if (busy && onAbortInstruction) onAbortInstruction();
                            }}
                            title={lang === 'bn' ? 'চলমান — থামাতে ক্লিক করুন' : 'Running — Click to stop'}
                            aria-label={lang === 'bn' ? 'থামান' : 'Stop'}
                            className="relative w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-sm transition-colors"
                          >
                            <motion.span
                              animate={{ scale: [1, 1.25, 1], opacity: [0.45, 0, 0.45] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute inset-0 rounded-full border border-slate-900/40 pointer-events-none"
                            />
                            <Square className="w-3 h-3 fill-current rounded-[2px]" />
                          </button>
                        ) : (
                          <Button
                            type="submit"
                            disabled={retryAction !== null || !input.trim()}
                            className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white text-xs font-semibold shadow-xs"
                          >
                            <span>
                              {interviewStage === 'final_description'
                                ? lang === 'bn'
                                  ? 'প্রজেক্ট বানান'
                                  : 'Build Project'
                                : isInterviewActive
                                  ? lang === 'bn'
                                    ? 'পাঠান'
                                    : 'Send'
                                  : lang === 'bn'
                                    ? 'চালান'
                                    : 'Execute'}
                            </span>
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </form>
              </div>
            </Card>
          </motion.div>
        ) : (
          /* Draggable Floating Animated Chat Bubble for Syton AI (Touch & Mouse + Framer Smooth Motion) */
          <motion.div
            key="ai-chat-bubble-wrapper"
            drag
            dragConstraints={constraintsRef}
            dragElastic={0.14}
            dragMomentum={false}
            whileDrag={{ scale: 1.08 }}
            style={{ x: bubbleX, y: bubbleY, touchAction: 'none' }}
            onDragStart={() => {
              didDragRef.current = false;
              setIsDraggingBubble(true);
            }}
            onDrag={(_e, info) => {
              if (Math.hypot(info.offset.x, info.offset.y) > 6) {
                didDragRef.current = true;
              }
            }}
            onDragEnd={() => {
              setIsDraggingBubble(false);
              const clamped = clampBubbleOffset(bubbleX.get(), bubbleY.get());
              if (clamped.x !== bubbleX.get()) {
                animate(bubbleX, clamped.x, { type: 'spring', stiffness: 520, damping: 32, mass: 0.5 });
              }
              if (clamped.y !== bubbleY.get()) {
                animate(bubbleY, clamped.y, { type: 'spring', stiffness: 520, damping: 32, mass: 0.5 });
              }
              if (typeof window !== 'undefined') {
                setBubbleOnLeft(clamped.x < -window.innerWidth * 0.45);
              }
              try {
                localStorage.setItem('syton_bubble_pos', JSON.stringify(clamped));
              } catch {
                // Ignore storage errors
              }
              window.setTimeout(() => {
                didDragRef.current = false;
              }, 80);
            }}
            onMouseEnter={() => setHoveredBubble(true)}
            onMouseLeave={() => setHoveredBubble(false)}
            className="pointer-events-auto absolute bottom-0 right-0 cursor-grab active:cursor-grabbing select-none touch-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.78 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.78 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center"
            >
              {/* Greeting Tooltip Speech Bubble (flips side automatically based on bubble position) */}
              <AnimatePresence>
                {!isDraggingBubble && (hoveredBubble || busy || history.length === 0) && (
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (didDragRef.current) return;
                      onToggleExpand();
                    }}
                    initial={{ opacity: 0, x: bubbleOnLeft ? -8 : 8, scale: 0.96 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: 1,
                    }}
                    exit={{ opacity: 0, x: bubbleOnLeft ? -8 : 8, scale: 0.96 }}
                    transition={{ duration: 0.1 }}
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 shadow-lg shadow-slate-900/10 rounded-full text-xs font-semibold text-slate-800 hover:border-teal-500 transition-colors whitespace-nowrap absolute top-1/2 -translate-y-1/2 touch-manipulation ${
                      bubbleOnLeft ? 'left-full ml-3' : 'right-full mr-3'
                    }`}
                  >
                    <span className="inline-flex text-amber-500">
                      <Hand className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      {busy
                        ? t.autopilot.runningBtn
                        : lang === 'bn'
                          ? 'Syston — বলুন কী করতে হবে!'
                          : 'Syston — Ask in EN / বাংলা'}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Static Framing Ring + Stationary Floating Chat Bubble Button */}
              <div className="relative flex items-center justify-center">
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-teal-400 via-emerald-300 to-slate-800 shadow-xl shadow-teal-950/25">
                  <button
                    type="button"
                    onClick={() => {
                      if (didDragRef.current) return;
                      onToggleExpand();
                    }}
                    aria-label={t.autopilot.badge}
                    className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors touch-manipulation active:scale-95"
                  >
                    <OrbitalThreeDots
                      surface="dark"
                      stageSizeClass="w-9 h-9"
                      dotSizeClass="w-2 h-2"
                      restRadius={7}
                      peakRadius={12.25}
                      duration={busy ? 0.85 : 1.25}
                    />

                    {/* Active indicator dot */}
                    <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
