import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type {
  ConstraintResultDetail,
  ModelSpec,
  NormalizedSolveResult,
  VariableResultDetail,
} from '../shared/types.ts';
import { fmtNum } from '../utils/format.ts';

interface AllocationChartProps {
  variables: VariableResultDetail[];
  sense: 'max' | 'min';
}

export function AllocationAndContributionChart({ variables }: AllocationChartProps) {
  const [metric, setMetric] = useState<'contribution' | 'primal'>('contribution');
  const [hovered, setHovered] = useState<string | null>(null);

  const rows = useMemo(() => {
    return variables
      .map((v) => ({
        name: v.name,
        primal: v.value,
        contribution: v.value * v.objCoef,
        objCoef: v.objCoef,
        unit: v.unit,
      }))
      .sort((a, b) => Math.abs(b[metric]) - Math.abs(a[metric]))
      .slice(0, 12);
  }, [variables, metric]);

  const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(r[metric])));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {metric === 'contribution' ? 'Objective Contribution by Variable' : 'Optimal Primal Allocation'}
          </h3>
          <p className="text-xs text-slate-500">
            {metric === 'contribution'
              ? 'Weighted objective impact (c · x) ranked by magnitude.'
              : 'Solved decision variable quantities.'}
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setMetric('contribution')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              metric === 'contribution' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Obj Impact
          </button>
          <button
            type="button"
            onClick={() => setMetric('primal')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              metric === 'primal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Primal Value
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        {rows.map((r) => {
          const val = r[metric];
          const pct = Math.min(100, (Math.abs(val) / maxAbs) * 100);
          const isHovered = hovered === r.name;
          return (
            <div
              key={r.name}
              onMouseEnter={() => setHovered(r.name)}
              onMouseLeave={() => setHovered(null)}
              className={`rounded-lg px-2 py-1.5 transition-colors ${isHovered ? 'bg-slate-50' : ''}`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-mono font-medium text-slate-800 truncate max-w-[55%]">
                  {r.name}
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {fmtNum(val, 4)}
                  {metric === 'primal' && r.unit ? ` ${r.unit}` : ''}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(val !== 0 ? 2 : 0, pct)}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${
                    val >= 0 ? 'bg-teal-600' : 'bg-amber-600'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ConstraintChartProps {
  constraints: ConstraintResultDetail[];
}

export function ConstraintUtilizationChart({ constraints }: ConstraintChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const rows = constraints.slice(0, 12);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Constraint Utilization &amp; Bottleneck Pressure
        </h3>
        <p className="text-xs text-slate-500">
          Amber bars mark active binding bottlenecks; shadow prices indicate marginal value per +1 RHS unit.
        </p>
      </div>

      <div className="space-y-2 pt-1">
        {rows.map((c) => {
          const util = c.utilizationPct !== null ? Math.min(120, Math.max(0, c.utilizationPct)) : c.binding ? 100 : 0;
          const barWidth = Math.min(100, util);
          const isHovered = hovered === c.name;
          return (
            <div
              key={c.name}
              onMouseEnter={() => setHovered(c.name)}
              onMouseLeave={() => setHovered(null)}
              className={`rounded-lg px-2 py-1.5 transition-colors ${isHovered ? 'bg-slate-50' : ''}`}
            >
              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                <span className="font-mono font-medium text-slate-800 truncate">{c.name}</span>
                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  {c.shadowPrice !== null && Math.abs(c.shadowPrice) > 1e-7 && (
                    <span className="text-teal-700 font-semibold">
                      SP: {fmtNum(c.shadowPrice, 3)}
                    </span>
                  )}
                  <span className={c.binding ? 'text-amber-700 font-semibold' : 'text-slate-600'}>
                    {c.utilizationPct !== null ? `${c.utilizationPct.toFixed(1)}%` : c.binding ? 'Binding' : 'Slack'}
                  </span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(barWidth > 0 ? 2 : 0, barWidth)}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${
                    c.binding ? 'bg-amber-600' : 'bg-slate-400'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Pt {
  x: number;
  y: number;
}

function clipPolygonHalfPlane(poly: Pt[], a: number, b: number, rhs: number, sense: '<=' | '>='): Pt[] {
  if (poly.length === 0) return [];
  // Normalize to a*x + b*y <= rhs
  const na = sense === '<=' ? a : -a;
  const nb = sense === '<=' ? b : -b;
  const nr = sense === '<=' ? rhs : -rhs;
  const eps = 1e-9;

  const inside = (p: Pt) => na * p.x + nb * p.y <= nr + eps;
  const intersect = (p1: Pt, p2: Pt): Pt => {
    const d1 = na * p1.x + nb * p1.y - nr;
    const d2 = na * p2.x + nb * p2.y - nr;
    const denom = d1 - d2;
    if (Math.abs(denom) < 1e-12) return p1;
    const t = d1 / denom;
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  };

  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const currIn = inside(curr);
    const prevIn = inside(prev);
    if (currIn) {
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

interface FeasibleRegionProps {
  spec: ModelSpec;
  result: NormalizedSolveResult;
}

export function FeasibleRegion2DChart({ spec, result }: FeasibleRegionProps) {
  const [varX, setVarX] = useState<string>(() => {
    const active = spec.variables.find((v) => Math.abs(result.values[v.name] ?? 0) > 1e-6);
    return active?.name ?? spec.variables[0]?.name ?? '';
  });
  const [varY, setVarY] = useState<string>(() => {
    const first = spec.variables.find((v) => Math.abs(result.values[v.name] ?? 0) > 1e-6)?.name ?? spec.variables[0]?.name;
    const second = spec.variables.find((v) => v.name !== first && Math.abs(result.values[v.name] ?? 0) > 1e-6)
      ?? spec.variables.find((v) => v.name !== first);
    return second?.name ?? spec.variables[0]?.name ?? '';
  });

  const validVars = spec.variables.map((v) => v.name);
  const safeX = validVars.includes(varX) ? varX : validVars[0] ?? '';
  const safeY = validVars.includes(varY) ? varY : validVars[1] ?? validVars[0] ?? '';

  const geometry = useMemo(() => {
    if (!safeX || !safeY || safeX === safeY) return null;

    const vXObj = spec.variables.find((v) => v.name === safeX);
    const vYObj = spec.variables.find((v) => v.name === safeY);
    if (!vXObj || !vYObj) return null;

    const optX = result.values[safeX] ?? 0;
    const optY = result.values[safeY] ?? 0;

    // Reduce every constraint to 2D slice by fixing other variables at their solved values
    const lines: Array<{ name: string; a: number; b: number; rhs: number; sense: '<=' | '>=' | '==' }> = [];
    for (const c of spec.constraints) {
      const a = c.terms[safeX] ?? 0;
      const b = c.terms[safeY] ?? 0;
      if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) continue;

      let fixedSum = 0;
      for (const [k, coef] of Object.entries(c.terms)) {
        if (k !== safeX && k !== safeY) {
          fixedSum += coef * (result.values[k] ?? 0);
        }
      }
      lines.push({
        name: c.name,
        a,
        b,
        rhs: c.rhs - fixedSum,
        sense: c.sense,
      });
    }

    // Determine sensible viewport bounds [xMin, xMax] x [yMin, yMax]
    const xCandidates = [0, optX * 1.45, vXObj.lb ?? 0, vXObj.ub ?? 0];
    const yCandidates = [0, optY * 1.45, vYObj.lb ?? 0, vYObj.ub ?? 0];
    for (const l of lines) {
      if (Math.abs(l.a) > 1e-9) {
        const xInt = l.rhs / l.a;
        if (Number.isFinite(xInt) && Math.abs(xInt) < 1e6) xCandidates.push(xInt);
      }
      if (Math.abs(l.b) > 1e-9) {
        const yInt = l.rhs / l.b;
        if (Number.isFinite(yInt) && Math.abs(yInt) < 1e6) yCandidates.push(yInt);
      }
    }

    const rawMinX = Math.min(0, ...xCandidates.filter(Number.isFinite));
    const rawMaxX = Math.max(1, ...xCandidates.filter(Number.isFinite));
    const rawMinY = Math.min(0, ...yCandidates.filter(Number.isFinite));
    const rawMaxY = Math.max(1, ...yCandidates.filter(Number.isFinite));

    const spanX = Math.max(1e-3, rawMaxX - rawMinX);
    const spanY = Math.max(1e-3, rawMaxY - rawMinY);
    const xMin = rawMinX - spanX * 0.08;
    const xMax = rawMaxX + spanX * 0.12;
    const yMin = rawMinY - spanY * 0.08;
    const yMax = rawMaxY + spanY * 0.12;

    let poly: Pt[] = [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax },
    ];

    const effLbX = vXObj.type === 'binary' ? 0 : vXObj.lb;
    const effUbX = vXObj.type === 'binary' ? 1 : vXObj.ub;
    const effLbY = vYObj.type === 'binary' ? 0 : vYObj.lb;
    const effUbY = vYObj.type === 'binary' ? 1 : vYObj.ub;

    if (effLbX !== null) poly = clipPolygonHalfPlane(poly, 1, 0, effLbX, '>=');
    if (effUbX !== null) poly = clipPolygonHalfPlane(poly, 1, 0, effUbX, '<=');
    if (effLbY !== null) poly = clipPolygonHalfPlane(poly, 0, 1, effLbY, '>=');
    if (effUbY !== null) poly = clipPolygonHalfPlane(poly, 0, 1, effUbY, '<=');

    for (const l of lines) {
      if (l.sense === '<=' || l.sense === '==') {
        poly = clipPolygonHalfPlane(poly, l.a, l.b, l.rhs, '<=');
      }
      if (l.sense === '>=' || l.sense === '==') {
        poly = clipPolygonHalfPlane(poly, l.a, l.b, l.rhs, '>=');
      }
    }

    return { xMin, xMax, yMin, yMax, lines, poly, optX, optY };
  }, [spec, result, safeX, safeY]);

  if (spec.variables.length < 2) return null;

  const W = 560;
  const H = 300;
  const padL = 56;
  const padR = 24;
  const padT = 20;
  const padB = 38;

  const toPx = (x: number, y: number) => {
    if (!geometry) return { px: padL, py: H - padB };
    const px = padL + ((x - geometry.xMin) / Math.max(1e-9, geometry.xMax - geometry.xMin)) * (W - padL - padR);
    const py = H - padB - ((y - geometry.yMin) / Math.max(1e-9, geometry.yMax - geometry.yMin)) * (H - padT - padB);
    return { px, py };
  };

  const clipLineToBox = (a: number, b: number, rhs: number) => {
    if (!geometry) return null;
    const { xMin, xMax, yMin, yMax } = geometry;
    const pts: Pt[] = [];
    if (Math.abs(b) > 1e-9) {
      const yAtMin = (rhs - a * xMin) / b;
      if (yAtMin >= yMin - 1e-6 && yAtMin <= yMax + 1e-6) pts.push({ x: xMin, y: yAtMin });
      const yAtMax = (rhs - a * xMax) / b;
      if (yAtMax >= yMin - 1e-6 && yAtMax <= yMax + 1e-6) pts.push({ x: xMax, y: yAtMax });
    }
    if (Math.abs(a) > 1e-9) {
      const xAtMin = (rhs - b * yMin) / a;
      if (xAtMin > xMin + 1e-6 && xAtMin < xMax - 1e-6) pts.push({ x: xAtMin, y: yMin });
      const xAtMax = (rhs - b * yMax) / a;
      if (xAtMax > xMin + 1e-6 && xAtMax < xMax - 1e-6) pts.push({ x: xAtMax, y: yMax });
    }
    if (pts.length < 2) return null;
    return [pts[0], pts[pts.length - 1]];
  };

  const LINE_COLORS = ['#64748b', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#059669'];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            2D Feasible Region &amp; Iso-Objective Slice
          </h3>
          <p className="text-xs text-slate-500">
            {spec.variables.length > 2
              ? 'Visualizes a 2-variable cross-section with all other variables fixed at their solved values.'
              : 'Exact feasible polytope, constraint hyperplanes, and optimal corner vertex.'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-slate-600">
            <span>X:</span>
            <select
              value={safeX}
              onChange={(e) => setVarX(e.target.value)}
              className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded-md text-slate-900"
            >
              {validVars.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-slate-600">
            <span>Y:</span>
            <select
              value={safeY}
              onChange={(e) => setVarY(e.target.value)}
              className="px-2 py-1 font-mono bg-slate-50 border border-slate-200 rounded-md text-slate-900"
            >
              {validVars.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {safeX === safeY ? (
        <div className="p-6 text-center text-xs text-slate-500 border border-slate-100 rounded-lg bg-slate-50">
          Select two different variables for X and Y axes to render the feasible region slice.
        </div>
      ) : geometry ? (
        <div className="space-y-2">
          <div className="border border-slate-200 rounded-lg bg-slate-50/40 p-2 overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-72">
              <defs>
                <clipPath id="plot-area-clip">
                  <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
                </clipPath>
              </defs>

              {/* Plot Frame & Grid */}
              <rect
                x={padL}
                y={padT}
                width={W - padL - padR}
                height={H - padT - padB}
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth="1"
              />

              {[0.25, 0.5, 0.75].map((t) => {
                const gx = padL + t * (W - padL - padR);
                const gy = padT + t * (H - padT - padB);
                return (
                  <g key={t}>
                    <line x1={gx} y1={padT} x2={gx} y2={H - padB} stroke="#f1f5f9" strokeWidth="1" />
                    <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="#f1f5f9" strokeWidth="1" />
                  </g>
                );
              })}

              {/* Shaded Feasible Polygon */}
              <g clipPath="url(#plot-area-clip)">
                {geometry.poly.length >= 3 && (
                  <polygon
                    points={geometry.poly
                      .map((p) => {
                        const { px, py } = toPx(p.x, p.y);
                        return `${px},${py}`;
                      })
                      .join(' ')}
                    fill="rgba(13, 148, 136, 0.14)"
                    stroke="#0f766e"
                    strokeWidth="2"
                  />
                )}

                {/* Constraint Boundary Lines */}
                {geometry.lines.slice(0, 8).map((l, idx) => {
                  const seg = clipLineToBox(l.a, l.b, l.rhs);
                  if (!seg) return null;
                  const p1 = toPx(seg[0].x, seg[0].y);
                  const p2 = toPx(seg[1].x, seg[1].y);
                  const color = LINE_COLORS[idx % LINE_COLORS.length];
                  return (
                    <line
                      key={l.name}
                      x1={p1.px}
                      y1={p1.py}
                      x2={p2.px}
                      y2={p2.py}
                      stroke={color}
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  );
                })}

                {/* Iso-Objective Contour Line through Optimum */}
                {(result.status === 'optimal' || result.status === 'feasible') && (() => {
                  const cx = spec.objective.terms[safeX] ?? 0;
                  const cy = spec.objective.terms[safeY] ?? 0;
                  if (Math.abs(cx) < 1e-12 && Math.abs(cy) < 1e-12) return null;
                  const isoRhs = cx * geometry.optX + cy * geometry.optY;
                  const isoSeg = clipLineToBox(cx, cy, isoRhs);
                  if (!isoSeg) return null;
                  const p1 = toPx(isoSeg[0].x, isoSeg[0].y);
                  const p2 = toPx(isoSeg[1].x, isoSeg[1].y);
                  return (
                    <line
                      x1={p1.px}
                      y1={p1.py}
                      x2={p2.px}
                      y2={p2.py}
                      stroke="#0f172a"
                      strokeWidth="1.75"
                      strokeDasharray="6 3"
                    />
                  );
                })()}

                {/* Optimal Vertex Marker */}
                {(result.status === 'optimal' || result.status === 'feasible') && (() => {
                  const optPt = toPx(geometry.optX, geometry.optY);
                  return (
                    <g>
                      <circle cx={optPt.px} cy={optPt.py} r="6" fill="#0f766e" stroke="#ffffff" strokeWidth="2" />
                      <text
                        x={Math.min(W - padR - 90, optPt.px + 9)}
                        y={Math.max(padT + 14, optPt.py - 8)}
                        className="fill-slate-900 text-[10px] font-mono font-semibold"
                      >
                        Opt ({fmtNum(geometry.optX, 2)}, {fmtNum(geometry.optY, 2)})
                      </text>
                    </g>
                  );
                })()}
              </g>

              {/* Axis Ticks */}
              <text x={padL} y={H - padB + 14} className="fill-slate-500 text-[10px] font-mono">
                {fmtNum(geometry.xMin, 2)}
              </text>
              <text x={W - padR} y={H - padB + 14} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
                {fmtNum(geometry.xMax, 2)}
              </text>
              <text x={(padL + W - padR) / 2} y={H - 8} textAnchor="middle" className="fill-slate-700 text-[11px] font-mono font-medium">
                {safeX}
              </text>

              <text x={padL - 6} y={H - padB} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
                {fmtNum(geometry.yMin, 2)}
              </text>
              <text x={padL - 6} y={padT + 8} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
                {fmtNum(geometry.yMax, 2)}
              </text>
              <text
                x={14}
                y={(padT + H - padB) / 2}
                textAnchor="middle"
                transform={`rotate(-90, 14, ${(padT + H - padB) / 2})`}
                className="fill-slate-700 text-[11px] font-mono font-medium"
              >
                {safeY}
              </text>
            </svg>
          </div>

          {/* Compact Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 px-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-teal-600/20 border border-teal-700 inline-block" />
              Feasible Region
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-slate-900 inline-block" />
              Iso-Objective Line
            </span>
            {geometry.lines.slice(0, 6).map((l, idx) => (
              <span key={l.name} className="inline-flex items-center gap-1.5 font-mono">
                <span
                  className="w-3 border-t-2 border-dashed inline-block"
                  style={{ borderColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                />
                {l.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface SensitivityChartProps {
  constraints: ConstraintResultDetail[];
}

export function SensitivityRhsChart({ constraints }: SensitivityChartProps) {
  const ranged = constraints.filter(
    (c) => c.allowableRhsMin !== null || c.allowableRhsMax !== null,
  );
  if (ranged.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Allowable RHS Stability Intervals (Visual Range Chart)
        </h3>
        <p className="text-xs text-slate-500">
          Shows current RHS position inside the LP basis stability interval [Allowable Min, Allowable Max].
        </p>
      </div>

      <div className="space-y-2.5">
        {ranged.slice(0, 10).map((c) => {
          const cur = c.rhs;
          const lo = c.allowableRhsMin ?? cur - Math.max(10, Math.abs(cur) * 0.5);
          const hi = c.allowableRhsMax ?? cur + Math.max(10, Math.abs(cur) * 0.5);
          const span = Math.max(1e-6, hi - lo);
          const curPct = Math.min(96, Math.max(4, ((cur - lo) / span) * 100));

          return (
            <div key={c.name} className="grid grid-cols-12 items-center gap-3 text-xs">
              <div className="col-span-4 font-mono text-slate-800 truncate" title={c.name}>
                {c.name}
              </div>
              <div className="col-span-2 text-right font-mono tabular-nums text-slate-500">
                {c.allowableRhsMin !== null ? fmtNum(c.allowableRhsMin, 2) : '-∞'}
              </div>
              <div className="col-span-4 relative h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 right-0 bg-teal-600/20" />
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-teal-700 rounded-full -translate-x-1/2"
                  style={{ left: `${curPct}%` }}
                  title={`Current RHS: ${fmtNum(cur, 4)}`}
                />
              </div>
              <div className="col-span-2 font-mono tabular-nums text-slate-500">
                {c.allowableRhsMax !== null ? fmtNum(c.allowableRhsMax, 2) : '+∞'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CompareBarChartProps {
  deltas: Array<{ name: string; valueA: number | null; valueB: number | null; delta: number | null }>;
}

export function ScenarioCompareBarChart({ deltas }: CompareBarChartProps) {
  const rows = deltas.slice(0, 10);
  const maxVal = Math.max(
    1e-9,
    ...rows.flatMap((r) => [Math.abs(r.valueA ?? 0), Math.abs(r.valueB ?? 0)]),
  );

  if (rows.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Baseline vs Scenario Allocation Comparison
          </h3>
          <p className="text-xs text-slate-500">
            Visual comparison of decision variable shifts between the two selected runs.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
            Baseline (A)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 inline-block" />
            Scenario (B)
          </span>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        {rows.map((r) => {
          const pctA = Math.min(100, (Math.abs(r.valueA ?? 0) / maxVal) * 100);
          const pctB = Math.min(100, (Math.abs(r.valueB ?? 0) / maxVal) * 100);
          return (
            <div key={r.name} className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-800">{r.name}</span>
                <span className="font-mono tabular-nums text-slate-600">
                  {fmtNum(r.valueA, 3)} → <strong className="text-slate-900">{fmtNum(r.valueB, 3)}</strong>
                </span>
              </div>
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pctA}%` }} />
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-600 rounded-full" style={{ width: `${pctB}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
