import loadHighs from 'highs';
import type { Highs, ModelData, RangingResult } from 'highs';
import type {
  ConstraintResultDetail,
  IisConflictConstraint,
  IisConflictVariable,
  IisDiagnosis,
  MinimalRelaxationSuggestion,
  ModelSpec,
  MultipleOptimalInfo,
  NormalizedSolveResult,
  SolveStatus,
  SolverParams,
  UnboundedDiagnosis,
  VariableResultDetail,
} from '../src/shared/types.ts';
import { modelSpecToLpText, validateModelSpec } from '../src/shared/validator.ts';

export interface SolverAdapter {
  readonly id: string;
  readonly name: string;
  solve(spec: ModelSpec, params: SolverParams): Promise<NormalizedSolveResult>;
}

let highsInstancePromise: Promise<Highs> | null = null;

async function getHighs(): Promise<Highs> {
  if (!highsInstancePromise) {
    highsInstancePromise = loadHighs();
  }
  return highsInstancePromise;
}

function mapBasisStatus(code: number | undefined, highs: Highs): string | null {
  if (code === undefined) return null;
  const b = highs.constants.basisStatus;
  if (code === b.basic) return 'Basic';
  if (code === b.lower) return 'At Lower';
  if (code === b.upper) return 'At Upper';
  if (code === b.zero) return 'Free Zero';
  if (code === b.nonbasic) return 'Nonbasic';
  return 'Unknown';
}

function mapIisBoundStatus(code: number | undefined, highs: Highs): string {
  const iisC = highs.constants.iis;
  if (code === iisC.boundLower) return 'Lower Bound';
  if (code === iisC.boundUpper) return 'Upper Bound';
  if (code === iisC.boundBoxed) return 'Both Bounds';
  return 'Active Bound';
}

function cleanInf(v: number, infThreshold = 1e19): number | null {
  if (!Number.isFinite(v) || Math.abs(v) >= infThreshold) return null;
  return v;
}

function roundTiny(v: number, eps = 1e-10): number {
  return Math.abs(v) < eps ? 0 : v;
}

export class HighsSolverAdapter implements SolverAdapter {
  readonly id = 'highs-wasm';
  readonly name = 'HiGHS (WASM Industrial Engine)';

  async solve(spec: ModelSpec, params: SolverParams): Promise<NormalizedSolveResult> {
    const startMs = performance.now();
    const validation = validateModelSpec(spec);
    const lpText = modelSpecToLpText(spec);

    if (!validation.valid) {
      return {
        status: 'error',
        rawStatus: 'Validation Error',
        solverName: this.name,
        solverVersion: '1.14',
        problemClass: validation.problemClass,
        solveTimeMs: Math.round((performance.now() - startMs) * 100) / 100,
        iterations: 0,
        mipNodes: 0,
        mipGap: null,
        bestBound: null,
        objective: null,
        values: {},
        duals: {},
        reducedCosts: {},
        variableDetails: [],
        constraintDetails: [],
        validation,
        scalingApplied: false,
        iis: null,
        unboundedDiagnosis: null,
        lpText,
        errorMessage: validation.issues.find((i) => i.severity === 'error')?.message ?? 'Invalid model specification.',
      };
    }

    const highs = await getHighs();
    const solverVersion = highs.version.string;
    const inf = highs.infinity;

    const numCols = spec.variables.length;
    const numRows = spec.constraints.length;
    const colIndexMap = new Map<string, number>();
    spec.variables.forEach((v, i) => colIndexMap.set(v.name, i));

    const colCost = new Float64Array(numCols);
    const colLower = new Float64Array(numCols);
    const colUpper = new Float64Array(numCols);
    const integrality = new Int32Array(numCols);
    let hasInteger = false;

    for (let j = 0; j < numCols; j++) {
      const v = spec.variables[j];
      colCost[j] = spec.objective.terms[v.name] ?? 0;
      if (v.type === 'binary') {
        colLower[j] = Math.max(0, v.lb ?? 0);
        colUpper[j] = Math.min(1, v.ub ?? 1);
        integrality[j] = highs.constants.variableType.integer;
        hasInteger = true;
      } else if (v.type === 'integer') {
        colLower[j] = v.lb === null ? -inf : v.lb;
        colUpper[j] = v.ub === null ? inf : v.ub;
        integrality[j] = highs.constants.variableType.integer;
        hasInteger = true;
      } else {
        colLower[j] = v.lb === null ? -inf : v.lb;
        colUpper[j] = v.ub === null ? inf : v.ub;
        integrality[j] = highs.constants.variableType.continuous;
      }
    }

    const rowLower = new Float64Array(numRows);
    const rowUpper = new Float64Array(numRows);
    // Build CSC matrix column by column
    const colBuckets: Array<Array<{ row: number; val: number }>> = Array.from({ length: numCols }, () => []);

    for (let i = 0; i < numRows; i++) {
      const c = spec.constraints[i];
      rowLower[i] = c.sense === '>=' || c.sense === '==' ? c.rhs : -inf;
      rowUpper[i] = c.sense === '<=' || c.sense === '==' ? c.rhs : inf;
      for (const [vName, coef] of Object.entries(c.terms)) {
        if (coef === 0) continue;
        const colIdx = colIndexMap.get(vName);
        if (colIdx !== undefined) {
          colBuckets[colIdx].push({ row: i, val: coef });
        }
      }
    }

    const starts = new Int32Array(numCols + 1);
    const flatIndices: number[] = [];
    const flatValues: number[] = [];
    for (let j = 0; j < numCols; j++) {
      starts[j] = flatIndices.length;
      for (const entry of colBuckets[j]) {
        flatIndices.push(entry.row);
        flatValues.push(entry.val);
      }
    }
    starts[numCols] = flatIndices.length;

    // Build optional Hessian for Convex QP (0.5 * x^T Q x)
    const qTerms = spec.objective.quadraticTerms ?? [];
    let hessianInput: ModelData['hessian'] | undefined = undefined;
    if (qTerms.length > 0 && !hasInteger) {
      // Accumulate symmetric entries into lower triangle (row >= col)
      const qMap = new Map<string, number>();
      for (const qt of qTerms) {
        const i1 = colIndexMap.get(qt.var1);
        const i2 = colIndexMap.get(qt.var2);
        if (i1 === undefined || i2 === undefined || qt.coef === 0) continue;
        const row = Math.max(i1, i2);
        const col = Math.min(i1, i2);
        const key = `${col}:${row}`;
        qMap.set(key, (qMap.get(key) ?? 0) + qt.coef);
      }
      const qBuckets: Array<Array<{ row: number; val: number }>> = Array.from({ length: numCols }, () => []);
      for (const [key, val] of qMap.entries()) {
        if (val === 0) continue;
        const [colStr, rowStr] = key.split(':');
        qBuckets[Number(colStr)].push({ row: Number(rowStr), val });
      }
      const qStarts = new Int32Array(numCols + 1);
      const qIdx: number[] = [];
      const qVal: number[] = [];
      for (let j = 0; j < numCols; j++) {
        qBuckets[j].sort((a, b) => a.row - b.row);
        qStarts[j] = qIdx.length;
        for (const e of qBuckets[j]) {
          qIdx.push(e.row);
          qVal.push(e.val);
        }
      }
      qStarts[numCols] = qIdx.length;
      if (qIdx.length > 0) {
        hessianInput = {
          format: 'triangular',
          dimension: numCols,
          starts: qStarts,
          indices: new Int32Array(qIdx),
          values: new Float64Array(qVal),
        };
      }
    }

    const modelData: ModelData = {
      numCols,
      numRows,
      sense:
        spec.objective.sense === 'max'
          ? highs.constants.objectiveSense.maximize
          : highs.constants.objectiveSense.minimize,
      offset: spec.objective.offset ?? 0,
      colCost,
      colLower,
      colUpper,
      rowLower,
      rowUpper,
      matrix: {
        format: 'csc',
        numRows,
        numCols,
        starts,
        indices: new Int32Array(flatIndices),
        values: new Float64Array(flatValues),
      },
      ...(hasInteger ? { integrality } : {}),
      ...(hessianInput ? { hessian: hessianInput } : {}),
    };

    const model = highs.createModel();
    try {
      model.passModel(modelData);
      model.options.set({
        output_flag: false,
        log_to_console: false,
        presolve: params.presolve,
        time_limit: Math.max(0.1, params.timeLimitSec),
        mip_rel_gap: Math.max(0, params.mipRelGap),
        simplex_scale_strategy: params.autoScale ? 2 : 0,
        ...(hessianInput ? {} : hasInteger ? {} : { solver: 'simplex' }),
      });

      let runResult = model.run();
      const ms = highs.constants.modelStatus;

      // If presolve returns unboundedOrInfeasible, re-solve with presolve off to disambiguate cleanly
      if (runResult.modelStatus === ms.unboundedOrInfeasible) {
        model.clearSolver();
        model.options.set('presolve', 'off');
        runResult = model.run();
      }

      const finalCode = runResult.modelStatus;
      let status: SolveStatus = 'error';
      let rawStatus = 'Unknown';

      if (finalCode === ms.optimal) {
        status = 'optimal';
        rawStatus = 'Optimal';
      } else if (finalCode === ms.infeasible) {
        status = 'infeasible';
        rawStatus = 'Infeasible';
      } else if (finalCode === ms.unbounded) {
        status = 'unbounded';
        rawStatus = 'Unbounded';
      } else if (finalCode === ms.unboundedOrInfeasible) {
        status = 'infeasible';
        rawStatus = 'Infeasible or Unbounded';
      } else if (finalCode === ms.timeLimit || finalCode === ms.iterationLimit) {
        const primalStat = Number(model.info.get('primal_solution_status'));
        status = primalStat === highs.constants.solutionStatus.feasible ? 'feasible' : 'time_limit';
        rawStatus = finalCode === ms.timeLimit ? 'Time Limit Reached' : 'Iteration Limit Reached';
      } else if (finalCode === ms.objectiveBound || finalCode === ms.objectiveTarget || finalCode === ms.solutionLimit) {
        status = 'feasible';
        rawStatus = 'Feasible (Limit Reached)';
      }

      const primalStatus = Number(model.info.get('primal_solution_status'));
      const dualStatus = Number(model.info.get('dual_solution_status'));
      const hasPrimal = primalStatus === highs.constants.solutionStatus.feasible;
      const hasDual = !hasInteger && dualStatus === highs.constants.solutionStatus.feasible;

      let iterations = 0;
      let mipNodes = 0;
      let mipGap: number | null = null;
      let bestBound: number | null = null;

      try {
        iterations = Number(model.info.get('simplex_iteration_count') ?? 0);
      } catch {
        iterations = 0;
      }
      if (hasInteger) {
        try {
          mipNodes = Number(model.info.get('mip_node_count') ?? 0n);
          const rawGap = Number(model.info.get('mip_gap'));
          mipGap = Number.isFinite(rawGap) ? rawGap : null;
          const rawBound = Number(model.info.get('mip_dual_bound'));
          bestBound = Number.isFinite(rawBound) ? rawBound : null;
        } catch {
          // Ignore unavailable MIP info fields
        }
      }

      const values: Record<string, number> = {};
      const duals: Record<string, number> = {};
      const reducedCosts: Record<string, number> = {};
      const variableDetails: VariableResultDetail[] = [];
      const constraintDetails: ConstraintResultDetail[] = [];
      let objective: number | null = null;

      if ((status === 'optimal' || status === 'feasible') && hasPrimal) {
        objective = roundTiny(model.getObjectiveValue());
        const sol = model.getSolution();

        let basis: { colStatus: Int32Array; rowStatus: Int32Array } | null = null;
        if (!hasInteger && !hessianInput) {
          try {
            const validBasis = Number(model.info.get('basis_validity'));
            if (validBasis === highs.constants.basisValidity.valid) {
              basis = model.getBasis();
            }
          } catch {
            basis = null;
          }
        }

        let ranging: RangingResult | null = null;
        if (params.computeRanging && status === 'optimal' && !hasInteger && !hessianInput && basis) {
          try {
            ranging = model.getRanging();
          } catch {
            ranging = null;
          }
        }

        for (let j = 0; j < numCols; j++) {
          const v = spec.variables[j];
          const val = roundTiny(sol.colValue[j]);
          const rc = hasDual ? roundTiny(sol.colDual[j]) : null;
          values[v.name] = val;
          if (rc !== null) reducedCosts[v.name] = rc;

          const effLb = v.type === 'binary' ? 0 : v.lb;
          const effUb = v.type === 'binary' ? 1 : v.ub;
          let atBound: VariableResultDetail['atBound'] = 'interior';
          if (effLb !== null && effUb !== null && Math.abs(effLb - effUb) < 1e-8) {
            atBound = 'fixed';
          } else if (effLb !== null && Math.abs(val - effLb) < 1e-6) {
            atBound = 'lower';
          } else if (effUb !== null && Math.abs(val - effUb) < 1e-6) {
            atBound = 'upper';
          }

          variableDetails.push({
            name: v.name,
            type: v.type,
            unit: v.unit,
            group: v.group,
            value: val,
            lb: effLb,
            ub: effUb,
            objCoef: colCost[j],
            reducedCost: rc,
            basisStatus: basis ? mapBasisStatus(basis.colStatus[j], highs) : null,
            atBound,
            allowableObjMin: ranging ? cleanInf(ranging.colCostDown.value[j]) : null,
            allowableObjMax: ranging ? cleanInf(ranging.colCostUp.value[j]) : null,
          });
        }

        for (let i = 0; i < numRows; i++) {
          const c = spec.constraints[i];
          const activity = roundTiny(sol.rowValue[i]);
          let slack = 0;
          if (c.sense === '<=') {
            slack = roundTiny(c.rhs - activity);
          } else if (c.sense === '>=') {
            slack = roundTiny(activity - c.rhs);
          } else {
            slack = roundTiny(Math.abs(c.rhs - activity));
          }
          const binding = Math.abs(slack) < 1e-5;
          const sp = hasDual ? roundTiny(sol.rowDual[i]) : null;
          if (sp !== null) duals[c.name] = sp;

          let utilizationPct: number | null = null;
          if (Math.abs(c.rhs) > 1e-9) {
            utilizationPct = Math.round((activity / c.rhs) * 1000) / 10;
          }

          constraintDetails.push({
            name: c.name,
            description: c.description,
            sense: c.sense,
            rhs: c.rhs,
            activity,
            slack,
            utilizationPct,
            shadowPrice: sp,
            binding,
            basisStatus: basis ? mapBasisStatus(basis.rowStatus[i], highs) : null,
            allowableRhsMin: ranging ? cleanInf(ranging.rowBoundDown.value[i]) : null,
            allowableRhsMax: ranging ? cleanInf(ranging.rowBoundUp.value[i]) : null,
          });
        }
      }

      // Infeasibility Diagnosis (IIS + Minimal Feasibility Relaxation)
      let iis: IisDiagnosis | null = null;
      if (status === 'infeasible' && params.computeIis) {
        iis = this.diagnoseInfeasibility(model, highs, spec, colLower, colUpper, rowLower, rowUpper);
      }

      // Unbounded Diagnosis (Primal Ray)
      let unboundedDiagnosis: UnboundedDiagnosis | null = null;
      if (status === 'unbounded') {
        unboundedDiagnosis = this.diagnoseUnboundedness(model, spec);
      }

      // Multiple Optimal Solutions Detection (#5): nonbasic structural variable with RC=0 OR nonbasic inequality slack with ShadowPrice=0
      let multipleOptimal: MultipleOptimalInfo | null = null;
      if (status === 'optimal' && !hasInteger && !hessianInput && variableDetails.length > 0) {
        const zeroRcVars = variableDetails
          .filter((v) => {
            const nonFixed = v.lb === null || v.ub === null || Math.abs(v.ub - v.lb) > 1e-7;
            const isNonbasic = v.basisStatus === 'At Lower' || v.basisStatus === 'At Upper' || v.basisStatus === 'Nonbasic';
            return nonFixed && isNonbasic && v.reducedCost !== null && Math.abs(v.reducedCost) < 1e-6;
          })
          .map((v) => v.name);

        const zeroDualSlacks = constraintDetails
          .filter((c) => {
            const isInequality = c.sense !== '==';
            const isNonbasic = c.basisStatus === 'At Lower' || c.basisStatus === 'At Upper' || c.basisStatus === 'Nonbasic';
            return isInequality && isNonbasic && c.shadowPrice !== null && Math.abs(c.shadowPrice) < 1e-6;
          })
          .map((c) => `slack(${c.name})`);

        const combined = [...zeroRcVars, ...zeroDualSlacks];
        if (combined.length > 0) {
          multipleOptimal = {
            detected: true,
            zeroReducedCostVars: combined,
            note: `Alternative optimal solutions / flat objective edge detected via zero reduced-cost nonbasic pivot(s): [${combined.join(', ')}].`,
          };
        }
      }

      const solveTimeMs = Math.round((performance.now() - startMs) * 100) / 100;

      return {
        status,
        rawStatus,
        solverName: this.name,
        solverVersion,
        problemClass: validation.problemClass,
        solveTimeMs,
        iterations,
        mipNodes,
        mipGap,
        bestBound,
        objective,
        values,
        duals,
        reducedCosts,
        variableDetails,
        constraintDetails,
        validation,
        scalingApplied: params.autoScale,
        iis,
        unboundedDiagnosis,
        multipleOptimal,
        lpText,
      };
    } finally {
      model.dispose();
    }
  }

  private diagnoseInfeasibility(
    model: ReturnType<Highs['createModel']>,
    highs: Highs,
    spec: ModelSpec,
    colLower: Float64Array,
    colUpper: Float64Array,
    rowLower: Float64Array,
    rowUpper: Float64Array,
  ): IisDiagnosis {
    const conflictingConstraints: IisConflictConstraint[] = [];
    const conflictingVariables: IisConflictVariable[] = [];
    const minimalRelaxations: MinimalRelaxationSuggestion[] = [];

    try {
      model.options.set('iis_strategy', highs.constants.iis.strategyRowPriority);
      const iisRes = model.getIis();
      for (let k = 0; k < iisRes.rowIndex.length; k++) {
        const rIdx = iisRes.rowIndex[k];
        const c = spec.constraints[rIdx];
        if (c && iisRes.rowBound[k] !== highs.constants.iis.boundFree) {
          conflictingConstraints.push({
            name: c.name,
            sense: c.sense,
            rhs: c.rhs,
            terms: c.terms,
            boundStatus: mapIisBoundStatus(iisRes.rowBound[k], highs),
          });
        }
      }
      for (let k = 0; k < iisRes.colIndex.length; k++) {
        const cIdx = iisRes.colIndex[k];
        const v = spec.variables[cIdx];
        if (v && iisRes.colBound[k] !== highs.constants.iis.boundFree) {
          conflictingVariables.push({
            name: v.name,
            lb: v.lb,
            ub: v.ub,
            type: v.type,
            boundStatus: mapIisBoundStatus(iisRes.colBound[k], highs),
          });
        }
      }
    } catch {
      // Fall back cleanly if native IIS throws on specific MIP formulations
    }

    try {
      model.feasibilityRelaxation({
        globalLowerPenalty: 1.0,
        globalUpperPenalty: 1.0,
        globalRowPenalty: 1.0,
      });
      const relSol = model.getSolution();
      for (let i = 0; i < spec.constraints.length; i++) {
        const c = spec.constraints[i];
        const act = relSol.rowValue[i];
        if (c.sense === '<=' || c.sense === '==') {
          const excess = act - rowUpper[i];
          if (excess > 1e-5) {
            minimalRelaxations.push({
              target: c.name,
              targetType: 'constraint',
              originalBound: `<= ${c.rhs}`,
              suggestedBound: `<= ${Math.round((c.rhs + excess) * 10000) / 10000}`,
              violationAmount: Math.round(excess * 10000) / 10000,
            });
          }
        }
        if (c.sense === '>=' || c.sense === '==') {
          const deficit = rowLower[i] - act;
          if (deficit > 1e-5) {
            minimalRelaxations.push({
              target: c.name,
              targetType: 'constraint',
              originalBound: `>= ${c.rhs}`,
              suggestedBound: `>= ${Math.round((c.rhs - deficit) * 10000) / 10000}`,
              violationAmount: Math.round(deficit * 10000) / 10000,
            });
          }
        }
      }

      for (let j = 0; j < spec.variables.length; j++) {
        const v = spec.variables[j];
        const val = relSol.colValue[j];
        if (colLower[j] > -highs.infinity / 2 && colLower[j] - val > 1e-5) {
          const diff = colLower[j] - val;
          minimalRelaxations.push({
            target: v.name,
            targetType: 'variable_lb',
            originalBound: `>= ${colLower[j]}`,
            suggestedBound: `>= ${Math.round((colLower[j] - diff) * 10000) / 10000}`,
            violationAmount: Math.round(diff * 10000) / 10000,
          });
        }
        if (colUpper[j] < highs.infinity / 2 && val - colUpper[j] > 1e-5) {
          const diff = val - colUpper[j];
          minimalRelaxations.push({
            target: v.name,
            targetType: 'variable_ub',
            originalBound: `<= ${colUpper[j]}`,
            suggestedBound: `<= ${Math.round((colUpper[j] + diff) * 10000) / 10000}`,
            violationAmount: Math.round(diff * 10000) / 10000,
          });
        }
      }
    } catch {
      // Relaxation unavailable
    }

    const found = conflictingConstraints.length > 0 || conflictingVariables.length > 0 || minimalRelaxations.length > 0;
    const summary =
      conflictingConstraints.length > 0
        ? `Identified an Irreducible Infeasible Subsystem (IIS) across ${conflictingConstraints.length} constraint(s) and ${conflictingVariables.length} variable bound(s) that cannot be satisfied simultaneously.`
        : minimalRelaxations.length > 0
          ? `Model is infeasible; minimum-slack feasibility relaxation identified ${minimalRelaxations.length} bound adjustment(s) to restore feasibility.`
          : 'Model proved infeasible. Check contradictory constraints or integer rounding thresholds.';

    return {
      found,
      summary,
      conflictingConstraints,
      conflictingVariables,
      minimalRelaxations,
    };
  }

  private diagnoseUnboundedness(
    model: ReturnType<Highs['createModel']>,
    spec: ModelSpec,
  ): UnboundedDiagnosis {
    const variablesInRay: Array<{ name: string; rayDirection: number }> = [];
    try {
      const ray = model.getPrimalRay();
      if (ray && ray.values) {
        for (let j = 0; j < spec.variables.length; j++) {
          const dir = ray.values[j];
          if (Math.abs(dir) > 1e-7) {
            variablesInRay.push({
              name: spec.variables[j].name,
              rayDirection: Math.round(dir * 10000) / 10000,
            });
          }
        }
      }
    } catch {
      // Ignore if ray unavailable
    }

    const unboundedVars = spec.variables
      .filter((v) => v.type !== 'binary' && (v.ub === null || v.lb === null))
      .map((v) => v.name);

    const summary =
      variablesInRay.length > 0
        ? `Objective can improve infinitely along primal ray involving: ${variablesInRay.map((r) => `${r.name} (${r.rayDirection > 0 ? '+' : ''}${r.rayDirection})`).join(', ')}.`
        : `Model is unbounded. Uncapped decision variables (${unboundedVars.join(', ') || 'check constraints'}) lack upper/lower bounds preventing infinite objective growth.`;

    return { summary, variablesInRay };
  }
}

export const defaultSolverAdapter: SolverAdapter = new HighsSolverAdapter();
