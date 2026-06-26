const assert = require('node:assert/strict');
const {
  createScoutRecommendation
} = require('../src/services/scoutService');
const {
  createInvestmentPlan
} = require('../src/services/investmentPlannerService');
const {
  createPropertyEvaluation
} = require('../src/services/propertyEvaluatorService');
const {
  createRentalRecommendation
} = require('../src/services/rentalFinderService');
const {
  routeChatMessage
} = require('../src/services/aiRouter');

async function run() {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  try {
    process.env.GEMINI_API_KEY = 'test-only-not-a-real-key';
    await checkJsonResponse();
    await checkFencedJsonResponse();
    await checkExtractedJsonResponse();
    await checkProseResponse();
    await checkEvaluatorJsonResponse();
    await checkRentalJsonResponse();
    await checkChatJsonResponse();
    await checkRateLimitFallback();
    await checkFailureFallback();
    console.log('[PASS] Recommendation parsing and fallback checks (9 modes)');
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    global.fetch = originalFetch;
  }
}

async function checkJsonResponse() {
  global.fetch = buildGeminiFetch(JSON.stringify(buildGeminiJson()));
  const response = await createInvestmentPlan(buildPayload());

  assertGeminiResponse(response, 'investment-planner', 'json');
  assert.equal(response.summary, 'A measured investment plan fits the supplied goals.');
  assert.deepEqual(response.reportData.nextBestActions, ['Confirm the target market.']);
}

async function checkFencedJsonResponse() {
  global.fetch = buildGeminiFetch(
    `Here is the recommendation:\n\`\`\`json\n${JSON.stringify(buildGeminiJson({
      tool: 'scout',
      resultType: 'property_match_recommendation',
      summary: 'The selected location and budget support a focused property search.'
    }))}\n\`\`\``
  );
  const response = await createScoutRecommendation(buildPayload());

  assertGeminiResponse(response, 'scout', 'fenced_json');
  assert.equal(response.summary, 'The selected location and budget support a focused property search.');
}

async function checkProseResponse() {
  global.fetch = buildGeminiFetch([
    'Your budget and Ottawa location support a focused townhouse search.',
    '',
    'Key insights:',
    '- Prioritize carrying costs as well as purchase price.',
    '- Keep location flexibility around transit corridors.',
    '',
    'Recommendations:',
    '- Compare neighbourhood inventory before booking tours.',
    '- Confirm must-have property features.',
    '',
    'Next steps:',
    '1. Review current listings within the selected budget.',
    '2. Refine location and property filters.',
    '',
    'Disclaimer:',
    'This is informational property guidance and not a guarantee of availability.'
  ].join('\n'));
  const response = await createScoutRecommendation(buildPayload());

  assertGeminiResponse(response, 'scout', 'prose_normalized');
  assert.ok(response.keyInsights.length >= 1);
  assert.ok(response.recommendations.length >= 1);
  assert.ok(response.reportData.nextBestActions.length >= 1);
}

async function checkExtractedJsonResponse() {
  global.fetch = buildGeminiFetch(
    `Recommendation follows.\n${JSON.stringify(buildGeminiJson({
      tool: 'scout',
      resultType: 'property_match_recommendation',
      summary: 'A focused search is appropriate for the supplied budget.'
    }))}\nUse these results as informational guidance.`
  );
  const response = await createScoutRecommendation(buildPayload());

  assertGeminiResponse(response, 'scout', 'extracted_json');
  assert.equal(response.summary, 'A focused search is appropriate for the supplied budget.');
}

async function checkFailureFallback() {
  global.fetch = async () => {
    throw new Error('simulated network failure');
  };
  const response = await createInvestmentPlan(buildPayload());

  assert.equal(response.status, 'success');
  assert.equal(response.tool, 'investment-planner');
  assert.equal(response.reportData.source, 'fallback');
  assert.equal(response.source, 'fallback');
  assert.equal(response.reportData.geminiMode, 'gemini_error');
  assert.equal(response.reportData.parseMode, null);
  assert.equal('receivedPayload' in response.reportData, false);
}

async function checkEvaluatorJsonResponse() {
  global.fetch = buildGeminiFetch(JSON.stringify(buildGeminiJson({
    tool: 'valuate',
    resultType: 'property_value_recommendation',
    summary: 'The supplied details support a directional value review.'
  })));
  const response = await createPropertyEvaluation(buildPayload());

  assertGeminiResponse(response, 'valuate', 'json');
  assert.equal(response.summary, 'The supplied details support a directional value review.');
}

async function checkRentalJsonResponse() {
  global.fetch = buildGeminiFetch(JSON.stringify(buildGeminiJson({
    tool: 'rental',
    resultType: 'rental_match_recommendation',
    summary: 'The supplied budget supports a focused rental search.'
  })));
  const response = await createRentalRecommendation(buildPayload());

  assertGeminiResponse(response, 'rental', 'json');
  assert.equal(response.summary, 'The supplied budget supports a focused rental search.');
}

async function checkRateLimitFallback() {
  global.fetch = async () => ({
    ok: false,
    status: 429
  });
  const response = await createPropertyEvaluation(buildPayload());

  assert.equal(response.status, 'success');
  assert.equal(response.tool, 'valuate');
  assert.equal(response.source, 'fallback');
  assert.equal(response.reportData.source, 'fallback');
  assert.equal(response.reportData.geminiMode, 'gemini_error');
}

async function checkChatJsonResponse() {
  global.fetch = buildGeminiFetch(JSON.stringify(buildGeminiJson({
    tool: 'scout',
    resultType: 'gemini_chat_response',
    summary: 'A focused property search is the best next step.'
  })));
  const response = await routeChatMessage('Help me find a home in Ottawa.');

  assert.equal(response.status, 'success');
  assert.equal(response.tool, 'scout');
  assert.equal(response.reportData.source, 'gemini');
  assert.equal(response.reportData.geminiMode, 'live');
  assert.equal(response.reportData.parseMode, 'json');
}

function assertGeminiResponse(response, tool, parseMode) {
  assert.equal(response.status, 'success');
  assert.equal(response.tool, tool);
  assert.equal(response.reportData.source, 'gemini');
  assert.equal(response.source, 'gemini');
  assert.equal(response.reportData.geminiMode, 'live');
  assert.equal(response.reportData.parseMode, parseMode);
  assert.equal('receivedPayload' in response.reportData, false);
  assert.deepEqual(response.nextSteps, response.reportData.nextBestActions);
}

function buildGeminiFetch(text) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ text }]
        }
      }]
    })
  });
}

function buildGeminiJson(overrides = {}) {
  return {
    status: 'success',
    tool: 'investment-planner',
    resultType: 'investment_plan_recommendation',
    summary: 'A measured investment plan fits the supplied goals.',
    score: 76,
    riskLevel: 'medium',
    keyInsights: ['Protect liquidity before acquiring.'],
    recommendations: ['Define conservative acquisition criteria.'],
    reportData: {
      assumptions: ['Inputs are self-reported.'],
      nextBestActions: ['Confirm the target market.']
    },
    crmSignals: {
      leadIntent: 'investment_planning',
      suggestedFollowUp: 'Review the plan with an advisor.'
    },
    disclaimer: 'Informational planning guidance only.',
    ...overrides
  };
}

function buildPayload() {
  return {
    question: 'Recommend my next step.',
    onboarding: {
      intent: 'investing',
      budgetMin: 500000,
      budgetMax: 750000,
      timeline: '6mo'
    },
    financials: {
      availableFunds: 100000
    },
    goals: ['investing'],
    filters: {
      city: 'Ottawa',
      country: 'Canada'
    },
    property: {
      types: ['house']
    },
    context: {},
    metadata: {
      source: 'contract-check'
    },
    consent: false
  };
}

run().catch((error) => {
  console.error('[FAIL] Recommendation source checks');
  console.error(error);
  process.exitCode = 1;
});
