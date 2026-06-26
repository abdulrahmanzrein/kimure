const {
  createAiResponse
} = require('../utils/responseContract');
const {
  generateGeminiStructuredJson,
  MissingGeminiApiKeyError
} = require('./geminiService');
const {
  getMockToolResponse
} = require('./mockAiService');

const RECOMMENDATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING' },
    tool: {
      type: 'STRING',
      enum: [
        'scout',
        'analyze',
        'rental',
        'valuate',
        'investment-planner'
      ]
    },
    resultType: { type: 'STRING' },
    summary: { type: 'STRING' },
    score: { type: 'NUMBER' },
    riskLevel: { type: 'STRING' },
    keyInsights: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    recommendations: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    reportData: {
      type: 'OBJECT',
      properties: {
        assumptions: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        nextBestActions: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        }
      }
    },
    crmSignals: {
      type: 'OBJECT',
      properties: {
        leadIntent: { type: 'STRING' },
        suggestedFollowUp: { type: 'STRING' }
      }
    },
    disclaimer: { type: 'STRING' }
  },
  required: [
    'status',
    'tool',
    'resultType',
    'summary',
    'score',
    'riskLevel',
    'keyInsights',
    'recommendations',
    'reportData',
    'crmSignals',
    'disclaimer'
  ]
};

async function createStructuredRecommendation({
  tool,
  payload,
  promptVersion,
  systemPrompt
}) {
  try {
    const parsed = await generateGeminiStructuredJson({
      systemPrompt,
      userPrompt: buildUserPrompt(payload),
      responseSchema: RECOMMENDATION_SCHEMA,
      maxOutputTokens: 1600,
      temperature: 0.2,
      allowProse: true
    });
    const parseMode = parsed.__kimureParseMode || 'json';
    const httpStatus = Number.isInteger(parsed.__kimureHttpStatus)
      ? parsed.__kimureHttpStatus
      : null;
    const normalized = normalizeResponse(parsed, {
      tool,
      promptVersion,
      source: 'gemini',
      geminiMode: 'live',
      parseMode
    });
    if (!isUsableRecommendation(normalized)) {
      throw new Error('Gemini recommendation was unusable after normalization');
    }

    console.info('[kimure:recommendation] normalized', {
      tool,
      source: 'gemini',
      fallbackUsed: false,
      fallbackMode: null,
      parseMode,
      httpStatus
    });
    return normalized;
  } catch (error) {
    const fallback = getMockToolResponse(tool);
    const fallbackMode = error instanceof MissingGeminiApiKeyError
      ? 'missing_api_key'
      : 'gemini_error';
    const normalized = normalizeResponse(fallback, {
      tool,
      promptVersion,
      source: 'fallback',
      geminiMode: fallbackMode,
      parseMode: null
    });
    console.info('[kimure:recommendation] normalized', {
      tool,
      source: 'fallback',
      fallbackUsed: true,
      fallbackMode,
      parseMode: null,
      httpStatus: Number.isInteger(error.httpStatus) ? error.httpStatus : null
    });
    return normalized;
  }
}

function buildUserPrompt(payload) {
  return [
    'Create a personalized Kimure recommendation from this structured onboarding request.',
    'Use only the supplied information. Do not invent listings, live provider data, verified credit, lender approval, or guaranteed returns.',
    'Return practical next actions in reportData.nextBestActions.',
    JSON.stringify(sanitizePromptPayload(payload), null, 2)
  ].join('\n\n');
}

function sanitizePromptPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};

  return {
    question: safeString(source.question),
    onboarding: safeObject(source.onboarding),
    financials: safeObject(source.financials),
    goals: safeStringArray(source.goals),
    filters: safeObject(source.filters),
    property: safeObject(source.property),
    context: safeObject(source.context),
    metadata: safeObject(source.metadata),
    consent: source.consent === true
  };
}

function normalizeResponse(value, metadata) {
  const source = isPlainObject(value) ? value : {};
  const reportData = safeObject(source.reportData);
  const crmSignals = safeObject(source.crmSignals);
  const summary = safeString(source.summary);
  let keyInsights = safeStringArray(source.keyInsights);
  let recommendations = safeStringArray(source.recommendations);
  const nextBestActions = safeStringArray(reportData.nextBestActions);
  if (!keyInsights.length && !recommendations.length && !nextBestActions.length && summary) {
    keyInsights = [summary];
    recommendations = [
      'Use this recommendation as a starting point and confirm missing details before acting.'
    ];
  }

  const normalizedNextSteps = nextBestActions.length
    ? nextBestActions
    : recommendations.slice(0, 5);
  const response = createAiResponse({
    status: source.status === 'error' ? 'error' : 'success',
    tool: metadata.tool,
    resultType: safeString(source.resultType) || `${metadata.tool}_recommendation`,
    summary,
    score: safeNumber(source.score),
    riskLevel: safeString(source.riskLevel) || 'unknown',
    keyInsights,
    recommendations,
    reportData: {
      source: metadata.source,
      geminiMode: metadata.geminiMode,
      parseMode: metadata.parseMode,
      promptVersion: metadata.promptVersion,
      assumptions: safeStringArray(reportData.assumptions),
      nextBestActions: normalizedNextSteps
    },
    crmSignals: {
      leadIntent: safeString(crmSignals.leadIntent),
      suggestedFollowUp: safeString(crmSignals.suggestedFollowUp)
    },
    disclaimer: metadata.source === 'fallback'
      ? 'This recommendation uses available platform signals and is informational only. It is not financial, legal, tax, mortgage, appraisal, or credit advice.'
      : safeString(source.disclaimer) ||
        'This recommendation is informational and is not financial, legal, tax, mortgage, appraisal, or credit advice.'
  });

  return {
    ...response,
    source: metadata.source,
    nextSteps: normalizedNextSteps
  };
}

function isUsableRecommendation(response) {
  return Boolean(
    response &&
    response.status === 'success' &&
    typeof response.summary === 'string' &&
    response.summary.trim() &&
    (
      response.keyInsights.length ||
      response.recommendations.length ||
      response.reportData.nextBestActions.length
    )
  );
}

function safeObject(value) {
  return isPlainObject(value) ? value : {};
}

function safeString(value) {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : '';
}

function safeStringArray(value) {
  return Array.isArray(value)
    ? value
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim().slice(0, 1000))
      .slice(0, 20)
    : [];
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  createStructuredRecommendation
};
