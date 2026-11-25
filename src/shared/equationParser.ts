import type { ConstraintSense, ModelConstraint, ModelSpec, ModelVariable, VariableType } from './types.ts';

export interface EquationParseResult {
  spec: ModelSpec;
  warnings: string[];
  detectedLines: number;
}

function parseLinearTerms(expr: string): { terms: Record<string, number>; constant: number } {
  // Normalize unicode minus and whitespace
  const cleaned = expr
    .replace(/−/g, '-')
    .replace(/\s+/g, '')
    .replace(/\*/g, '');

  const terms: Record<string, number> = {};
  let constant = 0;

  // Match signed monomials: +3.5x1, -x, 2y, +10
  const tokenRegex = /([+-]?(?:\d+\.?\d*|\.\d+)?[A-Za-z_][A-Za-z0-9_]*|[+-]?(?:\d+\.?\d*|\.\d+))/g;
  const matches = cleaned.match(tokenRegex);
  if (!matches) return { terms, constant };

  for (const tok of matches) {
    const varMatch = tok.match(/^([+-]?(?:\d+\.?\d*|\.\d+)?)([A-Za-z_][A-Za-z0-9_]*)$/);
    if (varMatch) {
      const coefRaw = varMatch[1];
      const vName = varMatch[2];
      const coef =
        coefRaw === '' || coefRaw === '+'
          ? 1
          : coefRaw === '-'
            ? -1
            : Number(coefRaw);
      if (Number.isFinite(coef)) {
        terms[vName] = (terms[vName] ?? 0) + coef;
      }
    } else {
      const num = Number(tok);
      if (Number.isFinite(num)) {
        constant += num;
      }
    }
  }

  return { terms, constant };
}

/**
 * LP-01 / Capability #1: Automatic Mathematical Equation Detection.
 * Converts natural LP/MIP equation syntax into canonical ModelSpec JSON.
 */
export function parseMathEquationsToSpec(rawText: string, modelName = 'Parsed Mathematical LP'): EquationParseResult {
  const lines = rawText
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  const warnings: string[] = [];
  let objSense: 'max' | 'min' = 'max';
  let objTerms: Record<string, number> = {};
  let objOffset = 0;

  const varBounds = new Map<string, { lb: number | null; ub: number | null; type: VariableType }>();
  const ensureVar = (name: string) => {
    if (!varBounds.has(name)) {
      varBounds.set(name, { lb: 0, ub: null, type: 'continuous' });
    }
  };

  const constraints: ModelConstraint[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    let line = lines[idx]
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/−/g, '-');

    const lower = line.toLowerCase();
    if (lower === 'subject to' || lower === 'subject to:' || lower === 's.t.' || lower === 's.t.:' || lower === 'constraints:' || lower === 'where:') {
      continue;
    }

    // Check integrality declarations: "integer: x, y" or "binary: b1, b2" or "x, y integer"
    const intMatch = line.match(/^(integer|integers|general|generals|binary|binaries)\s*:\s*(.+)$/i);
    if (intMatch) {
      const kind: VariableType = intMatch[1].toLowerCase().startsWith('bin') ? 'binary' : 'integer';
      const names = intMatch[2].split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      for (const n of names) {
        ensureVar(n);
        const cur = varBounds.get(n)!;
        cur.type = kind;
        if (kind === 'binary') {
          cur.lb = 0;
          cur.ub = 1;
        }
      }
      continue;
    }

    // Check objective declaration: "Maximize Z = 3x + 2y" or "min: 4x + 5y"
    const objMatch = line.match(/^(maximize|maximise|max|minimize|minimise|min)\b(?:\s+[A-Za-z_][A-Za-z0-9_]*\s*=|\s*:)?\s*(.+)$/i);
    if (objMatch) {
      objSense = objMatch[1].toLowerCase().startsWith('min') ? 'min' : 'max';
      let rhsExpr = objMatch[2].trim();
      if (rhsExpr.includes('=')) {
        rhsExpr = rhsExpr.split('=').slice(1).join('=').trim();
      }
      const parsed = parseLinearTerms(rhsExpr);
      objTerms = parsed.terms;
      objOffset = parsed.constant;
      Object.keys(objTerms).forEach(ensureVar);
      continue;
    }

    // Strip optional constraint label like "labor: 2x + y <= 100"
    let cName = `c_${constraints.length + 1}`;
    const labelMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
    if (labelMatch && !['s.t', 'st'].includes(labelMatch[1].toLowerCase())) {
      cName = labelMatch[1];
      line = labelMatch[2].trim();
    } else if (line.toLowerCase().startsWith('s.t.')) {
      line = line.slice(4).trim();
    }

    // Check multi-variable non-negativity like "x, y >= 0" or "x, y, z >= 0"
    const nonNegMulti = line.match(/^([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)+)\s*(>=|<=)\s*([+-]?\d+\.?\d*)$/);
    if (nonNegMulti) {
      const names = nonNegMulti[1].split(',').map((s) => s.trim()).filter(Boolean);
      const val = Number(nonNegMulti[3]);
      for (const n of names) {
        ensureVar(n);
        const cur = varBounds.get(n)!;
        if (nonNegMulti[2] === '>=') cur.lb = cur.lb === null ? val : Math.max(cur.lb, val);
        else cur.ub = cur.ub === null ? val : Math.min(cur.ub, val);
      }
      continue;
    }

    // Parse inequality/equality: LHS (<= | >= | == | =) RHS
    const relMatch = line.match(/^(.+?)(<=|>=|==|=)(.+)$/);
    if (!relMatch) {
      warnings.push(`Line ${idx + 1} skipped (no relation operator found): "${lines[idx]}"`);
      continue;
    }

    const lhsStr = relMatch[1].trim();
    const rawOp = relMatch[2];
    const rhsStr = relMatch[3].trim();
    const sense: ConstraintSense = rawOp === '=' || rawOp === '==' ? '==' : rawOp === '>=' ? '>=' : '<=';

    const lhsParsed = parseLinearTerms(lhsStr);
    const rhsParsed = parseLinearTerms(rhsStr);

    // Move all variable terms to LHS and constants to RHS
    const combinedTerms: Record<string, number> = { ...lhsParsed.terms };
    for (const [v, c] of Object.entries(rhsParsed.terms)) {
      combinedTerms[v] = (combinedTerms[v] ?? 0) - c;
    }
    for (const v of Object.keys(combinedTerms)) {
      if (Math.abs(combinedTerms[v]) < 1e-12) delete combinedTerms[v];
      else ensureVar(v);
    }

    const netRhs = rhsParsed.constant - lhsParsed.constant;
    const termKeys = Object.keys(combinedTerms);

    // If it's a pure single-variable bound like "x >= 0" or "x <= 40", apply as variable bound (unless named constraint)
    if (termKeys.length === 1 && !labelMatch) {
      const vName = termKeys[0];
      const coef = combinedTerms[vName];
      const boundVal = netRhs / coef;
      const effectiveSense: ConstraintSense =
        coef > 0 ? sense : sense === '<=' ? '>=' : sense === '>=' ? '<=' : '==';

      ensureVar(vName);
      const cur = varBounds.get(vName)!;
      if (effectiveSense === '>=' && boundVal >= 0 && cur.lb === 0) {
        cur.lb = boundVal;
        continue;
      }
      if (effectiveSense === '>=' && boundVal === 0) {
        cur.lb = 0;
        continue;
      }
    }

    constraints.push({
      name: cName,
      terms: combinedTerms,
      sense,
      rhs: Math.round(netRhs * 1e9) / 1e9,
    });
  }

  if (varBounds.size === 0) {
    warnings.push('No decision variables detected. Example: Maximize Z = 3x + 2y');
  }

  const variables: ModelVariable[] = Array.from(varBounds.entries()).map(([name, info]) => ({
    name,
    lb: info.lb,
    ub: info.ub,
    type: info.type,
    unit: 'units',
  }));

  return {
    spec: {
      name: modelName,
      domain: 'Custom',
      description: 'Formulated via Automatic Mathematical Equation Parser (LP-01)',
      variables,
      constraints,
      objective: {
        sense: objSense,
        terms: objTerms,
        offset: objOffset,
      },
    },
    warnings,
    detectedLines: lines.length,
  };
}

/**
 * Capability #7: Converts a canonical ModelSpec into clean LaTeX expressions.
 */
export function modelSpecToLatex(spec: ModelSpec): {
  objectiveLatex: string;
  constraintsLatex: string[];
  boundsLatex: string;
  integralityLatex: string | null;
} {
  const fmtVar = (name: string) => {
    const idxMatch = name.match(/^([A-Za-z]+)_?(\d+)$/);
    if (idxMatch) return `${idxMatch[1]}_{${idxMatch[2]}}`;
    return `\\text{${name.replace(/_/g, '\\_')}}`;
  };

  const fmtLinear = (terms: Record<string, number>) => {
    const parts: string[] = [];
    for (const [vName, coef] of Object.entries(terms)) {
      if (coef === 0) continue;
      const sign = coef >= 0 ? (parts.length > 0 ? ' + ' : '') : ' - ';
      const mag = Math.abs(coef);
      parts.push(`${sign}${mag === 1 ? '' : mag}${fmtVar(vName)}`);
    }
    return parts.length > 0 ? parts.join('') : '0';
  };

  const senseWord = spec.objective.sense === 'max' ? '\\max' : '\\min';
  let objExpr = fmtLinear(spec.objective.terms);
  if (spec.objective.offset && spec.objective.offset !== 0) {
    objExpr += spec.objective.offset > 0 ? ` + ${spec.objective.offset}` : ` - ${Math.abs(spec.objective.offset)}`;
  }
  if (spec.objective.quadraticTerms && spec.objective.quadraticTerms.length > 0) {
    const qParts = spec.objective.quadraticTerms.map((q) => {
      const s = q.coef >= 0 ? ' + ' : ' - ';
      const m = Math.abs(q.coef);
      return q.var1 === q.var2
        ? `${s}\\frac{${m}}{2}${fmtVar(q.var1)}^2`
        : `${s}${m}${fmtVar(q.var1)}${fmtVar(q.var2)}`;
    });
    objExpr += qParts.join('');
  }
  const objectiveLatex = `${senseWord}\\; Z = ${objExpr}`;

  const constraintsLatex = spec.constraints.map((c) => {
    const op = c.sense === '<=' ? '\\le' : c.sense === '>=' ? '\\ge' : '=';
    return `\\text{${c.name.replace(/_/g, '\\_')}}:\\quad ${fmtLinear(c.terms)} ${op} ${c.rhs}`;
  });

  const nonNegVars = spec.variables.filter((v) => v.type !== 'binary' && v.lb === 0 && v.ub === null);
  const boundedParts: string[] = [];
  if (nonNegVars.length > 0) {
    boundedParts.push(`${nonNegVars.map((v) => fmtVar(v.name)).join(', ')} \\ge 0`);
  }
  for (const v of spec.variables) {
    if (v.type === 'binary') {
      boundedParts.push(`${fmtVar(v.name)} \\in \\{0, 1\\}`);
    } else if (v.lb !== 0 || v.ub !== null) {
      const lbStr = v.lb === null ? '-\\infty' : String(v.lb);
      const ubStr = v.ub === null ? '+\\infty' : String(v.ub);
      boundedParts.push(`${lbStr} \\le ${fmtVar(v.name)} \\le ${ubStr}`);
    }
  }
  const boundsLatex = boundedParts.join(',\\quad ');

  const ints = spec.variables.filter((v) => v.type === 'integer').map((v) => fmtVar(v.name));
  const integralityLatex = ints.length > 0 ? `${ints.join(', ')} \\in \\mathbb{Z}` : null;

  return { objectiveLatex, constraintsLatex, boundsLatex, integralityLatex };
}
