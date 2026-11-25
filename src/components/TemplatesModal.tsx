import { ArrowRight, BookOpen, X } from 'lucide-react';
import { MODEL_TEMPLATES, type ModelTemplate } from '../shared/templates.ts';

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ModelTemplate) => Promise<void>;
}

export function TemplatesModal({ open, onClose, onSelectTemplate }: TemplatesModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-teal-700" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Industrial Optimization Template Library</h2>
              <p className="text-xs text-slate-500">
                Launch production-calibrated LP, MIP, and Convex QP financial and supply chain formulations.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 divide-y divide-slate-100">
          {MODEL_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{tpl.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-slate-700">{tpl.problemClass}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {tpl.spec.variables.length} vars / {tpl.spec.constraints.length} constraints
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{tpl.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{tpl.summary}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onSelectTemplate(tpl);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
              >
                Clone Project
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
