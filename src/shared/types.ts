export type VariableType = 'continuous' | 'integer' | 'binary';
export type ConstraintSense = '<=' | '>=' | '==';
export type ObjectiveSense = 'max' | 'min';
export type ProblemClass = 'LP' | 'MIP' | 'QP' | 'MIQP';
export type UserRole = 'analyst' | 'modeler' | 'admin';

export interface ModelVariable {
  name: string;
  lb: number | null;
  ub: number | null;
  type: VariableType;
  unit?: string;
  group?: string;
  description?: string;
}

export interface ModelConstraint {
  name: string;
  terms: Record<string, number>;
  sense: ConstraintSense;
  rhs: number;
  description?: string;
}

export interface QuadraticTerm {
  var1: string;
  var2: string;
  /** Coefficient in 0.5 * x^T Q x + c^T x. For diagonal x_i^2, coef is Q_ii (so 0.5 * Q_ii * x_i^2). */
  coef: number;
}

export interface ModelObjective {
  sense: ObjectiveSense;
  terms: Record<string, number>;
  offset?: number;
  quadraticTerms?: QuadraticTerm[];
}

export interface IndexedSetSpec {
  sets: Record<string, string[]>;
  parameters: Record<string, Record<string, number>>;
  indexedVariables: Array<{
    prefix: string;
    indexSets: string[];
    lb: number | null;
    ub: number | null;
    type: VariableType;
    unit?: string;
    objParam?: string;
  }>;
  indexedConstraints: Array<{
    namePrefix: string;
    forEachSet: string;
    sumSet: string;
    varPrefix: string;
    coefParam: string;
    sense: ConstraintSense;
    rhsParam: string;
    rhsFallback?: number;
  }>;
}

export interface ModelSpec {
  name: string;
  description?: string;
  domain?: 'Finance' | 'Supply Chain' | 'Operations' | 'Portfolio' | 'Risk & Credit' | 'Custom';
  currency?: 'BDT' | 'USD';
  variables: ModelVariable[];
  constraints: ModelConstraint[];
  objective: ModelObjective;
  indexedSpec?: IndexedSetSpec;
}

export interface SolverParams {
  solverId: 'highs-wasm' | 'gurobi-byol' | 'cplex-byol';
  timeLimitSec: number;
  mipRelGap: number;
  presolve: 'on' | 'off' | 'choose';
  autoScale: boolean;
  computeRanging: boolean;
  computeIis: boolean;
}

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  target?: string;
}

export interface ValidationReport {
  valid: boolean;
  problemClass: ProblemClass;
  numVars: number;
  numContinuous: number;
  numInteger: number;
  numBinary: number;
  numConstraints: number;
  numNonzeros: number;
  numQuadraticTerms: number;
  minNonzeroCoef: number | null;
  maxAbsCoef: number | null;
  dynamicRange: number | null;
  issues: ValidationIssue[];
}

export interface VariableResultDetail {
  name: string;
  type: VariableType;
  unit?: string;
  group?: string;
  value: number;
  lb: number | null;
  ub: number | null;
  objCoef: number;
  reducedCost: number | null;
  basisStatus: string | null;
  atBound: 'lower' | 'upper' | 'fixed' | 'interior' | 'n/a';
  allowableObjMin: number | null;
  allowableObjMax: number | null;
}

export interface ConstraintResultDetail {
  name: string;
  description?: string;
  sense: ConstraintSense;
  rhs: number;
  activity: number;
  slack: number;
  utilizationPct: number | null;
  shadowPrice: number | null;
  binding: boolean;
  basisStatus: string | null;
  allowableRhsMin: number | null;
  allowableRhsMax: number | null;
}

export interface IisConflictConstraint {
  name: string;
  sense: ConstraintSense;
  rhs: number;
  terms: Record<string, number>;
  boundStatus: string;
}

export interface IisConflictVariable {
  name: string;
  lb: number | null;
  ub: number | null;
  type: VariableType;
  boundStatus: string;
}

export interface MinimalRelaxationSuggestion {
  target: string;
  targetType: 'constraint' | 'variable_lb' | 'variable_ub';
  originalBound: string;
  suggestedBound: string;
  violationAmount: number;
}

export interface IisDiagnosis {
  found: boolean;
  summary: string;
  conflictingConstraints: IisConflictConstraint[];
  conflictingVariables: IisConflictVariable[];
  minimalRelaxations: MinimalRelaxationSuggestion[];
}

export interface UnboundedDiagnosis {
  summary: string;
  variablesInRay: Array<{ name: string; rayDirection: number }>;
}

export type SolveStatus =
  | 'optimal'
  | 'feasible'
  | 'infeasible'
  | 'unbounded'
  | 'time_limit'
  | 'error';

export interface MultipleOptimalInfo {
  detected: boolean;
  zeroReducedCostVars: string[];
  note: string;
}

export interface TransportationInput {
  name?: string;
  sources: string[];
  destinations: string[];
  supply: number[];
  demand: number[];
  costs: number[][];
}

export interface TransportationResult {
  balanced: boolean;
  balanceNote: string;
  effectiveSources: string[];
  effectiveDestinations: string[];
  effectiveSupply: number[];
  effectiveDemand: number[];
  effectiveCosts: number[][];
  vamAllocations: number[][];
  vamTotalCost: number;
  vamSteps: Array<{ step: number; allocation: string; rowPenalties: Array<number | null>; colPenalties: Array<number | null>; note: string }>;
  optimalAllocations: number[][];
  optimalTotalCost: number;
  costSavingsVsVam: number;
  uPotentials: number[];
  vPotentials: number[];
  solveTimeMs: number;
  status: string;
}

export interface AssignmentInput {
  name?: string;
  agents: string[];
  tasks: string[];
  matrix: number[][];
  sense: 'min' | 'max';
}

export interface AssignmentResult {
  sense: 'min' | 'max';
  padded: boolean;
  effectiveAgents: string[];
  effectiveTasks: string[];
  originalMatrix: number[][];
  step1RowReduced: number[][];
  step2ColReduced: number[][];
  assignments: Array<{ agent: string; task: string; row: number; col: number; cost: number; isDummy: boolean }>;
  totalCost: number;
  steps: string[];
}

export interface BatchSolveItemResult {
  index: number;
  name: string;
  status: SolveStatus;
  problemClass: ProblemClass;
  objective: number | null;
  solveTimeMs: number;
  values: Record<string, number>;
  errorMessage?: string;
}

export interface NormalizedSolveResult {
  status: SolveStatus;
  rawStatus: string;
  solverName: string;
  solverVersion: string;
  problemClass: ProblemClass;
  solveTimeMs: number;
  iterations: number;
  mipNodes: number;
  mipGap: number | null;
  bestBound: number | null;
  objective: number | null;
  values: Record<string, number>;
  duals: Record<string, number>;
  reducedCosts: Record<string, number>;
  variableDetails: VariableResultDetail[];
  constraintDetails: ConstraintResultDetail[];
  validation: ValidationReport;
  scalingApplied: boolean;
  iis: IisDiagnosis | null;
  unboundedDiagnosis: UnboundedDiagnosis | null;
  multipleOptimal?: MultipleOptimalInfo | null;
  lpText: string;
  errorMessage?: string;
}

export interface ModelVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  hash: string;
  createdAt: string;
  createdBy: string;
  role: UserRole;
  commitMessage: string;
  spec: ModelSpec;
  validation: ValidationReport;
}

export interface SolveRun {
  id: string;
  projectId: string;
  modelVersionId: string;
  versionNumber: number;
  createdAt: string;
  triggeredBy: string;
  role: UserRole;
  params: SolverParams;
  result: NormalizedSolveResult;
  aiExplanation?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: 'MODEL_CREATED' | 'MODEL_VERSIONED' | 'SOLVE_EXECUTED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED' | 'SENSITIVITY_SWEEP';
  projectId: string;
  projectName: string;
  modelVersionId?: string;
  runId?: string;
  solverVersion?: string;
  status?: string;
  objective?: number | null;
  details: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  domain: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  latestVersionNumber: number;
  latestVersionId: string;
  totalRuns: number;
}

export interface ProjectDetail extends ProjectSummary {
  versions: ModelVersion[];
  runs: SolveRun[];
}

export interface RunComparison {
  runA: SolveRun;
  runB: SolveRun;
  objectiveDelta: number | null;
  objectivePctDelta: number | null;
  variableDeltas: Array<{
    name: string;
    valueA: number | null;
    valueB: number | null;
    delta: number | null;
  }>;
  shadowPriceDeltas: Array<{
    name: string;
    shadowA: number | null;
    shadowB: number | null;
    delta: number | null;
  }>;
}

export interface WhatIfPoint {
  paramValue: number;
  status: SolveStatus;
  objective: number | null;
  bindingConstraints: string[];
  values: Record<string, number>;
}

export type AiAutomationActionType =
  | 'START_PROJECT_DISCOVERY'
  | 'CREATE_AND_SOLVE_PROJECT'
  | 'UPDATE_AND_SOLVE_PROJECT'
  | 'SOLVE_ACTIVE_PROJECT'
  | 'EXPLAIN_OR_DEBUG_ACTIVE_RUN'
  | 'RUN_WHAT_IF_SWEEP'
  | 'RUN_TRANSPORTATION'
  | 'RUN_ASSIGNMENT'
  | 'RUN_BATCH_SOLVE'
  | 'DELETE_PROJECT'
  | 'NAVIGATE_AND_CONFIGURE';

export interface ProjectDiscoveryIntake {
  description: string;
  category: string;
  difficulty: string;
  level: string;
  quantity: string;
  businessCategory: string;
  sector: string;
  currency: 'BDT' | 'USD';
  language: 'en' | 'bn';
}

export interface ReasoningQuestionItem {
  id: string;
  question: string;
  hint?: string;
  options: string[];
  defaultAnswer?: string;
}

export interface ReasoningQuestionsResponse {
  introMessage: string;
  questions: ReasoningQuestionItem[];
}

export interface ReasoningAnswerItem {
  id: string;
  question: string;
  answer: string;
}

export interface ProjectAnalyzeBuildResponse {
  analysisSummary: string;
  reasoningSteps?: string[];
  reasoningDurationMs?: number;
  replyMessage: string;
  replyLanguage: 'en' | 'bn';
  steps: AiAutomationStep[];
  project: ProjectDetail;
  run: SolveRun;
  explanation?: string;
  targetTab: 'solve' | 'sensitivity';
}

export interface AiAutomationStep {
  label: string;
  detail?: string;
}

export interface AiAutomationResponse {
  actionType: AiAutomationActionType;
  replyMessage: string;
  replyLanguage: 'en' | 'bn';
  steps: AiAutomationStep[];
  targetLanguage?: 'en' | 'bn';
  targetTab?: 'builder' | 'solve' | 'sensitivity' | 'transport' | 'compare';
  targetSubTab?: 'whatif' | 'batch';
  openUiAction?: 'none' | 'create_project' | 'examples_modal';
  discoveryPrefill?: {
    descriptionHint?: string;
    category?: string;
    businessCategory?: string;
    sector?: string;
  };
  project?: ProjectDetail;
  run?: SolveRun;
  analysisSummary?: string;
  reasoningSteps?: string[];
  reasoningDurationMs?: number;
  explanation?: string;
  deletedProjectId?: string;
  whatIfPayload?: {
    targetType: 'constraint_rhs' | 'objective_coef';
    targetName: string;
    minVal: number;
    maxVal: number;
    steps: number;
    points: WhatIfPoint[];
  };
  transportationPayload?: {
    input: TransportationInput;
    result: TransportationResult;
  };
  assignmentPayload?: {
    input: AssignmentInput;
    result: AssignmentResult;
  };
  batchPayload?: {
    batchText: string;
    summary: {
      total: number;
      optimalCount: number;
      failedCount: number;
      totalTimeMs: number;
    };
    results: BatchSolveItemResult[];
  };
}

