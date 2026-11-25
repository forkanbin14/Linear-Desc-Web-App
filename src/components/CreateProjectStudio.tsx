import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderPlus,
  Play,
  Plus,
  Sigma,
  Sparkles,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { modelSpecToLatex, parseMathEquationsToSpec } from '../shared/equationParser.ts';
import type {
  ConstraintSense,
  ModelConstraint,
  ModelSpec,
  ModelVariable,
  ObjectiveSense,
  QuadraticTerm,
  VariableType,
} from '../shared/types.ts';
import { validateModelSpec } from '../shared/validator.ts';
import { LatexBlock } from './LatexBlock.tsx';
import { AiTextSkeleton } from './SkeletonLoaders.tsx';

type InputMethod = 'visual' | 'equations' | 'excel' | 'ai';

interface CreateProjectStudioProps {
  hasExistingProjects: boolean;
  onCancel?: () => void;
  onCreateProject: (params: {
    name: string;
    domain: ModelSpec['domain'];
    description: string;
    spec: ModelSpec;
    autoSolve: boolean;
    actionType: 'MODEL_CREATED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED';
  }) => Promise<void>;
  onJumpToTransport: () => void;
  onJumpToBatch: () => void;
}

const DOMAINS: Array<NonNullable<ModelSpec['domain']>> = [
  'Custom',
  'Operations',
  'Finance',
  'Supply Chain',
  'Portfolio',
  'Risk & Credit',
];

export function CreateProjectStudio({
  hasExistingProjects,
  onCancel,
  onCreateProject,
  onJumpToTransport,
  onJumpToBatch,
}: CreateProjectStudioProps) {
  const { lang, currency, setCurrency, currencySymbol, t } = useLanguage();
  const [inputMethod, setInputMethod] = useState<InputMethod>('visual');

  // Project Identity (blank so user inputs their own details)
  const [projectName, setProjectName] = useState('');
  const [domain, setDomain] = useState<NonNullable<ModelSpec['domain']>>('Custom');
  const [description, setDescription] = useState('');

  // Structured Visual Model Spec
  const [objSense, setObjSense] = useState<ObjectiveSense>('max');
  const [objOffset, setObjOffset] = useState<number>(0);
  const [variables, setVariables] = useState<ModelVariable[]>([
    { name: 'x1', lb: 0, ub: null, type: 'continuous', unit: 'units', description: '' },
    { name: 'x2', lb: 0, ub: null, type: 'continuous', unit: 'units', description: '' },
  ]);
  const [objTerms, setObjTerms] = useState<Record<string, number>>({ x1: 0, x2: 0 });
  const [constraints, setConstraints] = useState<ModelConstraint[]>([
    { name: 'constraint_1', terms: { x1: 1, x2: 1 }, sense: '<=', rhs: 100, description: '' },
  ]);
  const [quadraticTerms, setQuadraticTerms] = useState<QuadraticTerm[]>([]);
  const [showQpSection, setShowQpSection] = useState(false);

  // Equation mode state
  const [eqText, setEqText] = useState('');
  const [eqWarnings, setEqWarnings] = useState<string[]>([]);

  // Excel mode state
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [sourceActionType, setSourceActionType] = useState<'MODEL_CREATED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED'>('MODEL_CREATED');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const builtSpec: ModelSpec = useMemo(() => {
    const cleanObjTerms: Record<string, number> = {};
    for (const v of variables) {
      const val = objTerms[v.name] ?? 0;
      if (val !== 0) cleanObjTerms[v.name] = val;
    }
    return {
      name: projectName.trim() || 'Untitled Optimization Model',
      domain,
      currency,
      description: description.trim(),
      variables,
      constraints,
      objective: {
        sense: objSense,
        terms: cleanObjTerms,
        ...(objOffset !== 0 ? { offset: objOffset } : {}),
        ...(quadraticTerms.length > 0 ? { quadraticTerms } : {}),
      },
    };
  }, [projectName, domain, currency, description, variables, constraints, objSense, objOffset, objTerms, quadraticTerms]);

  const validation = useMemo(() => validateModelSpec(builtSpec), [builtSpec]);
  const latex = useMemo(() => modelSpecToLatex(builtSpec), [builtSpec]);

  const applySpecToForm = (
    spec: ModelSpec,
    origin: 'MODEL_CREATED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED',
    fillMetaIfBlank = true,
  ) => {
    if (fillMetaIfBlank && !projectName.trim() && spec.name) {
      setProjectName(spec.name);
    }
    if (fillMetaIfBlank && !description.trim() && spec.description) {
      setDescription(spec.description);
    }
    if (spec.domain) setDomain(spec.domain);
    if (spec.currency === 'BDT' || spec.currency === 'USD') setCurrency(spec.currency);
    setObjSense(spec.objective.sense);
    setObjOffset(spec.objective.offset ?? 0);
    setVariables(spec.variables);
    const terms: Record<string, number> = {};
    for (const v of spec.variables) {
      terms[v.name] = spec.objective.terms[v.name] ?? 0;
    }
    setObjTerms(terms);
    setConstraints(spec.constraints);
    setQuadraticTerms(spec.objective.quadraticTerms ?? []);
    if ((spec.objective.quadraticTerms?.length ?? 0) > 0) setShowQpSection(true);
    setSourceActionType(origin);
    setInputMethod('visual');
  };

  // Variable CRUD
  const addVariable = () => {
    const base = `x${variables.length + 1}`;
    const name = variables.some((v) => v.name === base) ? `var_${Date.now().toString().slice(-4)}` : base;
    setVariables((prev) => [
      ...prev,
      { name, lb: 0, ub: null, type: 'continuous', unit: 'units', description: '' },
    ]);
    setObjTerms((prev) => ({ ...prev, [name]: 0 }));
  };

  const updateVariable = (idx: number, patch: Partial<ModelVariable>) => {
    const prevName = variables[idx].name;
    setVariables((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

    if (patch.name && patch.name !== prevName) {
      const nextName = patch.name;
      setObjTerms((prev) => {
        const next = { ...prev };
        next[nextName] = next[prevName] ?? 0;
        delete next[prevName];
        return next;
      });
      setConstraints((prev) =>
        prev.map((c) => {
          if (!(prevName in c.terms)) return c;
          const t = { ...c.terms };
          t[nextName] = t[prevName];
          delete t[prevName];
          return { ...c, terms: t };
        }),
      );
      setQuadraticTerms((prev) =>
        prev.map((q) => ({
          ...q,
          var1: q.var1 === prevName ? nextName : q.var1,
          var2: q.var2 === prevName ? nextName : q.var2,
        })),
      );
    }
  };

  const removeVariable = (idx: number) => {
    if (variables.length <= 1) return;
    const target = variables[idx].name;
    setVariables((prev) => prev.filter((_, i) => i !== idx));
    setObjTerms((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });
    setConstraints((prev) =>
      prev.map((c) => {
        const t = { ...c.terms };
        delete t[target];
        return { ...c, terms: t };
      }),
    );
    setQuadraticTerms((prev) => prev.filter((q) => q.var1 !== target && q.var2 !== target));
  };

  // Constraint CRUD
  const addConstraint = () => {
    const firstVar = variables[0]?.name;
    setConstraints((prev) => [
      ...prev,
      {
        name: `constraint_${prev.length + 1}`,
        terms: firstVar ? { [firstVar]: 1 } : {},
        sense: '<=',
        rhs: 0,
        description: '',
      },
    ]);
  };

  const updateConstraint = (idx: number, patch: Partial<ModelConstraint>) => {
    setConstraints((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const updateConstraintCoef = (conIdx: number, varName: string, raw: string) => {
    const val = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(val)) return;
    const con = constraints[conIdx];
    const nextTerms = { ...con.terms };
    if (val === 0) delete nextTerms[varName];
    else nextTerms[varName] = val;
    updateConstraint(conIdx, { terms: nextTerms });
  };

  const removeConstraint = (idx: number) => {
    setConstraints((prev) => prev.filter((_, i) => i !== idx));
  };

  // Quadratic Term CRUD
  const addQuadraticTerm = () => {
    const v0 = variables[0]?.name;
    if (!v0) return;
    setQuadraticTerms((prev) => [...prev, { var1: v0, var2: v0, coef: 1 }]);
  };

  // Parse raw equations into visual form
  const handleParseEquations = () => {
    if (!eqText.trim()) {
      setErrorMsg('Please enter equations before parsing.');
      return;
    }
    setErrorMsg(null);
    const parsed = parseMathEquationsToSpec(eqText, projectName.trim() || 'Custom Equation Model');
    setEqWarnings(parsed.warnings);
    if (parsed.spec.variables.length === 0) {
      setErrorMsg('No valid decision variables found. Example: Maximize Z = 5x + 4y');
      return;
    }
    applySpecToForm(parsed.spec, 'MODEL_CREATED', false);
  };

  // Excel upload handler
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelBusy(true);
    setErrorMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const res = await fetch('/api/imports/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: btoa(bin), filename: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse workbook');
      setExcelFileName(file.name);
      applySpecToForm(data.spec, 'EXCEL_IMPORTED', true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Excel import error');
    } finally {
      setExcelBusy(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // AI draft handler
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      setErrorMsg('Please describe your optimization problem for the AI assistant.');
      return;
    }
    setAiBusy(true);
    setErrorMsg(null);
    setAiExplanation(null);
    try {
      const res = await fetch('/api/ai/nl-to-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI drafting failed');
      setAiExplanation(data.explanation || null);
      applySpecToForm(data.spec, 'AI_SPEC_CONFIRMED', true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI draft error');
    } finally {
      setAiBusy(false);
    }
  };

  const handleSubmitProject = async (autoSolve: boolean) => {
    if (!projectName.trim()) {
      setErrorMsg(
        lang === 'bn'
          ? 'সেভ করার আগে অনুগ্রহ করে ১ নম্বর সেকশনে প্রজেক্টের নাম (Project Name) লিখুন।'
          : 'Please enter a Project Name in Section 1 before saving.',
      );
      projectNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      projectNameInputRef.current?.focus();
      return;
    }
    if (!validation.valid) {
      setErrorMsg(validation.issues.find((i) => i.severity === 'error')?.message || 'Fix validation errors first.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onCreateProject({
        name: projectName.trim(),
        domain,
        description: description.trim() || `${domain} optimization project`,
        spec: builtSpec,
        autoSolve,
        actionType: sourceActionType,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4"
      >
        <div className="space-y-1">
          <div className="text-xs font-medium text-teal-700">
            {hasExistingProjects ? t.creator.kickerNew : t.creator.kickerEmpty}
          </div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {t.creator.title}
          </h1>
          <p className="text-xs text-slate-600 max-w-3xl">
            {t.creator.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onJumpToTransport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap"
          >
            <Truck className="w-3.5 h-3.5 text-teal-700" />
            {t.creator.transportTool}
          </button>
          <button
            type="button"
            onClick={onJumpToBatch}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap"
          >
            {t.creator.batchTool}
          </button>
          {hasExistingProjects && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
            >
              {t.actions.cancel}
            </button>
          )}
        </div>
      </motion.div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </span>
          <button type="button" onClick={() => setErrorMsg(null)} className="font-semibold underline">
            {t.actions.dismiss}
          </button>
        </div>
      )}

      {/* Section 1: Project Identity & Context */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, delay: 0.02, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <h2 className="text-sm font-semibold text-slate-900">{t.creator.section1Title}</h2>
          <span className="text-xs text-slate-500">{t.creator.section1Hint}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <label className="block md:col-span-2">
            <span className="font-medium text-slate-700">{t.creator.projectNameLabel}</span>
            <input
              ref={projectNameInputRef}
              type="text"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={t.creator.projectNamePlaceholder}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="font-medium text-slate-700">{t.creator.domainLabel}</span>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as NonNullable<ModelSpec['domain']>)}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="font-medium text-slate-700 block">{t.creator.currencyLabel}</span>
            <div className="mt-1 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              {(['BDT', 'USD'] as const).map((cur) => {
                const active = currency === cur;
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={`relative z-10 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      active ? 'text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="creator-currency-pill"
                        transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                        className="absolute inset-0 bg-white rounded-md shadow-xs -z-10"
                      />
                    )}
                    {cur === 'BDT' ? '৳ BDT' : '$ USD'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <span>
            {lang === 'bn'
              ? `নির্বাচিত মূলধনের একক: ${currency === 'BDT' ? 'বাংলাদেশি টাকা (৳ BDT)' : 'মার্কিন ডলার ($ USD)'}`
              : `Selected Capital Unit: ${currency === 'BDT' ? 'Bangladeshi Taka (৳ BDT)' : 'US Dollar ($ USD)'}`}
          </span>
          <span className="font-mono font-semibold text-teal-800">{currencySymbol}</span>
        </div>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">{t.creator.descLabel}</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.creator.descPlaceholder}
            className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
          />
        </label>
      </motion.div>

      {/* Section 2: Multi-Level Model Input Switcher */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4 sm:space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 sm:pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t.creator.section2Title}</h2>
            <p className="text-xs text-slate-500">
              {t.creator.section2Subtitle}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto no-scrollbar max-w-full w-full sm:w-auto">
            {(
              [
                { id: 'visual', label: t.creator.tabVisual, icon: null },
                { id: 'equations', label: t.creator.tabEquations, icon: <Sigma className="w-3.5 h-3.5" /> },
                { id: 'excel', label: t.creator.tabExcel, icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
                { id: 'ai', label: t.creator.tabAi, icon: <Sparkles className="w-3.5 h-3.5 text-teal-700" /> },
              ] as const
            ).map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setInputMethod(tabItem.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors duration-100 whitespace-nowrap shrink-0 ${
                  inputMethod === tabItem.id ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {inputMethod === tabItem.id && (
                  <motion.span
                    layoutId="creator-method-pill"
                    transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                    className="absolute inset-0 bg-white rounded-md shadow-xs"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {tabItem.icon}
                  {tabItem.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* INPUT MODE A: ALGEBRAIC EQUATIONS */}
        {inputMethod === 'equations' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">
                Write objective &amp; constraints in plain algebra (e.g., <code className="font-mono">Maximize Z = 5x + 4y</code>, <code className="font-mono">6x + 4y &lt;= 24</code>, <code className="font-mono">x, y &gt;= 0</code>, <code className="font-mono">integer: x</code>).
              </span>
              <button
                type="button"
                onClick={handleParseEquations}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
              >
                Parse &amp; Populate Visual Form
              </button>
            </div>
            <textarea
              rows={8}
              value={eqText}
              onChange={(e) => setEqText(e.target.value)}
              placeholder={`Maximize Z = 5x + 4y\n6x + 4y <= 24\nx + 2y <= 6\nx, y >= 0`}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
            {eqWarnings.length > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {eqWarnings.join(' · ')}
              </div>
            )}
          </div>
        )}

        {/* INPUT MODE B: EXCEL IMPORT */}
        {inputMethod === 'excel' && (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900">Import Excel (.xlsx / .csv) Model Workbook</div>
              <p className="text-xs text-slate-600">
                Upload a workbook with Variables, Objective, and Constraints sheets, or download the blank structured template first.
              </p>
              {excelFileName && (
                <div className="text-xs font-medium text-emerald-700">
                  Loaded: {excelFileName}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/exports/blank-xlsx-template"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template
              </a>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={excelBusy}
                onClick={() => excelInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                {excelBusy ? 'Parsing...' : 'Select Workbook'}
              </button>
            </div>
          </div>
        )}

        {/* INPUT MODE C: AI PROBLEM DRAFTER */}
        {inputMethod === 'ai' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600">
              Explain your decision problem in plain English or Bengali. The AI extracts variables, bounds, objective, and constraints directly into the form for your review.
            </div>
            <textarea
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., A garment factory produces shirts ($12 profit, 2 hrs labor, 1.5m cloth) and jackets ($20 profit, 3.5 hrs labor, 2.5m cloth). Available daily capacity is 120 labor hours and 90m cloth. Maximize total daily profit."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
            <div className="flex items-center justify-between gap-3">
              {aiExplanation ? (
                <div className="text-xs text-teal-800">{aiExplanation}</div>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={aiBusy}
                onClick={handleAiGenerate}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                {aiBusy ? (lang === 'bn' ? 'মডেল ড্রাফট হচ্ছে...' : 'Drafting Model...') : (lang === 'bn' ? 'ফর্মে জেনারেট করুন' : 'Generate into Form')}
              </button>
            </div>
            {aiBusy && <AiTextSkeleton />}
          </div>
        )}

        {/* VISUAL FORM EDITOR (Always visible as canonical editor below or active) */}
        <div className="space-y-5 pt-2">
          {/* Objective Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="text-xs font-semibold text-slate-900">{t.creator.objTitle}</div>
              <div className="text-xs text-slate-500">{t.creator.objDesc}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setObjSense('max')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${objSense === 'max' ? 'bg-teal-700 text-white' : 'text-slate-600'}`}
                >
                  {t.creator.maximizeZ}
                </button>
                <button
                  type="button"
                  onClick={() => setObjSense('min')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${objSense === 'min' ? 'bg-teal-700 text-white' : 'text-slate-600'}`}
                >
                  {t.creator.minimizeZ}
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>{t.creator.offset}:</span>
                <input
                  type="number"
                  step="any"
                  value={objOffset}
                  onChange={(e) => setObjOffset(Number(e.target.value) || 0)}
                  className="w-20 px-2 py-1 font-mono text-right bg-white border border-slate-200 rounded"
                />
              </label>
            </div>
          </div>

          {/* Decision Variables Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-900">
                {t.creator.varsTitle} ({variables.length})
              </div>
              <button
                type="button"
                onClick={addVariable}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 bg-white hover:bg-teal-50 border border-teal-200 rounded-md"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.creator.addVariable}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-white">
                    <th className="py-2 px-3">Variable Name</th>
                    <th className="py-2 px-3">Domain Type</th>
                    <th className="py-2 px-3 text-right">Lower Bound</th>
                    <th className="py-2 px-3 text-right">Upper Bound</th>
                    <th className="py-2 px-3 text-right">Obj Coef</th>
                    <th className="py-2 px-3">Unit</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {variables.map((v, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => updateVariable(idx, { name: e.target.value })}
                          className="w-28 px-2 py-1 font-mono bg-white border border-slate-200 rounded focus:border-teal-600 focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <select
                          value={v.type}
                          onChange={(e) => {
                            const t = e.target.value as VariableType;
                            updateVariable(idx, {
                              type: t,
                              lb: t === 'binary' ? 0 : v.lb,
                              ub: t === 'binary' ? 1 : v.ub,
                            });
                          }}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded"
                        >
                          <option value="continuous">Continuous</option>
                          <option value="integer">Integer</option>
                          <option value="binary">Binary (0/1)</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="text"
                          disabled={v.type === 'binary'}
                          value={v.lb === null ? '' : v.lb}
                          placeholder="-inf"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === '' || raw === '-inf') updateVariable(idx, { lb: null });
                            else if (!Number.isNaN(Number(raw))) updateVariable(idx, { lb: Number(raw) });
                          }}
                          className="w-20 px-2 py-1 font-mono text-right border border-slate-200 rounded disabled:opacity-50"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="text"
                          disabled={v.type === 'binary'}
                          value={v.ub === null ? '' : v.ub}
                          placeholder="+inf"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === '' || raw === 'inf' || raw === '+inf') updateVariable(idx, { ub: null });
                            else if (!Number.isNaN(Number(raw))) updateVariable(idx, { ub: Number(raw) });
                          }}
                          className="w-20 px-2 py-1 font-mono text-right border border-slate-200 rounded disabled:opacity-50"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={objTerms[v.name] ?? 0}
                          onChange={(e) =>
                            setObjTerms((prev) => ({ ...prev, [v.name]: Number(e.target.value) || 0 }))
                          }
                          className="w-24 px-2 py-1 font-mono text-right border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={v.unit ?? ''}
                          placeholder="units"
                          onChange={(e) => updateVariable(idx, { unit: e.target.value })}
                          className="w-20 px-2 py-1 border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={v.description ?? ''}
                          placeholder="Description"
                          onChange={(e) => updateVariable(idx, { description: e.target.value })}
                          className="w-full min-w-[140px] px-2 py-1 border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        {variables.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariable(idx)}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Constraints Matrix Builder */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-900">
                {t.creator.constraintsTitle} ({constraints.length})
              </div>
              <button
                type="button"
                onClick={addConstraint}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 bg-white hover:bg-teal-50 border border-teal-200 rounded-md"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.creator.addConstraint}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-white">
                    <th className="py-2 px-3">Constraint Name</th>
                    {variables.map((v) => (
                      <th key={v.name} className="py-2 px-2 text-right font-mono min-w-[84px]">
                        {v.name} Coef
                      </th>
                    ))}
                    <th className="py-2 px-2 text-center">Sense</th>
                    <th className="py-2 px-3 text-right">RHS</th>
                    <th className="py-2 px-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {constraints.map((c, cIdx) => (
                    <tr key={cIdx}>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => updateConstraint(cIdx, { name: e.target.value })}
                          className="w-32 px-2 py-1 font-mono bg-white border border-slate-200 rounded"
                        />
                      </td>
                      {variables.map((v) => (
                        <td key={v.name} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            step="any"
                            value={c.terms[v.name] ?? 0}
                            onChange={(e) => updateConstraintCoef(cIdx, v.name, e.target.value)}
                            className="w-20 px-2 py-1 font-mono text-right bg-white border border-slate-200 rounded focus:border-teal-600 focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-2 text-center">
                        <select
                          value={c.sense}
                          onChange={(e) => updateConstraint(cIdx, { sense: e.target.value as ConstraintSense })}
                          className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded"
                        >
                          <option value="<=">&le;</option>
                          <option value=">=">&ge;</option>
                          <option value="==">=</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={c.rhs}
                          onChange={(e) => updateConstraint(cIdx, { rhs: Number(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 font-mono text-right bg-white border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeConstraint(cIdx)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optional Advanced Convex QP Section */}
          <div>
            <button
              type="button"
              onClick={() => setShowQpSection((s) => !s)}
              className="text-xs font-medium text-teal-800 hover:underline"
            >
              {showQpSection ? 'Hide Quadratic Objective Matrix (Convex QP)' : '+ Add Quadratic Risk / Hessian Terms (Optional Convex QP)'}
            </button>
            {showQpSection && (
              <div className="mt-2 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Hessian Terms (0.5 · xᵀQx)</span>
                  <button
                    type="button"
                    onClick={addQuadraticTerm}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded"
                  >
                    + Add Q Term
                  </button>
                </div>
                {quadraticTerms.map((q, qi) => (
                  <div key={qi} className="flex flex-wrap items-center gap-2 text-xs">
                    <select
                      value={q.var1}
                      onChange={(e) =>
                        setQuadraticTerms((prev) => prev.map((it, idx) => (idx === qi ? { ...it, var1: e.target.value } : it)))
                      }
                      className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded"
                    >
                      {variables.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <span>×</span>
                    <select
                      value={q.var2}
                      onChange={(e) =>
                        setQuadraticTerms((prev) => prev.map((it, idx) => (idx === qi ? { ...it, var2: e.target.value } : it)))
                      }
                      className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded"
                    >
                      {variables.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <input
                      type="number"
                      step="any"
                      value={q.coef}
                      onChange={(e) =>
                        setQuadraticTerms((prev) =>
                          prev.map((it, idx) => (idx === qi ? { ...it, coef: Number(e.target.value) || 0 } : it)),
                        )
                      }
                      className="w-24 px-2 py-1 font-mono text-right border border-slate-200 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setQuadraticTerms((prev) => prev.filter((_, idx) => idx !== qi))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Section 3: Live Mathematical Preview & Final Create Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            {validation.valid ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t.creator.readyLabel} ({validation.problemClass} · {validation.numVars} vars · {validation.numConstraints} constraints)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validation.issues.find((i) => i.severity === 'error')?.message}</span>
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {errorMsg && (
              <span className="text-xs font-medium text-red-700 sm:mr-2">{errorMsg}</span>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmitProject(false)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg whitespace-nowrap w-full sm:w-auto"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              {t.actions.saveProjectOnly}
            </button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              disabled={submitting}
              onClick={() => handleSubmitProject(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg whitespace-nowrap w-full sm:w-auto"
            >
              <Play className="w-3.5 h-3.5" />
              {submitting ? t.actions.creatingSolving : t.actions.createAndSolve}
            </motion.button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs overflow-x-auto">
          <div><LatexBlock math={latex.objectiveLatex} /></div>
          {latex.constraintsLatex.map((c, idx) => (
            <div key={idx} className="pl-2"><LatexBlock math={c} /></div>
          ))}
          {latex.boundsLatex && (
            <div className="pt-1 border-t border-slate-200/70">
              <LatexBlock math={latex.boundsLatex} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
