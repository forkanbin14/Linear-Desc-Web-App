import { ArrowRightLeft, LineChart, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ModelSpec, RunComparison, SolveRun, WhatIfPoint } from '../shared/types.ts';
import { fmtDate, fmtNum } from '../utils/format.ts';
import { ScenarioCompareBarChart } from './OptimizationCharts.tsx';

interface ScenarioCompareProps {
  spec: ModelSpec;
  versionId: string;
  runs: SolveRun[];
  externalWhatIf?: {
    key: number;
    targetType: 'constraint_rhs' | 'objective_coef';
    targetName: string;
    minVal: number;
    maxVal: number;
    steps: number;
    points: WhatIfPoint[];
  } | null;
}

export function ScenarioCompare({ spec, versionId, runs, externalWhatIf }: ScenarioCompareProps) {
  // What-If Parametric Sweep state
  const [targetType, setTargetType] = useState<'constraint_rhs' | 'objective_coef'>('constraint_rhs');
  const [targetName, setTargetName] = useState<string>(spec.constraints[0]?.name ?? '');
  const [minVal, setMinVal] = useState<number>(0);
  const [maxVal, setMaxVal] = useState<number>(100);
  const [steps, setSteps] = useState<number>(7);
  const [sweeping, setSweeping] = useState(false);
  const [sweepPoints, setSweepPoints] = useState<WhatIfPoint[]>([]);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [hoveredPtIdx, setHoveredPtIdx] = useState<number | null>(null);

  // Side-by-side Run Compare state
  const [runAId, setRunAId] = useState<string>(runs[1]?.id ?? runs[0]?.id ?? '');
  const [runBId, setRunBId] = useState<string>(runs[0]?.id ?? '');
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [comparing, setComparing] = useState(false);

  // Sync default parameter bounds when model or target changes
  useEffect(() => {
    if (externalWhatIf) return;
    if (targetType === 'constraint_rhs') {
      const first = spec.constraints.find((c) => c.name === targetName) ?? spec.constraints[0];
      if (first) {
        if (first.name !== targetName) setTargetName(first.name);
        const base = first.rhs;
        const span = Math.max(1, Math.abs(base) * 0.4);
        setMinVal(Math.round((base - span) * 100) / 100);
        setMaxVal(Math.round((base + span) * 100) / 100);
      }
    } else {
      const firstVar = spec.variables.find((v) => v.name === targetName) ?? spec.variables[0];
      if (firstVar) {
        if (firstVar.name !== targetName) setTargetName(firstVar.name);
        const base = spec.objective.terms[firstVar.name] ?? 1;
        const span = Math.max(0.5, Math.abs(base) * 0.5);
        setMinVal(Math.round((base - span) * 100) / 100);
        setMaxVal(Math.round((base + span) * 100) / 100);
      }
    }
    setSweepPoints([]);
  }, [spec, targetType, targetName, externalWhatIf]);

  useEffect(() => {
    if (!externalWhatIf) return;
    setTargetType(externalWhatIf.targetType);
    setTargetName(externalWhatIf.targetName);
    setMinVal(externalWhatIf.minVal);
    setMaxVal(externalWhatIf.maxVal);
    setSteps(externalWhatIf.steps);
    setSweepPoints(externalWhatIf.points);
    setSweepError(null);
  }, [externalWhatIf]);

  useEffect(() => {
    if (runs.length >= 1) {
      setRunBId(runs[0].id);
      setRunAId(runs[1]?.id ?? runs[0].id);
    } else {
      setRunAId('');
      setRunBId('');
      setComparison(null);
    }
  }, [runs]);

  useEffect(() => {
    if (!runAId || !runBId) return;
    let cancelled = false;
    const loadCompare = async () => {
      setComparing(true);
      try {
        const res = await fetch(`/api/runs/${runAId}/compare/${runBId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setComparison(data.comparison);
        }
      } finally {
        if (!cancelled) setComparing(false);
      }
    };
    loadCompare();
    return () => {
      cancelled = true;
    };
  }, [runAId, runBId]);

  const runWhatIf = async () => {
    if (!targetName) return;
    setSweeping(true);
    setSweepError(null);
    try {
      const res = await fetch(`/api/models/${versionId}/what-if`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetName, minVal, maxVal, steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sweep failed');
      setSweepPoints(data.points);
    } catch (err) {
      setSweepError(err instanceof Error ? err.message : 'Sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  // Compute SVG chart geometry for feasible sweep points
  const validPts = sweepPoints.filter((p) => p.objective !== null);
  const chartW = 680;
  const chartH = 210;
  const padL = 62;
  const padR = 24;
  const padT = 20;
  const padB = 34;

  const minObj = validPts.length > 0 ? Math.min(...validPts.map((p) => p.objective!)) : 0;
  const maxObj = validPts.length > 0 ? Math.max(...validPts.map((p) => p.objective!)) : 1;
  const objRange = Math.max(1e-6, maxObj - minObj);

  const svgCoords = validPts.map((p) => {
    const idx = sweepPoints.indexOf(p);
    const xRatio = sweepPoints.length <= 1 ? 0.5 : idx / (sweepPoints.length - 1);
    const yRatio = (p.objective! - minObj) / objRange;
    const x = padL + xRatio * (chartW - padL - padR);
    const y = chartH - padB - yRatio * (chartH - padT - padB);
    return { x, y, point: p };
  });

  const polylineStr = svgCoords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div className="space-y-6">
      {/* SECTION 1: INTERACTIVE WHAT-IF PARAMETRIC SWEEP */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-2.5">
            <LineChart className="w-4 h-4 text-teal-700 mt-0.5 sm:mt-0 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                What-If Parametric Sensitivity Sweep
              </h2>
              <p className="text-xs text-slate-500">
                Vary a constraint capacity (RHS) or objective coefficient across multiple solves to trace optimal objective curves and bottleneck shifts.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={sweeping || !targetName}
            onClick={runWhatIf}
            className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg whitespace-nowrap w-full sm:w-auto"
          >
            <Play className="w-3.5 h-3.5" />
            {sweeping ? 'Running Sweep...' : 'Run Parametric Sweep'}
          </button>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-5 gap-3 text-xs pt-2 border-t border-slate-100">
          <label className="block">
            <span className="text-slate-500 font-medium">Parameter Axis</span>
            <select
              value={targetType}
              onChange={(e) => {
                const nextT = e.target.value as 'constraint_rhs' | 'objective_coef';
                setTargetType(nextT);
                setTargetName(
                  nextT === 'constraint_rhs'
                    ? (spec.constraints[0]?.name ?? '')
                    : (spec.variables[0]?.name ?? ''),
                );
              }}
              className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            >
              <option value="constraint_rhs">Constraint RHS Limit</option>
              <option value="objective_coef">Objective Coefficient</option>
            </select>
          </label>

          <label className="block">
            <span className="text-slate-500 font-medium">Target Item</span>
            <select
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            >
              {targetType === 'constraint_rhs'
                ? spec.constraints.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} (base: {c.rhs})
                    </option>
                  ))
                : spec.variables.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} (base: {spec.objective.terms[v.name] ?? 0})
                    </option>
                  ))}
            </select>
          </label>

          <label className="block">
            <span className="text-slate-500 font-medium">Min Value</span>
            <input
              type="number"
              step="any"
              value={minVal}
              onChange={(e) => setMinVal(Number(e.target.value) || 0)}
              className="mt-1 w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-slate-500 font-medium">Max Value</span>
            <input
              type="number"
              step="any"
              value={maxVal}
              onChange={(e) => setMaxVal(Number(e.target.value) || 0)}
              className="mt-1 w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-slate-500 font-medium">Sample Steps</span>
            <input
              type="number"
              min={3}
              max={15}
              value={steps}
              onChange={(e) => setSteps(Math.min(15, Math.max(3, Number(e.target.value) || 7)))}
              className="mt-1 w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
          </label>
        </div>

        {sweepError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {sweepError}
          </div>
        )}

        {sweepPoints.length > 0 && (
          <div className="space-y-4 pt-2">
            {validPts.length >= 2 && (
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40 overflow-x-auto">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full min-w-[460px] max-w-3xl h-52 mx-auto">
                  {/* Horizontal grid lines */}
                  {[0, 0.5, 1].map((t) => {
                    const y = chartH - padB - t * (chartH - padT - padB);
                    const labelVal = minObj + t * objRange;
                    return (
                      <g key={t}>
                        <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                        <text
                          x={padL - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-500 text-[10px] font-mono"
                        >
                          {fmtNum(labelVal, 2)}
                        </text>
                      </g>
                    );
                  })}

                  <polyline
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={polylineStr}
                  />

                  {svgCoords.map((c, idx) => (
                    <g
                      key={idx}
                      onMouseEnter={() => setHoveredPtIdx(idx)}
                      onMouseLeave={() => setHoveredPtIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={hoveredPtIdx === idx ? 6.5 : 4.5}
                        fill="#0f766e"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <text
                        x={c.x}
                        y={chartH - 10}
                        textAnchor="middle"
                        className="fill-slate-600 text-[10px] font-mono"
                      >
                        {fmtNum(c.point.paramValue, 2)}
                      </text>
                    </g>
                  ))}
                </svg>
                {hoveredPtIdx !== null && svgCoords[hoveredPtIdx] && (
                  <div className="mt-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-700 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {targetName} = <strong>{fmtNum(svgCoords[hoveredPtIdx].point.paramValue, 4)}</strong>
                    </span>
                    <span>
                      Objective: <strong className="text-teal-800">{fmtNum(svgCoords[hoveredPtIdx].point.objective, 4)}</strong>
                    </span>
                    <span className="text-slate-500">
                      Binding: {svgCoords[hoveredPtIdx].point.bindingConstraints.join(', ') || 'None'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3 font-mono">{targetName}</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Optimal Objective</th>
                    <th className="py-2 px-3">Binding Constraints</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sweepPoints.map((pt, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono font-medium tabular-nums text-slate-900">
                        {fmtNum(pt.paramValue, 4)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-medium capitalize ${
                            pt.status === 'optimal' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {pt.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {pt.objective !== null ? fmtNum(pt.objective, 4) : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {pt.bindingConstraints.length > 0 ? pt.bindingConstraints.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: SIDE-BY-SIDE SCENARIO COMPARISON */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-2.5">
            <ArrowRightLeft className="w-4 h-4 text-slate-600 mt-0.5 sm:mt-0 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Side-by-Side Scenario Comparison</h2>
              <p className="text-xs text-slate-500">
                Compare two historical runs across versions or solver settings to audit allocation and shadow-price deltas.
              </p>
            </div>
          </div>

          {runs.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs w-full lg:w-auto min-w-0">
              <select
                value={runAId}
                onChange={(e) => setRunAId(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg truncate"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    Baseline: {r.id.slice(-6)} · v{r.versionNumber} ({fmtDate(r.createdAt)})
                  </option>
                ))}
              </select>
              <span className="text-slate-400 text-center hidden sm:inline">vs</span>
              <select
                value={runBId}
                onChange={(e) => setRunBId(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg truncate"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    Scenario: {r.id.slice(-6)} · v{r.versionNumber} ({fmtDate(r.createdAt)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {runs.length < 2 && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            This project currently has {runs.length} recorded run. Commit an edit (or adjust constraints) and execute a second solve to compare scenarios side-by-side.
          </div>
        )}

        {!comparing && comparison && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Baseline Objective (v{comparison.runA.versionNumber})</div>
                <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900">
                  {comparison.runA.result.objective !== null ? fmtNum(comparison.runA.result.objective, 4) : comparison.runA.result.status}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Scenario Objective (v{comparison.runB.versionNumber})</div>
                <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900">
                  {comparison.runB.result.objective !== null ? fmtNum(comparison.runB.result.objective, 4) : comparison.runB.result.status}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Objective Delta (B − A)</div>
                <div
                  className={`mt-1 text-lg font-mono font-semibold tabular-nums ${
                    (comparison.objectiveDelta ?? 0) > 0
                      ? 'text-emerald-700'
                      : (comparison.objectiveDelta ?? 0) < 0
                        ? 'text-red-700'
                        : 'text-slate-700'
                  }`}
                >
                  {comparison.objectiveDelta !== null
                    ? `${comparison.objectiveDelta > 0 ? '+' : ''}${fmtNum(comparison.objectiveDelta, 4)} (${
                        comparison.objectivePctDelta !== null ? `${comparison.objectivePctDelta > 0 ? '+' : ''}${comparison.objectivePctDelta.toFixed(2)}%` : '0%'
                      })`
                    : '—'}
                </div>
              </div>
            </div>

            <ScenarioCompareBarChart deltas={comparison.variableDeltas} />

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3">Decision Variable</th>
                    <th className="py-2 px-3 text-right">Baseline Value</th>
                    <th className="py-2 px-3 text-right">Scenario Value</th>
                    <th className="py-2 px-3 text-right">Allocation Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparison.variableDeltas.map((row) => (
                    <tr key={row.name}>
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{row.name}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {fmtNum(row.valueA, 4)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {fmtNum(row.valueB, 4)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-semibold tabular-nums ${
                          (row.delta ?? 0) > 1e-6
                            ? 'text-emerald-700'
                            : (row.delta ?? 0) < -1e-6
                              ? 'text-red-700'
                              : 'text-slate-400'
                        }`}
                      >
                        {row.delta !== null ? `${row.delta > 0 ? '+' : ''}${fmtNum(row.delta, 4)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
