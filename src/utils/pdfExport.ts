import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { analyze2DCornerPoints } from '../shared/cornerPointEngine.ts';
import type { ModelSpec, NormalizedSolveResult } from '../shared/types.ts';
import { fmtBound, fmtNum } from './format.ts';

export function exportSolveResultPdf(
  spec: ModelSpec,
  result: NormalizedSolveResult,
  versionNumber?: number,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Systonic Linear Desc — Mathematical Optimization Report', 36, 28);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${spec.name}${versionNumber ? ` (v${versionNumber})` : ''}  |  Class: ${result.problemClass}  |  Solver: ${result.solverName} ${result.solverVersion}`,
    36,
    46,
  );

  // Summary Block
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Executive Solve Summary', 36, 90);

  autoTable(doc, {
    startY: 98,
    margin: { left: 36, right: 36 },
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    head: [['Status', 'Objective Sense', 'Optimal Z*', 'Solve Time', 'Iterations / Nodes', 'Multiple Optima']],
    body: [
      [
        result.rawStatus,
        spec.objective.sense.toUpperCase(),
        result.objective !== null ? fmtNum(result.objective, 6) : 'N/A',
        `${fmtNum(result.solveTimeMs, 2)} ms`,
        `${result.iterations} / ${result.mipNodes}`,
        result.multipleOptimal?.detected ? `Yes (${result.multipleOptimal.zeroReducedCostVars.join(', ')})` : 'No',
      ],
    ],
  });

  // Decision Variables Table
  const yAfterSummary = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Optimal Decision Variables & Bounds', 36, yAfterSummary + 22);

  autoTable(doc, {
    startY: yAfterSummary + 30,
    margin: { left: 36, right: 36 },
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    head: [['Variable', 'Type', 'Optimal Value', 'Bounds [LB, UB]', 'Obj Coef', 'Reduced Cost', 'Allowable Obj Range']],
    body: result.variableDetails.map((v) => [
      v.name,
      v.type,
      fmtNum(v.value, 5),
      `[${fmtBound(v.lb, '-inf')}, ${fmtBound(v.ub, '+inf')}]`,
      fmtNum(v.objCoef, 4),
      v.reducedCost !== null ? fmtNum(v.reducedCost, 4) : '—',
      v.allowableObjMin !== null || v.allowableObjMax !== null
        ? `[${fmtBound(v.allowableObjMin, '-inf')}, ${fmtBound(v.allowableObjMax, '+inf')}]`
        : '—',
    ]),
  });

  // LHS = RHS Verification Table
  const yAfterVars = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Constraint LHS = RHS Verification & Sensitivity', 36, yAfterVars + 22);

  autoTable(doc, {
    startY: yAfterVars + 30,
    margin: { left: 36, right: 36 },
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    head: [['Constraint', 'LHS Activity', 'Sense', 'RHS Limit', 'Slack', 'Verified', 'Shadow Price']],
    body: result.constraintDetails.map((c) => {
      const ok =
        c.sense === '<='
          ? c.activity <= c.rhs + 1e-5
          : c.sense === '>='
            ? c.activity >= c.rhs - 1e-5
            : Math.abs(c.activity - c.rhs) <= 1e-5;
      return [
        c.name,
        fmtNum(c.activity, 5),
        c.sense,
        fmtNum(c.rhs, 5),
        fmtNum(c.slack, 5),
        ok ? (c.binding ? 'PASS (Binding)' : 'PASS') : 'VIOLATED',
        c.shadowPrice !== null ? fmtNum(c.shadowPrice, 4) : '—',
      ];
    }),
  });

  // Optional 2D Corner Point Method Appendix
  if (spec.variables.length >= 2) {
    const vX = spec.variables[0].name;
    const vY = spec.variables[1].name;
    const fixed: Record<string, number> = {};
    for (const v of spec.variables.slice(2)) fixed[v.name] = result.values[v.name] ?? 0;
    const corner = analyze2DCornerPoints(spec, vX, vY, fixed);

    if (corner.feasibleVertices.length > 0) {
      const yAfterCons = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 450;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`4. Corner Point Evaluation (${vX}, ${vY} slice · ${corner.regionStatus.toUpperCase()})`, 36, yAfterCons + 22);

      autoTable(doc, {
        startY: yAfterCons + 30,
        margin: { left: 36, right: 36 },
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5 },
        head: [['Vertex', vX, vY, 'Objective Z', 'Defining Boundary Lines', 'Optimal']],
        body: corner.feasibleVertices.map((v) => [
          `V${v.id}`,
          fmtNum(v.x, 4),
          fmtNum(v.y, 4),
          fmtNum(v.objectiveValue, 4),
          v.definingLines.join(' ∩ '),
          v.isOptimal ? 'OPTIMAL' : '',
        ]),
      });
    }
  }

  const safeFile = spec.name.replace(/[^A-Za-z0-9_-]/g, '_');
  doc.save(`${safeFile}${versionNumber ? `_v${versionNumber}` : ''}_optimization_report.pdf`);
}
