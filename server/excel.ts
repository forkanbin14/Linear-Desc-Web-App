import * as XLSX from 'xlsx';
import type { ConstraintSense, ModelConstraint, ModelSpec, ModelVariable, NormalizedSolveResult, VariableType } from '../src/shared/types.ts';

/**
 * Parses an uploaded Excel (.xlsx / .csv) file into a canonical ModelSpec.
 * Expected sheets:
 * 1. "Variables": columns [name, lb, ub, type, obj_coef, unit, group, description]
 * 2. "Constraints": columns [name, sense, rhs, <var_name_1>, <var_name_2>, ...] OR [name, expression_or_terms, sense, rhs]
 * 3. "Objective" (optional): columns [sense, offset]
 */
export function parseExcelToModelSpec(buffer: Buffer, filename: string): ModelSpec {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;

  const varSheetName = sheetNames.find((s) => s.toLowerCase().includes('var')) ?? sheetNames[0];
  const conSheetName = sheetNames.find((s) => s.toLowerCase().includes('con'));
  const objSheetName = sheetNames.find((s) => s.toLowerCase().includes('obj'));

  if (!varSheetName) {
    throw new Error('Excel workbook contains no readable worksheets.');
  }

  const varRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[varSheetName], { defval: '' });
  const variables: ModelVariable[] = [];
  const objTerms: Record<string, number> = {};

  for (const row of varRows) {
    const rawName = String(row.name ?? row.Name ?? row.variable ?? row.Variable ?? '').trim();
    if (!rawName) continue;

    const lbRaw = row.lb ?? row.LB ?? row.lower ?? row.Lower ?? 0;
    const ubRaw = row.ub ?? row.UB ?? row.upper ?? row.Upper ?? '';
    const typeRaw = String(row.type ?? row.Type ?? 'continuous').toLowerCase().trim();
    const coefRaw = Number(row.obj_coef ?? row.objective ?? row.Objective ?? row.coef ?? 0);

    let type: VariableType = 'continuous';
    if (typeRaw.includes('bin')) type = 'binary';
    else if (typeRaw.includes('int')) type = 'integer';

    const lb = lbRaw === '' || lbRaw === null || String(lbRaw).toLowerCase() === '-inf' ? null : Number(lbRaw);
    const ub = ubRaw === '' || ubRaw === null || String(ubRaw).toLowerCase() === 'inf' ? null : Number(ubRaw);

    variables.push({
      name: rawName,
      lb: Number.isFinite(lb as number) ? (lb as number) : null,
      ub: Number.isFinite(ub as number) ? (ub as number) : null,
      type,
      unit: String(row.unit ?? row.Unit ?? '').trim() || undefined,
      group: String(row.group ?? row.Group ?? '').trim() || undefined,
      description: String(row.description ?? row.Description ?? '').trim() || undefined,
    });

    if (Number.isFinite(coefRaw) && coefRaw !== 0) {
      objTerms[rawName] = coefRaw;
    }
  }

  const constraints: ModelConstraint[] = [];
  if (conSheetName) {
    const conRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[conSheetName], { defval: '' });
    const varNames = new Set(variables.map((v) => v.name));

    for (const row of conRows) {
      const cName = String(row.name ?? row.Name ?? row.constraint ?? row.Constraint ?? '').trim();
      if (!cName) continue;
      const senseRaw = String(row.sense ?? row.Sense ?? '<=').trim();
      const sense: ConstraintSense = senseRaw === '=' || senseRaw === '==' ? '==' : senseRaw === '>=' ? '>=' : '<=';
      const rhs = Number(row.rhs ?? row.RHS ?? 0);

      const terms: Record<string, number> = {};
      for (const [colKey, colVal] of Object.entries(row)) {
        if (varNames.has(colKey)) {
          const num = Number(colVal);
          if (Number.isFinite(num) && num !== 0) {
            terms[colKey] = num;
          }
        }
      }

      // Also support JSON string or "2*x + 1*y" in a "terms" column
      const termsCol = row.terms ?? row.Terms;
      if (typeof termsCol === 'string' && termsCol.trim()) {
        try {
          const parsed = JSON.parse(termsCol);
          if (parsed && typeof parsed === 'object') {
            for (const [k, v] of Object.entries(parsed)) {
              const num = Number(v);
              if (Number.isFinite(num) && num !== 0) terms[k] = num;
            }
          }
        } catch {
          // Parse simple "3 x + 2 y" or "3*x - y" syntax
          const cleaned = termsCol.replace(/\s+/g, '');
          const matches = cleaned.matchAll(/([+-]?\d*\.?\d*)\*?([A-Za-z_][A-Za-z0-9_]*)/g);
          for (const m of matches) {
            const coefStr = m[1];
            const vName = m[2];
            const coef = coefStr === '' || coefStr === '+' ? 1 : coefStr === '-' ? -1 : Number(coefStr);
            if (varNames.has(vName) && Number.isFinite(coef) && coef !== 0) {
              terms[vName] = (terms[vName] ?? 0) + coef;
            }
          }
        }
      }

      constraints.push({
        name: cName,
        terms,
        sense,
        rhs: Number.isFinite(rhs) ? rhs : 0,
        description: String(row.description ?? row.Description ?? '').trim() || undefined,
      });
    }
  }

  let objSense: 'max' | 'min' = 'max';
  let objOffset = 0;
  if (objSheetName) {
    const objRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[objSheetName], { defval: '' });
    if (objRows[0]) {
      const s = String(objRows[0].sense ?? objRows[0].Sense ?? 'max').toLowerCase();
      objSense = s.includes('min') ? 'min' : 'max';
      const off = Number(objRows[0].offset ?? objRows[0].Offset ?? 0);
      if (Number.isFinite(off)) objOffset = off;
    }
  }

  return {
    name: filename.replace(/\.(xlsx|xls|csv)$/i, ''),
    description: `Imported from Excel workbook (${filename})`,
    domain: 'Custom',
    variables,
    constraints,
    objective: {
      sense: objSense,
      terms: objTerms,
      offset: objOffset,
    },
  };
}

/**
 * Generates a clean ready-to-edit Excel workbook template matching the current ModelSpec.
 */
export function buildTemplateWorkbook(spec: ModelSpec): Buffer {
  const wb = XLSX.utils.book_new();

  const varRows = spec.variables.map((v) => ({
    name: v.name,
    lb: v.lb === null ? '-inf' : v.lb,
    ub: v.ub === null ? 'inf' : v.ub,
    type: v.type,
    obj_coef: spec.objective.terms[v.name] ?? 0,
    unit: v.unit ?? '',
    group: v.group ?? '',
    description: v.description ?? '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(varRows), 'Variables');

  const conRows = spec.constraints.map((c) => {
    const row: Record<string, string | number> = {
      name: c.name,
      sense: c.sense,
      rhs: c.rhs,
      description: c.description ?? '',
    };
    for (const v of spec.variables) {
      row[v.name] = c.terms[v.name] ?? 0;
    }
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conRows), 'Constraints');

  const objRows = [
    {
      sense: spec.objective.sense,
      offset: spec.objective.offset ?? 0,
      model_name: spec.name,
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(objRows), 'Objective');

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Exports a complete multi-sheet Executive Optimization Report (.xlsx).
 */
export function exportSolveReportWorkbook(spec: ModelSpec, result: NormalizedSolveResult): Buffer {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { Metric: 'Model Name', Value: spec.name },
    { Metric: 'Problem Class', Value: result.problemClass },
    { Metric: 'Solve Status', Value: result.status.toUpperCase() },
    { Metric: 'Objective Sense', Value: spec.objective.sense.toUpperCase() },
    { Metric: 'Optimal Objective', Value: result.objective ?? 'N/A' },
    { Metric: 'Solver Engine', Value: `${result.solverName} v${result.solverVersion}` },
    { Metric: 'Solve Time (ms)', Value: result.solveTimeMs },
    { Metric: 'Simplex Iterations', Value: result.iterations },
    { Metric: 'MIP Nodes', Value: result.mipNodes },
    { Metric: 'MIP Relative Gap', Value: result.mipGap ?? 'N/A' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

  const varRows = result.variableDetails.map((v) => ({
    Variable: v.name,
    Type: v.type,
    Optimal_Value: v.value,
    Unit: v.unit ?? '',
    Obj_Coef: v.objCoef,
    Lower_Bound: v.lb ?? '-inf',
    Upper_Bound: v.ub ?? '+inf',
    Reduced_Cost: v.reducedCost ?? 'N/A (MIP/QP)',
    Allowable_Obj_Min: v.allowableObjMin ?? '-inf',
    Allowable_Obj_Max: v.allowableObjMax ?? '+inf',
    Basis_Status: v.basisStatus ?? v.atBound,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(varRows), 'Decision_Variables');

  const conRows = result.constraintDetails.map((c) => ({
    Constraint: c.name,
    Sense: c.sense,
    RHS: c.rhs,
    Activity_LHS: c.activity,
    Slack: c.slack,
    Binding: c.binding ? 'YES' : 'NO',
    Shadow_Price: c.shadowPrice ?? 'N/A (MIP/QP)',
    Allowable_RHS_Min: c.allowableRhsMin ?? '-inf',
    Allowable_RHS_Max: c.allowableRhsMax ?? '+inf',
    Description: c.description ?? '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conRows), 'Constraints_Sensitivity');

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
