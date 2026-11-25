import { Play, Plus, Trash2, Truck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type {
  AssignmentInput,
  AssignmentResult,
  TransportationInput,
  TransportationResult,
} from '../shared/types.ts';
import { fmtNum } from '../utils/format.ts';
import { MatrixSolveSkeleton } from './SkeletonLoaders.tsx';

type Mode = 'transportation' | 'assignment';

interface TransportationStudioProps {
  externalTransport?: {
    key: number;
    input: TransportationInput;
    result: TransportationResult;
  } | null;
  externalAssignment?: {
    key: number;
    input: AssignmentInput;
    result: AssignmentResult;
  } | null;
}

export function TransportationStudio({
  externalTransport,
  externalAssignment,
}: TransportationStudioProps = {}) {
  const { currencySymbol, t } = useLanguage();
  const [mode, setMode] = useState<Mode>('transportation');

  // Transportation state
  const [sources, setSources] = useState<string[]>(['Dhaka Plant', 'Gazipur Plant', 'Savars Hub']);
  const [destinations, setDestinations] = useState<string[]>(['North Depot', 'South Port', 'West DC', 'Central Hub']);
  const [supply, setSupply] = useState<number[]>([300, 400, 500]);
  const [demand, setDemand] = useState<number[]>([250, 350, 400, 200]);
  const [costs, setCosts] = useState<number[][]>([
    [3, 1, 7, 4],
    [2, 6, 5, 9],
    [8, 3, 3, 2],
  ]);
  const [transResult, setTransResult] = useState<TransportationResult | null>(null);
  const [transLoading, setTransLoading] = useState(false);
  const [transError, setTransError] = useState<string | null>(null);

  // Assignment state
  const [agents, setAgents] = useState<string[]>(['Analyst A', 'Analyst B', 'Analyst C', 'Analyst D']);
  const [tasks, setTasks] = useState<string[]>(['Audit', 'Forecast', 'Risk', 'Tax']);
  const [assignMatrix, setAssignMatrix] = useState<number[][]>([
    [9, 2, 7, 8],
    [6, 4, 3, 7],
    [5, 8, 1, 8],
    [7, 6, 9, 4],
  ]);
  const [assignSense, setAssignSense] = useState<'min' | 'max'>('min');
  const [assignResult, setAssignResult] = useState<AssignmentResult | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (!externalTransport) return;
    setMode('transportation');
    setSources(externalTransport.input.sources);
    setDestinations(externalTransport.input.destinations);
    setSupply(externalTransport.input.supply);
    setDemand(externalTransport.input.demand);
    setCosts(externalTransport.input.costs);
    setTransResult(externalTransport.result);
    setTransError(null);
  }, [externalTransport]);

  useEffect(() => {
    if (!externalAssignment) return;
    setMode('assignment');
    setAgents(externalAssignment.input.agents);
    setTasks(externalAssignment.input.tasks);
    setAssignMatrix(externalAssignment.input.matrix);
    setAssignSense(externalAssignment.input.sense);
    setAssignResult(externalAssignment.result);
    setAssignError(null);
  }, [externalAssignment]);

  const loadUnbalancedPreset = () => {
    setSources(['Factory 1', 'Factory 2', 'Factory 3']);
    setDestinations(['Market A', 'Market B', 'Market C']);
    setSupply([450, 300, 350]); // Total 1100
    setDemand([300, 350, 250]); // Total 900 -> triggers Dummy Destination (200)
    setCosts([
      [8, 6, 10],
      [9, 12, 13],
      [14, 9, 16],
    ]);
    setTransResult(null);
  };

  const addSource = () => {
    setSources((p) => [...p, `Source ${p.length + 1}`]);
    setSupply((p) => [...p, 200]);
    setCosts((p) => [...p, new Array(destinations.length).fill(5)]);
  };

  const removeSource = (idx: number) => {
    if (sources.length <= 1) return;
    setSources((p) => p.filter((_, i) => i !== idx));
    setSupply((p) => p.filter((_, i) => i !== idx));
    setCosts((p) => p.filter((_, i) => i !== idx));
  };

  const addDestination = () => {
    setDestinations((p) => [...p, `Dest ${p.length + 1}`]);
    setDemand((p) => [...p, 200]);
    setCosts((p) => p.map((r) => [...r, 5]));
  };

  const removeDestination = (idx: number) => {
    if (destinations.length <= 1) return;
    setDestinations((p) => p.filter((_, i) => i !== idx));
    setDemand((p) => p.filter((_, i) => i !== idx));
    setCosts((p) => p.map((r) => r.filter((_, j) => j !== idx)));
  };

  const solveTransport = async () => {
    setTransLoading(true);
    setTransError(null);
    try {
      const res = await fetch('/api/transportation/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources, destinations, supply, demand, costs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transportation solve failed');
      setTransResult(data.result);
    } catch (err) {
      setTransError(err instanceof Error ? err.message : 'Solve error');
    } finally {
      setTransLoading(false);
    }
  };

  const addAgent = () => {
    setAgents((p) => [...p, `Agent ${p.length + 1}`]);
    setAssignMatrix((p) => [...p, new Array(tasks.length).fill(5)]);
  };

  const addTask = () => {
    setTasks((p) => [...p, `Task ${p.length + 1}`]);
    setAssignMatrix((p) => p.map((r) => [...r, 5]));
  };

  const solveAssignment = async () => {
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await fetch('/api/assignment/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents, tasks, matrix: assignMatrix, sense: assignSense }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment solve failed');
      setAssignResult(data.result);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assignment solve error');
    } finally {
      setAssignLoading(false);
    }
  };

  const totalSupply = supply.reduce((a, b) => a + b, 0);
  const totalDemand = demand.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {t.transport.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.transport.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto no-scrollbar max-w-full w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMode('transportation')}
            className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap flex-1 sm:flex-initial transition-colors duration-100 ${
              mode === 'transportation' ? 'text-slate-900' : 'text-slate-600'
            }`}
          >
            {mode === 'transportation' && (
              <motion.span
                layoutId="transport-mode-pill"
                transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                className="absolute inset-0 bg-white rounded-md shadow-xs"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              {t.transport.modeTransport}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('assignment')}
            className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap flex-1 sm:flex-initial transition-colors duration-100 ${
              mode === 'assignment' ? 'text-slate-900' : 'text-slate-600'
            }`}
          >
            {mode === 'assignment' && (
              <motion.span
                layoutId="transport-mode-pill"
                transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                className="absolute inset-0 bg-white rounded-md shadow-xs"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {t.transport.modeAssign}
            </span>
          </button>
        </div>
      </div>

      {/* MODE 1: TRANSPORTATION PROBLEM */}
      {mode === 'transportation' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-mono tabular-nums">
                Total Supply: <strong className="text-slate-900">{totalSupply}</strong> · Total Demand:{' '}
                <strong className="text-slate-900">{totalDemand}</strong> · Status:{' '}
                <strong className={Math.abs(totalSupply - totalDemand) < 1e-6 ? 'text-emerald-700' : 'text-amber-700'}>
                  {Math.abs(totalSupply - totalDemand) < 1e-6 ? 'Balanced' : 'Unbalanced (Auto-Dummy)'}
                </strong>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loadUnbalancedPreset}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
                >
                  Load Unbalanced Preset
                </button>
                <button
                  type="button"
                  onClick={addSource}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Source
                </button>
                <button
                  type="button"
                  onClick={addDestination}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Dest
                </button>
                <button
                  type="button"
                  disabled={transLoading}
                  onClick={solveTransport}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
                >
                  <Play className="w-3.5 h-3.5" />
                  {transLoading ? t.actions.solving : t.transport.solveTransport}
                </button>
              </div>
            </div>

            {transError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {transError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3">Source \ Destination Cost</th>
                    {destinations.map((d, j) => (
                      <th key={j} className="py-2 px-2 min-w-[110px]">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={d}
                            onChange={(e) => setDestinations((p) => p.map((x, idx) => (idx === j ? e.target.value : x)))}
                            className="w-24 px-1.5 py-1 font-medium text-slate-900 bg-white border border-slate-200 rounded"
                          />
                          {destinations.length > 1 && (
                            <button type="button" onClick={() => removeDestination(j)} className="text-slate-400 hover:text-red-600">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-2 px-3 text-right bg-teal-50/60 text-teal-900">Supply</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={s}
                            onChange={(e) => setSources((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
                            className="w-32 px-2 py-1 font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded"
                          />
                          {sources.length > 1 && (
                            <button type="button" onClick={() => removeSource(i)} className="text-slate-400 hover:text-red-600">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      {destinations.map((_, j) => (
                        <td key={j} className="py-1.5 px-2">
                          <input
                            type="number"
                            step="any"
                            value={costs[i]?.[j] ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCosts((p) => p.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === j ? val : c)) : r)));
                            }}
                            className="w-20 px-2 py-1 font-mono text-right bg-white border border-slate-200 rounded focus:border-teal-600 focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-right bg-teal-50/40">
                        <input
                          type="number"
                          min={0}
                          value={supply[i] ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setSupply((p) => p.map((v, ri) => (ri === i ? val : v)));
                          }}
                          className="w-24 px-2 py-1 font-mono font-semibold text-right bg-white border border-teal-200 rounded"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50/50 font-semibold">
                    <td className="py-2 px-3 text-amber-900">Demand</td>
                    {destinations.map((_, j) => (
                      <td key={j} className="py-1.5 px-2">
                        <input
                          type="number"
                          min={0}
                          value={demand[j] ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setDemand((p) => p.map((v, ci) => (ci === j ? val : v)));
                          }}
                          className="w-20 px-2 py-1 font-mono text-right bg-white border border-amber-200 rounded"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {totalSupply} / {totalDemand}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {transLoading && <MatrixSolveSkeleton />}

          {!transLoading && transResult && (
            <div className="space-y-5">
              {/* Staggered Animated KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.25, delay: 0 }}
                  className="bg-white border border-slate-200 rounded-xl p-4"
                >
                  <div className="text-xs text-slate-500">Minimum Transportation Cost</div>
                  <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-teal-800">
                    {currencySymbol}{fmtNum(transResult.optimalTotalCost, 2)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{transResult.status} (HiGHS LP)</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.25, delay: 0.05 }}
                  className="bg-white border border-slate-200 rounded-xl p-4"
                >
                  <div className="text-xs text-slate-500">Vogel&apos;s Initial BFS (VAM)</div>
                  <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
                    {currencySymbol}{fmtNum(transResult.vamTotalCost, 2)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{transResult.vamSteps.length} VAM allocations</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.25, delay: 0.1 }}
                  className="bg-white border border-slate-200 rounded-xl p-4"
                >
                  <div className="text-xs text-slate-500">Optimization Gain vs VAM</div>
                  <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-emerald-700">
                    {currencySymbol}{fmtNum(transResult.costSavingsVsVam, 2)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Saved via exact LP pivot</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.25, delay: 0.15 }}
                  className="bg-white border border-slate-200 rounded-xl p-4"
                >
                  <div className="text-xs text-slate-500">Network Balance</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {transResult.balanced ? 'Balanced' : 'Dummy Node Inserted'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">{transResult.balanceNote}</div>
                </motion.div>
              </div>

              {/* Optimal Shipment Matrix + Bipartite SVG Flow Graph */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Optimal Shipment Plan (Units &amp; Unit Cost)</h3>
                    <span className="text-xs font-mono text-slate-500">Dual potentials uᵢ / vⱼ shown</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <th className="py-2 px-3">Source (uᵢ)</th>
                          {transResult.effectiveDestinations.map((d, j) => (
                            <th key={j} className="py-2 px-3 text-right">
                              <div>{d}</div>
                              <div className="font-mono text-[10px] text-teal-700">v={fmtNum(transResult.vPotentials[j], 1)}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transResult.effectiveSources.map((s, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 font-medium text-slate-900">
                              <div>{s}</div>
                              <div className="font-mono text-[10px] text-teal-700">u={fmtNum(transResult.uPotentials[i], 1)}</div>
                            </td>
                            {transResult.effectiveDestinations.map((_, j) => {
                              const qty = transResult.optimalAllocations[i][j];
                              const unitC = transResult.effectiveCosts[i][j];
                              return (
                                <td
                                  key={j}
                                  className={`py-2 px-3 text-right font-mono tabular-nums ${
                                    qty > 1e-6 ? 'bg-teal-50/70 font-semibold text-teal-900' : 'text-slate-300'
                                  }`}
                                >
                                  <div>{qty > 1e-6 ? fmtNum(qty, 2) : '0'}</div>
                                  <div className="text-[10px] text-slate-400">@{unitC}</div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bipartite Distribution Network Graph */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">Optimal Distribution Flow Graph</h3>
                  <svg viewBox="0 0 420 260" className="w-full h-48 sm:h-60 bg-slate-50/50 border border-slate-100 rounded-lg">
                    {(() => {
                      const M = transResult.effectiveSources.length;
                      const N = transResult.effectiveDestinations.length;
                      const sy = (i: number) => 34 + (i * 192) / Math.max(1, M - 1);
                      const dy = (j: number) => 34 + (j * 192) / Math.max(1, N - 1);
                      const maxFlow = Math.max(1, ...transResult.optimalAllocations.flat());

                      return (
                        <>
                          {transResult.effectiveSources.map((_, i) =>
                            transResult.effectiveDestinations.map((__, j) => {
                              const flow = transResult.optimalAllocations[i][j];
                              if (flow <= 1e-6) return null;
                              const y1 = M === 1 ? 130 : sy(i);
                              const y2 = N === 1 ? 130 : dy(j);
                              const width = 1.5 + (flow / maxFlow) * 4;
                              return (
                                <g key={`${i}_${j}`}>
                                  <line x1={120} y1={y1} x2={300} y2={y2} stroke="#0f766e" strokeWidth={width} strokeOpacity={0.7} />
                                  <text
                                    x={210 + (j - i) * 6}
                                    y={(y1 + y2) / 2 - 4}
                                    textAnchor="middle"
                                    className="fill-slate-800 text-[9px] font-mono font-semibold"
                                  >
                                    {fmtNum(flow, 0)}
                                  </text>
                                </g>
                              );
                            }),
                          )}
                          {transResult.effectiveSources.map((s, i) => {
                            const y = M === 1 ? 130 : sy(i);
                            return (
                              <g key={s}>
                                <circle cx={114} cy={y} r={6} fill="#0f172a" />
                                <text x={102} y={y + 3} textAnchor="end" className="fill-slate-800 text-[10px] font-medium">
                                  {s}
                                </text>
                              </g>
                            );
                          })}
                          {transResult.effectiveDestinations.map((d, j) => {
                            const y = N === 1 ? 130 : dy(j);
                            return (
                              <g key={d}>
                                <circle cx={306} cy={y} r={6} fill="#0f766e" />
                                <text x={318} y={y + 3} textAnchor="start" className="fill-slate-800 text-[10px] font-medium">
                                  {d}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>

              {/* VAM Step-by-Step Trace */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Vogel&apos;s Approximation Method (VAM) Step-by-Step Trace</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {transResult.vamSteps.map((st) => (
                    <div key={st.step} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="font-mono font-semibold text-slate-900">Step {st.step}: {st.allocation}</div>
                      <div className="text-slate-500 mt-0.5">{st.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: HUNGARIAN ASSIGNMENT PROBLEM */}
      {mode === 'assignment' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 font-medium">Objective Sense:</span>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAssignSense('min')}
                    className={`px-2.5 py-1 rounded-md font-medium ${assignSense === 'min' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    Min Cost
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignSense('max')}
                    className={`px-2.5 py-1 rounded-md font-medium ${assignSense === 'max' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    Max Profit
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={addAgent}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agent Row
                </button>
                <button
                  type="button"
                  onClick={addTask}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Task Col
                </button>
                <button
                  type="button"
                  disabled={assignLoading}
                  onClick={solveAssignment}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                >
                  <Play className="w-3.5 h-3.5" />
                  {assignLoading ? t.actions.solving : t.transport.solveAssign}
                </button>
              </div>
            </div>

            {assignError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {assignError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3">Agent \ Task</th>
                    {tasks.map((t, j) => (
                      <th key={j} className="py-2 px-2">
                        <input
                          type="text"
                          value={t}
                          onChange={(e) => setTasks((p) => p.map((x, idx) => (idx === j ? e.target.value : x)))}
                          className="w-24 px-1.5 py-1 font-medium text-slate-900 bg-white border border-slate-200 rounded"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map((a, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={a}
                          onChange={(e) => setAgents((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
                          className="w-28 px-2 py-1 font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded"
                        />
                      </td>
                      {tasks.map((_, j) => {
                        const isAssigned = assignResult?.assignments.some((as) => as.row === i && as.col === j && !as.isDummy);
                        return (
                          <td key={j} className={`py-1.5 px-2 ${isAssigned ? 'bg-teal-50/80' : ''}`}>
                            <input
                              type="number"
                              step="any"
                              value={assignMatrix[i]?.[j] ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setAssignMatrix((p) => p.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === j ? val : c)) : r)));
                              }}
                              className={`w-20 px-2 py-1 font-mono text-right border rounded focus:outline-none ${
                                isAssigned ? 'border-teal-600 bg-white font-bold text-teal-900' : 'border-slate-200 bg-white'
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {assignLoading && <MatrixSolveSkeleton />}

          {!assignLoading && assignResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5"
            >
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Optimal 1-to-1 Assignment</h3>
                  <span className="font-mono font-bold text-sm text-teal-800">
                    Total {assignResult.sense === 'max' ? 'Score' : 'Cost'}: {currencySymbol}{fmtNum(assignResult.totalCost, 2)}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {assignResult.assignments.map((a, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="font-medium text-slate-900">
                        {a.agent} → <strong className="text-teal-800">{a.task}</strong>
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {a.isDummy ? 'Dummy (0)' : fmtNum(a.cost, 2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  {assignResult.steps.map((st, idx) => (
                    <div key={idx} className="text-xs text-slate-600">• {st}</div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Hungarian Reduced Cost Matrix (Row &amp; Col Reduced)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-2">Agent \ Task</th>
                        {assignResult.effectiveTasks.map((t, j) => (
                          <th key={j} className="py-2 px-2 text-right">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {assignResult.effectiveAgents.map((a, i) => (
                        <tr key={i}>
                          <td className="py-2 px-2 font-sans font-medium text-slate-800">{a}</td>
                          {assignResult.step2ColReduced[i].map((val, j) => {
                            const picked = assignResult.assignments.some((as) => as.row === i && as.col === j);
                            return (
                              <td
                                key={j}
                                className={`py-2 px-2 text-right ${picked ? 'bg-teal-100/70 text-teal-900 font-bold' : 'text-slate-600'}`}
                              >
                                {fmtNum(val, 2)}{picked ? ' *' : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
