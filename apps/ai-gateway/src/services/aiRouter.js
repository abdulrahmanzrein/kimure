const {
  getMockToolResponse
} = require('./mockAiService');
const {
  createAiResponse
} = require('../utils/responseContract');
const {
  generateGeminiChatResponse,
  MissingGeminiApiKeyError
} = require('./geminiService');

const MIN_MEANINGFUL_SCORE = 3;
const ROUTER_PROMPT_VERSION = 'phase1-gem-router-v1';

const TOOL_PRIORITY = [
  'valuate',
  'scout',
  'rental',
  'investment-planner',
  'mortgage',
  'credit-profile',
  'analyze'
];

const INTENT_SIGNALS = {
  mortgage: [
    signal('afford', 9),
    signal('affordability', 8),
    signal('mortgage', 7),
    signal('pre approval', 7),
    signal('borrow', 9),
    signal('down payment', 7),
    signal('payment', 4),
    signal('monthly payment', 8),
    signal('interest rate', 6),
    signal('can i buy', 8),
    signal('price range', 6),
    signal('loan', 4),
    signal('550k', 3)
  ],
  analyze: [
    signal('investment', 6),
    signal('roi', 10),
    signal('return', 6),
    signal('cash flow', 8),
    signal('cap rate', 8),
    signal('duplex', 7),
    signal('triplex', 7),
    signal('profitable', 8),
    signal('rental income', 8),
    signal('expense', 5),
    signal('expenses', 5),
    signal('deal', 6),
    signal('good investment', 10),
    signal('property analysis', 7),
    signal('analyze', 6)
  ],
  scout: [
    signal('find me homes', 15),
    signal('find me houses', 15),
    signal('find me listings', 15),
    signal('find me properties', 15),
    signal('show me homes', 13),
    signal('show me houses', 13),
    signal('show me listings', 13),
    signal('show me properties', 13),
    signal('looking for', 8),
    signal('find', 5),
    signal('search', 5),
    signal('show me', 5),
    signal('homes', 6),
    signal('houses', 6),
    signal('listings', 7),
    signal('properties', 5),
    signal('under', 5),
    signal('budget', 5),
    signal('ottawa', 5),
    signal('toronto', 5),
    signal('gatineau', 5),
    signal('bedrooms', 5),
    signal('match', 6),
    signal('matches', 6)
  ],
  valuate: [
    signal('overpriced', 16),
    signal('fair offer', 13),
    signal('value', 7),
    signal('valuation', 8),
    signal('market price', 9),
    signal('appraisal', 8),
    signal('compare', 5),
    signal('worth', 8),
    signal('price too high', 13),
    signal('priced too high', 13),
    signal('too expensive', 9)
  ],
  rental: [
    signal('airbnb', 16),
    signal('short term rental', 13),
    signal('nightly rate', 10),
    signal('occupancy', 9),
    signal('near transit', 8),
    signal('rental', 8),
    signal('rent', 6),
    signal('lease', 7),
    signal('tenant', 7),
    signal('tenants', 7),
    signal('rental property', 8)
  ],
  'credit-profile': [
    signal('credit', 8),
    signal('score', 6),
    signal('debt', 7),
    signal('financially ready', 12),
    signal('readiness', 9),
    signal('qualify', 8),
    signal('profile', 6),
    signal('income', 5),
    signal('savings', 6),
    signal('affordability profile', 12),
    signal('buyer readiness', 12),
    signal('ready to buy', 9)
  ],
  'investment-planner': [
    signal('5 year plan', 16),
    signal('five year plan', 16),
    signal('5 year investment plan', 18),
    signal('five year investment plan', 18),
    signal('strategy', 12),
    signal('roadmap', 11),
    signal('portfolio', 10),
    signal('grow', 9),
    signal('long term', 8),
    signal('plan', 6),
    signal('risk tolerance', 10),
    signal('goals', 8)
  ]
};

function signal(phrase, weight) {
  return {
    phrase,
    weight
  };
}

function normalizeMessage(message) {
  return String(message || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9$\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSignal(phrase) {
  return normalizeMessage(phrase);
}

function hasSignal(normalizedMessage, normalizedSignal) {
  const escapedSignal = escapeRegExp(normalizedSignal).replace(/\s+/g, '\\s+');
  const regex = new RegExp(`(^|\\s)${escapedSignal}(?=\\s|$)`);

  return regex.test(normalizedMessage);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreIntent(normalizedMessage) {
  return Object.entries(INTENT_SIGNALS).reduce((result, [tool, signals]) => {
    const matchedSignals = signals.filter((item) => {
      return hasSignal(normalizedMessage, normalizeSignal(item.phrase));
    });

    result.intentScores[tool] = matchedSignals.reduce((score, item) => {
      return score + item.weight;
    }, 0);

    result.matchedSignals[tool] = matchedSignals.map((item) => ({
      phrase: item.phrase,
      weight: item.weight
    }));

    return result;
  }, {
    intentScores: {},
    matchedSignals: {}
  });
}

function pickHighestScoringTool(intentScores) {
  const ranked = Object.entries(intentScores).sort(([toolA, scoreA], [toolB, scoreB]) => {
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    return TOOL_PRIORITY.indexOf(toolA) - TOOL_PRIORITY.indexOf(toolB);
  });

  const [tool, score] = ranked[0] || ['chat', 0];

  return score >= MIN_MEANINGFUL_SCORE ? tool : 'chat';
}

function getIntentRoutingDetails(message) {
  const normalizedMessage = normalizeMessage(message);
  const {
    intentScores,
    matchedSignals
  } = scoreIntent(normalizedMessage);
  const routedTool = pickHighestScoringTool(intentScores);

  return {
    routedTool,
    receivedMessage: message,
    normalizedMessage,
    intentScores,
    matchedSignals
  };
}

function createFallbackChatResponse(message, routingDetails, error) {
  const dedicatedRoute = getDedicatedRoute(routingDetails.routedTool);

  return createAiResponse({
    status: 'success',
    tool: routingDetails.routedTool,
    resultType: 'router_fallback',
    summary: routingDetails.routedTool === 'chat'
      ? 'Ask Kimure AI could not reach Gemini. Provide more context or retry the general question.'
      : `Ask Kimure AI identified ${routingDetails.routedTool} as the likely tool, but Gemini was unavailable. Use ${dedicatedRoute} with structured inputs for the dedicated assessment.`,
    score: null,
    riskLevel: 'unknown',
    keyInsights: [
      'No live Gemini specialist response was generated.',
      'No provider, listing, appraisal, mortgage approval, credit verification, or investment result is being claimed.',
      `Deterministic routing selected ${routingDetails.routedTool}.`
    ],
    recommendations: routingDetails.routedTool === 'chat'
      ? ['Retry the request or add the property, financial, location, budget, and goal context needed to select a dedicated tool.']
      : [`Call ${dedicatedRoute} with the structured inputs required by that tool.`],
    reportData: {
      ...routingDetails,
      dedicatedRoute,
      routingAction: routingDetails.routedTool === 'chat' ? 'answer_general_or_clarify' : 'recommend_dedicated_route',
      geminiMode: 'structured_router_fallback',
      promptVersion: ROUTER_PROMPT_VERSION,
      fallbackReason: error && error.message ? error.message : 'Gemini request failed'
    },
    crmSignals: {
      leadIntent: routingDetails.routedTool === 'chat' ? 'general_ai_question' : `${routingDetails.routedTool}_handoff`,
      suggestedFollowUp: routingDetails.routedTool === 'chat'
        ? 'Collect enough context to select a dedicated Kimure tool.'
        : `Continue through ${dedicatedRoute} with structured intake data.`
    },
    disclaimer: 'Gemini was unavailable, so this response contains routing guidance only and no specialist assessment or verified provider result.'
  });
}

function createMissingKeyResponse(message, routingDetails) {
  return createAiResponse({
    status: 'error',
    tool: 'chat',
    resultType: 'configuration_error',
    summary: 'GEMINI_API_KEY is missing from the backend environment. Add it to .env and restart the gateway.',
    score: null,
    riskLevel: 'unknown',
    keyInsights: [
      'The /ai/chat route is configured for Gemini-backed responses.',
      'Gemini keys must stay in the backend .env file only.',
      'Frontend clients should call this gateway and should never call Gemini directly.'
    ],
    recommendations: [
      'Create a local .env file from .env.example.',
      'Set GEMINI_API_KEY in the backend environment.',
      'Restart the Kimure AI Gateway server.'
    ],
    reportData: {
      ...routingDetails,
      dedicatedRoute: getDedicatedRoute(routingDetails.routedTool),
      routingAction: routingDetails.routedTool === 'chat' ? 'answer_general_or_clarify' : 'recommend_dedicated_route',
      geminiMode: 'configuration_error',
      promptVersion: ROUTER_PROMPT_VERSION,
      configurationError: 'missing_gemini_api_key',
      receivedPayload: {
        message
      }
    },
    crmSignals: {
      leadIntent: 'backend_configuration',
      suggestedFollowUp: 'Add GEMINI_API_KEY to backend .env before using Gemini-backed chat.'
    },
    disclaimer: 'Backend configuration error. Do not expose Gemini/API keys in frontend code.'
  });
}

async function routeChatMessage(message) {
  const routingDetails = getIntentRoutingDetails(message);

  try {
    return await generateGeminiChatResponse({
      message,
      routingDetails
    });
  } catch (error) {
    if (error instanceof MissingGeminiApiKeyError) {
      return createMissingKeyResponse(message, routingDetails);
    }

    return createFallbackChatResponse(message, routingDetails, error);
  }
}

function routeMockChatMessage(message) {
  const routingDetails = getIntentRoutingDetails(message);
  const response = getMockToolResponse(routingDetails.routedTool, {
    message
  });

  return {
    ...response,
    reportData: {
      ...response.reportData,
      ...routingDetails,
      dedicatedRoute: getDedicatedRoute(routingDetails.routedTool),
      routingAction: routingDetails.routedTool === 'chat' ? 'answer_general_or_clarify' : 'recommend_dedicated_route',
      promptVersion: ROUTER_PROMPT_VERSION
    }
  };
}

function getDedicatedRoute(tool) {
  const routes = {
    mortgage: '/ai/mortgage',
    analyze: '/ai/analyze',
    scout: '/ai/scout',
    valuate: '/ai/valuate',
    rental: '/ai/rental',
    'credit-profile': '/ai/credit-profile',
    'investment-planner': '/ai/investment-planner',
    chat: '/ai/chat'
  };

  return routes[tool] || '/ai/chat';
}

function getToolResponse(tool, payload) {
  return getMockToolResponse(tool, payload);
}

module.exports = {
  routeChatMessage,
  routeMockChatMessage,
  getToolResponse
};

