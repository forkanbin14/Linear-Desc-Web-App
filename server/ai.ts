import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import type {
  AiAutomationActionType,
  AssignmentInput,
  ModelSpec,
  NormalizedSolveResult,
  ProjectDiscoveryIntake,
  ReasoningAnswerItem,
  ReasoningQuestionsResponse,
  TransportationInput,
  ValidationReport,
} from '../src/shared/types.ts';
import { parseMathEquationsToSpec } from '../src/shared/equationParser.ts';
import { validateModelSpec } from '../src/shared/validator.ts';

let cachedAiClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }
  if (!cachedAiClient || cachedApiKey !== apiKey) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 20000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedApiKey = apiKey;
  }
  return cachedAiClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafely<T>(rawText: string): T {
  const cleaned = (rawText || '{}')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned || '{}') as T;
}

export function formatGeminiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'AI request failed');
  if (/daily quota.*overloaded|Settings > Secrets/i.test(raw)) {
    return raw;
  }
  const isDailyQuota = /GenerateRequestsPerDay|PerDay|quota.*exceeded/i.test(raw);
  // Extract inner JSON message if @google/genai returned serialized JSON error body
  try {
    const start = raw.indexOf('{');
    if (start !== -1) {
      const parsed = JSON.parse(raw.slice(start)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error?.message) {
        const code = parsed.error.code;
        if (code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED' || isDailyQuota) {
          return isDailyQuota
            ? 'Gemini free-tier daily quota reached (429). Select a billing-enabled API key in Settings > Secrets for higher limits, or try again later.'
            : 'AI rate limit reached (429). Please wait a few seconds and try again.';
        }
        if (code === 503 || code === 504 || parsed.error.status === 'UNAVAILABLE' || parsed.error.status === 'DEADLINE_EXCEEDED') {
          return 'Gemini AI is experiencing temporary high demand. Please try again in a few seconds.';
        }
        if (code === 400 || code === 403 || parsed.error.status === 'PERMISSION_DENIED') {
          return 'AI API key error. Please check GEMINI_API_KEY in Settings > Secrets.';
        }
        return parsed.error.message;
      }
    }
  } catch {
    // Fallback to string matching
  }
  if (isDailyQuota || /429|RESOURCE_EXHAUSTED/i.test(raw)) {
    return isDailyQuota
      ? 'Gemini free-tier daily quota reached (429). Select a billing-enabled API key in Settings > Secrets for higher limits, or try again later.'
      : 'AI rate limit reached (429). Please wait a few seconds and try again.';
  }
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return 'Gemini AI is experiencing temporary high demand (503). Please wait a few seconds and click Retry.';
  }
  if (/504|DEADLINE_EXCEEDED|Deadline expired|timeout|aborted|ETIMEDOUT/i.test(raw)) {
    return 'AI model took too long under load. Please click Retry.';
  }
  return raw;
}

function isTransientAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|DEADLINE_EXCEEDED|Deadline expired|RESOURCE_EXHAUSTED|high demand|overloaded|timeout|timed out|aborted|ETIMEDOUT|ECONNRESET|fetch failed/i.test(
    msg,
  );
}

let hydrogenDailyCooldownUntil = 0;
let hydrogenTransientCooldownUntil = 0;
let flashLiteTransientCooldownUntil = 0;

/**
 * Resilient & fast Gemini caller with singleton client, adaptive per-model health cooldowns
 * (avoids hitting a congested 503/504 model repeatedly), cross-model failover between
 * `gemini-3.1-flash-lite` and `gemini-4-hydrogen`, and exponential jitter retries.
 */
async function callGeminiWithRetry(
  params: Omit<GenerateContentParameters, 'model'>,
  speedMode: 'fast_lite' | 'hydrogen_low' = 'fast_lite',
): Promise<GenerateContentResponse> {
  const ai = getAiClient();
  const now = Date.now();
  const skipHydrogenDaily = now < hydrogenDailyCooldownUntil;
  const hydrogenCooling = skipHydrogenDaily || now < hydrogenTransientCooldownUntil;
  const liteCooling = now < flashLiteTransientCooldownUntil;

  // Pick healthiest model first, then alternate cleanly on transient errors
  let preferHydrogenFirst = speedMode === 'hydrogen_low' && !hydrogenCooling;
  if (liteCooling && !hydrogenCooling) {
    preferHydrogenFirst = true;
  }

  const attempts: Array<{ model: string; delayBeforeMs: number; useLowThinking: boolean }> =
    skipHydrogenDaily
      ? [
          { model: 'gemini-3.1-flash-lite', delayBeforeMs: 0, useLowThinking: false },
          { model: 'gemini-3.1-flash-lite', delayBeforeMs: 350, useLowThinking: false },
          { model: 'gemini-3.1-flash-lite', delayBeforeMs: 950, useLowThinking: false },
          { model: 'gemini-3.1-flash-lite', delayBeforeMs: 1850, useLowThinking: false },
          { model: 'gemini-3.1-flash-lite', delayBeforeMs: 3100, useLowThinking: false },
        ]
      : preferHydrogenFirst
        ? [
            { model: 'gemini-4-hydrogen', delayBeforeMs: 0, useLowThinking: true },
            { model: 'gemini-3.1-flash-lite', delayBeforeMs: 250, useLowThinking: false },
            { model: 'gemini-4-hydrogen', delayBeforeMs: 850, useLowThinking: false },
            { model: 'gemini-3.1-flash-lite', delayBeforeMs: 1750, useLowThinking: false },
            { model: 'gemini-4-hydrogen', delayBeforeMs: 3000, useLowThinking: true },
          ]
        : [
            { model: 'gemini-3.1-flash-lite', delayBeforeMs: 0, useLowThinking: false },
            { model: 'gemini-4-hydrogen', delayBeforeMs: 250, useLowThinking: true },
            { model: 'gemini-3.1-flash-lite', delayBeforeMs: 850, useLowThinking: false },
            { model: 'gemini-4-hydrogen', delayBeforeMs: 1750, useLowThinking: false },
            { model: 'gemini-3.1-flash-lite', delayBeforeMs: 3000, useLowThinking: false },
          ];

  let lastError: unknown;
  let sawDailyQuota = skipHydrogenDaily;
  let saw503 = false;

  for (let idx = 0; idx < attempts.length; idx++) {
    const step = attempts[idx];
    if (step.model === 'gemini-4-hydrogen' && Date.now() < hydrogenDailyCooldownUntil) {
      continue;
    }
    if (step.delayBeforeMs > 0) {
      const jitter = Math.floor(Math.random() * 140);
      await sleep(step.delayBeforeMs + jitter);
    }
    try {
      const baseConfig = params.config ? { ...params.config } : {};
      if (step.useLowThinking && step.model === 'gemini-4-hydrogen') {
        baseConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      } else {
        delete baseConfig.thinkingConfig;
      }
      const res = await ai.models.generateContent({
        ...params,
        model: step.model,
        config: baseConfig,
      });
      // Recover cooldown on success
      if (step.model === 'gemini-4-hydrogen') hydrogenTransientCooldownUntil = 0;
      if (step.model === 'gemini-3.1-flash-lite') flashLiteTransientCooldownUntil = 0;
      return res;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini attempt ${idx + 1} · ${step.model}]`, msg.slice(0, 220));
      if (step.model === 'gemini-4-hydrogen' && /GenerateRequestsPerDay|PerDay/i.test(msg)) {
        hydrogenDailyCooldownUntil = Date.now() + 15 * 60 * 1000;
        sawDailyQuota = true;
      } else if (/503|UNAVAILABLE|high demand|DEADLINE_EXCEEDED|Deadline expired/i.test(msg)) {
        if (step.model === 'gemini-4-hydrogen') {
          hydrogenTransientCooldownUntil = Date.now() + 45 * 1000;
        } else {
          flashLiteTransientCooldownUntil = Date.now() + 45 * 1000;
        }
        saw503 = true;
      }
      if (!isTransientAiError(err)) {
        throw new Error(formatGeminiErrorMessage(err));
      }
    }
  }

  if (sawDailyQuota && saw503) {
    throw new Error(
      'Gemini free-tier daily quota on gemini-4-hydrogen is exhausted (429) and fallback model gemini-3.1-flash-lite is temporarily overloaded (503). Select a billing-enabled API key in Settings > Secrets for higher limits, or wait a few seconds and click Retry.',
    );
  }
  throw new Error(formatGeminiErrorMessage(lastError));
}

export interface AiModelDraftResponse {
  spec: ModelSpec;
  validation: ValidationReport;
  modelingNotes: string;
}

/**
 * Section L: Natural language -> Validated JSON Model Spec.
 * Output is NEVER executed directly; it is schema-validated and returned
 * for explicit human preview & confirmation.
 */
export async function nlToModelSpec(prompt: string): Promise<AiModelDraftResponse> {
  const response = await callGeminiWithRetry({
    contents: `Convert the following optimization problem description (which may be in English, Bengali, or Banglish) into a rigorous mathematical LP/MIP canonical JSON specification.\n\nUser Problem:\n"""\n${prompt}\n"""`,
    config: {
      systemInstruction: `You are a Principal Operations Research & Quantitative Finance Architect.
Convert the user's natural-language business or financial optimization problem into a clean, mathematically sound LP/MIP canonical JSON spec.
Rules:
1. Variable names must be snake_case alphanumeric identifiers starting with a letter (e.g. project_a, invest_bond, units_x).
2. Always specify realistic lower bounds (usually 0) and upper bounds (or null if unbounded above).
3. Use "binary" for yes/no selection decisions, "integer" for discrete counts, and "continuous" for dollar amounts, weights, or quantities.
4. Ensure every variable referenced in constraints and objective exists in the variables list.
5. Express terms as an array of { varName, coef } pairs so they map cleanly to a terms dictionary.
6. Provide clear business descriptions on variables and constraints, plus concise modelingNotes summarizing assumptions.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Short descriptive model title' },
          domain: {
            type: Type.STRING,
            description: 'One of: Finance, Supply Chain, Operations, Portfolio, Risk & Credit, Custom',
          },
          description: { type: Type.STRING, description: 'Concise problem formulation summary' },
          modelingNotes: {
            type: Type.STRING,
            description: 'Key modeling assumptions, units, and sanity checks for the user to verify before solving',
          },
          objectiveSense: { type: Type.STRING, description: '"max" or "min"' },
          objectiveTerms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                varName: { type: Type.STRING },
                coef: { type: Type.NUMBER },
              },
              required: ['varName', 'coef'],
            },
          },
          variables: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                lb: { type: Type.NUMBER, nullable: true },
                ub: { type: Type.NUMBER, nullable: true },
                type: { type: Type.STRING, description: '"continuous", "integer", or "binary"' },
                unit: { type: Type.STRING },
                group: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['name', 'type'],
            },
          },
          constraints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                sense: { type: Type.STRING, description: '"<=", ">=", or "=="' },
                rhs: { type: Type.NUMBER },
                terms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      varName: { type: Type.STRING },
                      coef: { type: Type.NUMBER },
                    },
                    required: ['varName', 'coef'],
                  },
                },
              },
              required: ['name', 'sense', 'rhs', 'terms'],
            },
          },
        },
        required: ['name', 'description', 'modelingNotes', 'objectiveSense', 'objectiveTerms', 'variables', 'constraints'],
      },
    },
  }, 'hydrogen_low');

  const rawText = (response.text ?? '{}').trim();
  const parsed = parseJsonSafely<{
    name: string;
    domain?: string;
    description?: string;
    modelingNotes?: string;
    objectiveSense: string;
    objectiveTerms: Array<{ varName: string; coef: number }>;
    variables: Array<{
      name: string;
      lb?: number | null;
      ub?: number | null;
      type: string;
      unit?: string;
      group?: string;
      description?: string;
    }>;
    constraints: Array<{
      name: string;
      description?: string;
      sense: string;
      rhs: number;
      terms: Array<{ varName: string; coef: number }>;
    }>;
  }>(rawText);

  const allowedDomains = new Set(['Finance', 'Supply Chain', 'Operations', 'Portfolio', 'Risk & Credit', 'Custom']);
  const domain = parsed.domain && allowedDomains.has(parsed.domain) ? (parsed.domain as ModelSpec['domain']) : 'Custom';

  const objTermsRecord: Record<string, number> = {};
  for (const t of parsed.objectiveTerms || []) {
    if (t.varName && Number.isFinite(t.coef)) {
      objTermsRecord[t.varName] = t.coef;
    }
  }

  const spec: ModelSpec = {
    name: parsed.name || 'AI Drafted Optimization Model',
    domain,
    description: parsed.description || '',
    variables: (parsed.variables || []).map((v) => ({
      name: v.name,
      lb: v.lb === undefined ? 0 : v.lb,
      ub: v.ub === undefined ? null : v.ub,
      type: v.type === 'binary' ? 'binary' : v.type === 'integer' ? 'integer' : 'continuous',
      unit: v.unit,
      group: v.group,
      description: v.description,
    })),
    constraints: (parsed.constraints || []).map((c) => {
      const termsRecord: Record<string, number> = {};
      for (const t of c.terms || []) {
        if (t.varName && Number.isFinite(t.coef)) {
          termsRecord[t.varName] = t.coef;
        }
      }
      const sense = c.sense === '==' || c.sense === '=' ? '==' : c.sense === '>=' ? '>=' : '<=';
      return {
        name: c.name,
        description: c.description,
        sense,
        rhs: c.rhs,
        terms: termsRecord,
      };
    }),
    objective: {
      sense: parsed.objectiveSense === 'min' ? 'min' : 'max',
      terms: objTermsRecord,
    },
  };

  const validation = validateModelSpec(spec);

  return {
    spec,
    validation,
    modelingNotes: parsed.modelingNotes ?? 'Review variable bounds, units, and constraint signs before committing.',
  };
}

/**
 * Section L: Result Explainer grounded strictly in solver output, shadow prices,
 * reduced costs, and allowable sensitivity intervals.
 */
export async function explainSolveResult(spec: ModelSpec, result: NormalizedSolveResult, language: 'en' | 'bn' = 'en'): Promise<string> {
  const summaryPayload = {
    modelName: spec.name,
    problemClass: result.problemClass,
    sense: spec.objective.sense,
    status: result.status,
    objective: result.objective,
    mipGap: result.mipGap,
    variables: result.variableDetails.map((v) => ({
      name: v.name,
      value: v.value,
      unit: v.unit,
      objCoef: v.objCoef,
      reducedCost: v.reducedCost,
      atBound: v.atBound,
      allowableObjRange: [v.allowableObjMin, v.allowableObjMax],
    })),
    constraints: result.constraintDetails.map((c) => ({
      name: c.name,
      description: c.description,
      sense: c.sense,
      rhs: c.rhs,
      activity: c.activity,
      slack: c.slack,
      binding: c.binding,
      shadowPrice: c.shadowPrice,
      allowableRhsRange: [c.allowableRhsMin, c.allowableRhsMax],
    })),
  };

  const langDirective =
    language === 'bn'
      ? 'Write the explanation clearly in natural Bengali (with standard English financial/OR terms like Shadow Price, Binding Constraint, Reduced Cost where helpful).'
      : 'Write a crisp, executive financial & operations briefing in English.';

  const response = await callGeminiWithRetry({
    contents: `${langDirective}\n\nExplain why this optimization solution is optimal using the exact solver telemetry below. Highlight:\n1. Top recommended decisions and objective outcome.\n2. Binding bottleneck constraints and what their exact Shadow Price means per 1-unit expansion (including allowable range).\n3. Variables held at zero or lower/upper bounds and their Reduced Cost / opportunity cost.\n4. Concrete executive action items.\n\nSolver Telemetry:\n${JSON.stringify(summaryPayload)}`,
    config: {
      systemInstruction:
        'You are a Senior Quantitative Strategist explaining HiGHS optimization outputs to a CFO and Operations VP. Cite ONLY the exact numbers provided in the telemetry. Never invent figures. Keep formatting concise with crisp numbered sections.',
    },
  }, 'fast_lite');

  return (response.text ?? 'Unable to generate explanation.').trim();
}

/**
 * Instant zero-latency briefing computed directly from HiGHS solver telemetry.
 * Eliminates a redundant second sequential Gemini round-trip right after model build/solve.
 */
export function buildInstantSolveBriefing(
  spec: ModelSpec,
  result: NormalizedSolveResult,
  language: 'en' | 'bn' = 'en',
): string {
  const isBn = language === 'bn';
  const currencySym = spec.currency === 'USD' ? '$' : '৳';
  const objText =
    result.objective !== null
      ? `${currencySym}${Number(result.objective.toFixed(2)).toLocaleString()}`
      : 'N/A';

  if (result.status === 'infeasible') {
    const conflicts = result.iis?.conflictingConstraints?.slice(0, 4).join(', ') || 'constraints';
    return isBn
      ? `সতর্কতা: "${spec.name}" মডেলটি বর্তমান সীমাবদ্ধতায় সমাধানযোগ্য নয় (Infeasible)। প্রধান সাংঘর্ষিক শর্ত: ${conflicts}। সেন্সিটিভিটি ট্যাবে গিয়ে বা Syton AI-কে সীমা শিথিল করতে বলুন।`
      : `Notice: "${spec.name}" is currently INFEASIBLE. Primary conflicting constraints: ${conflicts}. Open the Sensitivity tab or ask Syton AI to relax conflicting limits.`;
  }

  const topVars = result.variableDetails
    .filter((v) => v.value > 1e-6)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((v) => `• ${v.name}: ${Number(v.value.toFixed(2))}${v.unit ? ` ${v.unit}` : ''}`);

  const bindingCons = result.constraintDetails
    .filter((c) => c.binding)
    .slice(0, 3)
    .map((c) =>
      isBn
        ? `• ${c.name} (সীমা ${c.rhs}, Shadow Price: ${c.shadowPrice !== null ? c.shadowPrice.toFixed(2) : '0'})`
        : `• ${c.name} (limit ${c.rhs}, Shadow Price: ${c.shadowPrice !== null ? c.shadowPrice.toFixed(2) : '0'})`,
    );

  if (isBn) {
    return [
      `১) সর্বোত্তম ফলাফল (${spec.objective.sense === 'min' ? 'সর্বনিম্ন খরচ' : 'সর্বোচ্চ লক্ষ্য'}): Z* = ${objText} (${result.solveTimeMs.toFixed(1)} ms)`,
      topVars.length > 0 ? `২) প্রস্তাবিত প্রধান সিদ্ধান্ত:\n${topVars.join('\n')}` : '',
      bindingCons.length > 0 ? `৩) প্রধান বটলনেক শর্ত:\n${bindingCons.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    `1) Optimal Outcome (${spec.objective.sense === 'min' ? 'Min Objective' : 'Max Objective'}): Z* = ${objText} (${result.solveTimeMs.toFixed(1)} ms)`,
    topVars.length > 0 ? `2) Recommended Allocation:\n${topVars.join('\n')}` : '',
    bindingCons.length > 0 ? `3) Binding Bottlenecks:\n${bindingCons.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Section L: Infeasibility Debug Assistant grounded in HiGHS IIS & Minimal Relaxation output.
 */
export async function debugInfeasibleModel(spec: ModelSpec, result: NormalizedSolveResult, language: 'en' | 'bn' = 'en'): Promise<string> {
  const payload = {
    modelName: spec.name,
    status: result.status,
    iis: result.iis,
    constraints: spec.constraints,
    variables: spec.variables,
  };

  const langDirective =
    language === 'bn'
      ? 'Respond in clear Bengali with financial/technical clarity.'
      : 'Respond in clear, concise executive English.';

  const response = await callGeminiWithRetry({
    contents: `${langDirective}\n\nDiagnose why this optimization model is INFEASIBLE using the HiGHS IIS conflict set and minimal feasibility relaxation numbers below. Explain which specific constraints contradict each other mathematically and rank the cleanest business trade-offs to restore feasibility.\n\nIIS & Relaxation Data:\n${JSON.stringify(payload)}`,
    config: {
      systemInstruction:
        'You are an Operations Research Debugger. Ground every statement in the IIS conflict list and minimal relaxation deltas provided. Never hallucinate numbers.',
    },
  }, 'fast_lite');

  return (response.text ?? 'Unable to diagnose infeasibility.').trim();
}

export interface AiAutomationContext {
  uiLanguage: 'en' | 'bn';
  uiCurrency?: 'BDT' | 'USD';
  projects: Array<{ id: string; name: string; domain: string }>;
  activeProject?: {
    id: string;
    name: string;
    domain: string;
    latestVersionNumber: number;
    spec: ModelSpec;
    hasRun: boolean;
    lastRunStatus?: string;
    lastRunObjective?: number | null;
  } | null;
}

export interface PlannedAiAutomation {
  actionType: AiAutomationActionType;
  replyLanguage: 'en' | 'bn';
  replyMessage: string;
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
  commitMessage?: string;
  deleteProjectTarget?: string;
  spec?: ModelSpec;
  whatIfConfig?: {
    targetType: 'constraint_rhs' | 'objective_coef';
    targetName: string;
    minVal: number;
    maxVal: number;
    steps: number;
  };
  transportationInput?: TransportationInput;
  assignmentInput?: AssignmentInput;
  batchItems?: Array<{ name: string; equations: string }>;
  reasoningSteps?: string[];
}

interface RawGeminiModelSpec {
  name: string;
  domain?: string;
  description?: string;
  objectiveSense: string;
  objectiveOffset?: number;
  objectiveTerms: Array<{ varName: string; coef: number }>;
  quadraticTerms?: Array<{ var1: string; var2: string; coef: number }>;
  variables: Array<{
    name: string;
    lb?: number | null;
    ub?: number | null;
    type: string;
    unit?: string;
    group?: string;
    description?: string;
  }>;
  constraints: Array<{
    name: string;
    description?: string;
    sense: string;
    rhs: number;
    terms: Array<{ varName: string; coef: number }>;
  }>;
}

function normalizeGeminiModelSpec(
  rawSpec: RawGeminiModelSpec,
  currency: 'BDT' | 'USD',
  fallbackName = 'AI Automated Optimization Model',
): ModelSpec {
  const allowedDomains = new Set(['Finance', 'Supply Chain', 'Operations', 'Portfolio', 'Risk & Credit', 'Custom']);
  const domain =
    rawSpec.domain && allowedDomains.has(rawSpec.domain)
      ? (rawSpec.domain as ModelSpec['domain'])
      : 'Custom';

  // Ensure valid snake_case identifiers starting with a letter
  const sanitizeVar = (rawName: string, idx: number): string => {
    const cleaned = (rawName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!cleaned || !/^[a-z]/.test(cleaned)) {
      return `var_${idx + 1}`;
    }
    return cleaned;
  };

  const varNameMap = new Map<string, string>();
  const normalizedVars = (rawSpec.variables || []).map((v, idx) => {
    const safeName = sanitizeVar(v.name, idx);
    varNameMap.set(v.name, safeName);
    const type: 'continuous' | 'integer' | 'binary' =
      v.type === 'binary' ? 'binary' : v.type === 'integer' ? 'integer' : 'continuous';
    const lb = v.lb === undefined ? 0 : v.lb;
    const ub = type === 'binary' ? (v.ub === undefined || v.ub === null ? 1 : v.ub) : v.ub === undefined ? null : v.ub;
    return {
      name: safeName,
      lb: type === 'binary' ? (lb === null ? 0 : Math.max(0, lb)) : lb,
      ub,
      type,
      unit: v.unit,
      group: v.group,
      description: v.description,
    };
  });

  const knownVarSet = new Set(normalizedVars.map((v) => v.name));

  const objTerms: Record<string, number> = {};
  for (const t of rawSpec.objectiveTerms || []) {
    const mapped = varNameMap.get(t.varName) ?? sanitizeVar(t.varName, 0);
    if (knownVarSet.has(mapped) && Number.isFinite(t.coef)) {
      objTerms[mapped] = t.coef;
    }
  }

  const normalizedConstraints = (rawSpec.constraints || []).map((c, idx) => {
    const terms: Record<string, number> = {};
    for (const t of c.terms || []) {
      const mapped = varNameMap.get(t.varName) ?? sanitizeVar(t.varName, 0);
      if (knownVarSet.has(mapped) && Number.isFinite(t.coef)) {
        terms[mapped] = t.coef;
      }
    }
    const sense: '<=' | '>=' | '==' = c.sense === '==' || c.sense === '=' ? '==' : c.sense === '>=' ? '>=' : '<=';
    return {
      name: (c.name || `constraint_${idx + 1}`).trim() || `constraint_${idx + 1}`,
      description: c.description,
      sense,
      rhs: Number.isFinite(c.rhs) ? c.rhs : 0,
      terms,
    };
  });

  const quadTerms =
    rawSpec.quadraticTerms && rawSpec.quadraticTerms.length > 0
      ? rawSpec.quadraticTerms
          .map((q) => ({
            var1: varNameMap.get(q.var1) ?? sanitizeVar(q.var1, 0),
            var2: varNameMap.get(q.var2) ?? sanitizeVar(q.var2, 0),
            coef: q.coef,
          }))
          .filter((q) => knownVarSet.has(q.var1) && knownVarSet.has(q.var2) && Number.isFinite(q.coef))
      : undefined;

  return {
    name: rawSpec.name || fallbackName,
    domain,
    currency: currency === 'USD' ? 'USD' : 'BDT',
    description: rawSpec.description || '',
    variables: normalizedVars,
    constraints: normalizedConstraints,
    objective: {
      sense: rawSpec.objectiveSense === 'min' ? 'min' : 'max',
      terms: objTerms,
      offset: Number.isFinite(rawSpec.objectiveOffset) ? rawSpec.objectiveOffset : 0,
      quadraticTerms: quadTerms && quadTerms.length > 0 ? quadTerms : undefined,
    },
  };
}

function tryFastProjectDiscoveryPlan(
  instruction: string,
  context: AiAutomationContext,
): PlannedAiAutomation | null {
  const text = instruction.trim();
  const numericMatches = text.match(/\d+(\.\d+)?/g) ?? [];
  const hasMathOperators = /(<=|>=|==|=|\+|\*)/.test(text);
  const hasOtherActionKeywords =
    /\b(solve\s*koro|run\s*solve|what[\s-]*if|sweep|transport|transportation|shipping|hungarian|assign|assignment|batch|delete|remove|explain|debug|why\s*optimal|increase|decrease)\b/i.test(
      text,
    );

  // Only route when the user asks to create/start a project without providing explicit equations/numbers
  if (numericMatches.length >= 2 || hasMathOperators || hasOtherActionKeywords) {
    return null;
  }

  const wantsProject =
    /(project|model|প্রজেক্ট|মডেল)/iu.test(text) &&
    /(create|make|build|start|new|setup|want|need|banabo|banate|banao|korbo|korte|chai|toiri|তৈরি|বানাবো|বানাতে|বানাও|করবো|করতে|নতুন)/iu.test(
      text,
    );

  if (!wantsProject) {
    return null;
  }

  const isBengaliOrBanglish =
    /[\u0980-\u09FF]/.test(text) ||
    /\b(ami|amar|ekta|ekti|notun|banabo|banate|banao|korbo|korte|chai|toiri|jonno)\b/i.test(text) ||
    context.uiLanguage === 'bn';

  const replyLanguage: 'en' | 'bn' = isBengaliOrBanglish ? 'bn' : 'en';

  // Detect optional domain hints without dumping generic "Ami ekta project banabo" text into Description
  let sectorHint: string | undefined;
  let businessHint: string | undefined;
  let categoryHint: string | undefined;
  if (/(garment|textile|shirt|pant|apparel|গার্মেন্টস|পোশাক)/i.test(text)) {
    sectorHint = 'Garments & Textile';
    businessHint = 'Manufacturing';
    categoryHint = 'Production & Manufacturing';
  } else if (/(food|bakery|restaurant|fmcg|খাবার|ফুড)/i.test(text)) {
    sectorHint = 'FMCG & Food';
  } else if (/(pharma|hospital|clinic|medicine|health|স্বাস্থ্য|ফার্মা)/i.test(text)) {
    sectorHint = 'Healthcare & Pharma';
  } else if (/(farm|dairy|agro|agriculture|কৃষি|ডেইরি)/i.test(text)) {
    sectorHint = 'Agriculture & Dairy';
    businessHint = 'Agribusiness';
  } else if (/(it|software|saas|tech|আইটি|সফটওয়্যার)/i.test(text)) {
    sectorHint = 'IT & SaaS';
  } else if (/(finance|bank|invest|portfolio|ব্যাংক|ফাইন্যান্স|বিনিয়োগ)/i.test(text)) {
    businessHint = 'Financial Services';
    categoryHint = 'Finance & Budget';
  }

  const isPureGenericAsk =
    /^(ami\s+)?(ekta|ekti|a|an|one)?\s*(new|notun|নতুন)?\s*(project|model|প্রজেক্ট)\s*(create|make|build|start|banabo|banate\s*chai|banao|korbo|korte\s*chai|chai|toiri\s*koro|তৈরি\s*করো|তৈরি\s*করব|বানাবো|বানাতে\s*চাই)?[.!?]*$/iu.test(
      text,
    );

  return {
    actionType: 'START_PROJECT_DISCOVERY',
    replyLanguage,
    replyMessage:
      replyLanguage === 'bn'
        ? 'অবশ্যই! চলুন ধাপে ধাপে প্রজেক্ট তৈরি করি — প্রথমে ৭টি ধাপ (ক্যাটাগরি, ডিফিকাল্টি, লেভেল, পরিমাণ, ব্যবসার ধরন, সেক্টর ও মূল লক্ষ্য) মেসেজে পূরণ করুন, এরপর প্রজেক্টের বর্ণনা লিখে সাবমিট করলেই আমি প্রজেক্ট তৈরি করে দেব।'
        : 'Sure! Let’s architect your optimization project step by step — first answer the 7 setup steps via chat, then submit your Project Description and I will build and solve your project.',
    reasoningSteps:
      replyLanguage === 'bn'
        ? [
            'ইউজারের বার্তায় নতুন অপটিমাইজেশন প্রজেক্ট তৈরির অভিপ্রায় শনাক্ত করা হয়েছে',
            sectorHint
              ? `প্রাসঙ্গিক সেক্টর (${sectorHint}) ও ক্যাটাগরি (${categoryHint || 'সাধারণ'}) অনুমান করা হয়েছে`
              : 'গাণিতিক সংখ্যা সম্পূর্ণ না থাকায় ধাপে ধাপে তথ্য সংগ্রহ ফ্লো বেছে নেওয়া হয়েছে',
            '৭টি কাঠামোগত প্রশ্ন শেষে মূল প্রজেক্ট বর্ণনা নিয়ে হাই-সাপোর্ট অটো-বিল্ড সক্রিয় করা হয়েছে',
          ]
        : [
            'Detected project-creation intent without complete mathematical coefficients',
            sectorHint
              ? `Inferred domain prefill (${sectorHint}) from user brief`
              : 'Selected guided 7-step discovery intake before model synthesis',
            'Initialized step-by-step chat architect flow leading into final description & HiGHS solve',
          ],
    discoveryPrefill: {
      descriptionHint: isPureGenericAsk ? undefined : text,
      category: categoryHint,
      businessCategory: businessHint,
      sector: sectorHint,
    },
  };
}

function tryFastInstantCommandPlan(
  instruction: string,
  context: AiAutomationContext,
): PlannedAiAutomation | null {
  const discoveryPlan = tryFastProjectDiscoveryPlan(instruction, context);
  if (discoveryPlan) {
    return discoveryPlan;
  }

  const text = instruction.trim();
  const isBanglaText =
    /[\u0980-\u09FF]/.test(text) ||
    /\b(koro|korun|jao|jan|kholo|khulun|dekhao|dekhun|bangla|banglay|amar|ei)\b/i.test(text);
  const replyLanguage: 'en' | 'bn' = isBanglaText || context.uiLanguage === 'bn' ? 'bn' : 'en';

  // 1. Instant Algebraic Equation Solver (when user pastes explicit Max/Min LP equations)
  if (
    /(<=|>=|≤|≥|=)/.test(text) &&
    /\b(max|maximize|maximise|min|minimize|minimise)\b/i.test(text) &&
    !/\b(batch|what[\s-]*if|sweep|transport|assign|update|edit|change)\b/i.test(text)
  ) {
    try {
      const normalizedEqText = text.replace(/,\s*(?=[A-Za-z0-9_.\s+-]*(<=|>=|≤|≥|=))/g, '\n');
      const parsedEq = parseMathEquationsToSpec(normalizedEqText, 'Instant Equation LP Model');
      parsedEq.spec.currency = context.uiCurrency === 'USD' ? 'USD' : 'BDT';
      const check = validateModelSpec(parsedEq.spec);
      if (
        check.valid &&
        parsedEq.spec.variables.length >= 1 &&
        parsedEq.spec.constraints.length >= 1 &&
        Object.keys(parsedEq.spec.objective.terms).length >= 1
      ) {
        return {
          actionType: 'CREATE_AND_SOLVE_PROJECT',
          replyLanguage,
          replyMessage:
            replyLanguage === 'bn'
              ? `আপনার গাণিতিক সমীকরণ থেকে "${parsedEq.spec.name}" তৈরি করে HiGHS ইঞ্জিনে সমাধান করা হয়েছে।`
              : `Parsed your algebraic equations, built "${parsedEq.spec.name}", and solved it with HiGHS WASM.`,
          targetTab: 'solve',
          spec: parsedEq.spec,
          reasoningSteps:
            replyLanguage === 'bn'
              ? [
                  `সমীকরণ থেকে ${parsedEq.spec.variables.length}টি ডিসিশন ভেরিয়েবল ও অবজেক্টিভ ফাংশন পার্স করা হয়েছে`,
                  `${parsedEq.spec.constraints.length}টি সীমাবদ্ধতার ফিজিবিলিটি স্কিমা যাচাই সম্পন্ন`,
                  'HiGHS WASM অপটিমাইজেশন সলভারে সমাধানের জন্য পাঠানো হয়েছে',
                ]
              : [
                  `Parsed ${parsedEq.spec.variables.length} variables and objective function directly from algebraic syntax`,
                  `Validated ${parsedEq.spec.constraints.length} linear constraints against canonical ModelSpec schema`,
                  'Dispatched directly to HiGHS WASM solver for optimal basis calculation',
                ],
        };
      }
    } catch {
      // Fall through to Gemini planner if text is natural prose rather than clean equations
    }
  }

  // Skip instant command routing if the user supplied numbers, math operators, edits, or deep questions
  if (
    /\d/.test(text) ||
    /(<=|>=|==|=|\+|\*|explain|why|debug|what[\s-]*if|sweep|batch|transport|assign|delete|remove|update|change|edit|add|kono|keno)/i.test(
      text,
    )
  ) {
    return null;
  }

  // 1. Instant Language Switch
  if (
    /^(switch\s+to\s+|change\s+(language\s+)?to\s+|use\s+)?(bangla|bengali|বাংলা)(\s+koro|\s+korun|\s+language|\s+করো|\s+করুন)?[.!?]*$/iu.test(
      text,
    )
  ) {
    return {
      actionType: 'NAVIGATE_AND_CONFIGURE',
      replyLanguage: 'bn',
      replyMessage: 'অ্যাপের ভাষা বাংলায় পরিবর্তন করা হয়েছে।',
      targetLanguage: 'bn',
      openUiAction: 'none',
      reasoningSteps: [
        'ইউজারের ভাষা পরিবর্তনের নির্দেশ (বাংলা) শনাক্ত করা হয়েছে',
        'ইন্টারফেস ও সলভার লেবেল বাংলায় সুইচ করা হয়েছে',
      ],
    };
  }
  if (
    /^(switch\s+to\s+|change\s+(language\s+)?to\s+|use\s+)?(english|ইংরেজি)(\s+koro|\s+korun|\s+language|\s+করো|\s+করুন)?[.!?]*$/iu.test(
      text,
    )
  ) {
    return {
      actionType: 'NAVIGATE_AND_CONFIGURE',
      replyLanguage: 'en',
      replyMessage: 'Switched application language to English.',
      targetLanguage: 'en',
      openUiAction: 'none',
      reasoningSteps: [
        'Detected language switch request to English',
        'Updated workspace UI locale to English',
      ],
    };
  }

  // 2. Instant Solve Active Project
  if (
    context.activeProject &&
    /^(solve|run\s*solve|optimize|calculate\s*optimal|solve\s*(it|this|project|koro|korun)|সমাধান(\s*করো|\s*করুন|\s*দেখাও)?)[.!?]*$/iu.test(
      text,
    )
  ) {
    return {
      actionType: 'SOLVE_ACTIVE_PROJECT',
      replyLanguage,
      replyMessage:
        replyLanguage === 'bn'
          ? `"${context.activeProject.name}" প্রজেক্টটি HiGHS ইঞ্জিনে সমাধান করা হচ্ছে।`
          : `Solved "${context.activeProject.name}" with HiGHS WASM.`,
      targetTab: 'solve',
      reasoningSteps:
        replyLanguage === 'bn'
          ? [
              `অ্যাক্টিভ প্রজেক্ট "${context.activeProject.name}" ও সর্বশেষ ভার্সন নির্বাচন করা হয়েছে`,
              'সরাসরি HiGHS অপটিমাইজেশন সলভার চালু করা হয়েছে',
            ]
          : [
              `Selected active project "${context.activeProject.name}"`,
              'Dispatched direct solve execution on HiGHS WASM',
            ],
    };
  }

  // 3. Instant Tab / Modal Navigation
  const tabMatchers: Array<{
    re: RegExp;
    tab?: PlannedAiAutomation['targetTab'];
    subTab?: PlannedAiAutomation['targetSubTab'];
    ui?: PlannedAiAutomation['openUiAction'];
    en: string;
    bn: string;
  }> = [
    {
      re: /^(open\s+|go\s+to\s+|show\s+)?(examples?|templates?|উদাহরণ|টেমপ্লেট)(\s+(modal|dekhao|kholo|দেখাও|খোলো))?[.!?]*$/iu,
      ui: 'examples_modal',
      en: 'Opened the Example Models library.',
      bn: 'উদাহরণ ও টেমপ্লেট লাইব্রেরি খোলা হয়েছে।',
    },
    {
      re: /^(open\s+|go\s+to\s+|show\s+)?(sensitivity|সেন্সিটিভিটি)(\s+(tab|view|e\s+jao|dekhao|খোলো|যাও))?[.!?]*$/iu,
      tab: 'sensitivity',
      en: 'Switched to Sensitivity & Shadow Price analysis.',
      bn: 'সেন্সিটিভিটি ও শ্যাডো প্রাইস ট্যাবে যাওয়া হয়েছে।',
    },
    {
      re: /^(open\s+|go\s+to\s+|show\s+)?(studio|builder|স্টুডিও|বিল্ডার)(\s+(tab|view|e\s+jao|dekhao|খোলো|যাও))?[.!?]*$/iu,
      tab: 'builder',
      en: 'Switched to Model Studio.',
      bn: 'মডেল স্টুডিও ট্যাবে যাওয়া হয়েছে।',
    },
    {
      re: /^(open\s+|go\s+to\s+|show\s+)?(compare|তুলনা)(\s+(tab|view|e\s+jao|dekhao|খোলো|যাও))?[.!?]*$/iu,
      tab: 'compare',
      en: 'Switched to Compare & Batch workspace.',
      bn: 'তুলনা ও ব্যাচ ওয়ার্কস্পেসে যাওয়া হয়েছে।',
    },
  ];

  for (const m of tabMatchers) {
    if (m.re.test(text)) {
      return {
        actionType: 'NAVIGATE_AND_CONFIGURE',
        replyLanguage,
        replyMessage: replyLanguage === 'bn' ? m.bn : m.en,
        targetTab: m.tab,
        targetSubTab: m.subTab,
        openUiAction: m.ui || 'none',
        reasoningSteps: [
          replyLanguage === 'bn'
            ? 'সরাসরি ন্যাভিগেশন নির্দেশ শনাক্ত করা হয়েছে'
            : 'Detected direct workspace navigation command',
          replyLanguage === 'bn' ? m.bn : m.en,
        ],
      };
    }
  }

  return null;
}

/**
 * Full-system Bilingual AI Autopilot Planner.
 * Interprets English, Bengali, or Banglish natural instructions and produces a typed
 * automation plan that executes projects, edits, solves, transportation, assignment,
 * sensitivity sweeps, batch queues, and UI navigation end-to-end.
 */
export async function planAiAutomation(
  instruction: string,
  context: AiAutomationContext,
): Promise<PlannedAiAutomation> {
  const fastPlan = tryFastInstantCommandPlan(instruction, context);
  if (fastPlan) {
    return fastPlan;
  }

  // Send compact context (no indentation whitespace or verbose descriptions) to minimize LLM input tokens
  const compactContext = {
    uiLanguage: context.uiLanguage,
    uiCurrency: context.uiCurrency || 'BDT',
    projects: context.projects.slice(0, 12),
    activeProject: context.activeProject
      ? {
          id: context.activeProject.id,
          name: context.activeProject.name,
          domain: context.activeProject.domain,
          hasRun: context.activeProject.hasRun,
          lastRunStatus: context.activeProject.lastRunStatus,
          lastRunObjective: context.activeProject.lastRunObjective,
          spec: {
            name: context.activeProject.spec.name,
            domain: context.activeProject.spec.domain,
            objective: context.activeProject.spec.objective,
            variables: context.activeProject.spec.variables.map((v) => ({
              name: v.name,
              lb: v.lb,
              ub: v.ub,
              type: v.type,
              unit: v.unit,
            })),
            constraints: context.activeProject.spec.constraints.map((c) => ({
              name: c.name,
              sense: c.sense,
              rhs: c.rhs,
              terms: c.terms,
            })),
          },
        }
      : null,
  };

  const response = await callGeminiWithRetry(
    {
      contents: `Instruction:\n"""\n${instruction}\n"""\nContext:\n${JSON.stringify(compactContext)}`,
      config: {
      systemInstruction: `You are "Syton AI", the Autonomous Operations Research AI of "Systonic Linear Desc", a bilingual (English + Bengali) Optimization-as-a-Service platform.
Interpret the user's instruction written in Bengali, Banglish (Bengali written in Latin script), or English, and produce the exact JSON action plan to automate the platform.
Respect the user's selected Capital Currency (${context.uiCurrency || 'BDT'}) when creating financial/capital values and explaining amounts (BDT = ৳ / Taka, USD = $ / Dollar).

Choose the single best actionType from:
1. "START_PROJECT_DISCOVERY": User asks to create/make/build a new project or optimization model (e.g. "Create a project", "Notun project banabo", "নতুন প্রজেক্ট তৈরি করতে চাই", "Build a project for my garment factory", "Ami ekti business project chai") WITHOUT supplying complete mathematical LP numbers, variable coefficients, and constraint limits. When chosen, Syton AI opens the 2-step guided intake form (Project Description, Category, Difficulty, Level, Quantity, Business Category, Sector) followed by Reasoning questions! Optionally populate "discoveryPrefill" if the user hinted a topic/sector.
2. "CREATE_AND_SOLVE_PROJECT": User ALREADY provides specific mathematical coefficients, limits, and numeric constraints in the prompt (e.g., profits, costs, resource caps, equations like "Shirt gives $50 profit (2 hrs labor)... Max labor is 200 hrs") OR explicitly says "build and solve immediately with numbers". Populate "modelSpec" completely and set targetTab="solve".
3. "UPDATE_AND_SOLVE_PROJECT": An activeProject exists AND user asks to modify/edit/update constraints, RHS limits, variable bounds, types, or objective coefficients (e.g., "labor 120 koro", "add demand constraint", "make variables integer", "x er profit 50 koro") and re-solve. Output the COMPLETE updated "modelSpec" (preserving untouched variables/constraints from activeProject.spec and applying requested edits) and set targetTab="solve". (If no activeProject exists and numbers are missing, use START_PROJECT_DISCOVERY instead.)
4. "SOLVE_ACTIVE_PROJECT": Active project exists and user simply says "solve koro", "run optimization", or "calculate optimal". Set targetTab="solve".
5. "EXPLAIN_OR_DEBUG_ACTIVE_RUN": Active project has a run and user asks "why optimal", "kono constraint bottleneck", "explain in Bangla", or "debug infeasible". Set targetTab="solve" (or "sensitivity" if infeasible).
6. "RUN_WHAT_IF_SWEEP": Active project exists and user asks to sweep/vary a constraint RHS or objective coefficient across a range (What-If / parametric sensitivity analysis). Populate "whatIfConfig" using an exact constraint or variable name from activeProject.spec, and set targetTab="compare", targetSubTab="whatif".
7. "RUN_TRANSPORTATION": User describes a factory-to-warehouse/supply-demand shipping cost minimization problem (LP-12 Transportation). Populate "transportationInput" cleanly and set targetTab="transport".
8. "RUN_ASSIGNMENT": User describes assigning N workers/agents/machines to tasks/jobs to minimize cost/time or maximize profit/score (LP-12 Hungarian Assignment). Populate "assignmentInput" cleanly and set targetTab="transport".
9. "RUN_BATCH_SOLVE": User gives multiple optimization problems to solve in one batch, or asks to run batch equations. Populate "batchItems" with algebraic LP equation strings (e.g. "Maximize Z = 40x + 30y\\n2x + y <= 100\\nx, y >= 0") and set targetTab="compare", targetSubTab="batch".
10. "DELETE_PROJECT": User explicitly asks to delete a project. Set "deleteProjectTarget" to the project ID or name.
11. "NAVIGATE_AND_CONFIGURE": User asks to switch language ("Bangla koro" / "Switch to English"), switch views/tabs (builder, solve, sensitivity, transport, compare), open New Project studio manually, or open Examples modal.

Important Rules:
- Always match replyLanguage ("bn" or "en") to the user's instruction language (Bengali or Banglish -> "bn"; English -> "en", unless the user explicitly requested a specific output language).
- For replyMessage, write a clear, friendly confirmation in Bengali (বাংলা) when replyLanguage="bn", or English when replyLanguage="en".
- Populate "reasoningSteps" with 3 to 5 concise, transparent step-by-step thought traces (1 short sentence each, matching replyLanguage) showing how you interpreted the instruction, identified variables/constraints/currency, and chose the exact action.
- For LP/MIP variable names in modelSpec, always use valid snake_case identifiers starting with a letter (e.g., x1, shirt, bond_a). Every variable in objectiveTerms and constraint terms MUST appear in variables.
- If the user's prompt specifies a quadratic objective term, include quadraticTerms; otherwise omit.
- Only populate the payload object relevant to the chosen actionType.

Return valid JSON matching this structure:
{
  "actionType": "START_PROJECT_DISCOVERY | CREATE_AND_SOLVE_PROJECT | UPDATE_AND_SOLVE_PROJECT | SOLVE_ACTIVE_PROJECT | EXPLAIN_OR_DEBUG_ACTIVE_RUN | RUN_WHAT_IF_SWEEP | RUN_TRANSPORTATION | RUN_ASSIGNMENT | RUN_BATCH_SOLVE | DELETE_PROJECT | NAVIGATE_AND_CONFIGURE",
  "replyLanguage": "en | bn",
  "replyMessage": "string",
  "reasoningSteps": ["step 1", "step 2", "step 3"],
  "targetLanguage": "en | bn | keep",
  "targetTab": "builder | solve | sensitivity | transport | compare | keep",
  "targetSubTab": "whatif | batch | keep",
  "openUiAction": "none | create_project | examples_modal",
  "discoveryPrefill": { "descriptionHint": "string", "category": "string", "businessCategory": "string", "sector": "string" },
  "commitMessage": "string",
  "deleteProjectTarget": "string",
  "modelSpec": {
    "name": "string", "domain": "Finance | Supply Chain | Operations | Portfolio | Risk & Credit | Custom", "description": "string",
    "objectiveSense": "max | min", "objectiveOffset": 0,
    "objectiveTerms": [{ "varName": "x1", "coef": 40 }],
    "variables": [{ "name": "x1", "lb": 0, "ub": null, "type": "continuous | integer | binary", "unit": "units", "description": "string" }],
    "constraints": [{ "name": "c1", "description": "string", "sense": "<= | >= | ==", "rhs": 100, "terms": [{ "varName": "x1", "coef": 2 }] }]
  },
  "whatIfConfig": { "targetType": "constraint_rhs | objective_coef", "targetName": "string", "minVal": 0, "maxVal": 100, "steps": 7 },
  "transportationInput": { "name": "string", "sources": ["S1"], "destinations": ["D1"], "supply": [10], "demand": [10], "costs": [[5]] },
  "assignmentInput": { "name": "string", "agents": ["A1"], "tasks": ["T1"], "sense": "min | max", "matrix": [[5]] },
  "batchItems": [{ "name": "string", "equations": "Maximize Z = 40x + 30y\\n2x + y <= 100\\nx, y >= 0" }]
}`,
      responseMimeType: 'application/json',
    },
  }, 'fast_lite');

  const rawText = (response.text ?? '{}').trim();
  const parsed = parseJsonSafely<{
    actionType: AiAutomationActionType;
    replyLanguage?: string;
    replyMessage?: string;
    targetLanguage?: string;
    targetTab?: string;
    targetSubTab?: string;
    openUiAction?: string;
    discoveryPrefill?: {
      descriptionHint?: string;
      category?: string;
      businessCategory?: string;
      sector?: string;
    };
    commitMessage?: string;
    deleteProjectTarget?: string;
    modelSpec?: RawGeminiModelSpec;
    whatIfConfig?: {
      targetType: string;
      targetName: string;
      minVal: number;
      maxVal: number;
      steps?: number;
    };
    transportationInput?: TransportationInput;
    assignmentInput?: {
      name?: string;
      agents: string[];
      tasks: string[];
      sense: string;
      matrix: number[][];
    };
    batchItems?: Array<{ name: string; equations: string }>;
    reasoningSteps?: string[];
  }>(rawText);

  const currency = context.uiCurrency === 'USD' ? 'USD' : 'BDT';
  const builtSpec = parsed.modelSpec ? normalizeGeminiModelSpec(parsed.modelSpec, currency) : undefined;

  const validTabs = new Set(['builder', 'solve', 'sensitivity', 'transport', 'compare']);
  const validSubTabs = new Set(['whatif', 'batch']);

  return {
    actionType: parsed.actionType || 'NAVIGATE_AND_CONFIGURE',
    replyLanguage: parsed.replyLanguage === 'bn' ? 'bn' : 'en',
    replyMessage: parsed.replyMessage || (context.uiLanguage === 'bn' ? 'নির্দেশনা অনুযায়ী কাজ সম্পন্ন হয়েছে।' : 'Automation completed.'),
    reasoningSteps: Array.isArray(parsed.reasoningSteps)
      ? parsed.reasoningSteps.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
      : undefined,
    targetLanguage: parsed.targetLanguage === 'en' || parsed.targetLanguage === 'bn' ? parsed.targetLanguage : undefined,
    targetTab: parsed.targetTab && validTabs.has(parsed.targetTab) ? (parsed.targetTab as PlannedAiAutomation['targetTab']) : undefined,
    targetSubTab:
      parsed.targetSubTab && validSubTabs.has(parsed.targetSubTab)
        ? (parsed.targetSubTab as PlannedAiAutomation['targetSubTab'])
        : undefined,
    openUiAction:
      parsed.openUiAction === 'create_project' || parsed.openUiAction === 'examples_modal'
        ? parsed.openUiAction
        : 'none',
    discoveryPrefill: parsed.discoveryPrefill,
    commitMessage: parsed.commitMessage,
    deleteProjectTarget: parsed.deleteProjectTarget,
    spec: builtSpec,
    whatIfConfig: parsed.whatIfConfig
      ? {
          targetType: parsed.whatIfConfig.targetType === 'objective_coef' ? 'objective_coef' : 'constraint_rhs',
          targetName: parsed.whatIfConfig.targetName,
          minVal: parsed.whatIfConfig.minVal,
          maxVal: parsed.whatIfConfig.maxVal,
          steps: Math.min(15, Math.max(3, Math.round(parsed.whatIfConfig.steps ?? 7))),
        }
      : undefined,
    transportationInput: parsed.transportationInput,
    assignmentInput: parsed.assignmentInput
      ? {
          ...parsed.assignmentInput,
          sense: parsed.assignmentInput.sense === 'max' ? 'max' : 'min',
        }
      : undefined,
    batchItems: parsed.batchItems,
  };
}

/**
 * Stage 2 of Syton AI Project Architect:
 * Takes Stage 1 intake (description, category, difficulty, level, quantity, businessCategory, sector)
 * and dynamically generates 4-5 targeted reasoning questions with clickable options
 * so the user can supply domain constraints before autonomous AI synthesis.
 */
export async function generateProjectReasoningQuestions(
  intake: ProjectDiscoveryIntake,
): Promise<ReasoningQuestionsResponse> {
  const isBn = intake.language === 'bn';
  const currencyLabel = intake.currency === 'USD' ? 'USD ($)' : 'BDT (৳ Taka)';

  const response = await callGeminiWithRetry({
    contents: `Generate tailored Optimization Reasoning Questions for this Stage-1 Project Brief:\n${JSON.stringify(intake)}`,
    config: {
      systemInstruction: `You are "Syton AI", Principal Operations Research & Quantitative Strategist of "Systonic Linear Desc".
The user has submitted their Stage-1 project brief:
- Project Description: ${intake.description}
- Optimization Category: ${intake.category}
- Difficulty: ${intake.difficulty}
- Level: ${intake.level}
- Quantity / Scale: ${intake.quantity}
- Business Category: ${intake.businessCategory}
- Sector: ${intake.sector}
- Capital Currency: ${currencyLabel}
- Response Language: ${isBn ? 'Bengali (বাংলা)' : 'English'}

Task: Ask 4 to 5 crisp, high-impact **Additional Reasoning Questions** to gather exact numerical & operational assumptions needed to build a realistic, mathematically feasible LP/MIP/QP project for them.
Guidelines:
1. Write "introMessage" and all questions, hints, options, and defaultAnswer in ${isBn ? 'natural, clear Bengali (বাংলা) using standard OR/business terms where helpful' : 'clear, crisp English'}.
2. Cover critical modeling dimensions tailored to "${intake.sector}" (${intake.businessCategory}):
   - Q1: Primary Goal & Unit Economics (profit margin or cost rate in ${currencyLabel})
   - Q2: Total Available Capital / Budget Limit in ${currencyLabel}
   - Q3: Key Operational Bottleneck (labor hours, machine capacity, warehouse space, vehicle count, or time horizon)
   - Q4: Demand / Market Bounds or Minimum Commitments aligned with Quantity="${intake.quantity}"
   - Q5: Variable Precision & Risk Rule (Continuous vs Whole Integer/Binary Go-No-Go decisions, or safety reserve %)
3. For each question, provide 3 to 4 realistic clickable option strings in "options" scaled appropriately for ${currencyLabel}, and set "defaultAnswer" to the most balanced realistic option.
4. Keep every question concise (1 sentence) and every option short (< 8 words) so they look crisp as selectable UI chips.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          introMessage: {
            type: Type.STRING,
            description: 'Short friendly message from Syton AI introducing the reasoning step',
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                hint: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                defaultAnswer: { type: Type.STRING },
              },
              required: ['id', 'question', 'options', 'defaultAnswer'],
            },
          },
        },
        required: ['introMessage', 'questions'],
      },
    },
  }, 'fast_lite');

  const rawText = (response.text ?? '{}').trim();
  const parsed = parseJsonSafely<{
    introMessage?: string;
    questions?: Array<{
      id?: string;
      question?: string;
      hint?: string;
      options?: string[];
      defaultAnswer?: string;
    }>;
  }>(rawText);

  const questions = (parsed.questions || [])
    .filter((q) => Boolean(q.question && q.question.trim()))
    .slice(0, 6)
    .map((q, idx) => {
      const options = (q.options || []).filter(Boolean).slice(0, 5);
      return {
        id: q.id || `q_${idx + 1}`,
        question: q.question!.trim(),
        hint: q.hint?.trim() || undefined,
        options,
        defaultAnswer: q.defaultAnswer?.trim() || options[0] || '',
      };
    });

  return {
    introMessage:
      parsed.introMessage?.trim() ||
      (isBn
        ? 'চমৎকার! প্রজেক্টটি নির্ভুলভাবে বিশ্লেষণ ও তৈরি করার জন্য নিচের অতিরিক্ত প্রশ্নগুলোর উত্তর সিলেক্ট বা টাইপ করুন:'
        : 'Great brief! Answer or select these reasoning inputs so I can analyze the trade-offs and architect your optimization project:'),
    questions,
  };
}

/**
 * Stage 3 of Syton AI Project Architect:
 * Analyzes Stage 1 intake + Stage 2 reasoning answers, synthesizes a mathematically feasible,
 * domain-calibrated ModelSpec + structured AI analysis summary, ready to save and solve with HiGHS.
 */
export async function analyzeAndBuildProjectFromIntake(
  intake: ProjectDiscoveryIntake,
  answers: ReasoningAnswerItem[],
): Promise<{
  analysisSummary: string;
  reasoningSteps: string[];
  replyMessage: string;
  commitMessage: string;
  spec: ModelSpec;
}> {
  const isBn = intake.language === 'bn';
  const currencyLabel = intake.currency === 'USD' ? 'USD ($)' : 'BDT (৳ Taka)';

  const response = await callGeminiWithRetry({
    contents: `Stage-1 Brief:\n${JSON.stringify(intake)}\nGoal & Scope:\n${JSON.stringify(answers)}\nSynthesize a FEASIBLE optimization specification.`,
    config: {
      systemInstruction: `You are "Syton AI", Autonomous Operations Research Architect of "Systonic Linear Desc".
You have collected BOTH Stage-1 Project Brief and Stage-2 Reasoning Answers from the user.
Now perform rigorous quantitative analysis and synthesize a complete, strictly FEASIBLE, non-trivial mathematical LP/MIP/QP project.

Critical Mathematical & Modeling Rules:
1. Respect Capital Currency = ${currencyLabel} for all cost, budget, and profit coefficients.
2. Respect Language = ${isBn ? 'Bengali (বাংলা)' : 'English'} for "reasoningSteps", "analysisSummary", "replyMessage", "commitMessage", model description, and variable/constraint business descriptions.
3. Align decision variable count with Quantity="${intake.quantity}" (e.g., 2-3 vars for Small, 4-5 vars for Medium, 6-8 vars for Large) and complexity with Difficulty="${intake.difficulty}" / Level="${intake.level}".
4. **GUARANTEE FEASIBILITY**: Double-check your constraints! For instance, ensure lower bounds (or >= minimum demand constraints) do NOT exceed budget or capacity <= RHS limits. Every constraint MUST have realistic positive slack headroom so HiGHS finds an OPTIMAL (not infeasible and not trivial 0) solution!
5. Variable names MUST be lowercase snake_case alphanumeric starting with a letter (e.g. shirt_prod, raw_jute, express_route). Every variable in objectiveTerms and constraint terms MUST exist in variables.
6. Set valid "domain" strictly from: "Finance", "Supply Chain", "Operations", "Portfolio", "Risk & Credit", "Custom".
7. Populate "reasoningSteps" with 3 to 4 crisp step-by-step reasoning statements showing how you analyzed Sector ("${intake.sector}"), Currency (${currencyLabel}), Variables, Constraints, and verified Feasibility.
8. In "analysisSummary", write a concise 3-bullet breakdown explaining how Sector ("${intake.sector}"), Business Category ("${intake.businessCategory}"), Budget, and Scope mapped into decision variables, objective function, and constraints.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reasoningSteps: {
            type: Type.ARRAY,
            description: '3 to 4 crisp sequential thought steps in user language tracing how the model was designed & checked',
            items: { type: Type.STRING },
          },
          analysisSummary: {
            type: Type.STRING,
            description: 'Concise AI reasoning breakdown in user language explaining assumptions, variable choices, and constraints',
          },
          replyMessage: {
            type: Type.STRING,
            description: 'Concise confirmation message from Syton AI announcing the built & solved project',
          },
          commitMessage: { type: Type.STRING },
          modelSpec: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              domain: { type: Type.STRING },
              description: { type: Type.STRING },
              objectiveSense: { type: Type.STRING, description: '"max" or "min"' },
              objectiveOffset: { type: Type.NUMBER },
              objectiveTerms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    varName: { type: Type.STRING },
                    coef: { type: Type.NUMBER },
                  },
                  required: ['varName', 'coef'],
                },
              },
              quadraticTerms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    var1: { type: Type.STRING },
                    var2: { type: Type.STRING },
                    coef: { type: Type.NUMBER },
                  },
                  required: ['var1', 'var2', 'coef'],
                },
              },
              variables: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    lb: { type: Type.NUMBER, nullable: true },
                    ub: { type: Type.NUMBER, nullable: true },
                    type: { type: Type.STRING, description: '"continuous", "integer", or "binary"' },
                    unit: { type: Type.STRING },
                    group: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ['name', 'type'],
                },
              },
              constraints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    sense: { type: Type.STRING, description: '"<=", ">=", or "=="' },
                    rhs: { type: Type.NUMBER },
                    terms: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          varName: { type: Type.STRING },
                          coef: { type: Type.NUMBER },
                        },
                        required: ['varName', 'coef'],
                      },
                    },
                  },
                  required: ['name', 'sense', 'rhs', 'terms'],
                },
              },
            },
            required: ['name', 'objectiveSense', 'objectiveTerms', 'variables', 'constraints'],
          },
        },
        required: ['analysisSummary', 'replyMessage', 'modelSpec'],
      },
    },
  }, 'fast_lite');

  const rawText = (response.text ?? '{}').trim();
  const parsed = parseJsonSafely<{
    reasoningSteps?: string[];
    analysisSummary: string;
    replyMessage: string;
    commitMessage?: string;
    modelSpec: RawGeminiModelSpec;
  }>(rawText);

  const currency = intake.currency === 'USD' ? 'USD' : 'BDT';
  const spec = normalizeGeminiModelSpec(
    parsed.modelSpec,
    currency,
    `${intake.sector} Optimization Model`,
  );

  const defaultReasoningSteps = isBn
    ? [
        `১. "${intake.sector}" সেক্টর ও "${intake.category}" ক্যাটাগরির ব্যবসায়িক চাহিদা বিশ্লেষণ`,
        `২. "${intake.quantity}" স্কেল অনুযায়ী ${spec.variables.length}টি ডিসিশন ভেরিয়েবল নির্ধারণ`,
        `৩. ${currencyLabel} বাজেট ও ${spec.constraints.length}টি সীমাবদ্ধতার ফিজিবিলিটি যাচাই`,
        `৪. HiGHS WASM ইঞ্জিনের জন্য গাণিতিক মডেল প্রস্তুতকরণ`,
      ]
    : [
        `Analyzed "${intake.sector}" sector and "${intake.category}" objective scope`,
        `Formulated ${spec.variables.length} decision variables calibrated for "${intake.quantity}"`,
        `Validated ${spec.constraints.length} operational & ${currencyLabel} budget constraints for strict feasibility`,
        `Compiled LP/MIP specification for HiGHS WASM optimization`,
      ];

  const reasoningSteps =
    Array.isArray(parsed.reasoningSteps) && parsed.reasoningSteps.length > 0
      ? parsed.reasoningSteps.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
      : defaultReasoningSteps;

  return {
    analysisSummary: parsed.analysisSummary?.trim() || '',
    reasoningSteps,
    replyMessage:
      parsed.replyMessage?.trim() ||
      (isBn
        ? `"${spec.name}" প্রজেক্টটি বিশ্লেষণ করে তৈরি ও সমাধান করা হয়েছে।`
        : `Analyzed your requirements, created "${spec.name}", and solved it with HiGHS.`),
    commitMessage: parsed.commitMessage?.trim() || 'Synthesized by Syton AI Guided Reasoning',
    spec,
  };
}

