import type { IndexedSetSpec, ModelConstraint, ModelSpec, ModelVariable } from './types.ts';

/**
 * Compiles compact indexed/set-based declarations (e.g. x[product, quarter])
 * into canonical flat variables & constraints ready for HiGHS.
 */
export function expandIndexedSpec(
  baseName: string,
  description: string,
  sense: 'max' | 'min',
  indexedSpec: IndexedSetSpec,
): ModelSpec {
  const variables: ModelVariable[] = [];
  const objectiveTerms: Record<string, number> = {};
  const constraints: ModelConstraint[] = [];

  const cartesian = (arrays: string[][]): string[][] => {
    if (arrays.length === 0) return [[]];
    return arrays.reduce<string[][]>(
      (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
      [[]],
    );
  };

  for (const iv of indexedSpec.indexedVariables) {
    const setArrays = iv.indexSets.map((sName) => indexedSpec.sets[sName] || []);
    const combos = cartesian(setArrays);
    for (const tuple of combos) {
      const key = tuple.join(',');
      const varName = `${iv.prefix}_${tuple.join('_')}`;
      variables.push({
        name: varName,
        lb: iv.lb,
        ub: iv.ub,
        type: iv.type,
        unit: iv.unit,
        group: iv.prefix,
        description: `${iv.prefix}[${key}]`,
      });
      if (iv.objParam && indexedSpec.parameters[iv.objParam]) {
        const paramTable = indexedSpec.parameters[iv.objParam];
        const coef = paramTable[key] ?? paramTable[tuple[0]] ?? 0;
        if (coef !== 0) {
          objectiveTerms[varName] = coef;
        }
      }
    }
  }

  for (const ic of indexedSpec.indexedConstraints) {
    const outerItems = indexedSpec.sets[ic.forEachSet] || [];
    const innerItems = indexedSpec.sets[ic.sumSet] || [];
    const coefTable = indexedSpec.parameters[ic.coefParam] || {};
    const rhsTable = indexedSpec.parameters[ic.rhsParam] || {};

    for (const outer of outerItems) {
      const terms: Record<string, number> = {};
      for (const inner of innerItems) {
        // Support either (inner, outer) or (outer, inner) indexing
        const vName1 = `${ic.varPrefix}_${inner}_${outer}`;
        const vName2 = `${ic.varPrefix}_${outer}_${inner}`;
        const varExists1 = variables.some((v) => v.name === vName1);
        const varName = varExists1 ? vName1 : vName2;
        const cKey1 = `${inner},${outer}`;
        const cKey2 = `${outer},${inner}`;
        const coef = coefTable[cKey1] ?? coefTable[cKey2] ?? coefTable[inner] ?? coefTable[outer] ?? 1;
        if (variables.some((v) => v.name === varName) && coef !== 0) {
          terms[varName] = coef;
        }
      }
      const rhs = rhsTable[outer] ?? ic.rhsFallback ?? 0;
      constraints.push({
        name: `${ic.namePrefix}_${outer}`,
        terms,
        sense: ic.sense,
        rhs,
        description: `Indexed ${ic.namePrefix} for ${outer}`,
      });
    }
  }

  return {
    name: baseName,
    description,
    domain: 'Supply Chain',
    variables,
    constraints,
    objective: {
      sense,
      terms: objectiveTerms,
    },
    indexedSpec,
  };
}
