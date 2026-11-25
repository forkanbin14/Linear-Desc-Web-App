import { CheckCircle2, Layers, ListChecks, Sigma, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { analyze2DCornerPoints } from '../shared/cornerPointEngine.ts';
import { modelSpecToLatex } from '../shared/equationParser.ts';
import type { ModelSpec, NormalizedSolveResult } from '../shared/types.ts';
import { fmtNum } from '../utils/format.ts';
import { LatexBlock } from './LatexBlock.tsx';

interface GraphicalCornerViewProps {
  spec: ModelSpec;
  result: NormalizedSolveResult | null;
}

interface Pt {
  x: number;
  y: number;
}

function clipPolygonHalfPlane(poly: Pt[], a: number, b: number, rhs: number, sense: '<=' | '>='): Pt[] {
  if (poly.length === 0) return [];
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

export function GraphicalCornerView({ spec, result }: GraphicalCornerViewProps) {
  const validVars = spec.variables.map((v) => v.name);
  const [varX, setVarX] = useState<string>(() => validVars[0] ?? '');
  const [varY, setVarY] = useState<string>(() => validVars[1] ?? validVars[0] ?? '');

  const safeX = validVars.includes(varX) ? varX : validVars[0] ?? '';
  const safeY = validVars.includes(varY) ? varY : validVars[1] ?? validVars[0] ?? '';

  const latex = useMemo(() => modelSpecToLatex(spec), [spec]);

  const cornerAnalysis = useMemo(() => {
    if (!safeX || !safeY || safeX === safeY) return null;
    const fixedValues: Record<string, number> = {};
    for (const v of spec.variables) {
      if (v.name !== safeX && v.name !== safeY) {
        fixedValues[v.name] = result?.values[v.name] ?? 0;
      }
    }
    return analyze2DCornerPoints(spec, safeX, safeY, fixedValues);
  }, [spec, safeX, safeY, result]);

  const geometry = useMemo(() => {
    if (!cornerAnalysis) return null;
    const vXObj = spec.variables.find((v) => v.name === safeX);
    const vYObj = spec.variables.find((v) => v.name === safeY);
    if (!vXObj || !vYObj) return null;

    const xCands = [0, vXObj.lb ?? 0, vXObj.ub ?? 0, ...(result ? [result.values[safeX] ?? 0] : [])];
    const yCands = [0, vYObj.lb ?? 0, vYObj.ub ?? 0, ...(result ? [result.values[safeY] ?? 0] : [])];

    for (const v of cornerAnalysis.feasibleVertices) {
      xCands.push(v.x);
      yCands.push(v.y);
    }
    for (const l of cornerAnalysis.lines) {
      if (l.xIntercept !== null && Math.abs(l.xIntercept) < 1e5) xCands.push(l.xIntercept);
      if (l.yIntercept !== null && Math.abs(l.yIntercept) < 1e5) yCands.push(l.yIntercept);
    }

    const rawMinX = Math.min(0, ...xCands.filter(Number.isFinite));
    const rawMaxX = Math.max(1, ...xCands.filter(Number.isFinite));
    const rawMinY = Math.min(0, ...yCands.filter(Number.isFinite));
    const rawMaxY = Math.max(1, ...yCands.filter(Number.isFinite));

    const spanX = Math.max(1e-3, rawMaxX - rawMinX);
    const spanY = Math.max(1e-3, rawMaxY - rawMinY);
    const xMin = rawMinX - spanX * 0.08;
    const xMax = rawMaxX + spanX * 0.14;
    const yMin = rawMinY - spanY * 0.08;
    const yMax = rawMaxY + spanY * 0.14;

    let poly: Pt[] = [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax },
    ];

    for (const l of cornerAnalysis.lines) {
      if (l.sense === '<=' || l.sense === '==') poly = clipPolygonHalfPlane(poly, l.a, l.b, l.rhs, '<=');
      if (l.sense === '>=' || l.sense === '==') poly = clipPolygonHalfPlane(poly, l.a, l.b, l.rhs, '>=');
    }

    return { xMin, xMax, yMin, yMax, poly };
  }, [cornerAnalysis, spec.variables, safeX, safeY, result]);

  const verificationRows = useMemo(() => {
    if (!result || (result.status !== 'optimal' && result.status !== 'feasible')) return [];
    return spec.constraints.map((c) => {
      const substitutedParts: string[] = [];
      let lhs = 0;
      for (const [vName, coef] of Object.entries(c.terms)) {
        if (coef === 0) continue;
        const val = result.values[vName] ?? 0;
        lhs += coef * val;
        substitutedParts.push(`${coef}·(${fmtNum(val, 3)})`);
      }
      const diff = c.rhs - lhs;
      const verified =
        c.sense === '<='
          ? lhs <= c.rhs + 1e-5
          : c.sense === '>='
            ? lhs >= c.rhs - 1e-5
            : Math.abs(lhs - c.rhs) <= 1e-5;
      const detail = result.constraintDetails.find((cd) => cd.name === c.name);
      return {
        name: c.name,
        expression: substitutedParts.join(' + ') || '0',
        lhs,
        sense: c.sense,
        rhs: c.rhs,
        slack: detail?.slack ?? Math.abs(diff),
        binding: detail?.binding ?? Math.abs(diff) < 1e-5,
        verified,
      };
    });
  }, [spec.constraints, result]);

  const W = 600;
  const H = 330;
  const padL = 56;
  const padR = 24;
  const padT = 22;
  const padB = 40;

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
      const y1 = (rhs - a * xMin) / b;
      if (y1 >= yMin - 1e-6 && y1 <= yMax + 1e-6) pts.push({ x: xMin, y: y1 });
      const y2 = (rhs - a * xMax) / b;
      if (y2 >= yMin - 1e-6 && y2 <= yMax + 1e-6) pts.push({ x: xMax, y: y2 });
    }
    if (Math.abs(a) > 1e-9) {
      const x1 = (rhs - b * yMin) / a;
      if (x1 > xMin + 1e-6 && x1 < xMax - 1e-6) pts.push({ x: x1, y: yMin });
      const x2 = (rhs - b * yMax) / a;
      if (x2 > xMin + 1e-6 && x2 < xMax - 1e-6) pts.push({ x: x2, y: yMax });
    }
    if (pts.length < 2) return null;
    return [pts[0], pts[pts.length - 1]];
  };

  const LINE_COLORS = ['#0284c7', '#7c3aed', '#d97706', '#dc2626', '#059669', '#475569'];

  return (
    <div className="space-y-5">
      {/* LaTeX Mathematical Formulation Card (Capability #7) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sigma className="w-4 h-4 text-teal-700" />
          <h3 className="text-sm font-semibold text-slate-900">LaTeX Mathematical Formulation</h3>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 overflow-x-auto text-sm text-slate-900">
          <div>
            <LatexBlock math={latex.objectiveLatex} />
          </div>
          <div className="text-xs text-slate-500 font-medium pt-1">Subject to:</div>
          <div className="pl-3 space-y-1.5">
            {latex.constraintsLatex.map((cTex, idx) => (
              <div key={idx}>
                <LatexBlock math={cTex} />
              </div>
            ))}
          </div>
          {latex.boundsLatex && (
            <div className="pt-1 border-t border-slate-200/70">
              <LatexBlock math={latex.boundsLatex} />
            </div>
          )}
          {latex.integralityLatex && (
            <div>
              <LatexBlock math={latex.integralityLatex} />
            </div>
          )}
        </div>
      </div>

      {/* Interactive 2D Corner Point Graph & Table (LP-02 .. LP-07) */}
      {spec.variables.length >= 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Graphical Method, Feasible Region &amp; Corner Points (LP-02 to LP-07)
              </h3>
              <p className="text-xs text-slate-500">
                Inspect boundary lines, axis intercepts, bounded/unbounded feasible polygon, and evaluated corner vertices V1..Vk.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {cornerAnalysis && (
                <span className="font-mono font-semibold text-slate-800">
                  Region: {cornerAnalysis.regionStatus.toUpperCase()}
                </span>
              )}
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

          {cornerAnalysis?.multipleOptimal && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Multiple Optimal Solutions Detected:</strong> The objective contour coincides with a constraint edge between vertices{' '}
                {cornerAnalysis.optimalVertices.map((v) => `V${v.id} (${v.x}, ${v.y})`).join(' and ')}.
              </span>
            </div>
          )}

          {cornerAnalysis && geometry && safeX !== safeY && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* Graph Canvas */}
              <div className="xl:col-span-7 border border-slate-200 rounded-lg bg-slate-50/40 p-2">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-80">
                  <defs>
                    <clipPath id="corner-plot-clip">
                      <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
                    </clipPath>
                  </defs>
                  <rect
                    x={padL}
                    y={padT}
                    width={W - padL - padR}
                    height={H - padT - padB}
                    fill="#ffffff"
                    stroke="#e2e8f0"
                  />

                  <g clipPath="url(#corner-plot-clip)">
                    {/* Coordinate Axes (X=0, Y=0) */}
                    {(() => {
                      const o = toPx(0, 0);
                      return (
                        <g stroke="#cbd5e1" strokeWidth="1">
                          <line x1={padL} y1={o.py} x2={W - padR} y2={o.py} />
                          <line x1={o.px} y1={padT} x2={o.px} y2={H - padB} />
                        </g>
                      );
                    })()}

                    {/* Feasible Polygon */}
                    {geometry.poly.length >= 3 && (
                      <polygon
                        points={geometry.poly
                          .map((p) => {
                            const { px, py } = toPx(p.x, p.y);
                            return `${px},${py}`;
                          })
                          .join(' ')}
                        fill="rgba(13, 148, 136, 0.15)"
                        stroke="#0f766e"
                        strokeWidth="2"
                      />
                    )}

                    {/* Constraint Lines */}
                    {cornerAnalysis.lines.slice(0, 8).map((l, idx) => {
                      const seg = clipLineToBox(l.a, l.b, l.rhs);
                      if (!seg) return null;
                      const p1 = toPx(seg[0].x, seg[0].y);
                      const p2 = toPx(seg[1].x, seg[1].y);
                      return (
                        <line
                          key={l.name}
                          x1={p1.px}
                          y1={p1.py}
                          x2={p2.px}
                          y2={p2.py}
                          stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      );
                    })}

                    {/* Multiple Optimal Edge Highlight */}
                    {cornerAnalysis.multipleOptimal && cornerAnalysis.optimalVertices.length >= 2 && (() => {
                      const p1 = toPx(cornerAnalysis.optimalVertices[0].x, cornerAnalysis.optimalVertices[0].y);
                      const p2 = toPx(
                        cornerAnalysis.optimalVertices[cornerAnalysis.optimalVertices.length - 1].x,
                        cornerAnalysis.optimalVertices[cornerAnalysis.optimalVertices.length - 1].y,
                      );
                      return <line x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py} stroke="#d97706" strokeWidth="3.5" />;
                    })()}

                    {/* Corner Vertices */}
                    {cornerAnalysis.feasibleVertices.map((v) => {
                      const { px, py } = toPx(v.x, v.y);
                      return (
                        <g key={v.id}>
                          <circle
                            cx={px}
                            cy={py}
                            r={v.isOptimal ? 6 : 4}
                            fill={v.isOptimal ? '#0f766e' : '#0f172a'}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <text
                            x={Math.min(W - padR - 55, px + 7)}
                            y={Math.max(padT + 12, py - 6)}
                            className={`text-[10px] font-mono ${v.isOptimal ? 'fill-teal-800 font-bold' : 'fill-slate-700'}`}
                          >
                            V{v.id} ({fmtNum(v.x, 1)}, {fmtNum(v.y, 1)})
                          </text>
                        </g>
                      );
                    })}
                  </g>

                  <text x={padL} y={H - padB + 14} className="fill-slate-500 text-[10px] font-mono">
                    {fmtNum(geometry.xMin, 1)}
                  </text>
                  <text x={W - padR} y={H - padB + 14} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
                    {fmtNum(geometry.xMax, 1)}
                  </text>
                  <text x={(padL + W - padR) / 2} y={H - 8} textAnchor="middle" className="fill-slate-800 text-[11px] font-mono font-semibold">
                    {safeX}
                  </text>
                  <text x={padL - 6} y={H - padB} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
                    {fmtNum(geometry.yMin, 1)}
                  </text>
                  <text x={padL - 6} y={padT + 8} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
                    {fmtNum(geometry.yMax, 1)}
                  </text>
                  <text
                    x={14}
                    y={(padT + H - padB) / 2}
                    textAnchor="middle"
                    transform={`rotate(-90, 14, ${(padT + H - padB) / 2})`}
                    className="fill-slate-800 text-[11px] font-mono font-semibold"
                  >
                    {safeY}
                  </text>
                </svg>
              </div>

              {/* Corner Points Evaluation Table */}
              <div className="xl:col-span-5 border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-semibold text-slate-800">
                  Corner Point Method Table ({cornerAnalysis.feasibleVertices.length} Vertices)
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-white">
                        <th className="py-2 px-2.5">Vertex</th>
                        <th className="py-2 px-2.5 font-mono">({safeX}, {safeY})</th>
                        <th className="py-2 px-2.5 text-right font-mono">Z Value</th>
                        <th className="py-2 px-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cornerAnalysis.feasibleVertices.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            No feasible corner points in this 2D slice.
                          </td>
                        </tr>
                      ) : (
                        cornerAnalysis.feasibleVertices.map((v) => (
                          <tr key={v.id} className={v.isOptimal ? 'bg-teal-50/70 font-medium' : ''}>
                            <td className="py-2 px-2.5 font-mono text-slate-900">V{v.id}</td>
                            <td className="py-2 px-2.5 font-mono tabular-nums text-slate-700">
                              ({fmtNum(v.x, 3)}, {fmtNum(v.y, 3)})
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-900">
                              {fmtNum(v.objectiveValue, 4)}
                            </td>
                            <td className="py-2 px-2.5">
                              {v.isOptimal ? (
                                <span className="text-teal-800 font-semibold">Optimal ({spec.objective.sense.toUpperCase()})</span>
                              ) : (
                                <span className="text-slate-400">Feasible</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step-by-Step Pedagogical Solution (Capability #2) */}
          {cornerAnalysis && cornerAnalysis.steps.length > 0 && (
            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <ListChecks className="w-4 h-4 text-teal-700" />
                Step-by-Step Mathematical Solution
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {cornerAnalysis.steps.map((s) => (
                  <div key={s.stepNumber} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="text-xs font-semibold text-slate-900">
                      Step {s.stepNumber}: {s.title}
                    </div>
                    <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {s.body}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explicit LHS = RHS Verification Table (Capability #4) */}
      {verificationRows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">LHS = RHS Substituted Verification</h3>
              <p className="text-xs text-slate-500">
                Evaluates every constraint using the exact solved decision vector x* to verify feasibility and binding equality.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">Constraint</th>
                  <th className="py-2.5 px-3">Substituted LHS Expression</th>
                  <th className="py-2.5 px-3 text-right">Evaluated LHS</th>
                  <th className="py-2.5 px-3 text-center">Rel</th>
                  <th className="py-2.5 px-3 text-right">RHS</th>
                  <th className="py-2.5 px-3 text-right">Slack / Surplus</th>
                  <th className="py-2.5 px-3">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verificationRows.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">{row.name}</td>
                    <td className="py-2 px-3 font-mono text-slate-600 max-w-sm truncate" title={row.expression}>
                      {row.expression}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {fmtNum(row.lhs, 4)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-700">{row.sense}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                      {fmtNum(row.rhs, 4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                      {fmtNum(row.slack, 4)}
                    </td>
                    <td className="py-2 px-3">
                      {row.verified ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {row.binding ? 'Verified (LHS = RHS)' : 'Verified'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-red-700">
                          <XCircle className="w-3.5 h-3.5" />
                          Violated
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
