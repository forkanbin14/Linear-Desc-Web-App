import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Layers, Play, Share2, SlidersHorizontal, Sparkles, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { ModelSpec, SolveRun, SolverParams } from '../shared/types.ts';
import { downloadTextFile, fmtBound, fmtDate, fmtNum } from '../utils/format.ts';
import { exportSolveResultPdf } from '../utils/pdfExport.ts';
import { GraphicalCornerView } from './GraphicalCornerView.tsx';
import {
  AllocationAndContributionChart,
  ConstraintUtilizationChart,
  FeasibleRegion2DChart,
} from './OptimizationCharts.tsx';
import { AiTextSkeleton, SolveWorkspaceSkeleton } from './SkeletonLoaders.tsx';

interface SolveWorkspaceProps {
  spec: ModelSpec;
  activeRun: SolveRun | null;
  runs: SolveRun[];
  onSelectRun: (runId: string) => void;
  solverParams: SolverParams;
  onChangeParams: (next: SolverParams) => void;
  onExecuteSolve: () => Promise<void>;
  solving: boolean;
  isDirty: boolean;
  onJumpToIis: () => void;
  onExplainRun: (runId: string, lang: 'en' | 'bn') => Promise<string>;
  onOpenShare?: () => void;
}

export function SolveWorkspace({
  spec,
  activeRun,
  runs,
  onSelectRun,
  solverParams,
  onChangeParams,
  onExecuteSolve,
  solving,
  isDirty,
  onJumpToIis,
  onExplainRun,
  onOpenShare,
}: SolveWorkspaceProps) {
  const { lang, currency, currencySymbol, t } = useLanguage();
  const [explainLang, setExplainLang] = useState<'en' | 'bn'>(lang);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'graphical'>('overview');

  const activeCurrency = spec.currency ?? currency;
  const activeSymbol = activeCurrency === 'USD' ? '$' : '৳';

  useEffect(() => {
    setExplainLang(lang);
  }, [lang]);

  const result = activeRun?.result ?? null;

  const exportCsvSolution = () => {
    if (!result) return;
    const rows: string[] = ['Section,Name,TypeOrSense,ValueOrLHS,RHSOrLower,UpperOrSlack,ShadowPriceOrReducedCost,Status'];
    for (const v of result.variableDetails) {
      rows.push(
        `Variable,"${v.name}",${v.type},${v.value},${v.lb ?? '-inf'},${v.ub ?? '+inf'},${v.reducedCost ?? ''},"${v.basisStatus ?? v.atBound}"`,
      );
    }
    for (const c of result.constraintDetails) {
      rows.push(
        `Constraint,"${c.name}",${c.sense},${c.activity},${c.rhs},${c.slack},${c.shadowPrice ?? ''},"${c.binding ? 'Binding' : 'Slack'}"`,
      );
    }
    downloadTextFile(`${spec.name.replace(/\s+/g, '_')}_solution.csv`, rows.join('\n'), 'text/csv');
  };

  const handleExplain = async () => {
    if (!activeRun) return;
    setExplaining(true);
    setExplainError(null);
    try {
      await onExplainRun(activeRun.id, explainLang);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'AI explanation failed');
    } finally {
      setExplaining(false);
    }
  };

  const maxAbsVar = result
    ? Math.max(1e-9, ...result.variableDetails.map((v) => Math.abs(v.value)))
    : 1;

  const bindingCount = result ? result.constraintDetails.filter((c) => c.binding).length : 0;

  return (
    <div className="space-y-5">
      {/* Solver Configuration Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-500 mt-0.5 sm:mt-0 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t.solve.engineTitle}</h2>
              <p className="text-xs text-slate-500">
                {t.solve.engineDesc}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto min-w-0">
            {runs.length > 0 && (
              <select
                value={activeRun?.id ?? ''}
                onChange={(e) => onSelectRun(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 px-3 py-1.5 min-h-[38px] sm:min-h-0 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 truncate"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    Run {r.id.slice(-6)} · v{r.versionNumber} · {r.result.status.toUpperCase()} ({fmtDate(r.createdAt)})
                  </option>
                ))}
              </select>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              disabled={solving || isDirty}
              title={isDirty ? 'Commit draft edits first to maintain version auditability' : 'Run HiGHS optimization'}
              onClick={onExecuteSolve}
              className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              {solving ? t.actions.solving : t.actions.executeSolve}
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 pt-3.5 sm:pt-4 text-xs">
          <label className="block">
            <span className="text-slate-500 font-medium">Solver Adapter</span>
            <select
              value={solverParams.solverId}
              onChange={(e) =>
                onChangeParams({ ...solverParams, solverId: e.target.value as SolverParams['solverId'] })
              }
              className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            >
              <option value="highs-wasm">HiGHS WASM (Default)</option>
              <option value="gurobi-byol" disabled>Gurobi BYOL (Enterprise License)</option>
              <option value="cplex-byol" disabled>IBM CPLEX BYOL (Enterprise)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-slate-500 font-medium">Time Limit (sec)</span>
            <input
              type="number"
              min={1}
              max={3600}
              value={solverParams.timeLimitSec}
              onChange={(e) =>
                onChangeParams({ ...solverParams, timeLimitSec: Math.max(1, Number(e.target.value) || 60) })
              }
              className="mt-1 w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-slate-500 font-medium">MIP Rel Gap</span>
            <input
              type="number"
              step="0.0001"
              min={0}
              max={1}
              value={solverParams.mipRelGap}
              onChange={(e) =>
                onChangeParams({ ...solverParams, mipRelGap: Math.max(0, Number(e.target.value) || 0) })
              }
              className="mt-1 w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-slate-500 font-medium">Presolve</span>
            <select
              value={solverParams.presolve}
              onChange={(e) =>
                onChangeParams({ ...solverParams, presolve: e.target.value as SolverParams['presolve'] })
              }
              className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            >
              <option value="on">On (Recommended)</option>
              <option value="choose">Auto Choose</option>
              <option value="off">Off (Raw Diagnostics)</option>
            </select>
          </label>

          <div className="flex flex-col justify-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={solverParams.autoScale}
                onChange={(e) => onChangeParams({ ...solverParams, autoScale: e.target.checked })}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              Equilibration Scaling
            </label>
          </div>
        </div>
      </div>

      {/* Shimmer Loading Skeleton State */}
      {solving && <SolveWorkspaceSkeleton />}

      {/* Empty State */}
      {!solving && !result && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <div className="text-sm font-semibold text-slate-900">{t.solve.emptyTitle}</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {t.solve.emptyDesc}
          </p>
          <button
            type="button"
            disabled={isDirty}
            onClick={onExecuteSolve}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
          >
            <Play className="w-3.5 h-3.5" />
            {t.solve.runFirst}
          </button>
        </div>
      )}

      {/* Populated Results */}
      {!solving && result && (
        <>
          {/* Staggered Animated 4-Column KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.25, delay: 0.0, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="text-xs text-slate-500">{t.solve.kpiStatus}</div>
              <div className="mt-1.5 flex items-center gap-2">
                {result.status === 'optimal' || result.status === 'feasible' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span
                  className={`text-lg font-semibold ${
                    result.status === 'optimal'
                      ? 'text-emerald-700'
                      : result.status === 'infeasible' || result.status === 'unbounded'
                        ? 'text-red-700'
                        : 'text-amber-700'
                  }`}
                >
                  {result.rawStatus}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono">
                {result.problemClass} · {result.solverVersion}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.25, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
                <span>
                  {t.solve.kpiObjective} ({spec.objective.sense.toUpperCase()})
                </span>
                <span className="font-mono text-[11px] font-semibold text-teal-700">
                  {activeCurrency} ({activeSymbol || currencySymbol})
                </span>
              </div>
              <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
                {result.objective !== null ? `${activeSymbol}${fmtNum(result.objective, 4)}` : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {result.mipGap !== null ? `MIP Gap: ${(result.mipGap * 100).toFixed(3)}%` : `Capital: ${activeCurrency} · Exact Optimum`}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.25, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="text-xs text-slate-500">{t.solve.kpiExecution}</div>
              <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
                {fmtNum(result.solveTimeMs, 2)} ms
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {result.iterations} simplex iters · {result.mipNodes} MIP nodes
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.25, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="text-xs text-slate-500">{t.solve.kpiBottlenecks}</div>
              <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
                {bindingCount} / {result.constraintDetails.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t.solve.bindingAtOptimum}
              </div>
            </motion.div>
          </div>

          {/* Multiple Optimal Solutions Alert Banner (Capability #5) */}
          {result.multipleOptimal?.detected && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-amber-900">
                    {t.solve.multipleOptTitle}
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {result.multipleOptimal.note}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('graphical')}
                className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg whitespace-nowrap"
              >
                {t.solve.multipleOptAction}
              </button>
            </div>
          )}

          {/* Infeasible / Unbounded Alert Banner */}
          {(result.status === 'infeasible' || result.status === 'unbounded') && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-900">
                    {result.status === 'infeasible'
                      ? 'No Feasible Solution Exists — IIS Conflict Detected'
                      : 'Model Is Unbounded — Primal Ray Detected'}
                  </div>
                  <p className="text-xs text-red-700 mt-0.5">
                    {result.iis?.summary || result.unboundedDiagnosis?.summary}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onJumpToIis}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg whitespace-nowrap"
              >
                Inspect Conflict &amp; Relaxations
              </button>
            </div>
          )}

          {/* Export Strip & AI Explainer */}
          {(result.status === 'optimal' || result.status === 'feasible') && (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t.solve.explainerTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t.solve.explainerDesc}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setExplainLang('en')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                        explainLang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setExplainLang('bn')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                        explainLang === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      বাংলা
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={explaining}
                    onClick={handleExplain}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    {explaining ? t.solve.explainingBtn : t.solve.explainBtn}
                  </button>

                  <button
                    type="button"
                    onClick={() => exportSolveResultPdf(spec, result, activeRun?.versionNumber)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-red-700" />
                    {t.actions.exportPdf}
                  </button>

                  <a
                    href={`/api/runs/${activeRun!.id}/export/xlsx`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    {t.actions.exportExcel}
                  </a>

                  <button
                    type="button"
                    onClick={exportCsvSolution}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    {t.actions.exportCsv}
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadTextFile(`${spec.name.replace(/\s+/g, '_')}.lp`, result.lpText)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    {t.actions.exportLp}
                  </button>

                  {onOpenShare && (
                    <button
                      type="button"
                      onClick={onOpenShare}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg whitespace-nowrap"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                      {t.actions.share}
                    </button>
                  )}
                </div>
              </div>

              {explainError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {explainError}
                </div>
              )}

              {explaining && <AiTextSkeleton />}

              {!explaining && activeRun?.aiExplanation && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed whitespace-pre-wrap"
                >
                  {activeRun.aiExplanation}
                </motion.div>
              )}
            </div>
          )}

          {/* Workspace View Mode Switch: Executive Charts vs Corner Point / Steps / LHS=RHS */}
          <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg w-full sm:w-fit overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setViewMode('overview')}
              className={`relative px-3 py-1.5 rounded-md font-medium whitespace-nowrap shrink-0 transition-colors duration-100 ${
                viewMode === 'overview' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {viewMode === 'overview' && (
                <motion.span
                  layoutId="solve-viewmode-pill"
                  transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                  className="absolute inset-0 bg-slate-900 rounded-md"
                />
              )}
              <span className="relative z-10">{t.solve.viewOverview}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graphical')}
              className={`relative px-3 py-1.5 rounded-md font-medium whitespace-nowrap shrink-0 transition-colors duration-100 ${
                viewMode === 'graphical' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {viewMode === 'graphical' && (
                <motion.span
                  layoutId="solve-viewmode-pill"
                  transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                  className="absolute inset-0 bg-slate-900 rounded-md"
                />
              )}
              <span className="relative z-10">{t.solve.viewGraphical}</span>
            </button>
          </div>

          {viewMode === 'graphical' ? (
            <GraphicalCornerView spec={spec} result={result} />
          ) : (
            <>
              {/* Visual Analytics & Feasible Region Graphs */}
              {(result.status === 'optimal' || result.status === 'feasible') && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <AllocationAndContributionChart
                      variables={result.variableDetails}
                      sense={spec.objective.sense}
                    />
                    <ConstraintUtilizationChart constraints={result.constraintDetails} />
                  </div>
                  <FeasibleRegion2DChart spec={spec} result={result} />
                </div>
              )}

              {result.status === 'infeasible' && spec.variables.length >= 2 && (
                <FeasibleRegion2DChart spec={spec} result={result} />
              )}

          {/* Decision Variables Allocation Table + Bars */}
          {result.variableDetails.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t.solve.varsTableTitle}</h3>
                  <p className="text-xs text-slate-500">Primal allocations, objective contributions, and reduced costs.</p>
                </div>
                <span className="text-xs font-mono text-slate-400">{result.variableDetails.length} variables</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3">Variable</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Optimal Value</th>
                      <th className="py-2.5 px-3 w-44">Allocation Magnitude</th>
                      <th className="py-2.5 px-3 text-right">Bounds [LB, UB]</th>
                      <th className="py-2.5 px-3 text-right">Obj Coef</th>
                      <th className="py-2.5 px-3 text-right">Reduced Cost</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.variableDetails.map((v, idx) => {
                      const pct = Math.min(100, Math.round((Math.abs(v.value) / maxAbsVar) * 100));
                      return (
                        <tr key={v.name} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-mono font-medium text-slate-900">
                            {v.name}
                            {v.unit ? <span className="ml-1.5 text-slate-400 font-sans">({v.unit})</span> : null}
                          </td>
                          <td className="py-2 px-3 text-slate-600 capitalize">{v.type}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                            {fmtNum(v.value, 4)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.4, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                                className={`h-full rounded-full ${v.value >= 0 ? 'bg-teal-600' : 'bg-amber-600'}`}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                            [{fmtBound(v.lb, '-∞')}, {fmtBound(v.ub, '+∞')}]
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                            {fmtNum(v.objCoef, 4)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                            {v.reducedCost !== null ? fmtNum(v.reducedCost, 4) : '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {v.basisStatus ?? (v.atBound === 'interior' ? 'Interior' : `At ${v.atBound}`)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Constraints Activity & Shadow Price Table */}
          {result.constraintDetails.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t.solve.consTableTitle}</h3>
                  <p className="text-xs text-slate-500">
                    Binding constraints limit the objective; Shadow Price shows objective change per +1 unit relaxation of RHS.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">{result.constraintDetails.length} rows</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3">Constraint</th>
                      <th className="py-2.5 px-3 text-right">Activity (LHS)</th>
                      <th className="py-2.5 px-3 text-center">Sense</th>
                      <th className="py-2.5 px-3 text-right">Limit (RHS)</th>
                      <th className="py-2.5 px-3 text-right">Slack</th>
                      <th className="py-2.5 px-3 w-32">Utilization</th>
                      <th className="py-2.5 px-3 text-right">Shadow Price</th>
                      <th className="py-2.5 px-3">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.constraintDetails.map((c) => {
                      const util = c.utilizationPct !== null ? Math.min(100, Math.max(0, c.utilizationPct)) : 0;
                      return (
                        <tr key={c.name} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3">
                            <div className="font-mono font-medium text-slate-900">{c.name}</div>
                            {c.description && <div className="text-slate-500 truncate max-w-xs">{c.description}</div>}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                            {fmtNum(c.activity, 4)}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600">{c.sense}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                            {fmtNum(c.rhs, 4)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                            {fmtNum(c.slack, 4)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${c.binding ? 'bg-amber-600' : 'bg-slate-400'}`}
                                  style={{ width: `${util}%` }}
                                />
                              </div>
                              <span className="font-mono tabular-nums text-slate-500 w-10 text-right">
                                {c.utilizationPct !== null ? `${Math.round(c.utilizationPct)}%` : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-teal-800">
                            {c.shadowPrice !== null ? fmtNum(c.shadowPrice, 4) : '—'}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`font-medium ${c.binding ? 'text-amber-700' : 'text-slate-500'}`}>
                              {c.binding ? 'Binding' : 'Slack'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </>
          )}
        </>
      )}
    </div>
  );
}
