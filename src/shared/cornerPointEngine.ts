import type { ModelSpec } from './types.ts';

export interface CornerVertex {
  id: number;
  x: number;
  y: number;
  objectiveValue: number;
  isOptimal: boolean;
  definingLines: string[];
}

export interface BoundaryLine2D {
  name: string;
  a: number;
  b: number;
  rhs: number;
  sense: '<=' | '>=' | '==';
  xIntercept: number | null;
  yIntercept: number | null;
}

export interface CornerPointAnalysis {
  varX: string;
  varY: string;
  lines: BoundaryLine2D[];
  feasibleVertices: CornerVertex[];
  optimalVertices: CornerVertex[];
  optimalObjective: number | null;
  regionStatus: 'empty' | 'bounded' | 'unbounded';
  multipleOptimal: boolean;
  steps: Array<{ stepNumber: number; title: string; body: string }>;
}

/**
 * LP-02..LP-07 + Graph Engine:
 * Exact 2D Corner Point Method, Bounded/Unbounded Region Detection,
 * Multiple Optimal Solution Detection, and Step-by-Step Pedagogical Trace.
 */
export function analyze2DCornerPoints(
  spec: ModelSpec,
  varX: string,
  varY: string,
  fixedValues: Record<string, number> = {},
): CornerPointAnalysis {
  const vX = spec.variables.find((v) => v.name === varX);
  const vY = spec.variables.find((v) => v.name === varY);
  const lines: BoundaryLine2D[] = [];

  if (!vX || !vY || varX === varY) {
    return {
      varX,
      varY,
      lines: [],
      feasibleVertices: [],
      optimalVertices: [],
      optimalObjective: null,
      regionStatus: 'empty',
      multipleOptimal: false,
      steps: [],
    };
  }

  // Add constraint lines reduced to 2D slice
  for (const c of spec.constraints) {
    const a = c.terms[varX] ?? 0;
    const b = c.terms[varY] ?? 0;
    let fixedSum = 0;
    for (const [k, coef] of Object.entries(c.terms)) {
      if (k !== varX && k !== varY) {
        fixedSum += coef * (fixedValues[k] ?? 0);
      }
    }
    const rhs = c.rhs - fixedSum;
    lines.push({
      name: c.name,
      a,
      b,
      rhs,
      sense: c.sense,
      xIntercept: Math.abs(a) > 1e-10 ? rhs / a : null,
      yIntercept: Math.abs(b) > 1e-10 ? rhs / b : null,
    });
  }

  // Add variable bound lines
  const lbX = vX.type === 'binary' ? 0 : vX.lb;
  const ubX = vX.type === 'binary' ? 1 : vX.ub;
  const lbY = vY.type === 'binary' ? 0 : vY.lb;
  const ubY = vY.type === 'binary' ? 1 : vY.ub;

  if (lbX !== null) {
    lines.push({ name: `${varX} >= ${lbX}`, a: 1, b: 0, rhs: lbX, sense: '>=', xIntercept: lbX, yIntercept: null });
  }
  if (ubX !== null) {
    lines.push({ name: `${varX} <= ${ubX}`, a: 1, b: 0, rhs: ubX, sense: '<=', xIntercept: ubX, yIntercept: null });
  }
  if (lbY !== null) {
    lines.push({ name: `${varY} >= ${lbY}`, a: 0, b: 1, rhs: lbY, sense: '>=', xIntercept: null, yIntercept: lbY });
  }
  if (ubY !== null) {
    lines.push({ name: `${varY} <= ${ubY}`, a: 0, b: 1, rhs: ubY, sense: '<=', xIntercept: null, yIntercept: ubY });
  }

  const isFeasible = (x: number, y: number): boolean => {
    const eps = 1e-7;
    for (const l of lines) {
      const lhs = l.a * x + l.b * y;
      if (l.sense === '<=' && lhs > l.rhs + eps) return false;
      if (l.sense === '>=' && lhs < l.rhs - eps) return false;
      if (l.sense === '==' && Math.abs(lhs - l.rhs) > eps) return false;
    }
    return true;
  };

  // Compute all pairwise intersections
  const rawPts: Array<{ x: number; y: number; l1: string; l2: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const L1 = lines[i];
      const L2 = lines[j];
      const det = L1.a * L2.b - L2.a * L1.b;
      if (Math.abs(det) < 1e-11) continue;
      const x = (L1.rhs * L2.b - L2.rhs * L1.b) / det;
      const y = (L1.a * L2.rhs - L2.a * L1.rhs) / det;
      if (Number.isFinite(x) && Number.isFinite(y) && isFeasible(x, y)) {
        rawPts.push({
          x: Math.abs(x) < 1e-9 ? 0 : x,
          y: Math.abs(y) < 1e-9 ? 0 : y,
          l1: L1.name,
          l2: L2.name,
        });
      }
    }
  }

  // Deduplicate vertices within tolerance
  const uniquePts: Array<{ x: number; y: number; definingLines: string[] }> = [];
  for (const p of rawPts) {
    const existing = uniquePts.find((u) => Math.hypot(u.x - p.x, u.y - p.y) < 1e-6);
    if (existing) {
      if (!existing.definingLines.includes(p.l1)) existing.definingLines.push(p.l1);
      if (!existing.definingLines.includes(p.l2)) existing.definingLines.push(p.l2);
    } else {
      uniquePts.push({ x: p.x, y: p.y, definingLines: [p.l1, p.l2] });
    }
  }

  // Sort polygon vertices counter-clockwise around centroid
  if (uniquePts.length > 2) {
    const cx = uniquePts.reduce((s, p) => s + p.x, 0) / uniquePts.length;
    const cy = uniquePts.reduce((s, p) => s + p.y, 0) / uniquePts.length;
    uniquePts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  }

  // Check if feasible region is unbounded in any ray direction
  let regionStatus: CornerPointAnalysis['regionStatus'] = 'empty';
  if (uniquePts.length > 0) {
    const anchor = uniquePts[0];
    const farDist = 1e5;
    let hasUnboundedRay = false;
    // Test 16 radial directions from anchor
    for (let k = 0; k < 16; k++) {
      const ang = (k * Math.PI * 2) / 16;
      const tx = anchor.x + Math.cos(ang) * farDist;
      const ty = anchor.y + Math.sin(ang) * farDist;
      if (isFeasible(tx, ty)) {
        hasUnboundedRay = true;
        break;
      }
    }
    regionStatus = hasUnboundedRay ? 'unbounded' : 'bounded';
  }

  const cX = spec.objective.terms[varX] ?? 0;
  const cY = spec.objective.terms[varY] ?? 0;
  let fixedObj = spec.objective.offset ?? 0;
  for (const [k, coef] of Object.entries(spec.objective.terms)) {
    if (k !== varX && k !== varY) {
      fixedObj += coef * (fixedValues[k] ?? 0);
    }
  }

  const evalObj = (x: number, y: number) => Math.round((cX * x + cY * y + fixedObj) * 1e9) / 1e9;

  let bestObj: number | null = null;
  if (uniquePts.length > 0) {
    const vals = uniquePts.map((p) => evalObj(p.x, p.y));
    bestObj = spec.objective.sense === 'max' ? Math.max(...vals) : Math.min(...vals);
  }

  const feasibleVertices: CornerVertex[] = uniquePts.map((p, i) => {
    const z = evalObj(p.x, p.y);
    const isOptimal = bestObj !== null && Math.abs(z - bestObj) < 1e-5;
    return {
      id: i + 1,
      x: Math.round(p.x * 1e6) / 1e6,
      y: Math.round(p.y * 1e6) / 1e6,
      objectiveValue: z,
      isOptimal,
      definingLines: p.definingLines,
    };
  });

  const optimalVertices = feasibleVertices.filter((v) => v.isOptimal);
  const multipleOptimal = optimalVertices.length >= 2;

  const roundStr = (n: number | null) => (n === null ? 'None' : String(Math.round(n * 1000) / 1000));

  const steps: CornerPointAnalysis['steps'] = [
    {
      stepNumber: 1,
      title: 'Decision Variables & Non-Negativity (LP-01)',
      body: `Evaluating 2D coordinate slice on ${varX} (bounds [${lbX ?? '-∞'}, ${ubX ?? '+∞'}]) and ${varY} (bounds [${lbY ?? '-∞'}, ${ubY ?? '+∞'}]).`,
    },
    {
      stepNumber: 2,
      title: 'Objective Function Formulation (LP-05)',
      body: `${spec.objective.sense === 'max' ? 'Maximize' : 'Minimize'} Z = ${cX}·${varX} ${cY >= 0 ? '+' : '-'} ${Math.abs(cY)}·${varY}${fixedObj !== 0 ? ` + ${Math.round(fixedObj * 1000) / 1000}` : ''}.`,
    },
    {
      stepNumber: 3,
      title: 'Boundary Lines & Coordinate Intercepts (LP-02)',
      body: lines
        .slice(0, 8)
        .map(
          (l) =>
            `${l.name}: ${l.a}·${varX} + ${l.b}·${varY} = ${Math.round(l.rhs * 1000) / 1000} → X-int: (${roundStr(l.xIntercept)}, 0), Y-int: (0, ${roundStr(l.yIntercept)})`,
        )
        .join('\n'),
    },
    {
      stepNumber: 4,
      title: 'Feasible Region & Boundedness Check (LP-03)',
      body:
        regionStatus === 'empty'
          ? 'No feasible intersection exists across all constraints (Infeasible).'
          : `Detected ${feasibleVertices.length} feasible corner vertices. The feasible region is ${regionStatus.toUpperCase()}.`,
    },
    {
      stepNumber: 5,
      title: 'Corner Point Evaluation (LP-04 / LP-06 / LP-07)',
      body:
        feasibleVertices.length > 0
          ? feasibleVertices
              .map(
                (v) =>
                  `Vertex V${v.id} (${v.x}, ${v.y}) → Z = ${v.objectiveValue}${v.isOptimal ? '  ★ OPTIMAL' : ''}`,
              )
              .join('\n')
          : 'No corner points to evaluate.',
    },
    {
      stepNumber: 6,
      title: multipleOptimal ? 'Multiple Optimal Solutions Detected' : 'Optimal Conclusion',
      body:
        optimalVertices.length === 0
          ? 'Model has no feasible optimal corner point.'
          : multipleOptimal
            ? `Multiple Optimal Solutions: ${optimalVertices.length} distinct vertices (${optimalVertices.map((v) => `(${v.x}, ${v.y})`).join(' and ')}) yield identical Z* = ${bestObj}. Every convex combination along the connecting edge is also optimal.`
            : `Unique optimal vertex at (${optimalVertices[0].x}, ${optimalVertices[0].y}) achieving Z* = ${bestObj}.`,
    },
  ];

  return {
    varX,
    varY,
    lines,
    feasibleVertices,
    optimalVertices,
    optimalObjective: bestObj,
    regionStatus,
    multipleOptimal,
    steps,
  };
}
