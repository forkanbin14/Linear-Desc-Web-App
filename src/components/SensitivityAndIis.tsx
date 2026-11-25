import { AlertTriangle, CheckCircle2, Info, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { ModelSpec, SolveRun } from '../shared/types.ts';
import { fmtBound, fmtNum } from '../utils/format.ts';
import { SensitivityRhsChart } from './OptimizationCharts.tsx';

interface SensitivityAndIisProps {
  spec: ModelSpec;
  activeRun: SolveRun | null;
  onApplyMinimalRelaxation: (nextSpec: ModelSpec, commitMsg: string) => Promise<void>;
  onDebugInfeasible: (runId: string, lang: 'en' | 'bn') => Promise<string>;
}

export function SensitivityAndIis({
  spec,
  activeRun,
  onApplyMinimalRelaxation,
  onDebugInfeasible,
}: SensitivityAndIisProps) {
  const [debugLang, setDebugLang] = useState<'en' | 'bn'>('en');
  const [debugging, setDebugging] = useState(false);
  const [debugNotes, setDebugNotes] = useState<string | null>(null);
  const [debugErr, setDebugErr] = useState<string | null>(null);
  const [applyingRelax, setApplyingRelax] = useState(false);

  const result = activeRun?.result ?? null;

  if (!result) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
        <div className="text-sm font-semibold text-slate-900">No Solve Run Selected</div>
        <p className="text-xs text-slate-500">
          Execute a solve first to inspect LP sensitivity ranging, shadow prices, or IIS conflict diagnostics.
        </p>
      </div>
    );
  }

  const handleAiDebug = async () => {
    if (!activeRun) return;
    setDebugging(true);
    setDebugErr(null);
    try {
      const text = await onDebugInfeasible(activeRun.id, debugLang);
      setDebugNotes(text);
    } catch (err) {
      setDebugErr(err instanceof Error ? err.message : 'AI diagnosis failed');
    } finally {
      setDebugging(false);
    }
  };

  const handleApplyRelaxation = async () => {
    if (!result.iis || result.iis.minimalRelaxations.length === 0) return;
    setApplyingRelax(true);
    try {
      const cloned: ModelSpec = JSON.parse(JSON.stringify(spec));
      for (const rel of result.iis.minimalRelaxations) {
        if (rel.targetType === 'constraint') {
          const con = cloned.constraints.find((c) => c.name === rel.target);
          if (con) {
            if (con.sense === '<=') con.rhs = Math.ceil((con.rhs + rel.violationAmount) * 1000) / 1000;
            else if (con.sense === '>=') con.rhs = Math.floor((con.rhs - rel.violationAmount) * 1000) / 1000;
          }
        } else if (rel.targetType === 'variable_lb') {
          const v = cloned.variables.find((x) => x.name === rel.target);
          if (v && v.lb !== null) v.lb = Math.floor((v.lb - rel.violationAmount) * 1000) / 1000;
        } else if (rel.targetType === 'variable_ub') {
          const v = cloned.variables.find((x) => x.name === rel.target);
          if (v && v.ub !== null) v.ub = Math.ceil((v.ub + rel.violationAmount) * 1000) / 1000;
        }
      }
      await onApplyMinimalRelaxation(cloned, 'Applied HiGHS minimal feasibility relaxation');
    } finally {
      setApplyingRelax(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* INFEASIBILITY EXPLORER (IIS) */}
      {result.status === 'infeasible' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-red-950">
                    Irreducible Infeasible Subsystem (IIS) Conflict Explorer
                  </h2>
                  <p className="text-xs text-red-800 mt-1">
                    {result.iis?.summary ?? 'This constraint system has no feasible intersection.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-white/80 border border-red-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDebugLang('en')}
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      debugLang === 'en' ? 'bg-red-700 text-white' : 'text-red-900'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebugLang('bn')}
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      debugLang === 'bn' ? 'bg-red-700 text-white' : 'text-red-900'
                    }`}
                  >
                    বাংলা
                  </button>
                </div>
                <button
                  type="button"
                  disabled={debugging}
                  onClick={handleAiDebug}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  {debugging ? 'Diagnosing IIS...' : 'AI Debug Assistant'}
                </button>
              </div>
            </div>

            {debugErr && <div className="text-xs text-red-700">{debugErr}</div>}
            {debugNotes && (
              <div className="p-4 bg-white border border-red-200 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {debugNotes}
              </div>
            )}
          </div>

          {/* Conflicting Constraints Table */}
          {result.iis && result.iis.conflictingConstraints.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">
                  Conflicting Constraints in IIS ({result.iis.conflictingConstraints.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Removing or relaxing any constraint in this minimal subsystem resolves the algebraic contradiction.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3">Constraint Name</th>
                      <th className="py-2.5 px-3">Expression</th>
                      <th className="py-2.5 px-3 text-center">Sense</th>
                      <th className="py-2.5 px-3 text-right">RHS</th>
                      <th className="py-2.5 px-3">Conflict Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.iis.conflictingConstraints.map((c) => {
                      const expr = Object.entries(c.terms)
                        .map(([k, v], i) => `${i > 0 && v >= 0 ? '+ ' : v < 0 ? '- ' : ''}${Math.abs(v)}·${k}`)
                        .join(' ');
                      return (
                        <tr key={c.name} className="bg-red-50/30">
                          <td className="py-2 px-3 font-mono font-semibold text-red-900">{c.name}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{expr}</td>
                          <td className="py-2 px-3 text-center font-mono text-red-800">{c.sense}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-red-900">
                            {fmtNum(c.rhs, 4)}
                          </td>
                          <td className="py-2 px-3 text-red-700 font-medium">{c.boundStatus}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Minimal Feasibility Relaxation Table */}
          {result.iis && result.iis.minimalRelaxations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Minimal Feasibility Relaxation Suggestions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Minimum L1 bound perturbation computed by HiGHS to restore feasibility.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={applyingRelax}
                  onClick={handleApplyRelaxation}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {applyingRelax ? 'Saving New Version...' : 'Apply Relaxation as New Version'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3">Target</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 font-mono">Current Bound</th>
                      <th className="py-2.5 px-3 font-mono">Minimal Relaxed Bound</th>
                      <th className="py-2.5 px-3 text-right">Delta Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.iis.minimalRelaxations.map((r, i) => (
                      <tr key={`${r.target}_${i}`}>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900">{r.target}</td>
                        <td className="py-2 px-3 text-slate-600 capitalize">{r.targetType.replace('_', ' ')}</td>
                        <td className="py-2 px-3 font-mono text-red-700">{r.originalBound}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-emerald-700">{r.suggestedBound}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                          {fmtNum(r.violationAmount, 4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UNBOUNDED DIAGNOSIS */}
      {result.status === 'unbounded' && result.unboundedDiagnosis && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-amber-950">Unbounded Ray Diagnosis</h2>
              <p className="text-xs text-amber-800 mt-1">{result.unboundedDiagnosis.summary}</p>
            </div>
          </div>
          {result.unboundedDiagnosis.variablesInRay.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-50/50 border-b border-amber-200 text-amber-900">
                    <th className="py-2 px-3">Variable</th>
                    <th className="py-2 px-3 text-right">Primal Ray Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {result.unboundedDiagnosis.variablesInRay.map((r) => (
                    <tr key={r.name}>
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{r.name}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-800">
                        {r.rayDirection > 0 ? `+${r.rayDirection}` : r.rayDirection} → ∞
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* LP SENSITIVITY & RANGING REPORT */}
      {(result.status === 'optimal' || result.status === 'feasible') && (
        <>
          {result.problemClass !== 'LP' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-700">
              <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-slate-900">
                  {result.problemClass} Sensitivity Note:
                </span>{' '}
                Continuous simplex shadow prices and allowable ranging intervals are mathematically defined for pure Linear Programs (LP). For {result.problemClass} models, use the <strong>What-If &amp; Compare</strong> tab to sweep constraint capacities and measure discrete objective transitions.
              </div>
            </div>
          )}

          <SensitivityRhsChart constraints={result.constraintDetails} />

          {/* Constraint RHS Sensitivity Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Constraint Shadow Prices &amp; Allowable RHS Ranges
                </h3>
                <p className="text-xs text-slate-500">
                  Shadow Price holds valid while the constraint RHS stays within [Allowable Min, Allowable Max].
                </p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3">Constraint</th>
                    <th className="py-2.5 px-3 text-right">Shadow Price</th>
                    <th className="py-2.5 px-3 text-right">Allowable Min RHS</th>
                    <th className="py-2.5 px-3 text-right">Current RHS</th>
                    <th className="py-2.5 px-3 text-right">Allowable Max RHS</th>
                    <th className="py-2.5 px-3 text-right">Slack</th>
                    <th className="py-2.5 px-3">Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.constraintDetails.map((c) => (
                    <tr key={c.name} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{c.name}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-teal-800">
                        {c.shadowPrice !== null ? fmtNum(c.shadowPrice, 4) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {fmtBound(c.allowableRhsMin, '-∞')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {fmtNum(c.rhs, 4)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {fmtBound(c.allowableRhsMax, '+∞')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {fmtNum(c.slack, 4)}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{c.basisStatus ?? (c.binding ? 'Binding' : 'Slack')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Objective Coefficient Sensitivity Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                Variable Reduced Costs &amp; Allowable Objective Coefficient Ranges
              </h3>
              <p className="text-xs text-slate-500">
                Current primal allocation remains optimal while objective coefficient stays within [Allowable Min, Allowable Max].
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3">Variable</th>
                    <th className="py-2.5 px-3 text-right">Optimal Value</th>
                    <th className="py-2.5 px-3 text-right">Reduced Cost</th>
                    <th className="py-2.5 px-3 text-right">Allowable Min Coef</th>
                    <th className="py-2.5 px-3 text-right">Current Obj Coef</th>
                    <th className="py-2.5 px-3 text-right">Allowable Max Coef</th>
                    <th className="py-2.5 px-3">Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.variableDetails.map((v) => (
                    <tr key={v.name} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{v.name}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                        {fmtNum(v.value, 4)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-amber-800">
                        {v.reducedCost !== null ? fmtNum(v.reducedCost, 4) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {fmtBound(v.allowableObjMin, '-∞')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {fmtNum(v.objCoef, 4)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {fmtBound(v.allowableObjMax, '+∞')}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{v.basisStatus ?? v.atBound}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
