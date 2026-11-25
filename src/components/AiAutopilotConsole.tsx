import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Cpu,
  Hand,
  Languages,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { OrbitalThreeDots } from './IconicPreloader.tsx';
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
      aria-label="Syton AI"
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

interface ReasoningStageItem {
  title: string;
  detail: string;
}

function LiveReasoningProcessCard({
  mode,
  lang,
  currency,
  contextText,
  intakeSummary,
}: {
  mode: 'command' | 'project_build';
  lang: 'en' | 'bn';
  currency: 'BDT' | 'USD';
  contextText?: string;
  intakeSummary?: string;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const stages: ReasoningStageItem[] =
    mode === 'project_build'
      ? lang === 'bn'
        ? [
            {
              title: '৭টি ধাপ ও প্রজেক্ট বর্ণনা পার্স করা হচ্ছে',
              detail: intakeSummary || 'খাত, জটিলতা, স্কেল ও বাজেট সীমা যাচাই চলছে...',
            },
            {
              title: 'ডিসিশন ভেরিয়েবল ও অবজেক্টিভ ফাংশন গঠন',
              detail: `${currency === 'BDT' ? '৳ BDT' : '$ USD'} এককে বাস্তবসম্মত সহগ ও লক্ষ্য নির্ধারণ`,
            },
            {
              title: 'কনস্ট্রেইন্ট ম্যাট্রিক্স ও ফিজিবিলিটি যাচাই',
              detail: 'বাজেট, শ্রম, কাঁচামাল ও ন্যূনতম চাহিদা সীমার সামঞ্জস্য পরীক্ষা',
            },
            {
              title: 'HiGHS WASM অপটিমাইজেশন সলভার চালানো হচ্ছে',
              detail: 'সর্বোত্তম (Optimal) সমাধান, শ্যাডো প্রাইস ও স্ল্যাক বিশ্লেষণ',
            },
            {
              title: 'ফলাফল ও কৌশলগত ব্যাখ্যা প্রস্তুত করা হচ্ছে',
              detail: 'অ্যাকশন রুট ও পূর্ণাঙ্গ বিশ্লেষণ সাজানো হচ্ছে',
            },
          ]
        : [
            {
              title: 'Parsing 7 intake parameters & project brief',
              detail: intakeSummary || 'Validating sector, scale, complexity & budget scope...',
            },
            {
              title: 'Formulating variables & objective coefficients',
              detail: `Calibrating realistic ${currency === 'BDT' ? '৳ BDT' : '$ USD'} economic weights`,
            },
            {
              title: 'Synthesizing constraint matrix & bounds',
              detail: 'Balancing capital, labor, capacity & minimum demand limits',
            },
            {
              title: 'Solving mathematical program with HiGHS WASM',
              detail: 'Computing optimal basis, dual shadow prices & constraint slack',
            },
            {
              title: 'Compiling execution trace & business brief',
              detail: 'Preparing workspace navigation & quantitative summary',
            },
          ]
      : lang === 'bn'
        ? [
            {
              title: 'নির্দেশনার উদ্দেশ্য ও প্যারামিটার বিশ্লেষণ',
              detail: contextText
                ? `“${contextText.slice(0, 72)}${contextText.length > 72 ? '...' : ''}”`
                : 'ভাষা, মুদ্রা ও অ্যাকশন টার্গেট শনাক্ত করা হচ্ছে',
            },
            {
              title: 'প্রজেক্ট ও মডিউল কনটেক্সট মিলিয়ে দেখা হচ্ছে',
              detail: 'অ্যাক্টিভ মডেল বা সঠিক অপটিমাইজেশন টুল নির্বাচন',
            },
            {
              title: 'গাণিতিক যুক্তি ও ডেটা স্ট্রাকচার তৈরি',
              detail: `${currency === 'BDT' ? '৳ BDT' : '$ USD'} কনফিগারেশন ও সীমা নির্ধারণ`,
            },
            {
              title: 'অপটিমাইজেশন ও টুল অটোমেশন সম্পন্ন হচ্ছে',
              detail: 'ফলাফল যাচাই ও চূড়ান্ত উত্তর তৈরি করা হচ্ছে',
            },
          ]
        : [
            {
              title: 'Analyzing prompt intent & parameters',
              detail: contextText
                ? `“${contextText.slice(0, 72)}${contextText.length > 72 ? '...' : ''}”`
                : 'Detecting language, currency & optimization intent',
            },
            {
              title: 'Matching workspace context & solver module',
              detail: 'Selecting active model state or routing to specialized engine',
            },
            {
              title: 'Synthesizing mathematical structure & bounds',
              detail: `Validating ${currency === 'BDT' ? '৳ BDT' : '$ USD'} parameters and constraints`,
            },
            {
              title: 'Running HiGHS engine & verifying response',
              detail: 'Finalizing trace steps and bilingual summary',
            },
          ];

  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 50);

    const thresholds = mode === 'project_build' ? [220, 520, 900, 1380] : [160, 380, 680];
    const timeouts = thresholds.map((ms, idx) =>
      window.setTimeout(() => {
        setActiveIdx((prev) => Math.max(prev, idx + 1));
      }, ms),
    );

    return () => {
      window.clearInterval(timer);
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [mode]);

  const elapsedSec = (elapsedMs / 1000).toFixed(1);

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
        <OrbitalThreeDots
          surface="dark"
          stageSizeClass="w-6 h-6"
          dotSizeClass="w-[4.5px] h-[4.5px]"
          restRadius={4}
          peakRadius={6.8}
          duration={0.95}
        />
      </div>

      <div className="flex-1 bg-white border border-teal-200/90 rounded-2xl rounded-tl-sm p-3.5 max-w-[92%] space-y-3 shadow-sm overflow-hidden">
        {/* Top Shimmering Thinking Header + Live Timer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <motion.span
              animate={{ opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="text-xs font-bold text-slate-900 truncate"
            >
              {mode === 'project_build'
                ? lang === 'bn'
                  ? 'Syton AI ধাপে ধাপে চিন্তা ও বিল্ড করছে...'
                  : 'Syton AI is reasoning & building...'
                : lang === 'bn'
                  ? 'Syton AI ধাপে ধাপে রিজনিং করছে...'
                  : 'Syton AI is reasoning step by step...'}
            </motion.span>
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200/80 text-[10px] font-mono font-semibold text-teal-800 tabular-nums shrink-0">
            <Clock className="w-2.5 h-2.5 text-teal-600" />
            {elapsedSec}s
          </span>
        </div>

        {/* Animated Progress Sweep Bar */}
        <div className="relative h-1 w-full rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            animate={{ x: ['-60%', '140%'] }}
            transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-teal-500 to-emerald-400"
          />
        </div>

        {/* Replit / Claude-style Progressive Vertical Step Timeline */}
        <div className="space-y-0.5 pt-0.5">
          {stages.map((st, idx) => {
            const isDone = idx < activeIdx;
            const isCurrent = idx === activeIdx;
            const isUpcoming = idx > activeIdx;
            const isLast = idx === stages.length - 1;

            return (
              <motion.div
                key={st.title}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: isUpcoming ? 0.42 : 1, x: 0 }}
                transition={{ duration: 0.24, delay: idx * 0.06 }}
                className="relative flex items-start gap-2.5 pb-2.5 last:pb-0"
              >
                {/* Vertical Timeline Connector Line */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[7px] top-4 bottom-0 w-[1.5px] transition-colors duration-300 ${
                      isDone ? 'bg-emerald-400' : isCurrent ? 'bg-teal-200' : 'bg-slate-200'
                    }`}
                  />
                )}

                {/* Step Status Node */}
                <div className="relative z-10 flex items-center justify-center w-4 h-4 mt-0.5 shrink-0">
                  {isDone ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-50" />
                    </motion.div>
                  ) : isCurrent ? (
                    <div className="relative flex items-center justify-center w-3.5 h-3.5">
                      <motion.span
                        animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full bg-teal-400/50"
                      />
                      <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                    </div>
                  ) : (
                    <span className="w-2 h-2 rounded-full border border-slate-300 bg-white" />
                  )}
                </div>

                {/* Step Title & Sub-detail */}
                <div
                  className={`flex-1 min-w-0 rounded-lg transition-colors duration-200 ${
                    isCurrent ? 'bg-teal-50/70 border border-teal-200/60 px-2 py-1.5 -mt-0.5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] leading-snug ${
                        isDone
                          ? 'font-medium text-slate-700'
                          : isCurrent
                            ? 'font-semibold text-teal-950'
                            : 'font-medium text-slate-500'
                      }`}
                    >
                      {st.title}
                    </span>
                    {isDone && (
                      <span className="text-[9px] font-mono font-semibold text-emerald-700 shrink-0">
                        {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
                      </span>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {(isCurrent || (isDone && idx === 0)) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="text-[10px] text-slate-500 leading-relaxed mt-0.5 truncate"
                      >
                        {st.detail}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function ReasoningAccordion({
  reasoningSteps,
  durationMs,
  analysisSummary,
  defaultOpen = false,
  lang,
}: {
  reasoningSteps?: string[];
  durationMs?: number;
  analysisSummary?: string;
  defaultOpen?: boolean;
  lang: 'en' | 'bn';
}) {
  const [open, setOpen] = useState(defaultOpen);
  const stepsList = reasoningSteps ?? [];
  if (stepsList.length === 0 && !analysisSummary) return null;

  const formattedSec =
    typeof durationMs === 'number' && durationMs > 0 ? (durationMs / 1000).toFixed(1) : null;

  const headerLabel =
    lang === 'bn'
      ? formattedSec && stepsList.length > 0
        ? `${formattedSec} সেকেন্ডে বিশ্লেষিত · ${stepsList.length}টি রিজনিং ধাপ`
        : stepsList.length > 0
          ? `রিজনিং প্রক্রিয়া · ${stepsList.length}টি ধাপ`
          : 'Syton AI রিজনিং ও বিশ্লেষণ'
      : formattedSec && stepsList.length > 0
        ? `Thought for ${formattedSec}s · ${stepsList.length} reasoning steps`
        : stepsList.length > 0
          ? `Reasoning process · ${stepsList.length} steps`
          : 'Syton AI Deep Reasoning Analysis';

  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/75 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-slate-100/80 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-4.5 h-4.5 rounded-md bg-white border border-teal-200/80 flex items-center justify-center shrink-0">
            <OrbitalThreeDots
              surface="light"
              stageSizeClass="w-4 h-4"
              dotSizeClass="w-[3px] h-[3px]"
              restRadius={2.4}
              peakRadius={4.2}
            />
          </span>
          <span className="text-[11px] font-semibold text-slate-700 truncate">{headerLabel}</span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-slate-400 shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-slate-200/80"
          >
            <div className="p-2.5 space-y-2.5 bg-white/75">
              {stepsList.length > 0 && (
                <div className="space-y-0.5 pl-0.5">
                  {stepsList.map((step, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.16, delay: idx * 0.045 }}
                      className="relative flex items-start gap-2 pb-2 last:pb-0"
                    >
                      {idx < stepsList.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[6px] top-3.5 bottom-0 w-px bg-teal-200"
                        />
                      )}
                      <span className="relative z-10 mt-1 w-3 h-3 rounded-full bg-teal-50 border border-teal-400 flex items-center justify-center shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                      </span>
                      <span className="text-[11px] text-slate-700 leading-relaxed">{step}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {analysisSummary && (
                <div className="p-2.5 bg-slate-900 text-slate-100 rounded-xl text-[11px] whitespace-pre-wrap leading-relaxed border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-teal-300 uppercase tracking-wider">
                    <OrbitalThreeDots
                      surface="dark"
                      stageSizeClass="w-3.5 h-3.5"
                      dotSizeClass="w-[3px] h-[3px]"
                      restRadius={2.2}
                      peakRadius={3.6}
                    />
                    <span>
                      {lang === 'bn'
                        ? 'গাণিতিক কাঠামো ও সারসংক্ষেপ'
                        : 'Quantitative Model Breakdown'}
                    </span>
                  </div>
                  <div className="text-slate-200">{analysisSummary}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const constraintsRef = useRef<HTMLDivElement | null>(null);
  const didDragRef = useRef(false);

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

      const res = await fetch('/api/ai/project-analyze-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          ? `Syton AI "${built.project.name}" তৈরি ও সমাধান করেছে!`
          : `Syton AI built & solved "${built.project.name}"!`,
      );
      resetInterview();
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Failed to analyze and build project');
      setRetryAction('build');
      setInterviewStage('final_description');
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

  const submit = async (textOverride?: string) => {
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
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.div
            key="ai-agent-workspace-panel"
            layout
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: 'spring', stiffness: 600, damping: 34, mass: 0.55 }}
            style={{ transformOrigin: 'bottom right' }}
            className={`pointer-events-auto flex flex-col transition-[width,height] duration-150 ${
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
                        <span className="text-xs font-bold text-slate-900">Syton AI</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {lang === 'bn' ? 'বাংলা / EN / বাংলিশ' : 'EN / বাংলা / Banglish'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {lang === 'bn'
                          ? 'হ্যালো! আমি Syton AI — আপনার স্বয়ংক্রিয় অপটিমাইজেশন এজেন্ট। নতুন প্রজেক্ট তৈরি করতে চাইলে অথবা যেকোনো অপটিমাইজেশন নির্দেশনা দিতে চাইলে নিচে মেসেজ লিখুন।'
                          : "Hello! I'm Syton AI — your autonomous optimization agent. Type a message below to create a new project step-by-step or run any optimization command."}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Conversation Turn Timeline */}
                {chronologicalHistory.map((item, idx) => {
                  const isLatestTurn = idx === chronologicalHistory.length - 1;
                  return (
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
                                <span className="text-xs font-bold text-slate-900">Syton AI</span>
                                <Badge
                                  variant="secondary"
                                  className="h-4.5 px-1.5 text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-200/80 truncate"
                                >
                                  {item.response.actionType.replace(/_/g, ' ')}
                                </Badge>
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

                            {/* Collapsible Claude / ChatGPT-style Reasoning Process Accordion */}
                            <ReasoningAccordion
                              reasoningSteps={item.response.reasoningSteps}
                              durationMs={item.response.reasoningDurationMs}
                              analysisSummary={item.response.analysisSummary}
                              defaultOpen={Boolean(
                                isLatestTurn &&
                                  (item.response.actionType === 'CREATE_AND_SOLVE_PROJECT' ||
                                    item.response.analysisSummary),
                              )}
                              lang={lang}
                            />

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
                  );
                })}

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
                                <span className="text-xs font-bold text-slate-900">Syton AI</span>
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
                              ? 'Syton AI প্রজেক্ট তৈরি ও সমাধান করছে...'
                              : 'Syton AI building & solving project...'}
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
                          ? 'Syton AI-কে বাংলা বা ইংরেজিতে নির্দেশ দিন...'
                          : 'Command Syton AI in English, Bangla, or Banglish...'
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

                      <span className="hidden sm:inline text-[10px] text-slate-400 ml-1">
                        {lang === 'bn' ? 'Enter = পাঠান' : 'Enter to send'}
                      </span>
                    </div>

                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        type="submit"
                        disabled={busy || isInterviewBusy || retryAction !== null || !input.trim()}
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
                    </motion.div>
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
            dragTransition={{
              bounceStiffness: 420,
              bounceDamping: 26,
              power: 0.22,
              timeConstant: 160,
            }}
            whileDrag={{ scale: 1.12 }}
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
                animate(bubbleX, clamped.x, { type: 'spring', stiffness: 440, damping: 28, mass: 0.65 });
              }
              if (clamped.y !== bubbleY.get()) {
                animate(bubbleY, clamped.y, { type: 'spring', stiffness: 440, damping: 28, mass: 0.65 });
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
              initial={{ opacity: 0, scale: 0.72 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.72 }}
              transition={{ type: 'spring', stiffness: 440, damping: 26, mass: 0.65 }}
              className="relative flex items-center justify-center"
            >
              {/* Waving Greeting Tooltip Speech Bubble (flips side automatically based on bubble position) */}
              <AnimatePresence>
                {!isDraggingBubble && (hoveredBubble || busy || history.length === 0) && (
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (didDragRef.current) return;
                      onToggleExpand();
                    }}
                    initial={{ opacity: 0, x: bubbleOnLeft ? -10 : 10, scale: 0.92 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: 1,
                      y: [0, -3, 0],
                    }}
                    exit={{ opacity: 0, x: bubbleOnLeft ? -10 : 10, scale: 0.92 }}
                    transition={{
                      opacity: { duration: 0.16 },
                      scale: { duration: 0.16 },
                      y: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
                    }}
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg shadow-slate-900/10 rounded-full text-xs font-semibold text-slate-800 hover:border-teal-500 transition-colors whitespace-nowrap absolute top-1/2 -translate-y-1/2 ${
                      bubbleOnLeft ? 'left-full ml-3' : 'right-full mr-3'
                    }`}
                  >
                    <motion.span
                      animate={{ rotate: [0, 22, -14, 20, -8, 0] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        repeatDelay: 2.2,
                        ease: 'easeInOut',
                      }}
                      style={{ transformOrigin: '70% 70%' }}
                      className="inline-flex text-amber-500"
                    >
                      <Hand className="w-3.5 h-3.5" />
                    </motion.span>
                    <span>
                      {busy
                        ? t.autopilot.runningBtn
                        : lang === 'bn'
                          ? 'Syton AI — বলুন কী করতে হবে!'
                          : 'Syton AI — Ask in EN / বাংলা'}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Outer Framing & Waving Concentric Rings + Floating Chat Bubble Button */}
              <motion.div
                animate={{
                  y: isDraggingBubble ? 0 : [0, -5, 0],
                  rotate: isDraggingBubble ? 0 : [0, 2, -2, 0],
                }}
                transition={{
                  y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
                  rotate: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' },
                }}
                className="relative flex items-center justify-center"
              >
                {/* Expanding Wave Ring 1 */}
                <motion.span
                  aria-hidden="true"
                  animate={{ scale: [1, 1.48], opacity: [0.55, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full bg-teal-500/35 pointer-events-none"
                />
                {/* Expanding Wave Ring 2 */}
                <motion.span
                  aria-hidden="true"
                  animate={{ scale: [1, 1.72], opacity: [0.4, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: 0.9, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border-2 border-teal-400/50 pointer-events-none"
                />

                {/* Rotating Framing Halo */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  className="p-[2.5px] rounded-full bg-gradient-to-tr from-teal-400 via-emerald-300 to-slate-800 shadow-xl shadow-teal-950/25"
                >
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (didDragRef.current) return;
                      onToggleExpand();
                    }}
                    whileHover={{ scale: 1.07 }}
                    whileTap={{ scale: 0.93 }}
                    animate={{ rotate: -360 }}
                    transition={{ rotate: { duration: 10, repeat: Infinity, ease: 'linear' } }}
                    aria-label={t.autopilot.badge}
                    className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors"
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
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
