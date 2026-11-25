import { AlertTriangle, CheckCircle2, Code2, Download, FileSpreadsheet, GitCommitHorizontal, Layers, Plus, RotateCcw, Sigma, Table2, Trash2, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { modelSpecToLatex, parseMathEquationsToSpec } from '../shared/equationParser.ts';
import { expandIndexedSpec } from '../shared/indexedExpander.ts';
import type {
  ConstraintSense,
  IndexedSetSpec,
  ModelConstraint,
  ModelSpec,
  ModelVariable,
  QuadraticTerm,
  VariableType,
} from '../shared/types.ts';
import { modelSpecToLpText, validateModelSpec } from '../shared/validator.ts';
import { downloadTextFile } from '../utils/format.ts';
import { LatexBlock } from './LatexBlock.tsx';

interface ModelBuilderProps {
  spec: ModelSpec;
  isDirty: boolean;
  versionNumber: number;
  versionId: string;
  onChangeSpec: (next: ModelSpec) => void;
  onRevertDraft: () => void;
  onCommitVersion: (commitMessage: string) => Promise<void>;
  onExcelImportedSpec: (importedSpec: ModelSpec, filename: string) => Promise<void>;
  committing: boolean;
}

type BuilderTab = 'grid' | 'equations' | 'matrix' | 'indexed' | 'code';

const EQUATION_PRESETS: Array<{ label: string; text: string }> = [
  {
    label: 'HSC Standard Max',
    text: `Maximize Z = 5x + 4y\nSubject to:\nMachine_A: 6x + 4y <= 24\nMachine_B: x + 2y <= 6\nMarket_Cap: -x + y <= 1\ny <= 2\nx, y >= 0`,
  },
  {
    label: 'HSC Standard Min',
    text: `Minimize Z = 20x + 24y\nSubject to:\nNutrient_A: 3x + 2y >= 18\nNutrient_B: x + 4y >= 12\nx, y >= 0`,
  },
  {
    label: 'Multiple Optimal Edge',
    text: `Maximize Z = 6x + 4y\nSubject to:\nCap_1: 3x + 2y <= 18\nCap_2: x <= 4\nCap_3: y <= 6\nx, y >= 0`,
  },
  {
    label: 'MILP (Integer + Binary)',
    text: `Maximize Z = 12x + 19y + 25b1 + 18b2\nSubject to:\nBudget: 4x + 7y + 10b1 + 6b2 <= 42\nHours: 2x + 3y <= 15\ninteger: x, y\nbinary: b1, b2`,
  },
];

const DEFAULT_INDEXED_SPEC: IndexedSetSpec = {
  sets: {
    Plant: ['Dhaka', 'Chattogram'],
    Quarter: ['Q1', 'Q2', 'Q3'],
  },
  parameters: {
    unit_profit: {
      'Dhaka,Q1': 42,
      'Dhaka,Q2': 45,
      'Dhaka,Q3': 48,
      'Chattogram,Q1': 39,
      'Chattogram,Q2': 44,
      'Chattogram,Q3': 46,
    },
    labor_hrs: {
      Dhaka: 2.5,
      Chattogram: 2.1,
    },
    quarter_capacity: {
      Q1: 1200,
      Q2: 1400,
      Q3: 1500,
    },
  },
  indexedVariables: [
    {
      prefix: 'prod',
      indexSets: ['Plant', 'Quarter'],
      lb: 0,
      ub: 700,
      type: 'continuous',
      unit: 'tons',
      objParam: 'unit_profit',
    },
  ],
  indexedConstraints: [
    {
      namePrefix: 'labor_cap',
      forEachSet: 'Quarter',
      sumSet: 'Plant',
      varPrefix: 'prod',
      coefParam: 'labor_hrs',
      sense: '<=',
      rhsParam: 'quarter_capacity',
    },
  ],
};

export function ModelBuilder({
  spec,
  isDirty,
  versionNumber,
  versionId,
  onChangeSpec,
  onRevertDraft,
  onCommitVersion,
  onExcelImportedSpec,
  committing,
}: ModelBuilderProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<BuilderTab>('grid');
  const [commitMsg, setCommitMsg] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [indexedDraft, setIndexedDraft] = useState<IndexedSetSpec>(
    spec.indexedSpec ?? DEFAULT_INDEXED_SPEC,
  );
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [equationInput, setEquationInput] = useState<string>(EQUATION_PRESETS[0].text);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const readOnly = false;

  const parsedEquations = useMemo(
    () => parseMathEquationsToSpec(equationInput, spec.name),
    [equationInput, spec.name],
  );
  const parsedEquationLatex = useMemo(
    () => modelSpecToLatex(parsedEquations.spec),
    [parsedEquations.spec],
  );

  const validation = useMemo(() => validateModelSpec(spec), [spec]);
  const specLatex = useMemo(() => modelSpecToLatex(spec), [spec]);
  const lpText = useMemo(() => (validation.valid ? modelSpecToLpText(spec) : '// Fix validation errors to generate LP text'), [spec, validation.valid]);

  const updateVariable = (idx: number, patch: Partial<ModelVariable>) => {
    const prevName = spec.variables[idx].name;
    const nextVars = spec.variables.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    let nextConstraints = spec.constraints;
    let nextObjTerms = { ...spec.objective.terms };
    let nextQuad = spec.objective.quadraticTerms;

    if (patch.name && patch.name !== prevName) {
      const newName = patch.name;
      if (prevName in nextObjTerms) {
        nextObjTerms[newName] = nextObjTerms[prevName];
        delete nextObjTerms[prevName];
      }
      nextConstraints = spec.constraints.map((c) => {
        if (!(prevName in c.terms)) return c;
        const t = { ...c.terms };
        t[newName] = t[prevName];
        delete t[prevName];
        return { ...c, terms: t };
      });
      if (nextQuad) {
        nextQuad = nextQuad.map((q) => ({
          ...q,
          var1: q.var1 === prevName ? newName : q.var1,
          var2: q.var2 === prevName ? newName : q.var2,
        }));
      }
    }

    onChangeSpec({
      ...spec,
      variables: nextVars,
      constraints: nextConstraints,
      objective: { ...spec.objective, terms: nextObjTerms, quadraticTerms: nextQuad },
    });
  };

  const addVariable = () => {
    const base = `var_${spec.variables.length + 1}`;
    onChangeSpec({
      ...spec,
      variables: [
        ...spec.variables,
        { name: base, lb: 0, ub: null, type: 'continuous', unit: 'units', group: 'General' },
      ],
      objective: {
        ...spec.objective,
        terms: { ...spec.objective.terms, [base]: 1 },
      },
    });
  };

  const removeVariable = (idx: number) => {
    const target = spec.variables[idx].name;
    const nextObj = { ...spec.objective.terms };
    delete nextObj[target];
    const nextCons = spec.constraints.map((c) => {
      const t = { ...c.terms };
      delete t[target];
      return { ...c, terms: t };
    });
    const nextQuad = spec.objective.quadraticTerms?.filter((q) => q.var1 !== target && q.var2 !== target);
    onChangeSpec({
      ...spec,
      variables: spec.variables.filter((_, i) => i !== idx),
      constraints: nextCons,
      objective: { ...spec.objective, terms: nextObj, quadraticTerms: nextQuad },
    });
  };

  const updateObjCoef = (varName: string, val: string) => {
    const num = val === '' ? 0 : Number(val);
    const nextTerms = { ...spec.objective.terms };
    if (Number.isFinite(num)) {
      if (num === 0) delete nextTerms[varName];
      else nextTerms[varName] = num;
      onChangeSpec({
        ...spec,
        objective: { ...spec.objective, terms: nextTerms },
      });
    }
  };

  const updateConstraint = (idx: number, patch: Partial<ModelConstraint>) => {
    onChangeSpec({
      ...spec,
      constraints: spec.constraints.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  };

  const updateMatrixCell = (conIdx: number, varName: string, rawVal: string) => {
    const num = rawVal === '' ? 0 : Number(rawVal);
    if (!Number.isFinite(num)) return;
    const con = spec.constraints[conIdx];
    const nextTerms = { ...con.terms };
    if (num === 0) delete nextTerms[varName];
    else nextTerms[varName] = num;
    updateConstraint(conIdx, { terms: nextTerms });
  };

  const addConstraint = () => {
    const defaultVar = spec.variables[0]?.name;
    onChangeSpec({
      ...spec,
      constraints: [
        ...spec.constraints,
        {
          name: `constraint_${spec.constraints.length + 1}`,
          terms: defaultVar ? { [defaultVar]: 1 } : {},
          sense: '<=',
          rhs: 100,
          description: '',
        },
      ],
    });
  };

  const removeConstraint = (idx: number) => {
    onChangeSpec({
      ...spec,
      constraints: spec.constraints.filter((_, i) => i !== idx),
    });
  };

  const addQuadraticTerm = () => {
    const v0 = spec.variables[0]?.name;
    if (!v0) return;
    const existing = spec.objective.quadraticTerms ?? [];
    onChangeSpec({
      ...spec,
      objective: {
        ...spec.objective,
        quadraticTerms: [...existing, { var1: v0, var2: v0, coef: 1 }],
      },
    });
  };

  const updateQuadraticTerm = (idx: number, patch: Partial<QuadraticTerm>) => {
    const existing = spec.objective.quadraticTerms ?? [];
    onChangeSpec({
      ...spec,
      objective: {
        ...spec.objective,
        quadraticTerms: existing.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
      },
    });
  };

  const removeQuadraticTerm = (idx: number) => {
    const existing = spec.objective.quadraticTerms ?? [];
    onChangeSpec({
      ...spec,
      objective: {
        ...spec.objective,
        quadraticTerms: existing.filter((_, i) => i !== idx),
      },
    });
  };

  const handleOpenCodeTab = () => {
    setJsonText(JSON.stringify(spec, null, 2));
    setJsonError(null);
    setTab('code');
  };

  const applyJsonDraft = () => {
    try {
      const parsed = JSON.parse(jsonText) as ModelSpec;
      onChangeSpec(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax');
    }
  };

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelBusy(true);
    setExcelError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      const res = await fetch('/api/imports/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, filename: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Excel import failed');
      await onExcelImportedSpec(data.spec, file.name);
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : 'Failed to parse Excel workbook');
    } finally {
      setExcelBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExpandIndexed = () => {
    const expanded = expandIndexedSpec(
      spec.name,
      spec.description || 'Expanded from indexed set specification',
      spec.objective.sense,
      indexedDraft,
    );
    onChangeSpec(expanded);
    setTab('grid');
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: Sub-tabs + Excel I/O + Commit Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar max-w-full w-full sm:w-auto">
          {(
            [
              { id: 'grid', label: t.builder.tabular, icon: null },
              { id: 'equations', label: t.builder.equations, icon: <Sigma className="w-3.5 h-3.5" /> },
              { id: 'matrix', label: t.builder.matrix, icon: <Table2 className="w-3.5 h-3.5" /> },
              { id: 'indexed', label: t.builder.indexed, icon: <Layers className="w-3.5 h-3.5" /> },
              { id: 'code', label: t.builder.code, icon: <Code2 className="w-3.5 h-3.5" /> },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => (item.id === 'code' ? handleOpenCodeTab() : setTab(item.id))}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-100 whitespace-nowrap shrink-0 ${
                tab === item.id ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === item.id && (
                <motion.span
                  layoutId="builder-tab-pill"
                  transition={{ type: 'spring', stiffness: 720, damping: 40, mass: 0.45 }}
                  className="absolute inset-0 bg-white rounded-md shadow-xs"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {item.icon}
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleExcelFile}
            className="hidden"
          />
          <a
            href={`/api/models/${versionId}/export/xlsx-template`}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap flex-1 sm:flex-initial"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            {t.builder.excelTemplate}
          </a>
          <button
            type="button"
            disabled={excelBusy}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap flex-1 sm:flex-initial"
          >
            <Upload className="w-3.5 h-3.5 text-teal-700" />
            {excelBusy ? t.actions.solving : t.builder.importExcel}
          </button>
        </div>
      </div>

      {excelError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Excel Import Error: {excelError}</span>
        </div>
      )}

      {/* Unsaved Version Commit Banner */}
      {isDirty && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-3.5 sm:px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2 text-xs text-amber-900">
            <GitCommitHorizontal className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              Uncommitted edits on draft (base v{versionNumber}). Save an immutable version before solving to preserve audit reproducibility.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit note (e.g., Tightened Capex to $14M)"
              className="px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 w-full sm:w-64"
            />
            <button
              type="button"
              onClick={onRevertDraft}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Revert
            </button>
            <button
              type="button"
              disabled={committing || !validation.valid}
              onClick={async () => {
                await onCommitVersion(commitMsg.trim() || `Updated model parameters (v${versionNumber + 1})`);
                setCommitMsg('');
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {committing ? 'Saving...' : `Commit v${versionNumber + 1}`}
            </button>
          </div>
        </div>
      )}

      {/* Validation Status Summary */}
      <div className="bg-white border border-slate-200 rounded-xl px-3.5 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600">
          {validation.valid ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              {t.builder.validOk}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-red-700">
              <AlertTriangle className="w-4 h-4" />
              {t.builder.validErr}
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span>Class: <strong className="font-mono text-slate-900">{validation.problemClass}</strong></span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{validation.numVars} vars ({validation.numBinary} bin, {validation.numInteger} int)</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{validation.numConstraints} constraints</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            Range: {validation.dynamicRange !== null ? validation.dynamicRange.toExponential(1) : '—'}
          </span>
        </div>
      </div>

      {validation.issues.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Pre-Solve Diagnostics ({validation.issues.length})</div>
          {validation.issues.map((issue, i) => (
            <div
              key={`${issue.code}_${i}`}
              className={`text-xs px-3 py-2 rounded-lg flex items-start gap-2 ${
                issue.severity === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong className="font-mono">{issue.code}</strong>: {issue.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* TAB 1: TABULAR BUILDER */}
      {tab === 'grid' && (
        <div className="space-y-5">
          {/* Objective Header Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Objective Function</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure optimization direction, constant offset, and linear or quadratic objective terms.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChangeSpec({ ...spec, objective: { ...spec.objective, sense: 'max' } })}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      spec.objective.sense === 'max' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Maximize
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChangeSpec({ ...spec, objective: { ...spec.objective, sense: 'min' } })}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      spec.objective.sense === 'min' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Minimize
                  </button>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Offset</span>
                  <input
                    type="number"
                    disabled={readOnly}
                    value={spec.objective.offset ?? 0}
                    onChange={(e) =>
                      onChangeSpec({
                        ...spec,
                        objective: { ...spec.objective, offset: Number(e.target.value) || 0 },
                      })
                    }
                    className="w-24 px-2 py-1 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded-md"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Decision Variables Grid */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Decision Variables ({spec.variables.length})</h3>
                <p className="text-xs text-slate-500">Bounds, variable domain, and objective coefficient per decision variable.</p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={addVariable}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Variable
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-3">Variable Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Lower Bound</th>
                    <th className="py-2.5 px-3 text-right">Upper Bound</th>
                    <th className="py-2.5 px-3 text-right">Obj Coef</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3">Description</th>
                    {!readOnly && <th className="py-2.5 px-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {spec.variables.map((v, idx) => (
                    <tr key={`${idx}_${v.name}`} className="hover:bg-slate-50/70">
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          disabled={readOnly}
                          value={v.name}
                          onChange={(e) => updateVariable(idx, { name: e.target.value })}
                          className="w-full min-w-[140px] px-2 py-1 font-mono text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-teal-600 focus:bg-white rounded focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <select
                          disabled={readOnly}
                          value={v.type}
                          onChange={(e) => {
                            const nextType = e.target.value as VariableType;
                            updateVariable(idx, {
                              type: nextType,
                              lb: nextType === 'binary' ? 0 : v.lb,
                              ub: nextType === 'binary' ? 1 : v.ub,
                            });
                          }}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-teal-600"
                        >
                          <option value="continuous">Continuous</option>
                          <option value="integer">Integer</option>
                          <option value="binary">Binary</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="text"
                          disabled={readOnly || v.type === 'binary'}
                          value={v.lb === null ? '' : v.lb}
                          placeholder="-inf"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === '' || raw === '-inf') updateVariable(idx, { lb: null });
                            else if (!Number.isNaN(Number(raw))) updateVariable(idx, { lb: Number(raw) });
                          }}
                          className="w-20 px-2 py-1 font-mono text-right bg-transparent border border-slate-200 focus:border-teal-600 rounded focus:outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="text"
                          disabled={readOnly || v.type === 'binary'}
                          value={v.ub === null ? '' : v.ub}
                          placeholder="+inf"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === '' || raw === 'inf' || raw === '+inf') updateVariable(idx, { ub: null });
                            else if (!Number.isNaN(Number(raw))) updateVariable(idx, { ub: Number(raw) });
                          }}
                          className="w-20 px-2 py-1 font-mono text-right bg-transparent border border-slate-200 focus:border-teal-600 rounded focus:outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          disabled={readOnly}
                          value={spec.objective.terms[v.name] ?? 0}
                          onChange={(e) => updateObjCoef(v.name, e.target.value)}
                          className="w-24 px-2 py-1 font-mono text-right bg-transparent border border-slate-200 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          disabled={readOnly}
                          value={v.unit ?? ''}
                          placeholder="unit"
                          onChange={(e) => updateVariable(idx, { unit: e.target.value })}
                          className="w-20 px-2 py-1 text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          disabled={readOnly}
                          value={v.description ?? ''}
                          placeholder="Business description"
                          onChange={(e) => updateVariable(idx, { description: e.target.value })}
                          className="w-full min-w-[180px] px-2 py-1 text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>
                      {!readOnly && (
                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeVariable(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Delete variable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Constraints Grid */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Linear Constraints ({spec.constraints.length})</h3>
                <p className="text-xs text-slate-500">Edit constraint limits (RHS), sense, or switch to Coefficient Matrix for dense grid editing.</p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={addConstraint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Constraint
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-3">Constraint Name</th>
                    <th className="py-2.5 px-3">Linear Expression (LHS)</th>
                    <th className="py-2.5 px-3 w-24">Sense</th>
                    <th className="py-2.5 px-3 text-right w-32">RHS Limit</th>
                    <th className="py-2.5 px-3">Description</th>
                    {!readOnly && <th className="py-2.5 px-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {spec.constraints.map((c, cIdx) => {
                    const expr = Object.entries(c.terms)
                      .filter(([, val]) => val !== 0)
                      .map(([k, val], idx) => {
                        const sign = val >= 0 ? (idx > 0 ? ' + ' : '') : ' - ';
                        const mag = Math.abs(val);
                        return `${sign}${mag === 1 ? '' : `${mag}·`}${k}`;
                      })
                      .join('');
                    return (
                      <tr key={`${cIdx}_${c.name}`} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={c.name}
                            onChange={(e) => updateConstraint(cIdx, { name: e.target.value })}
                            className="w-full min-w-[140px] px-2 py-1 font-mono text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-teal-600 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700 max-w-md">
                          <div className="truncate" title={expr || '0'}>
                            {expr || <span className="text-slate-400">0 (edit in Matrix tab)</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            disabled={readOnly}
                            value={c.sense}
                            onChange={(e) => updateConstraint(cIdx, { sense: e.target.value as ConstraintSense })}
                            className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded text-slate-900"
                          >
                            <option value="<=">&le;</option>
                            <option value=">=">&ge;</option>
                            <option value="==">=</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            disabled={readOnly}
                            value={c.rhs}
                            onChange={(e) => updateConstraint(cIdx, { rhs: Number(e.target.value) || 0 })}
                            className="w-28 px-2 py-1 font-mono text-right bg-transparent border border-slate-200 focus:border-teal-600 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={c.description ?? ''}
                            placeholder="Description"
                            onChange={(e) => updateConstraint(cIdx, { description: e.target.value })}
                            className="w-full min-w-[160px] px-2 py-1 text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-teal-600 rounded focus:outline-none"
                          />
                        </td>
                        {!readOnly && (
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeConstraint(cIdx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optional Convex QP Hessian Section */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Quadratic Objective Matrix (Convex QP — v2) ({spec.objective.quadraticTerms?.length ?? 0} terms)
                </h3>
                <p className="text-xs text-slate-500">
                  Optional symmetric covariance/Hessian terms for 0.5 · xᵀQx (used in Markowitz Mean-Variance portfolio optimization).
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={addQuadraticTerm}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Q Term
                </button>
              )}
            </div>
            {(spec.objective.quadraticTerms?.length ?? 0) > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">Variable i</th>
                      <th className="py-2 px-3">Variable j</th>
                      <th className="py-2 px-3 text-right">Q[i,j] Coefficient</th>
                      {!readOnly && <th className="py-2 px-3 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {spec.objective.quadraticTerms!.map((qt, qIdx) => (
                      <tr key={qIdx}>
                        <td className="py-1.5 px-3">
                          <select
                            disabled={readOnly}
                            value={qt.var1}
                            onChange={(e) => updateQuadraticTerm(qIdx, { var1: e.target.value })}
                            className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded"
                          >
                            {spec.variables.map((v) => (
                              <option key={v.name} value={v.name}>{v.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-3">
                          <select
                            disabled={readOnly}
                            value={qt.var2}
                            onChange={(e) => updateQuadraticTerm(qIdx, { var2: e.target.value })}
                            className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded"
                          >
                            {spec.variables.map((v) => (
                              <option key={v.name} value={v.name}>{v.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            disabled={readOnly}
                            value={qt.coef}
                            onChange={(e) => updateQuadraticTerm(qIdx, { coef: Number(e.target.value) || 0 })}
                            className="w-28 px-2 py-1 font-mono text-right border border-slate-200 rounded"
                          />
                        </td>
                        {!readOnly && (
                          <td className="py-1.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeQuadraticTerm(qIdx)}
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Live LaTeX Equation Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-700">{t.builder.latexPreview}</div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs overflow-x-auto space-y-1.5">
              <div><LatexBlock math={specLatex.objectiveLatex} /></div>
              <div className="text-slate-500">Subject to {spec.constraints.length} constraint(s):</div>
              <div className="pl-2 space-y-1">
                {specLatex.constraintsLatex.slice(0, 6).map((c, idx) => (
                  <div key={idx}><LatexBlock math={c} /></div>
                ))}
                {specLatex.constraintsLatex.length > 6 && (
                  <div className="text-slate-400">... and {specLatex.constraintsLatex.length - 6} more</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1B: AUTOMATIC MATHEMATICAL EQUATION PARSER (LP-01) */}
      {tab === 'equations' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Automatic Mathematical Equation Detector (LP-01)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Type standard inequalities, objective functions, non-negativity bounds, or <code className="font-mono">integer: / binary:</code> declarations. Automatically detects variables, coefficients, and renders live LaTeX.
              </p>
            </div>
            <button
              type="button"
              disabled={readOnly || parsedEquations.spec.variables.length === 0}
              onClick={() => {
                onChangeSpec({
                  ...parsedEquations.spec,
                  name: spec.name,
                  domain: spec.domain,
                });
                setTab('grid');
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
            >
              Load Parsed Model into Builder
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Examples:</span>
            {EQUATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setEquationInput(preset.text)}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 font-medium"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Mathematical System Input (Plain Text / Inequalities)
              </label>
              <textarea
                rows={12}
                value={equationInput}
                onChange={(e) => setEquationInput(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600 leading-relaxed"
              />
              {parsedEquations.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {parsedEquations.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-700">
                Detected Structure ({parsedEquations.spec.variables.length} vars · {parsedEquations.spec.constraints.length} constraints)
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs overflow-x-auto">
                <div><LatexBlock math={parsedEquationLatex.objectiveLatex} /></div>
                <div className="text-slate-500 font-medium pt-1">Subject to:</div>
                <div className="pl-2 space-y-1.5">
                  {parsedEquationLatex.constraintsLatex.map((ct, i) => (
                    <div key={i}><LatexBlock math={ct} /></div>
                  ))}
                </div>
                {parsedEquationLatex.boundsLatex && (
                  <div className="pt-1 border-t border-slate-200">
                    <LatexBlock math={parsedEquationLatex.boundsLatex} />
                  </div>
                )}
                {parsedEquationLatex.integralityLatex && (
                  <div>
                    <LatexBlock math={parsedEquationLatex.integralityLatex} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DENSE SPREADSHEET COEFFICIENT MATRIX */}
      {tab === 'matrix' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Dense Constraint Coefficient Matrix (A · x)</h3>
              <p className="text-xs text-slate-500">Excel-style matrix editor: edit any A[i,j] coefficient directly.</p>
            </div>
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 sticky left-0 bg-slate-50 border-r border-slate-200 z-10">Constraint / Row</th>
                  {spec.variables.map((v) => (
                    <th key={v.name} className="py-2.5 px-2 font-mono text-right min-w-[92px]">
                      {v.name}
                    </th>
                  ))}
                  <th className="py-2.5 px-2 text-center border-l border-slate-200">Sense</th>
                  <th className="py-2.5 px-3 text-right">RHS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-teal-50/40 font-medium">
                  <td className="py-2 px-3 sticky left-0 bg-teal-50/70 border-r border-slate-200 text-teal-900">
                    Objective ({spec.objective.sense.toUpperCase()})
                  </td>
                  {spec.variables.map((v) => (
                    <td key={v.name} className="py-1.5 px-2 text-right">
                      <input
                        type="number"
                        step="any"
                        disabled={readOnly}
                        value={spec.objective.terms[v.name] ?? 0}
                        onChange={(e) => updateObjCoef(v.name, e.target.value)}
                        className="w-20 px-1.5 py-1 font-mono text-right bg-white border border-teal-200 rounded focus:outline-none focus:border-teal-600"
                      />
                    </td>
                  ))}
                  <td className="py-2 px-2 text-center border-l border-slate-200 font-mono text-teal-800">→</td>
                  <td className="py-2 px-3 text-right font-mono text-teal-800">opt</td>
                </tr>
                {spec.constraints.map((c, cIdx) => (
                  <tr key={c.name} className="hover:bg-slate-50">
                    <td className="py-1.5 px-3 sticky left-0 bg-white border-r border-slate-200 font-mono text-slate-900">
                      {c.name}
                    </td>
                    {spec.variables.map((v) => {
                      const val = c.terms[v.name] ?? 0;
                      return (
                        <td key={v.name} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            step="any"
                            disabled={readOnly}
                            value={val}
                            onChange={(e) => updateMatrixCell(cIdx, v.name, e.target.value)}
                            className={`w-20 px-1.5 py-1 font-mono text-right border rounded focus:outline-none focus:border-teal-600 ${
                              val === 0 ? 'text-slate-300 border-slate-100 bg-slate-50/40' : 'text-slate-900 border-slate-200 bg-white'
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-center border-l border-slate-200 font-mono">
                      {c.sense}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-medium">
                      {c.rhs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INDEXED SET-BASED EXPANDER */}
      {tab === 'indexed' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Indexed Set-Based Model Expander</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Define multi-dimensional sets (e.g. Plant × Quarter) and symbolic parameter tables, then expand into flat canonical variables &amp; constraints.
              </p>
            </div>
            <button
              type="button"
              disabled={readOnly}
              onClick={handleExpandIndexed}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Expand to Canonical Model Spec
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Indexed Sets &amp; Parameter Tables (JSON)
              </label>
              <textarea
                rows={16}
                disabled={readOnly}
                value={JSON.stringify(indexedDraft, null, 2)}
                onChange={(e) => {
                  try {
                    setIndexedDraft(JSON.parse(e.target.value));
                  } catch {
                    // Allow typing while editing
                  }
                }}
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-700">Symbolic Preview</div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-700">
                <div>
                  <span className="font-semibold text-slate-900">Sets: </span>
                  {Object.entries(indexedDraft.sets).map(([k, vals]) => (
                    <span key={k} className="font-mono mr-3">
                      {k} = [{vals.join(', ')}]
                    </span>
                  ))}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Indexed Variables: </span>
                  {indexedDraft.indexedVariables.map((iv, i) => (
                    <div key={i} className="font-mono mt-1 text-slate-800">
                      {iv.prefix}[{iv.indexSets.join(', ')}] ∈ [{iv.lb ?? '-∞'}, {iv.ub ?? '+∞'}] ({iv.type})
                    </div>
                  ))}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Indexed Constraints: </span>
                  {indexedDraft.indexedConstraints.map((ic, i) => (
                    <div key={i} className="font-mono mt-1 text-slate-800">
                      ∀ {ic.forEachSet}: Σ({ic.sumSet}) {ic.coefParam} · {ic.varPrefix} {ic.sense} {ic.rhsParam}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Clicking Expand compiles these Cartesian index tuples into flat canonical variables and constraints ready for HiGHS and version control.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CANONICAL JSON & CPLEX LP PREVIEW */}
      {tab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Canonical JSON Model Spec</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadTextFile(`${spec.name.replace(/\s+/g, '_')}.json`, JSON.stringify(spec, null, 2), 'application/json')}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md"
                >
                  Download JSON
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={applyJsonDraft}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                  >
                    Apply JSON
                  </button>
                )}
              </div>
            </div>
            {jsonError && <div className="text-xs text-red-600">{jsonError}</div>}
            <textarea
              rows={20}
              disabled={readOnly}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Compiled CPLEX LP Format</h3>
              <button
                type="button"
                onClick={() => downloadTextFile(`${spec.name.replace(/\s+/g, '_')}.lp`, lpText)}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md"
              >
                Download .LP
              </button>
            </div>
            <pre className="w-full h-[412px] overflow-auto p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-lg leading-relaxed">
              {lpText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
