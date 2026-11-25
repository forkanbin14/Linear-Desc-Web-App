import { Code, Download, Layers, Play, Terminal } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { BatchSolveItemResult } from '../shared/types.ts';
import { downloadTextFile, fmtNum } from '../utils/format.ts';
import { AiTextSkeleton, MatrixSolveSkeleton } from './SkeletonLoaders.tsx';

const DEFAULT_BATCH_SCRIPT = `=== Problem 1: HSC Textile Production Mix ===
Maximize Z = 40x + 30y
2x + y <= 100
x + 2y <= 80
x, y >= 0

=== Problem 2: Diet Cost Minimization ===
Minimize Z = 20x1 + 24x2
3x1 + 2x2 >= 18
x1 + 4x2 >= 12
x1, x2 >= 0

=== Problem 3: Binary Knapsack Allocation ===
Maximize Z = 15b1 + 22b2 + 18b3 + 12b4
4b1 + 6b2 + 5b3 + 3b4 <= 11
binary: b1, b2, b3, b4

=== Problem 4: Multiple Optimal Edge Demo ===
Maximize Z = 6x + 4y
3x + 2y <= 18
x <= 4
y <= 6
x, y >= 0`;

interface BatchAndApiPanelProps {
  externalBatch?: {
    key: number;
    batchText: string;
    summary: {
      total: number;
      optimalCount: number;
      failedCount: number;
      totalTimeMs: number;
    };
    results: BatchSolveItemResult[];
  } | null;
}

export function BatchAndApiPanel({ externalBatch }: BatchAndApiPanelProps = {}) {
  const { lang, t } = useLanguage();
  const [batchText, setBatchText] = useState(DEFAULT_BATCH_SCRIPT);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSummary, setBatchSummary] = useState<{
    total: number;
    optimalCount: number;
    failedCount: number;
    totalTimeMs: number;
  } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchSolveItemResult[]>([]);

  useEffect(() => {
    if (!externalBatch) return;
    setBatchText(externalBatch.batchText);
    setBatchSummary(externalBatch.summary);
    setBatchResults(externalBatch.results);
    setBatchError(null);
  }, [externalBatch]);

  // Live API Endpoint Tester
  const [apiEndpoint, setApiEndpoint] = useState('/api/parse-equations');
  const [apiPayload, setApiPayload] = useState(
    JSON.stringify(
      {
        modelName: 'API Quick LP',
        rawText: 'Maximize Z = 5x + 4y\n6x + 4y <= 24\nx + 2y <= 6\nx, y >= 0',
      },
      null,
      2,
    ),
  );
  const [apiResponse, setApiResponse] = useState<string>('');
  const [apiBusy, setApiBusy] = useState(false);

  const runBatch = async () => {
    setBatchRunning(true);
    setBatchError(null);
    try {
      const blocks = batchText
        .split(/^===\s*(.+?)\s*===$/m)
        .map((s) => s.trim())
        .filter(Boolean);

      const items: Array<{ name: string; equations: string }> = [];
      if (batchText.includes('===')) {
        for (let i = 0; i < blocks.length; i += 2) {
          const title = blocks[i];
          const eq = blocks[i + 1] ?? '';
          if (eq) items.push({ name: title, equations: eq });
        }
      } else {
        items.push({ name: 'Single Batch Item', equations: batchText });
      }

      const res = await fetch('/api/batch/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch solve failed');
      setBatchSummary(data.summary);
      setBatchResults(data.results || []);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Batch error');
    } finally {
      setBatchRunning(false);
    }
  };

  const exportBatchCsv = () => {
    if (batchResults.length === 0) return;
    const header = ['Index', 'Problem Name', 'Class', 'Status', 'Objective', 'Solve Time (ms)', 'Optimal Values'];
    const lines = batchResults.map((r) => [
      r.index,
      `"${r.name.replace(/"/g, '""')}"`,
      r.problemClass,
      r.status,
      r.objective ?? '',
      r.solveTimeMs,
      `"${JSON.stringify(r.values).replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...lines.map((l) => l.join(','))].join('\n');
    downloadTextFile('a2z_batch_optimization_results.csv', csv, 'text/csv');
  };

  const testApiEndpoint = async () => {
    setApiBusy(true);
    try {
      const isGet = apiEndpoint === '/api/health' || apiEndpoint === '/api/projects';
      const res = await fetch(apiEndpoint, {
        method: isGet ? 'GET' : 'POST',
        headers: isGet ? undefined : { 'Content-Type': 'application/json' },
        body: isGet ? undefined : apiPayload,
      });
      const text = await res.text();
      try {
        setApiResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setApiResponse(text);
      }
    } catch (err) {
      setApiResponse(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setApiBusy(false);
    }
  };

  const switchApiPreset = (endpoint: string) => {
    setApiEndpoint(endpoint);
    if (endpoint === '/api/parse-equations') {
      setApiPayload(
        JSON.stringify(
          {
            modelName: 'API Quick LP',
            rawText: 'Maximize Z = 5x + 4y\n6x + 4y <= 24\nx + 2y <= 6\nx, y >= 0',
          },
          null,
          2,
        ),
      );
    } else if (endpoint === '/api/transportation/solve') {
      setApiPayload(
        JSON.stringify(
          {
            sources: ['S1', 'S2'],
            destinations: ['D1', 'D2'],
            supply: [100, 150],
            demand: [120, 130],
            costs: [
              [4, 7],
              [6, 3],
            ],
          },
          null,
          2,
        ),
      );
    } else if (endpoint === '/api/assignment/solve') {
      setApiPayload(
        JSON.stringify(
          {
            agents: ['A1', 'A2', 'A3'],
            tasks: ['T1', 'T2', 'T3'],
            matrix: [
              [10, 5, 13],
              [3, 9, 18],
              [10, 7, 2],
            ],
            sense: 'min',
          },
          null,
          2,
        ),
      );
    } else {
      setApiPayload('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Capability #8: Batch Problem Processor */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-2.5">
            <Layers className="w-4 h-4 text-teal-700 mt-0.5 sm:mt-0 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Batch Problem Processing &amp; CSV Export
              </h2>
              <p className="text-xs text-slate-500">
                Separate multiple LP/MIP models with <code className="font-mono">=== Name ===</code> headers to parse and solve them sequentially in one server batch call.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {batchResults.length > 0 && (
              <button
                type="button"
                onClick={exportBatchCsv}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex-1 sm:flex-initial"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
            <button
              type="button"
              disabled={batchRunning}
              onClick={runBatch}
              className="flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg flex-1 sm:flex-initial"
            >
              <Play className="w-3.5 h-3.5" />
              {batchRunning ? t.actions.solving : (lang === 'bn' ? 'ব্যাচ কিউ চালান' : 'Run Batch Queue')}
            </button>
          </div>
        </div>

        <textarea
          rows={11}
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
        />

        {batchError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {batchError}
          </div>
        )}

        {batchRunning && <MatrixSolveSkeleton />}

        {!batchRunning && batchSummary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 sm:gap-6 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 sm:px-4 py-2.5">
              <span>Problems Processed: <strong className="font-mono text-slate-900">{batchSummary.total}</strong></span>
              <span>Solved Optimal/Feasible: <strong className="font-mono text-emerald-700">{batchSummary.optimalCount}</strong></span>
              <span>Failed / Infeasible: <strong className="font-mono text-red-700">{batchSummary.failedCount}</strong></span>
              <span>Cumulative Solver Time: <strong className="font-mono text-slate-900">{fmtNum(batchSummary.totalTimeMs, 2)} ms</strong></span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Problem</th>
                    <th className="py-2 px-3">Class</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Objective Z*</th>
                    <th className="py-2 px-3 text-right">Time (ms)</th>
                    <th className="py-2 px-3">Decision Vector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchResults.map((r) => (
                    <tr key={r.index}>
                      <td className="py-2 px-3 font-mono text-slate-500">{r.index}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{r.name}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{r.problemClass}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-teal-800">{r.status}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {r.objective !== null ? fmtNum(r.objective, 4) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {fmtNum(r.solveTimeMs, 2)}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-700 max-w-md truncate">
                        {r.errorMessage
                          ? r.errorMessage
                          : Object.entries(r.values)
                              .map(([k, v]) => `${k}=${fmtNum(v, 3)}`)
                              .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Capability #9: REST API Integration Console */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <Terminal className="w-4 h-4 text-slate-700 mt-0.5 sm:mt-0 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">REST API Integration &amp; Live Tester</h2>
              <p className="text-xs text-slate-500">
                Programmatic JSON API for ERP pipelines, Python scripts, and CI/CD optimization webhooks.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
            <select
              value={apiEndpoint}
              onChange={(e) => switchApiPreset(e.target.value)}
              className="w-full sm:w-auto max-w-full min-w-0 px-2.5 py-2 sm:py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 truncate"
            >
              <option value="/api/parse-equations">POST /api/parse-equations</option>
              <option value="/api/transportation/solve">POST /api/transportation/solve</option>
              <option value="/api/assignment/solve">POST /api/assignment/solve</option>
              <option value="/api/projects">GET /api/projects</option>
              <option value="/api/health">GET /api/health</option>
            </select>
            <button
              type="button"
              disabled={apiBusy}
              onClick={testApiEndpoint}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
            >
              <Code className="w-3.5 h-3.5" />
              {apiBusy ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Request JSON Body</div>
            <textarea
              rows={10}
              value={apiPayload}
              onChange={(e) => setApiPayload(e.target.value)}
              disabled={apiEndpoint === '/api/health' || apiEndpoint === '/api/projects'}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-50"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Live JSON Response</div>
            {apiBusy ? (
              <div className="h-[212px]">
                <AiTextSkeleton />
              </div>
            ) : (
              <pre className="w-full h-[212px] overflow-auto p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-lg">
                {apiResponse || '// Click "Send Request" to inspect live REST payload'}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
