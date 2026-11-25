import { AlertTriangle, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import type { ModelSpec, ValidationReport } from '../shared/types.ts';
import { AiTextSkeleton } from './SkeletonLoaders.tsx';

interface AiDraftModalProps {
  open: boolean;
  onClose: () => void;
  hasActiveProject: boolean;
  onConfirmAsNewProject: (spec: ModelSpec) => Promise<void>;
  onConfirmAsNewVersion: (spec: ModelSpec, msg: string) => Promise<void>;
}

const EXAMPLE_PROMPTS = [
  'Budget 10 lakh taka, 3ta project (Solar, Logistics, Fintech) er majhe max return: Solar returns 18% (cost 4L, risk 12%), Logistics returns 14% (cost 3.5L, risk 8%), Fintech returns 24% (cost 5L, risk 28%). Weighted average portfolio risk <= 18% and at least 2 projects must be selected.',
  'Allocate $25M treasury liquidity across 4 instruments: T-Bills (4.1% yield, 0% risk weight), IG Bonds (5.8% yield, 20% risk weight), Senior Loans (8.2% yield, 50% risk weight), and Mezzanine (12.5% yield, 100% risk weight). Maximize annual yield while keeping weighted risk <= 35%, T-Bills >= $6M, and Mezzanine <= $4M.',
  'Minimize production + shipping cost for 2 factories (North cap 500, cost $12/unit; South cap 700, cost $10/unit) supplying 3 depots with demand 300, 400, 350. Shipping costs from North: $4, $6, $8; from South: $7, $3, $5.',
];

export function AiDraftModal({
  open,
  onClose,
  hasActiveProject,
  onConfirmAsNewProject,
  onConfirmAsNewVersion,
}: AiDraftModalProps) {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    spec: ModelSpec;
    validation: ValidationReport;
    modelingNotes: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const generateDraft = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await fetch('/api/ai/nl-to-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate model spec');
      setDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-teal-700" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Natural Language → Validated Model Spec
              </h2>
              <p className="text-xs text-slate-500">
                AI drafts are schema-validated and require explicit human confirmation before entering the solver.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Describe Problem (English, Bengali, or Banglish)
              </label>
              <div className="flex items-center gap-1.5">
                {EXAMPLE_PROMPTS.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(ex)}
                    className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
                  >
                    Example {idx + 1}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Budget 10 lakh, 3ta project-er majhe max return, risk limit 20%..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={loading || !prompt.trim()}
                onClick={generateDraft}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                {loading ? 'Formulating & Validating Spec...' : 'Generate Draft Spec'}
              </button>
            </div>
          </div>

          {loading && <AiTextSkeleton />}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && draft && (
            <div className="space-y-4 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{draft.spec.name}</div>
                  <div className="text-xs text-slate-500">{draft.spec.description}</div>
                </div>
                {draft.validation.valid ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Schema Valid ({draft.validation.problemClass})
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    Schema Issues ({draft.validation.issues.length})
                  </span>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <strong className="text-slate-900">Modeling Assumptions: </strong>
                {draft.modelingNotes}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700 border-b border-slate-200">
                    Variables ({draft.spec.variables.length})
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {draft.spec.variables.map((v) => (
                      <div key={v.name} className="px-3 py-1.5 flex items-center justify-between font-mono">
                        <span className="text-slate-900">{v.name} ({v.type})</span>
                        <span className="text-slate-500">
                          obj: {draft.spec.objective.terms[v.name] ?? 0} · [{v.lb ?? '-∞'}, {v.ub ?? '+∞'}]
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700 border-b border-slate-200">
                    Constraints ({draft.spec.constraints.length})
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {draft.spec.constraints.map((c) => {
                      const expr = Object.entries(c.terms)
                        .map(([k, val], idx) => `${idx > 0 && val >= 0 ? '+ ' : val < 0 ? '- ' : ''}${Math.abs(val)}·${k}`)
                        .join(' ');
                      return (
                        <div key={c.name} className="px-3 py-1.5 font-mono text-slate-800">
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="text-slate-600">{expr} {c.sense} {c.rhs}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {draft && (
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Discard Draft
            </button>
            {hasActiveProject && (
              <button
                type="button"
                disabled={saving || !draft.validation.valid}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onConfirmAsNewVersion(draft.spec, 'Confirmed AI-generated model specification');
                    onClose();
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 disabled:opacity-50 rounded-lg"
              >
                Commit to Current Project
              </button>
            )}
            <button
              type="button"
              disabled={saving || !draft.validation.valid}
              onClick={async () => {
                setSaving(true);
                try {
                  await onConfirmAsNewProject(draft.spec);
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
            >
              {saving ? 'Saving...' : 'Confirm & Create New Project'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
