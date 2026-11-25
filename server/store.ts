import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AuditLogEntry,
  ModelSpec,
  ModelVersion,
  NormalizedSolveResult,
  ProjectDetail,
  ProjectSummary,
  RunComparison,
  SolveRun,
  SolverParams,
  UserRole,
} from '../src/shared/types.ts';
import { validateModelSpec } from '../src/shared/validator.ts';

interface StoreState {
  projects: Record<
    string,
    {
      id: string;
      name: string;
      domain: string;
      description: string;
      createdAt: string;
      updatedAt: string;
      versionIds: string[];
      runIds: string[];
    }
  >;
  versions: Record<string, ModelVersion>;
  runs: Record<string, SolveRun>;
  auditLog: AuditLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), '.a2z-data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export const DEFAULT_SOLVER_PARAMS: SolverParams = {
  solverId: 'highs-wasm',
  timeLimitSec: 60,
  mipRelGap: 1e-4,
  presolve: 'on',
  autoScale: true,
  computeRanging: true,
  computeIis: true,
};

function shortHash(obj: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

class PlatformStore {
  private state: StoreState = {
    projects: {},
    versions: {},
    runs: {},
    auditLog: [],
  };
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        this.state = JSON.parse(raw) as StoreState;
        this.initialized = true;
        return;
      } catch {
        // Re-initialize empty store if corrupt
      }
    }

    this.state = {
      projects: {},
      versions: {},
      runs: {},
      auditLog: [],
    };
    this.initialized = true;
    this.save();
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist A2Z store:', err);
    }
  }

  deleteProject(projectId: string): boolean {
    const p = this.state.projects[projectId];
    if (!p) return false;
    for (const vid of p.versionIds) delete this.state.versions[vid];
    for (const rid of p.runIds) delete this.state.runs[rid];
    delete this.state.projects[projectId];
    this.save();
    return true;
  }

  listProjects(): ProjectSummary[] {
    return Object.values(this.state.projects).map((p) => {
      const latestVerId = p.versionIds[p.versionIds.length - 1];
      const latestVer = this.state.versions[latestVerId];
      return {
        id: p.id,
        name: p.name,
        domain: p.domain,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        latestVersionNumber: latestVer?.versionNumber ?? 1,
        latestVersionId: latestVerId,
        totalRuns: p.runIds.length,
      };
    });
  }

  getProject(projectId: string): ProjectDetail | null {
    const p = this.state.projects[projectId];
    if (!p) return null;
    const versions = p.versionIds.map((vid) => this.state.versions[vid]).filter(Boolean);
    const runs = p.runIds.map((rid) => this.state.runs[rid]).filter(Boolean);
    const latest = versions[versions.length - 1];
    return {
      id: p.id,
      name: p.name,
      domain: p.domain,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      latestVersionNumber: latest?.versionNumber ?? 1,
      latestVersionId: latest?.id ?? '',
      totalRuns: runs.length,
      versions,
      runs,
    };
  }

  createProject(input: {
    name: string;
    domain: string;
    description: string;
    spec: ModelSpec;
    actor: string;
    role: UserRole;
    actionType?: AuditLogEntry['action'];
  }): ProjectDetail {
    const now = new Date().toISOString();
    const projectId = makeId('proj');
    const versionId = makeId('ver');
    const validation = validateModelSpec(input.spec);

    this.state.projects[projectId] = {
      id: projectId,
      name: input.name,
      domain: input.domain || 'Custom',
      description: input.description || input.spec.description || 'Custom optimization project',
      createdAt: now,
      updatedAt: now,
      versionIds: [versionId],
      runIds: [],
    };

    this.state.versions[versionId] = {
      id: versionId,
      projectId,
      versionNumber: 1,
      hash: shortHash(input.spec),
      createdAt: now,
      createdBy: input.actor,
      role: input.role,
      commitMessage: 'Initial model version',
      spec: input.spec,
      validation,
    };

    this.state.auditLog.unshift({
      id: makeId('aud'),
      timestamp: now,
      actor: input.actor,
      role: input.role,
      action: input.actionType ?? 'MODEL_CREATED',
      projectId,
      projectName: input.name,
      modelVersionId: versionId,
      details: `Created project v1 (${validation.problemClass}, ${validation.numVars} vars, ${validation.numConstraints} constraints)`,
    });

    this.save();
    return this.getProject(projectId)!;
  }

  createVersion(input: {
    projectId: string;
    spec: ModelSpec;
    commitMessage: string;
    actor: string;
    role: UserRole;
    actionType?: AuditLogEntry['action'];
  }): ModelVersion {
    const proj = this.state.projects[input.projectId];
    if (!proj) throw new Error(`Project ${input.projectId} not found.`);

    const now = new Date().toISOString();
    const prevVerId = proj.versionIds[proj.versionIds.length - 1];
    const prevVer = this.state.versions[prevVerId];
    const versionNumber = (prevVer?.versionNumber ?? 0) + 1;
    const versionId = makeId('ver');
    const validation = validateModelSpec(input.spec);

    const ver: ModelVersion = {
      id: versionId,
      projectId: proj.id,
      versionNumber,
      hash: shortHash(input.spec),
      createdAt: now,
      createdBy: input.actor,
      role: input.role,
      commitMessage: input.commitMessage || `Update to v${versionNumber}`,
      spec: input.spec,
      validation,
    };

    this.state.versions[versionId] = ver;
    proj.versionIds.push(versionId);
    proj.updatedAt = now;

    this.state.auditLog.unshift({
      id: makeId('aud'),
      timestamp: now,
      actor: input.actor,
      role: input.role,
      action: input.actionType ?? 'MODEL_VERSIONED',
      projectId: proj.id,
      projectName: proj.name,
      modelVersionId: versionId,
      details: `Committed v${versionNumber} (${ver.hash}): ${ver.commitMessage}`,
    });

    this.save();
    return ver;
  }

  getVersion(versionId: string): ModelVersion | null {
    return this.state.versions[versionId] ?? null;
  }

  recordRun(input: {
    projectId: string;
    modelVersionId: string;
    params: SolverParams;
    result: NormalizedSolveResult;
    actor: string;
    role: UserRole;
  }): SolveRun {
    const proj = this.state.projects[input.projectId];
    const ver = this.state.versions[input.modelVersionId];
    if (!proj || !ver) throw new Error('Invalid project or model version.');

    const now = new Date().toISOString();
    const runId = makeId('run');
    const run: SolveRun = {
      id: runId,
      projectId: proj.id,
      modelVersionId: ver.id,
      versionNumber: ver.versionNumber,
      createdAt: now,
      triggeredBy: input.actor,
      role: input.role,
      params: input.params,
      result: input.result,
    };

    this.state.runs[runId] = run;
    proj.runIds.unshift(runId);
    proj.updatedAt = now;

    this.state.auditLog.unshift({
      id: makeId('aud'),
      timestamp: now,
      actor: input.actor,
      role: input.role,
      action: 'SOLVE_EXECUTED',
      projectId: proj.id,
      projectName: proj.name,
      modelVersionId: ver.id,
      runId,
      solverVersion: `HiGHS ${input.result.solverVersion}`,
      status: input.result.status,
      objective: input.result.objective,
      details: `Solved v${ver.versionNumber} (${input.result.problemClass}) -> ${input.result.status.toUpperCase()} in ${input.result.solveTimeMs}ms`,
    });

    this.save();
    return run;
  }

  attachAiExplanation(runId: string, explanation: string): void {
    const run = this.state.runs[runId];
    if (run) {
      run.aiExplanation = explanation;
      this.save();
    }
  }

  getRun(runId: string): SolveRun | null {
    return this.state.runs[runId] ?? null;
  }

  compareRuns(runAId: string, runBId: string): RunComparison | null {
    const runA = this.state.runs[runAId];
    const runB = this.state.runs[runBId];
    if (!runA || !runB) return null;

    const objA = runA.result.objective;
    const objB = runB.result.objective;
    const objectiveDelta = objA !== null && objB !== null ? objB - objA : null;
    const objectivePctDelta =
      objA !== null && objB !== null && Math.abs(objA) > 1e-9 ? ((objB - objA) / Math.abs(objA)) * 100 : null;

    const allVarNames = Array.from(
      new Set([...Object.keys(runA.result.values), ...Object.keys(runB.result.values)]),
    );
    const variableDeltas = allVarNames.map((name) => {
      const valueA = runA.result.values[name] ?? null;
      const valueB = runB.result.values[name] ?? null;
      return {
        name,
        valueA,
        valueB,
        delta: valueA !== null && valueB !== null ? valueB - valueA : null,
      };
    });

    const allConNames = Array.from(
      new Set([...Object.keys(runA.result.duals), ...Object.keys(runB.result.duals)]),
    );
    const shadowPriceDeltas = allConNames.map((name) => {
      const shadowA = runA.result.duals[name] ?? null;
      const shadowB = runB.result.duals[name] ?? null;
      return {
        name,
        shadowA,
        shadowB,
        delta: shadowA !== null && shadowB !== null ? shadowB - shadowA : null,
      };
    });

    return {
      runA,
      runB,
      objectiveDelta,
      objectivePctDelta,
      variableDeltas,
      shadowPriceDeltas,
    };
  }

  getAuditLog(limit = 100): AuditLogEntry[] {
    return this.state.auditLog.slice(0, limit);
  }

  recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    this.state.auditLog.unshift({
      ...entry,
      id: makeId('aud'),
      timestamp: new Date().toISOString(),
    });
    this.save();
  }
}

export const platformStore = new PlatformStore();
