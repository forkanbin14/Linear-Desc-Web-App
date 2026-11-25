import type {
  AssignmentInput,
  AssignmentResult,
  ModelConstraint,
  ModelSpec,
  ModelVariable,
  TransportationInput,
  TransportationResult,
} from '../src/shared/types.ts';
import { defaultSolverAdapter } from './solverAdapter.ts';
import { DEFAULT_SOLVER_PARAMS } from './store.ts';

function computePenalty(vals: number[]): number {
  if (vals.length === 0) return -1;
  if (vals.length === 1) return vals[0];
  let min1 = Infinity;
  let min2 = Infinity;
  for (const v of vals) {
    if (v < min1) {
      min2 = min1;
      min1 = v;
    } else if (v < min2) {
      min2 = v;
    }
  }
  return min2 - min1;
}

/**
 * LP-12 Part A: Transportation Problem Engine
 * Balances supply & demand automatically (adding Dummy Source/Destination if needed),
 * computes Vogel's Approximation Method (VAM) initial basic feasible solution with step trace,
 * and solves the exact minimum-cost dispatch using HiGHS LP SolverAdapter + dual potentials (u_i, v_j).
 */
export async function solveTransportationProblem(input: TransportationInput): Promise<TransportationResult> {
  const start = performance.now();
  const sources = [...input.sources];
  const destinations = [...input.destinations];
  const supply = input.supply.map((n) => Math.max(0, Number(n) || 0));
  const demand = input.demand.map((n) => Math.max(0, Number(n) || 0));
  const costs = input.costs.map((row) => row.map((c) => Number(c) || 0));

  const mOrig = sources.length;
  const nOrig = destinations.length;
  if (mOrig === 0 || nOrig === 0) {
    throw new Error('Transportation model requires at least 1 source and 1 destination.');
  }

  const totalSupply = supply.reduce((a, b) => a + b, 0);
  const totalDemand = demand.reduce((a, b) => a + b, 0);
  const eps = 1e-6;

  let balanced = true;
  let balanceNote = `Balanced Transportation Network (Total Supply = Total Demand = ${totalSupply}).`;

  const effSources = [...sources];
  const effDests = [...destinations];
  const effSupply = [...supply];
  const effDemand = [...demand];
  const effCosts = costs.map((r) => [...r]);

  if (totalSupply - totalDemand > eps) {
    balanced = false;
    const diff = Math.round((totalSupply - totalDemand) * 1e6) / 1e6;
    balanceNote = `Supply exceeds Demand by ${diff}. Added Dummy Destination column with 0 unit cost.`;
    effDests.push('Dummy Destination');
    effDemand.push(diff);
    for (let i = 0; i < effCosts.length; i++) effCosts[i].push(0);
  } else if (totalDemand - totalSupply > eps) {
    balanced = false;
    const diff = Math.round((totalDemand - totalSupply) * 1e6) / 1e6;
    balanceNote = `Demand exceeds Supply by ${diff}. Added Dummy Source row with 0 unit cost.`;
    effSources.push('Dummy Source');
    effSupply.push(diff);
    effCosts.push(new Array(effDests.length).fill(0));
  }

  const M = effSources.length;
  const N = effDests.length;

  // Step 1: Vogel's Approximation Method (VAM)
  const vamAlloc = Array.from({ length: M }, () => new Array(N).fill(0));
  const remS = [...effSupply];
  const remD = [...effDemand];
  const rowActive = new Array(M).fill(true);
  const colActive = new Array(N).fill(true);
  const vamSteps: TransportationResult['vamSteps'] = [];

  let guard = M * N + 5;
  let stepNum = 1;
  while (guard-- > 0 && rowActive.some(Boolean) && colActive.some(Boolean)) {
    const rowPenalties: Array<number | null> = rowActive.map((act, i) => {
      if (!act) return null;
      const activeCosts: number[] = [];
      for (let j = 0; j < N; j++) if (colActive[j]) activeCosts.push(effCosts[i][j]);
      return computePenalty(activeCosts);
    });
    const colPenalties: Array<number | null> = colActive.map((act, j) => {
      if (!act) return null;
      const activeCosts: number[] = [];
      for (let i = 0; i < M; i++) if (rowActive[i]) activeCosts.push(effCosts[i][j]);
      return computePenalty(activeCosts);
    });

    let bestType: 'row' | 'col' = 'row';
    let bestIdx = -1;
    let bestPen = -1;

    rowPenalties.forEach((p, i) => {
      if (p !== null && p > bestPen) {
        bestPen = p;
        bestType = 'row';
        bestIdx = i;
      }
    });
    colPenalties.forEach((p, j) => {
      if (p !== null && p > bestPen) {
        bestPen = p;
        bestType = 'col';
        bestIdx = j;
      }
    });

    if (bestIdx === -1) break;

    let pickI = -1;
    let pickJ = -1;
    let minCost = Infinity;

    if (bestType === 'row') {
      pickI = bestIdx;
      for (let j = 0; j < N; j++) {
        if (colActive[j] && effCosts[pickI][j] < minCost) {
          minCost = effCosts[pickI][j];
          pickJ = j;
        }
      }
    } else {
      pickJ = bestIdx;
      for (let i = 0; i < M; i++) {
        if (rowActive[i] && effCosts[i][pickJ] < minCost) {
          minCost = effCosts[i][pickJ];
          pickI = i;
        }
      }
    }

    if (pickI === -1 || pickJ === -1) break;
    const qty = Math.min(remS[pickI], remD[pickJ]);
    vamAlloc[pickI][pickJ] = Math.round(qty * 1e6) / 1e6;
    remS[pickI] -= qty;
    remD[pickJ] -= qty;

    const noteParts: string[] = [];
    if (remS[pickI] <= eps && rowActive.filter(Boolean).length >= 1) {
      if (remD[pickJ] > eps || rowActive.filter(Boolean).length > 1 || colActive.filter(Boolean).length === 1) {
        rowActive[pickI] = false;
        noteParts.push(`Exhausted ${effSources[pickI]}`);
      }
    }
    if (remD[pickJ] <= eps && (rowActive[pickI] || colActive.filter(Boolean).length >= 1)) {
      if (rowActive[pickI] || colActive.filter(Boolean).length === 1) {
        colActive[pickJ] = false;
        noteParts.push(`Satisfied ${effDests[pickJ]}`);
      }
    }
    if (rowActive[pickI] && remS[pickI] <= eps) {
      rowActive[pickI] = false;
    }

    vamSteps.push({
      step: stepNum++,
      allocation: `${effSources[pickI]} → ${effDests[pickJ]} : ${vamAlloc[pickI][pickJ]} units @ ${effCosts[pickI][pickJ]}`,
      rowPenalties,
      colPenalties,
      note: noteParts.join(' & ') || `Max penalty (${bestPen}) on ${bestType === 'row' ? effSources[bestIdx] : effDests[bestIdx]}`,
    });
  }

  let vamTotalCost = 0;
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      vamTotalCost += vamAlloc[i][j] * effCosts[i][j];
    }
  }
  vamTotalCost = Math.round(vamTotalCost * 1e4) / 1e4;

  // Step 2: Solve Exact LP Optimum via HiGHS SolverAdapter
  const variables: ModelVariable[] = [];
  const objTerms: Record<string, number> = {};
  const constraints: ModelConstraint[] = [];

  for (let i = 0; i < M; i++) {
    const supplyTerms: Record<string, number> = {};
    for (let j = 0; j < N; j++) {
      const vName = `x_${i}_${j}`;
      variables.push({
        name: vName,
        lb: 0,
        ub: null,
        type: 'continuous',
        unit: 'units',
      });
      objTerms[vName] = effCosts[i][j];
      supplyTerms[vName] = 1;
    }
    constraints.push({
      name: `supply_${i}`,
      terms: supplyTerms,
      sense: '==',
      rhs: effSupply[i],
    });
  }

  for (let j = 0; j < N; j++) {
    const demandTerms: Record<string, number> = {};
    for (let i = 0; i < M; i++) {
      demandTerms[`x_${i}_${j}`] = 1;
    }
    constraints.push({
      name: `demand_${j}`,
      terms: demandTerms,
      sense: '==',
      rhs: effDemand[j],
    });
  }

  const lpSpec: ModelSpec = {
    name: input.name || 'Transportation LP',
    domain: 'Supply Chain',
    variables,
    constraints,
    objective: { sense: 'min', terms: objTerms },
  };

  const solveRes = await defaultSolverAdapter.solve(lpSpec, {
    ...DEFAULT_SOLVER_PARAMS,
    computeRanging: false,
    computeIis: false,
  });

  const optAlloc = Array.from({ length: M }, () => new Array(N).fill(0));
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      const val = solveRes.values[`x_${i}_${j}`] ?? 0;
      optAlloc[i][j] = Math.round(val * 1e6) / 1e6;
    }
  }

  const uPotentials = Array.from({ length: M }, (_, i) => Math.round((solveRes.duals[`supply_${i}`] ?? 0) * 1e4) / 1e4);
  const vPotentials = Array.from({ length: N }, (_, j) => Math.round((solveRes.duals[`demand_${j}`] ?? 0) * 1e4) / 1e4);
  const optimalTotalCost = Math.round((solveRes.objective ?? vamTotalCost) * 1e4) / 1e4;
  const costSavingsVsVam = Math.round((vamTotalCost - optimalTotalCost) * 1e4) / 1e4;

  return {
    balanced,
    balanceNote,
    effectiveSources: effSources,
    effectiveDestinations: effDests,
    effectiveSupply: effSupply,
    effectiveDemand: effDemand,
    effectiveCosts: effCosts,
    vamAllocations: vamAlloc,
    vamTotalCost,
    vamSteps,
    optimalAllocations: optAlloc,
    optimalTotalCost,
    costSavingsVsVam,
    uPotentials,
    vPotentials,
    solveTimeMs: Math.round((performance.now() - start) * 100) / 100,
    status: solveRes.rawStatus,
  };
}

/**
 * LP-12 Part B: Exact Kuhn-Munkres Hungarian Assignment Algorithm (O(n^3))
 * Supports Min Cost & Max Profit, plus automatic square padding for unbalanced matrices.
 */
export function solveHungarianAssignment(input: AssignmentInput): AssignmentResult {
  const m = input.agents.length;
  const n = input.tasks.length;
  if (m === 0 || n === 0) {
    throw new Error('Assignment problem requires at least 1 agent and 1 task.');
  }

  const dim = Math.max(m, n);
  const padded = m !== n;
  const effectiveAgents = [...input.agents];
  const effectiveTasks = [...input.tasks];
  while (effectiveAgents.length < dim) effectiveAgents.push(`Dummy Agent ${effectiveAgents.length + 1 - m}`);
  while (effectiveTasks.length < dim) effectiveTasks.push(`Dummy Task ${effectiveTasks.length + 1 - n}`);

  // Build padded raw matrix
  const origMatrix: number[][] = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (__, j) => (i < m && j < n ? Number(input.matrix[i]?.[j]) || 0 : 0)),
  );

  const steps: string[] = [];
  if (padded) {
    steps.push(`Padded rectangular ${m}×${n} matrix to square ${dim}×${dim} with 0-cost dummy entries.`);
  }

  // Convert max problem into min opportunity-loss matrix
  let workMatrix = origMatrix.map((r) => [...r]);
  if (input.sense === 'max') {
    let maxEntry = -Infinity;
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        if (origMatrix[i][j] > maxEntry) maxEntry = origMatrix[i][j];
      }
    }
    workMatrix = origMatrix.map((row) => row.map((v) => maxEntry - v));
    steps.push(`Maximization conversion: subtracted all entries from max value (${maxEntry}).`);
  }

  // Step 1: Row Reduction
  const step1RowReduced = workMatrix.map((row) => {
    const rMin = Math.min(...row);
    return row.map((v) => Math.round((v - rMin) * 1e6) / 1e6);
  });
  steps.push('Step 1 (Row Reduction): Subtracted minimum element of each row from that row.');

  // Step 2: Column Reduction
  const step2ColReduced = step1RowReduced.map((r) => [...r]);
  for (let j = 0; j < dim; j++) {
    let cMin = Infinity;
    for (let i = 0; i < dim; i++) {
      if (step2ColReduced[i][j] < cMin) cMin = step2ColReduced[i][j];
    }
    for (let i = 0; i < dim; i++) {
      step2ColReduced[i][j] = Math.round((step2ColReduced[i][j] - cMin) * 1e6) / 1e6;
    }
  }
  steps.push('Step 2 (Column Reduction): Subtracted minimum element of each column from that column.');

  // Step 3: Exact O(n^3) Hungarian Potential / Augmenting Path Solver (1-indexed internals)
  const u = new Array(dim + 1).fill(0);
  const v = new Array(dim + 1).fill(0);
  const p = new Array(dim + 1).fill(0);
  const way = new Array(dim + 1).fill(0);

  for (let i = 1; i <= dim; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(dim + 1).fill(Infinity);
    const used = new Array(dim + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= dim; j++) {
        if (!used[j]) {
          const cur = step2ColReduced[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= dim; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  // Extract matching: p[j] = row assigned to column j
  const rowToCol = new Array(dim).fill(-1);
  for (let j = 1; j <= dim; j++) {
    if (p[j] >= 1 && p[j] <= dim) {
      rowToCol[p[j] - 1] = j - 1;
    }
  }

  const assignments: AssignmentResult['assignments'] = [];
  let totalCost = 0;
  for (let i = 0; i < dim; i++) {
    const j = rowToCol[i];
    const isDummy = i >= m || j >= n;
    const cost = origMatrix[i][j];
    if (!isDummy) totalCost += cost;
    assignments.push({
      agent: effectiveAgents[i],
      task: effectiveTasks[j],
      row: i,
      col: j,
      cost,
      isDummy,
    });
  }

  totalCost = Math.round(totalCost * 1e4) / 1e4;
  steps.push(
    `Step 3 (Optimal Independent Zero Cover): Found optimal 1-to-1 matching yielding total ${input.sense === 'max' ? 'profit/score' : 'cost'} = ${totalCost}.`,
  );

  return {
    sense: input.sense,
    padded,
    effectiveAgents,
    effectiveTasks,
    originalMatrix: origMatrix,
    step1RowReduced,
    step2ColReduced,
    assignments,
    totalCost,
    steps,
  };
}
