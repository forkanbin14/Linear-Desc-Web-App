import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { modelSpecToLatex, parseMathEquationsToSpec } from './src/shared/equationParser.ts';
import { MODEL_TEMPLATES } from './src/shared/templates.ts';
import type {
  AiAutomationResponse,
  AiAutomationStep,
  AssignmentInput,
  BatchSolveItemResult,
  ModelSpec,
  ProjectAnalyzeBuildResponse,
  ProjectDiscoveryIntake,
  ReasoningAnswerItem,
  SolverParams,
  TransportationInput,
  UserRole,
  WhatIfPoint,
} from './src/shared/types.ts';
import { modelSpecToLpText, validateModelSpec } from './src/shared/validator.ts';
import {
  analyzeAndBuildProjectFromIntake,
  buildInstantSolveBriefing,
  debugInfeasibleModel,
  explainSolveResult,
  formatGeminiErrorMessage,
  generateProjectReasoningQuestions,
  nlToModelSpec,
  planAiAutomation,
  transcribeAudioToText,
} from './server/ai.ts';
import { buildTemplateWorkbook, exportSolveReportWorkbook, parseExcelToModelSpec } from './server/excel.ts';
import { defaultSolverAdapter } from './server/solverAdapter.ts';
import { DEFAULT_SOLVER_PARAMS, platformStore } from './server/store.ts';
import { solveHungarianAssignment, solveTransportationProblem } from './server/transportationEngine.ts';

async function startServer() {
  await platformStore.init();

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, engine: 'HiGHS WASM', service: 'Systonic Linear Desc' });
  });

  app.get('/api/templates', (_req, res) => {
    res.json({ templates: MODEL_TEMPLATES });
  });

  app.get('/api/projects', (_req, res) => {
    res.json({ projects: platformStore.listProjects() });
  });

  app.get('/api/projects/:id', (req, res) => {
    const proj = platformStore.getProject(req.params.id);
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: proj });
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const { name, domain, description, spec, actor, role, actionType, autoSolve, params } = req.body as {
        name: string;
        domain?: string;
        description?: string;
        spec: ModelSpec;
        actor?: string;
        role?: UserRole;
        actionType?: 'MODEL_CREATED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED';
        autoSolve?: boolean;
        params?: Partial<SolverParams>;
      };
      if (!name || !spec) {
        return res.status(400).json({ error: 'Project name and model spec are required.' });
      }
      let proj = platformStore.createProject({
        name,
        domain: domain || spec.domain || 'Custom',
        description: description || spec.description || '',
        spec,
        actor: actor || 'workspace@a2z.corp',
        role: role || 'modeler',
        actionType,
      });

      if (autoSolve && proj.latestVersionId) {
        const mergedParams: SolverParams = { ...DEFAULT_SOLVER_PARAMS, ...(params ?? {}) };
        const result = await defaultSolverAdapter.solve(spec, mergedParams);
        platformStore.recordRun({
          projectId: proj.id,
          modelVersionId: proj.latestVersionId,
          params: mergedParams,
          result,
          actor: actor || 'workspace@a2z.corp',
          role: role || 'modeler',
        });
        proj = platformStore.getProject(proj.id) ?? proj;
      }

      res.status(201).json({ project: proj });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create project' });
    }
  });

  app.delete('/api/projects/:id', (req, res) => {
    const deleted = platformStore.deleteProject(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ deleted: true });
  });

  app.get('/api/exports/blank-xlsx-template', (_req, res) => {
    const blankSpec: ModelSpec = {
      name: 'Optimization Model Template',
      domain: 'Custom',
      variables: [
        { name: 'x1', lb: 0, ub: null, type: 'continuous', unit: 'units', description: 'Variable 1' },
        { name: 'x2', lb: 0, ub: null, type: 'continuous', unit: 'units', description: 'Variable 2' },
      ],
      constraints: [
        { name: 'resource_1', terms: { x1: 2, x2: 1 }, sense: '<=', rhs: 100, description: 'Resource capacity' },
      ],
      objective: { sense: 'max', terms: { x1: 10, x2: 12 } },
    };
    const buf = buildTemplateWorkbook(blankSpec);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="a2z_optimization_template.xlsx"');
    res.send(buf);
  });

  app.post('/api/projects/:id/models', (req, res) => {
    try {
      const { spec, commitMessage, actor, role, actionType } = req.body as {
        spec: ModelSpec;
        commitMessage?: string;
        actor?: string;
        role?: UserRole;
        actionType?: 'MODEL_VERSIONED' | 'EXCEL_IMPORTED' | 'AI_SPEC_CONFIRMED';
      };
      if (!spec) {
        return res.status(400).json({ error: 'Model specification is required.' });
      }
      const version = platformStore.createVersion({
        projectId: req.params.id,
        spec,
        commitMessage: commitMessage || 'Model update',
        actor: actor || 'modeler@a2z.corp',
        role: role || 'modeler',
        actionType,
      });
      res.status(201).json({ version });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Project not found' });
    }
  });

  app.post('/api/validate', (req, res) => {
    try {
      const { spec } = req.body as { spec: ModelSpec };
      const validation = validateModelSpec(spec);
      const lpText = validation.valid ? modelSpecToLpText(spec) : '';
      res.json({ validation, lpText });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Validation failed' });
    }
  });

  app.post('/api/models/:versionId/solve', async (req, res) => {
    try {
      const ver = platformStore.getVersion(req.params.versionId);
      if (!ver) return res.status(404).json({ error: 'Model version not found' });

      const { params, actor, role } = req.body as {
        params?: Partial<SolverParams>;
        actor?: string;
        role?: UserRole;
      };

      const mergedParams: SolverParams = { ...DEFAULT_SOLVER_PARAMS, ...(params ?? {}) };
      const result = await defaultSolverAdapter.solve(ver.spec, mergedParams);

      const run = platformStore.recordRun({
        projectId: ver.projectId,
        modelVersionId: ver.id,
        params: mergedParams,
        result,
        actor: actor || 'analyst@a2z.corp',
        role: role || 'analyst',
      });

      res.json({ run });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Solve execution failed' });
    }
  });

  app.post('/api/models/:versionId/what-if', async (req, res) => {
    try {
      const ver = platformStore.getVersion(req.params.versionId);
      if (!ver) return res.status(404).json({ error: 'Model version not found' });

      const { targetType, targetName, minVal, maxVal, steps, actor, role } = req.body as {
        targetType: 'constraint_rhs' | 'objective_coef';
        targetName: string;
        minVal: number;
        maxVal: number;
        steps: number;
        actor?: string;
        role?: UserRole;
      };

      const nSteps = Math.min(15, Math.max(3, Math.round(steps || 7)));
      const points: WhatIfPoint[] = [];

      for (let i = 0; i < nSteps; i++) {
        const ratio = nSteps === 1 ? 0 : i / (nSteps - 1);
        const val = Math.round((minVal + (maxVal - minVal) * ratio) * 10000) / 10000;
        const cloned: ModelSpec = JSON.parse(JSON.stringify(ver.spec));

        if (targetType === 'constraint_rhs') {
          const con = cloned.constraints.find((c) => c.name === targetName);
          if (con) con.rhs = val;
        } else {
          cloned.objective.terms[targetName] = val;
        }

        const resSolve = await defaultSolverAdapter.solve(cloned, {
          ...DEFAULT_SOLVER_PARAMS,
          computeRanging: false,
          computeIis: false,
        });

        points.push({
          paramValue: val,
          status: resSolve.status,
          objective: resSolve.objective,
          bindingConstraints: resSolve.constraintDetails.filter((c) => c.binding).map((c) => c.name),
          values: resSolve.values,
        });
      }

      const proj = platformStore.getProject(ver.projectId);
      platformStore.recordAudit({
        actor: actor || 'analyst@a2z.corp',
        role: role || 'analyst',
        action: 'SENSITIVITY_SWEEP',
        projectId: ver.projectId,
        projectName: proj?.name ?? ver.projectId,
        modelVersionId: ver.id,
        details: `Parametric what-if sweep on ${targetType} "${targetName}" from ${minVal} to ${maxVal} (${nSteps} solves)`,
      });

      res.json({ points });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'What-if analysis failed' });
    }
  });

  app.get('/api/runs/:id', (req, res) => {
    const run = platformStore.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ run });
  });

  app.get('/api/runs/:a/compare/:b', (req, res) => {
    const comparison = platformStore.compareRuns(req.params.a, req.params.b);
    if (!comparison) return res.status(404).json({ error: 'One or both runs not found' });
    res.json({ comparison });
  });

  app.get('/api/runs/:id/export/xlsx', (req, res) => {
    const run = platformStore.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    const ver = platformStore.getVersion(run.modelVersionId);
    if (!ver) return res.status(404).json({ error: 'Version not found' });

    const buf = exportSolveReportWorkbook(ver.spec, run.result);
    const safeName = ver.spec.name.replace(/[^A-Za-z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_v${ver.versionNumber}_report.xlsx"`);
    res.send(buf);
  });

  app.get('/api/models/:versionId/export/xlsx-template', (req, res) => {
    const ver = platformStore.getVersion(req.params.versionId);
    if (!ver) return res.status(404).json({ error: 'Model version not found' });

    const buf = buildTemplateWorkbook(ver.spec);
    const safeName = ver.spec.name.replace(/[^A-Za-z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_v${ver.versionNumber}_template.xlsx"`);
    res.send(buf);
  });

  app.post('/api/imports/excel', (req, res) => {
    try {
      const { base64Data, filename } = req.body as { base64Data: string; filename: string };
      if (!base64Data) return res.status(400).json({ error: 'No Excel file payload provided.' });
      const buffer = Buffer.from(base64Data, 'base64');
      const spec = parseExcelToModelSpec(buffer, filename || 'imported_model.xlsx');
      const validation = validateModelSpec(spec);
      res.json({ spec, validation });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to parse Excel workbook' });
    }
  });

  app.post('/api/ai/nl-to-model', async (req, res) => {
    try {
      const { prompt } = req.body as { prompt: string };
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Please describe your optimization problem.' });
      }
      const draft = await nlToModelSpec(prompt.trim());
      res.json(draft);
    } catch (err) {
      console.error('AI nl-to-model error:', err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  app.post('/api/ai/explain-run', async (req, res) => {
    try {
      const { runId, language } = req.body as { runId: string; language?: 'en' | 'bn' };
      const run = platformStore.getRun(runId);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      const ver = platformStore.getVersion(run.modelVersionId);
      if (!ver) return res.status(404).json({ error: 'Version not found' });

      const explanation = await explainSolveResult(ver.spec, run.result, language || 'en');
      platformStore.attachAiExplanation(runId, explanation);
      res.json({ explanation });
    } catch (err) {
      console.error('AI explain error:', err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  app.post('/api/ai/debug-infeasible', async (req, res) => {
    try {
      const { runId, language } = req.body as { runId: string; language?: 'en' | 'bn' };
      const run = platformStore.getRun(runId);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      const ver = platformStore.getVersion(run.modelVersionId);
      if (!ver) return res.status(404).json({ error: 'Version not found' });

      const diagnosis = await debugInfeasibleModel(ver.spec, run.result, language || 'en');
      res.json({ diagnosis });
    } catch (err) {
      console.error('AI debug-infeasible error:', err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  app.post('/api/ai/automate', async (req, res) => {
    try {
      const startedAt = Date.now();
      const { instruction, uiLanguage, uiCurrency, activeProjectId, params } = req.body as {
        instruction: string;
        uiLanguage?: 'en' | 'bn';
        uiCurrency?: 'BDT' | 'USD';
        activeProjectId?: string | null;
        params?: Partial<SolverParams>;
      };
      if (!instruction || !instruction.trim()) {
        return res.status(400).json({ error: 'Instruction prompt is required.' });
      }

      const projects = platformStore.listProjects();
      const activeDetail = activeProjectId ? platformStore.getProject(activeProjectId) : undefined;
      const latestVer = activeDetail?.versions[activeDetail.versions.length - 1];
      const latestRun = activeDetail?.runs[0];

      const plan = await planAiAutomation(instruction.trim(), {
        uiLanguage: uiLanguage === 'bn' ? 'bn' : 'en',
        uiCurrency: uiCurrency === 'USD' ? 'USD' : 'BDT',
        projects: projects.map((p) => ({ id: p.id, name: p.name, domain: p.domain })),
        activeProject: activeDetail && latestVer
          ? {
              id: activeDetail.id,
              name: activeDetail.name,
              domain: activeDetail.domain,
              latestVersionNumber: latestVer.versionNumber,
              spec: latestVer.spec,
              hasRun: Boolean(latestRun),
              lastRunStatus: latestRun?.result.status,
              lastRunObjective: latestRun?.result.objective ?? null,
            }
          : null,
      });

      const isBn = plan.replyLanguage === 'bn';
      const steps: AiAutomationStep[] = [
        {
          label: isBn ? 'AI নির্দেশনা বিশ্লেষণ সম্পন্ন' : 'Parsed AI instruction',
          detail: plan.actionType,
        },
      ];
      const mergedParams: SolverParams = { ...DEFAULT_SOLVER_PARAMS, ...(params ?? {}) };

      const responsePayload: AiAutomationResponse = {
        actionType: plan.actionType,
        replyMessage: plan.replyMessage,
        replyLanguage: plan.replyLanguage,
        reasoningSteps: plan.reasoningSteps,
        reasoningDurationMs: Date.now() - startedAt,
        steps,
        targetLanguage: plan.targetLanguage,
        targetTab: plan.targetTab,
        targetSubTab: plan.targetSubTab,
        openUiAction: plan.openUiAction,
        discoveryPrefill: plan.discoveryPrefill,
      };

      // Handle Create or Update+Solve (falls back to Create if no active project exists)
      const effectiveAction =
        plan.actionType === 'UPDATE_AND_SOLVE_PROJECT' && !activeDetail
          ? 'START_PROJECT_DISCOVERY'
          : plan.actionType;

      if (effectiveAction === 'START_PROJECT_DISCOVERY') {
        responsePayload.actionType = 'START_PROJECT_DISCOVERY';
        steps.push({
          label: isBn
            ? 'ধাপ ১: প্রজেক্টের বিবরণ, ক্যাটাগরি, ডিফিকাল্টি, লেভেল, পরিমাণ, ব্যবসার ধরন ও সেক্টর ফর্ম প্রস্তুত'
            : 'Stage 1: Opened Project Discovery Brief (Description, Category, Difficulty, Level, Quantity, Business & Sector)',
        });
      } else if (effectiveAction === 'CREATE_AND_SOLVE_PROJECT' && plan.spec) {
        const validation = validateModelSpec(plan.spec);
        if (!validation.valid) {
          const msg = validation.issues.map((i) => i.message).join('; ');
          return res.status(400).json({ error: `Generated model validation error: ${msg}` });
        }
        steps.push({
          label: isBn ? 'মডেল স্কিমা যাচাই সম্পন্ন' : 'Validated mathematical model spec',
          detail: `${plan.spec.variables.length} vars · ${plan.spec.constraints.length} constraints`,
        });

        const created = platformStore.createProject({
          name: plan.spec.name,
          domain: plan.spec.domain || 'Custom',
          description: plan.spec.description || instruction.trim().slice(0, 160),
          spec: plan.spec,
          actor: 'syton-ai@systonic.ai',
          role: 'modeler',
          actionType: 'AI_SPEC_CONFIRMED',
        });
        steps.push({
          label: isBn ? `নতুন প্রজেক্ট "${created.name}" সংরক্ষিত` : `Created project "${created.name}" (v1)`,
        });

        const solveResult = await defaultSolverAdapter.solve(plan.spec, mergedParams);
        const run = platformStore.recordRun({
          projectId: created.id,
          modelVersionId: created.latestVersionId,
          params: mergedParams,
          result: solveResult,
          actor: 'syton-ai@systonic.ai',
          role: 'modeler',
        });
        steps.push({
          label: isBn
            ? `HiGHS সলভ সম্পন্ন (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`
            : `Solved with HiGHS (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`,
        });

        const explanation = buildInstantSolveBriefing(plan.spec, solveResult, plan.replyLanguage);
        if (solveResult.status === 'optimal' || solveResult.status === 'feasible') {
          platformStore.attachAiExplanation(run.id, explanation);
          steps.push({
            label: isBn ? 'সমাধানের সারসংক্ষেপ প্রস্তুত হয়েছে' : 'Generated solver briefing',
          });
        } else if (solveResult.status === 'infeasible') {
          steps.push({
            label: isBn ? 'ইনফিজিবিলিটি ডায়াগনোসিস প্রস্তুত' : 'Prepared IIS infeasibility summary',
          });
        }

        responsePayload.actionType = 'CREATE_AND_SOLVE_PROJECT';
        responsePayload.project = platformStore.getProject(created.id) ?? created;
        responsePayload.run = platformStore.getRun(run.id) ?? run;
        responsePayload.explanation = explanation;
        responsePayload.targetTab = solveResult.status === 'infeasible' ? 'sensitivity' : 'solve';
      } else if (effectiveAction === 'UPDATE_AND_SOLVE_PROJECT' && activeDetail && plan.spec) {
        const validation = validateModelSpec(plan.spec);
        if (!validation.valid) {
          const msg = validation.issues.map((i) => i.message).join('; ');
          return res.status(400).json({ error: `Updated model validation error: ${msg}` });
        }
        const version = platformStore.createVersion({
          projectId: activeDetail.id,
          spec: plan.spec,
          commitMessage: plan.commitMessage || 'Syton AI update',
          actor: 'syton-ai@systonic.ai',
          role: 'modeler',
          actionType: 'AI_SPEC_CONFIRMED',
        });
        steps.push({
          label: isBn ? `ভার্সন v${version.versionNumber} আপডেট সংরক্ষিত` : `Committed version v${version.versionNumber}`,
        });

        const solveResult = await defaultSolverAdapter.solve(version.spec, mergedParams);
        const run = platformStore.recordRun({
          projectId: activeDetail.id,
          modelVersionId: version.id,
          params: mergedParams,
          result: solveResult,
          actor: 'syton-ai@systonic.ai',
          role: 'modeler',
        });
        steps.push({
          label: isBn
            ? `HiGHS সলভ সম্পন্ন (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`
            : `Solved with HiGHS (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`,
        });

        const explanation = buildInstantSolveBriefing(version.spec, solveResult, plan.replyLanguage);
        if (solveResult.status === 'optimal' || solveResult.status === 'feasible') {
          platformStore.attachAiExplanation(run.id, explanation);
        }

        responsePayload.project = platformStore.getProject(activeDetail.id) ?? activeDetail;
        responsePayload.run = platformStore.getRun(run.id) ?? run;
        responsePayload.explanation = explanation;
        responsePayload.targetTab = solveResult.status === 'infeasible' ? 'sensitivity' : 'solve';
      } else if (effectiveAction === 'SOLVE_ACTIVE_PROJECT' && activeDetail && latestVer) {
        const solveResult = await defaultSolverAdapter.solve(latestVer.spec, mergedParams);
        const run = platformStore.recordRun({
          projectId: activeDetail.id,
          modelVersionId: latestVer.id,
          params: mergedParams,
          result: solveResult,
          actor: 'syton-ai@systonic.ai',
          role: 'analyst',
        });
        steps.push({
          label: isBn
            ? `HiGHS সলভ সম্পন্ন (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`
            : `Solved with HiGHS (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`,
        });

        const explanation = buildInstantSolveBriefing(latestVer.spec, solveResult, plan.replyLanguage);
        if (solveResult.status === 'optimal' || solveResult.status === 'feasible') {
          platformStore.attachAiExplanation(run.id, explanation);
        }

        responsePayload.project = platformStore.getProject(activeDetail.id) ?? activeDetail;
        responsePayload.run = platformStore.getRun(run.id) ?? run;
        responsePayload.explanation = explanation;
        responsePayload.targetTab = solveResult.status === 'infeasible' ? 'sensitivity' : 'solve';
      } else if (effectiveAction === 'EXPLAIN_OR_DEBUG_ACTIVE_RUN' && activeDetail && latestVer && latestRun) {
        if (latestRun.result.status === 'infeasible') {
          const diagnosis = await debugInfeasibleModel(latestVer.spec, latestRun.result, plan.replyLanguage);
          responsePayload.explanation = diagnosis;
          responsePayload.targetTab = 'sensitivity';
          steps.push({
            label: isBn ? 'IIS কনফ্লিক্ট ডায়াগনোসিস সম্পন্ন' : 'Generated IIS infeasibility diagnosis',
          });
        } else {
          const explanation = await explainSolveResult(latestVer.spec, latestRun.result, plan.replyLanguage);
          platformStore.attachAiExplanation(latestRun.id, explanation);
          responsePayload.explanation = explanation;
          responsePayload.targetTab = 'solve';
          steps.push({
            label: isBn ? 'এক্সিকিউটিভ অপটিমালিটি ব্যাখ্যা তৈরি' : 'Generated optimality explanation',
          });
        }
        responsePayload.project = platformStore.getProject(activeDetail.id) ?? activeDetail;
        responsePayload.run = platformStore.getRun(latestRun.id) ?? latestRun;
      } else if (effectiveAction === 'RUN_WHAT_IF_SWEEP' && activeDetail && latestVer && plan.whatIfConfig) {
        const { targetType, targetName, minVal, maxVal, steps: nRaw } = plan.whatIfConfig;
        const nSteps = Math.min(15, Math.max(3, Math.round(nRaw || 7)));
        const points: WhatIfPoint[] = [];

        for (let i = 0; i < nSteps; i++) {
          const ratio = nSteps === 1 ? 0 : i / (nSteps - 1);
          const val = Math.round((minVal + (maxVal - minVal) * ratio) * 10000) / 10000;
          const cloned: ModelSpec = JSON.parse(JSON.stringify(latestVer.spec));
          if (targetType === 'constraint_rhs') {
            const con = cloned.constraints.find((c) => c.name === targetName);
            if (con) con.rhs = val;
          } else {
            cloned.objective.terms[targetName] = val;
          }
          const resSolve = await defaultSolverAdapter.solve(cloned, {
            ...DEFAULT_SOLVER_PARAMS,
            computeRanging: false,
            computeIis: false,
          });
          points.push({
            paramValue: val,
            status: resSolve.status,
            objective: resSolve.objective,
            bindingConstraints: resSolve.constraintDetails.filter((c) => c.binding).map((c) => c.name),
            values: resSolve.values,
          });
        }
        steps.push({
          label: isBn
            ? `${targetName}-এর ওপর ${nSteps}-ধাপের What-If সুইপ সম্পন্ন`
            : `Executed ${nSteps}-point What-If sweep on ${targetName}`,
        });
        responsePayload.whatIfPayload = {
          targetType,
          targetName,
          minVal,
          maxVal,
          steps: nSteps,
          points,
        };
        responsePayload.targetTab = 'compare';
        responsePayload.targetSubTab = 'whatif';
      } else if (effectiveAction === 'RUN_TRANSPORTATION' && plan.transportationInput) {
        const result = await solveTransportationProblem(plan.transportationInput);
        steps.push({
          label: isBn
            ? `ট্রান্সপোর্টেশন সমাধান সম্পন্ন (সর্বনিম্ন খরচ = ${result.optimalTotalCost})`
            : `Solved transportation network (Min cost = ${result.optimalTotalCost})`,
        });
        responsePayload.transportationPayload = {
          input: plan.transportationInput,
          result,
        };
        responsePayload.targetTab = 'transport';
      } else if (effectiveAction === 'RUN_ASSIGNMENT' && plan.assignmentInput) {
        const result = solveHungarianAssignment(plan.assignmentInput);
        steps.push({
          label: isBn
            ? `হাঙ্গেরিয়ান অ্যাসাইনমেন্ট সম্পন্ন (মোট = ${result.totalCost})`
            : `Solved Hungarian assignment (Total = ${result.totalCost})`,
        });
        responsePayload.assignmentPayload = {
          input: plan.assignmentInput,
          result,
        };
        responsePayload.targetTab = 'transport';
      } else if (effectiveAction === 'RUN_BATCH_SOLVE' && plan.batchItems && plan.batchItems.length > 0) {
        const items = plan.batchItems.slice(0, 50);
        const results: BatchSolveItemResult[] = [];
        let totalTimeMs = 0;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const label = item.name?.trim() || `Problem #${i + 1}`;
          try {
            const specToSolve = parseMathEquationsToSpec(item.equations || '', label).spec;
            const resSolve = await defaultSolverAdapter.solve(specToSolve, {
              ...mergedParams,
              computeRanging: false,
              computeIis: false,
            });
            totalTimeMs += resSolve.solveTimeMs;
            results.push({
              index: i + 1,
              name: label,
              status: resSolve.status,
              problemClass: resSolve.problemClass,
              objective: resSolve.objective,
              solveTimeMs: resSolve.solveTimeMs,
              values: resSolve.values,
              errorMessage: resSolve.errorMessage,
            });
          } catch (err) {
            results.push({
              index: i + 1,
              name: label,
              status: 'error',
              problemClass: 'LP',
              objective: null,
              solveTimeMs: 0,
              values: {},
              errorMessage: err instanceof Error ? err.message : 'Failed to parse or solve problem',
            });
          }
        }
        const optimalCount = results.filter((r) => r.status === 'optimal' || r.status === 'feasible').length;
        const batchText = items.map((it) => `=== ${it.name} ===\n${it.equations}`).join('\n\n');
        steps.push({
          label: isBn
            ? `${results.length}টি সমস্যা ব্যাচ কিউতে সমাধান সম্পন্ন`
            : `Batch solved ${optimalCount}/${results.length} models`,
        });
        responsePayload.batchPayload = {
          batchText,
          summary: {
            total: results.length,
            optimalCount,
            failedCount: results.length - optimalCount,
            totalTimeMs: Math.round(totalTimeMs * 100) / 100,
          },
          results,
        };
        responsePayload.targetTab = 'compare';
        responsePayload.targetSubTab = 'batch';
      } else if (effectiveAction === 'DELETE_PROJECT') {
        const target = plan.deleteProjectTarget?.toLowerCase().trim();
        const match =
          projects.find((p) => p.id === plan.deleteProjectTarget) ||
          (target ? projects.find((p) => p.name.toLowerCase().includes(target)) : undefined) ||
          (activeDetail ? projects.find((p) => p.id === activeDetail.id) : undefined);

        if (match && platformStore.deleteProject(match.id)) {
          responsePayload.deletedProjectId = match.id;
          steps.push({
            label: isBn ? `প্রজেক্ট "${match.name}" ডিলিট করা হয়েছে` : `Deleted project "${match.name}"`,
          });
        }
      } else {
        steps.push({
          label: isBn ? 'ওয়ার্কস্পেস কনফিগারেশন ও ভিউ আপডেট সম্পন্ন' : 'Updated workspace view & configuration',
        });
      }

      res.json(responsePayload);
    } catch (err) {
      console.error('AI automate error:', err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  // Guided Project Architect Stage 2: Generate tailored reasoning questions from Stage 1 intake
  app.post('/api/ai/project-reasoning-questions', async (req, res) => {
    try {
      const { intake } = req.body as { intake?: ProjectDiscoveryIntake };
      if (!intake || !intake.description?.trim()) {
        return res.status(400).json({ error: 'Project description and intake parameters are required.' });
      }
      const data = await generateProjectReasoningQuestions({
        ...intake,
        description: intake.description.trim(),
        currency: intake.currency === 'USD' ? 'USD' : 'BDT',
        language: intake.language === 'bn' ? 'bn' : 'en',
      });
      res.json(data);
    } catch (err) {
      console.error('AI project-reasoning-questions error:', err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  // Guided Project Architect Stage 3: Deep Reasoning Analysis -> Build Project -> HiGHS Solve
  app.post('/api/ai/project-analyze-build', async (req, res) => {
    try {
      const startedAt = Date.now();
      const { intake, answers, params } = req.body as {
        intake?: ProjectDiscoveryIntake;
        answers?: ReasoningAnswerItem[];
        params?: Partial<SolverParams>;
      };
      if (!intake || !intake.description?.trim()) {
        return res.status(400).json({ error: 'Project intake data is required.' });
      }
      const normalizedIntake: ProjectDiscoveryIntake = {
        ...intake,
        description: intake.description.trim(),
        currency: intake.currency === 'USD' ? 'USD' : 'BDT',
        language: intake.language === 'bn' ? 'bn' : 'en',
      };
      const isBn = normalizedIntake.language === 'bn';

      const synthesized = await analyzeAndBuildProjectFromIntake(
        normalizedIntake,
        Array.isArray(answers) ? answers : [],
      );

      const validation = validateModelSpec(synthesized.spec);
      if (!validation.valid) {
        const msg = validation.issues.map((i) => i.message).join('; ');
        return res.status(400).json({ error: `Generated model validation error: ${msg}` });
      }

      const steps: AiAutomationStep[] = [
        {
          label: isBn
            ? 'ধাপ ১ ও ২ ডেটা গভীরভাবে বিশ্লেষণ (Reasoning) সম্পন্ন'
            : 'Completed deep AI reasoning across Stage 1 & Stage 2 inputs',
        },
        {
          label: isBn
            ? `মডেল ফর্মুলেশন যাচাই (${synthesized.spec.variables.length} ভেরিয়েবল · ${synthesized.spec.constraints.length} শর্ত)`
            : `Validated mathematical formulation (${synthesized.spec.variables.length} vars · ${synthesized.spec.constraints.length} constraints)`,
        },
      ];

      const created = platformStore.createProject({
        name: synthesized.spec.name,
        domain: synthesized.spec.domain || 'Custom',
        description: synthesized.spec.description || normalizedIntake.description.slice(0, 180),
        spec: synthesized.spec,
        actor: 'syton-ai@systonic.ai',
        role: 'modeler',
        actionType: 'AI_SPEC_CONFIRMED',
      });
      steps.push({
        label: isBn
          ? `নতুন প্রজেক্ট "${created.name}" সংরক্ষিত`
          : `Created project "${created.name}" (v1)`,
      });

      const mergedParams: SolverParams = { ...DEFAULT_SOLVER_PARAMS, ...(params ?? {}) };
      const solveResult = await defaultSolverAdapter.solve(synthesized.spec, mergedParams);
      const run = platformStore.recordRun({
        projectId: created.id,
        modelVersionId: created.latestVersionId,
        params: mergedParams,
        result: solveResult,
        actor: 'syton-ai@systonic.ai',
        role: 'modeler',
      });
      steps.push({
        label: isBn
          ? `HiGHS সলভ সম্পন্ন (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`
          : `Solved with HiGHS (${solveResult.status}${solveResult.objective !== null ? ` · Z* = ${solveResult.objective}` : ''})`,
      });

      const explanation = buildInstantSolveBriefing(
        synthesized.spec,
        solveResult,
        normalizedIntake.language,
      );
      if (solveResult.status === 'optimal' || solveResult.status === 'feasible') {
        platformStore.attachAiExplanation(run.id, explanation);
        steps.push({
          label: isBn ? 'এক্সিকিউটিভ সমাধান সারসংক্ষেপ প্রস্তুত হয়েছে' : 'Generated executive optimality briefing',
        });
      } else if (solveResult.status === 'infeasible') {
        steps.push({
          label: isBn ? 'ইনফিজিবিলিটি ডায়াগনোসিস প্রস্তুত' : 'Prepared IIS infeasibility summary',
        });
      }

      const payload: ProjectAnalyzeBuildResponse = {
        analysisSummary: synthesized.analysisSummary,
        reasoningSteps: synthesized.reasoningSteps,
        reasoningDurationMs: Date.now() - startedAt,
        replyMessage: synthesized.replyMessage,
        replyLanguage: normalizedIntake.language,
        steps,
        project: platformStore.getProject(created.id) ?? created,
        run: platformStore.getRun(run.id) ?? run,
        explanation,
        targetTab: solveResult.status === 'infeasible' ? 'sensitivity' : 'solve',
      };

      res.json(payload);
    } catch (err) {
      console.error('AI project-analyze-build error:', err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  app.get('/api/audit-log', (_req, res) => {
    res.json({ entries: platformStore.getAuditLog(150) });
  });

  // LP-01 / Capability #1 & #7: Mathematical Equation Parser + LaTeX Formatter
  app.post('/api/parse-equations', (req, res) => {
    try {
      const { rawText, modelName } = req.body as { rawText: string; modelName?: string };
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({ error: 'Equation input text is required.' });
      }
      const parsed = parseMathEquationsToSpec(rawText, modelName || 'Parsed LP Model');
      const validation = validateModelSpec(parsed.spec);
      const latex = modelSpecToLatex(parsed.spec);
      res.json({ ...parsed, validation, latex });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to parse equations' });
    }
  });

  // LP-12 Part A: Transportation Problem Engine (VAM + HiGHS Optimal)
  app.post('/api/transportation/solve', async (req, res) => {
    try {
      const input = req.body as TransportationInput;
      const result = await solveTransportationProblem(input);
      res.json({ result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Transportation solve failed' });
    }
  });

  // LP-12 Part B: Exact Hungarian Assignment Engine
  app.post('/api/assignment/solve', (req, res) => {
    try {
      const input = req.body as AssignmentInput;
      const result = solveHungarianAssignment(input);
      res.json({ result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Assignment solve failed' });
    }
  });

  app.post('/api/ai/transcribe-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType, language } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        language?: 'en' | 'bn';
      };
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return res.status(400).json({ error: 'Audio recording payload is required.' });
      }
      const text = await transcribeAudioToText(
        audioBase64,
        mimeType || 'audio/webm',
        language === 'bn' ? 'bn' : 'en',
      );
      res.json({ text });
    } catch (err) {
      console.error('AI transcribe-audio error:', err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  // Capability #8: Batch Problem Processing Engine
  app.post('/api/batch/solve', async (req, res) => {
    try {
      const { items, params } = req.body as {
        items: Array<{ name?: string; equations?: string; spec?: ModelSpec }>;
        params?: Partial<SolverParams>;
      };
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Provide at least 1 problem item in items array.' });
      }
      if (items.length > 50) {
        return res.status(400).json({ error: 'Batch size is capped at 50 problems per request.' });
      }

      const mergedParams: SolverParams = { ...DEFAULT_SOLVER_PARAMS, ...(params ?? {}) };
      const results: BatchSolveItemResult[] = [];
      let totalTimeMs = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = item.name?.trim() || `Problem #${i + 1}`;
        try {
          const specToSolve = item.spec
            ? item.spec
            : parseMathEquationsToSpec(item.equations || '', label).spec;
          const resSolve = await defaultSolverAdapter.solve(specToSolve, {
            ...mergedParams,
            computeRanging: false,
            computeIis: false,
          });
          totalTimeMs += resSolve.solveTimeMs;
          results.push({
            index: i + 1,
            name: label,
            status: resSolve.status,
            problemClass: resSolve.problemClass,
            objective: resSolve.objective,
            solveTimeMs: resSolve.solveTimeMs,
            values: resSolve.values,
            errorMessage: resSolve.errorMessage,
          });
        } catch (err) {
          results.push({
            index: i + 1,
            name: label,
            status: 'error',
            problemClass: 'LP',
            objective: null,
            solveTimeMs: 0,
            values: {},
            errorMessage: err instanceof Error ? err.message : 'Failed to parse or solve problem',
          });
        }
      }

      const optimalCount = results.filter((r) => r.status === 'optimal' || r.status === 'feasible').length;
      res.json({
        summary: {
          total: results.length,
          optimalCount,
          failedCount: results.length - optimalCount,
          totalTimeMs: Math.round(totalTimeMs * 100) / 100,
        },
        results,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Batch solve failed' });
    }
  });

  // Vite middleware in development, static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Systonic Linear Desc server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
