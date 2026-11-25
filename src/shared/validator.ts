import type { ModelSpec, ProblemClass, ValidationIssue, ValidationReport } from './types.ts';

const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.\[\],]*$/;

export function sanitizeLpName(name: string, fallbackPrefix: string, index: number): string {
  const cleaned = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.\[\],]/g, '_');
  if (!cleaned || /^[0-9.]/.test(cleaned)) {
    return `${fallbackPrefix}_${index}_${cleaned}`;
  }
  return cleaned;
}

export function validateModelSpec(spec: ModelSpec): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (!spec || typeof spec !== 'object') {
    return {
      valid: false,
      problemClass: 'LP',
      numVars: 0,
      numContinuous: 0,
      numInteger: 0,
      numBinary: 0,
      numConstraints: 0,
      numNonzeros: 0,
      numQuadraticTerms: 0,
      minNonzeroCoef: null,
      maxAbsCoef: null,
      dynamicRange: null,
      issues: [{ code: 'INVALID_SPEC', severity: 'error', message: 'Model specification must be a valid JSON object.' }],
    };
  }

  if (!Array.isArray(spec.variables) || spec.variables.length === 0) {
    issues.push({
      code: 'NO_VARIABLES',
      severity: 'error',
      message: 'Model must define at least one decision variable.',
    });
  }

  if (!Array.isArray(spec.constraints)) {
    issues.push({
      code: 'INVALID_CONSTRAINTS',
      severity: 'error',
      message: 'Model constraints must be an array.',
    });
  }

  const varSet = new Set<string>();
  let numContinuous = 0;
  let numInteger = 0;
  let numBinary = 0;
  const coefStats: { minNonzero: number | null; maxAbs: number | null } = {
    minNonzero: null,
    maxAbs: null,
  };

  const trackCoef = (val: number, target: string) => {
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
      issues.push({
        code: 'INVALID_NUMBER',
        severity: 'error',
        message: `Non-finite or NaN numeric value detected (${String(val)}).`,
        target,
      });
      return;
    }
    const abs = Math.abs(val);
    if (abs > 0) {
      if (coefStats.minNonzero === null || abs < coefStats.minNonzero) coefStats.minNonzero = abs;
      if (coefStats.maxAbs === null || abs > coefStats.maxAbs) coefStats.maxAbs = abs;
    }
  };

  for (const v of spec.variables || []) {
    if (!v.name || !v.name.trim()) {
      issues.push({ code: 'EMPTY_VAR_NAME', severity: 'error', message: 'Variable name cannot be empty.' });
      continue;
    }
    if (!VALID_IDENTIFIER.test(v.name.trim())) {
      issues.push({
        code: 'VAR_NAME_CHARS',
        severity: 'warning',
        message: `Variable "${v.name}" contains spaces or special symbols; it will be sanitized for solver LP serialization.`,
        target: v.name,
      });
    }
    if (varSet.has(v.name)) {
      issues.push({
        code: 'DUPLICATE_VAR',
        severity: 'error',
        message: `Duplicate variable name "${v.name}".`,
        target: v.name,
      });
    }
    varSet.add(v.name);

    if (v.type === 'binary') numBinary++;
    else if (v.type === 'integer') numInteger++;
    else numContinuous++;

    if (v.lb !== null && (typeof v.lb !== 'number' || Number.isNaN(v.lb))) {
      issues.push({ code: 'INVALID_LB', severity: 'error', message: `Invalid lower bound on "${v.name}".`, target: v.name });
    }
    if (v.ub !== null && (typeof v.ub !== 'number' || Number.isNaN(v.ub))) {
      issues.push({ code: 'INVALID_UB', severity: 'error', message: `Invalid upper bound on "${v.name}".`, target: v.name });
    }
    if (v.lb !== null && v.ub !== null && v.lb > v.ub) {
      issues.push({
        code: 'INVERTED_BOUNDS',
        severity: 'error',
        message: `Variable "${v.name}" has lower bound (${v.lb}) > upper bound (${v.ub}).`,
        target: v.name,
      });
    }
    if (v.type === 'binary') {
      const lb = v.lb ?? 0;
      const ub = v.ub ?? 1;
      if (lb < 0 || ub > 1) {
        issues.push({
          code: 'BINARY_BOUNDS',
          severity: 'warning',
          message: `Binary variable "${v.name}" has bounds [${lb}, ${ub}] outside [0, 1]; solver clamps binary domain to {0, 1}.`,
          target: v.name,
        });
      }
    }
  }

  const conNames = new Set<string>();
  let numNonzeros = 0;

  for (const c of spec.constraints || []) {
    if (!c.name || !c.name.trim()) {
      issues.push({ code: 'EMPTY_CON_NAME', severity: 'error', message: 'Constraint name cannot be empty.' });
    } else if (conNames.has(c.name)) {
      issues.push({
        code: 'DUPLICATE_CON',
        severity: 'error',
        message: `Duplicate constraint name "${c.name}".`,
        target: c.name,
      });
    }
    conNames.add(c.name);

    if (!['<=', '>=', '=='].includes(c.sense)) {
      issues.push({
        code: 'INVALID_SENSE',
        severity: 'error',
        message: `Constraint "${c.name}" has invalid sense "${c.sense}". Must be <=, >=, or ==.`,
        target: c.name,
      });
    }

    trackCoef(c.rhs, c.name);

    const entries = Object.entries(c.terms || {});
    if (entries.length === 0) {
      issues.push({
        code: 'EMPTY_CONSTRAINT_ROW',
        severity: 'warning',
        message: `Constraint "${c.name}" has no variable terms (0 ${c.sense} ${c.rhs}).`,
        target: c.name,
      });
    }

    for (const [varName, coef] of entries) {
      if (!varSet.has(varName)) {
        issues.push({
          code: 'UNKNOWN_VAR_REF',
          severity: 'error',
          message: `Constraint "${c.name}" references undefined variable "${varName}".`,
          target: c.name,
        });
      }
      trackCoef(coef, `${c.name}.${varName}`);
      if (coef !== 0) numNonzeros++;
    }
  }

  if (!spec.objective || !['max', 'min'].includes(spec.objective.sense)) {
    issues.push({
      code: 'INVALID_OBJECTIVE',
      severity: 'error',
      message: 'Objective must specify sense "max" or "min".',
    });
  } else {
    const objTerms = Object.entries(spec.objective.terms || {});
    if (objTerms.length === 0 && (!spec.objective.quadraticTerms || spec.objective.quadraticTerms.length === 0)) {
      issues.push({
        code: 'ZERO_OBJECTIVE',
        severity: 'warning',
        message: 'Objective has no nonzero terms; solver will return any feasible point (objective = 0).',
      });
    }
    for (const [varName, coef] of objTerms) {
      if (!varSet.has(varName)) {
        issues.push({
          code: 'UNKNOWN_OBJ_VAR',
          severity: 'error',
          message: `Objective references undefined variable "${varName}".`,
          target: varName,
        });
      }
      trackCoef(coef, `objective.${varName}`);
    }
    for (const qt of spec.objective.quadraticTerms || []) {
      if (!varSet.has(qt.var1) || !varSet.has(qt.var2)) {
        issues.push({
          code: 'UNKNOWN_QP_VAR',
          severity: 'error',
          message: `Quadratic term (${qt.var1}, ${qt.var2}) references an undefined variable.`,
        });
      }
      trackCoef(qt.coef, `objective.Q(${qt.var1},${qt.var2})`);
    }
  }

  const minNonzeroCoef = coefStats.minNonzero;
  const maxAbsCoef = coefStats.maxAbs;
  let dynamicRange: number | null = null;
  if (minNonzeroCoef !== null && maxAbsCoef !== null && minNonzeroCoef > 0) {
    dynamicRange = maxAbsCoef / minNonzeroCoef;
    if (dynamicRange > 1e6) {
      issues.push({
        code: 'ILL_CONDITIONED_SCALE',
        severity: 'warning',
        message: `Coefficient dynamic range is ${dynamicRange.toExponential(2)} (> 1e6). Enable Equilibration Auto-Scaling to preserve simplex accuracy.`,
      });
    }
    if (minNonzeroCoef < 1e-3) {
      issues.push({
        code: 'TINY_COEFFICIENTS',
        severity: 'warning',
        message: `Minimum nonzero coefficient (${minNonzeroCoef.toExponential(2)}) is below 1e-3. Consider normalizing units (e.g. $M instead of $).`,
      });
    }
  }

  const numQuadraticTerms = spec.objective?.quadraticTerms?.length ?? 0;
  const hasInt = numInteger + numBinary > 0;
  const hasQuad = numQuadraticTerms > 0;
  const problemClass: ProblemClass = hasQuad
    ? hasInt
      ? 'MIQP'
      : 'QP'
    : hasInt
      ? 'MIP'
      : 'LP';

  if (problemClass === 'MIQP') {
    issues.push({
      code: 'MIQP_NOTE',
      severity: 'warning',
      message: 'Mixed-Integer Quadratic Programming (MIQP) relaxes quadratic terms or requires continuous variables in HiGHS; convert discrete variables or linearize risk for exact MIQP.',
    });
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    problemClass,
    numVars: spec.variables?.length ?? 0,
    numContinuous,
    numInteger,
    numBinary,
    numConstraints: spec.constraints?.length ?? 0,
    numNonzeros,
    numQuadraticTerms,
    minNonzeroCoef,
    maxAbsCoef,
    dynamicRange,
    issues,
  };
}

export function modelSpecToLpText(spec: ModelSpec): string {
  const lines: string[] = [];
  const nameMap = new Map<string, string>();
  spec.variables.forEach((v, idx) => {
    nameMap.set(v.name, sanitizeLpName(v.name, 'x', idx));
  });

  const formatTerms = (terms: Record<string, number>): string => {
    const parts: string[] = [];
    for (const [vName, coef] of Object.entries(terms)) {
      if (coef === 0) continue;
      const safe = nameMap.get(vName) ?? vName;
      const sign = coef >= 0 ? (parts.length > 0 ? '+ ' : '') : '- ';
      const mag = Math.abs(coef);
      parts.push(`${sign}${mag === 1 ? '' : `${mag} `}${safe}`);
    }
    return parts.length > 0 ? parts.join(' ') : `0 ${nameMap.get(spec.variables[0]?.name) ?? 'x0'}`;
  };

  lines.push(spec.objective.sense === 'max' ? 'Maximize' : 'Minimize');
  let objExpr = formatTerms(spec.objective.terms);
  if (spec.objective.quadraticTerms && spec.objective.quadraticTerms.length > 0) {
    const qParts: string[] = [];
    for (const qt of spec.objective.quadraticTerms) {
      if (qt.coef === 0) continue;
      const s1 = nameMap.get(qt.var1) ?? qt.var1;
      const s2 = nameMap.get(qt.var2) ?? qt.var2;
      // CPLEX LP format uses [ ... ] / 2 for 0.5 * x^T Q x
      const termCoef = s1 === s2 ? qt.coef : 2 * qt.coef;
      const sign = termCoef >= 0 ? (qParts.length > 0 ? '+ ' : '') : '- ';
      const mag = Math.abs(termCoef);
      if (s1 === s2) {
        qParts.push(`${sign}${mag} ${s1}^2`);
      } else {
        qParts.push(`${sign}${mag} ${s1} * ${s2}`);
      }
    }
    if (qParts.length > 0) {
      objExpr += ` + [ ${qParts.join(' ')} ] / 2`;
    }
  }
  lines.push(` obj: ${objExpr}`);

  lines.push('Subject To');
  spec.constraints.forEach((c, idx) => {
    const cName = sanitizeLpName(c.name, 'c', idx);
    const sense = c.sense === '==' ? '=' : c.sense;
    lines.push(` ${cName}: ${formatTerms(c.terms)} ${sense} ${c.rhs}`);
  });

  lines.push('Bounds');
  for (const v of spec.variables) {
    const safe = nameMap.get(v.name) ?? v.name;
    if (v.type === 'binary') {
      lines.push(` 0 <= ${safe} <= 1`);
      continue;
    }
    const lb = v.lb === null ? '-inf' : String(v.lb);
    const ub = v.ub === null ? '+inf' : String(v.ub);
    if (v.lb === null && v.ub === null) {
      lines.push(` ${safe} free`);
    } else if (v.ub === null) {
      lines.push(` ${safe} >= ${lb}`);
    } else if (v.lb === null) {
      lines.push(` ${safe} <= ${ub}`);
    } else {
      lines.push(` ${lb} <= ${safe} <= ${ub}`);
    }
  }

  const generals = spec.variables.filter((v) => v.type === 'integer').map((v) => nameMap.get(v.name) ?? v.name);
  if (generals.length > 0) {
    lines.push('Generals');
    lines.push(` ${generals.join(' ')}`);
  }

  const binaries = spec.variables.filter((v) => v.type === 'binary').map((v) => nameMap.get(v.name) ?? v.name);
  if (binaries.length > 0) {
    lines.push('Binaries');
    lines.push(` ${binaries.join(' ')}`);
  }

  lines.push('End');
  return lines.join('\n');
}
