const {
  createAiResponse
} = require('../utils/responseContract');

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CHAT_PROMPT_VERSION = 'phase1-gem-router-v1';
const DEFAULT_DISCLAIMER = 'Kimure AI can provide educational real estate, financing, and investment guidance, but this is not financial, legal, tax, mortgage, appraisal, or credit advice.';

class MissingGeminiApiKeyError extends Error {
  constructor() {
    super('GEMINI_API_KEY is missing from the backend environment');
    this.name = 'MissingGeminiApiKeyError';
  }
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: {
      type: 'STRING'
    },
    tool: {
      type: 'STRING',
      enum: [
        'chat',
        'mortgage',
        'analyze',
        'scout',
        'valuate',
        'rental',
        'credit-profile',
        'investment-planner'
      ]
    },
    resultType: {
      type: 'STRING'
    },
    summary: {
      type: 'STRING'
    },
    score: {
      type: 'NUMBER'
    },
    riskLevel: {
      type: 'STRING'
    },
    keyInsights: {
      type: 'ARRAY',
      items: {
        type: 'STRING'
      }
    },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'STRING'
      }
    },
    reportData: {
      type: 'OBJECT',
      properties: {
        routedTool: {
          type: 'STRING'
        },
        receivedMessage: {
          type: 'STRING'
        },
        dedicatedRoute: {
          type: 'STRING'
        },
        routingAction: {
          type: 'STRING'
        },
        assumptions: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        missingInformation: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        nextBestActions: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        }
      }
    },
    crmSignals: {
      type: 'OBJECT',
      properties: {
        leadIntent: {
          type: 'STRING'
        },
        suggestedFollowUp: {
          type: 'STRING'
        }
      }
    },
    disclaimer: {
      type: 'STRING'
    }
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
  ],
  propertyOrdering: [
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

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

function buildKimureSystemPrompt() {
  return [
    `You are Ask Kimure AI, the central assistant/router using prompt ${CHAT_PROMPT_VERSION}.`,
    'Your primary job is to route clear requests to one dedicated Kimure tool: mortgage, analyze, scout, valuate, rental, credit-profile, investment-planner, or chat.',
    'Treat the backend deterministic routing hint as authoritative when routedTool is not chat. Do not reclassify a clear routed intent into general chat.',
    'Use credit-profile for buyer/credit readiness, investment-planner for portfolio strategy, mortgage for affordability, scout for property discovery/matching, analyze for deal quality, valuate for fair-value questions, and rental for rental search/suitability.',
    'Do not become one giant specialist chatbot. For a dedicated-tool intent, give a concise routing-aware response, identify missing inputs, and recommend the dedicated route rather than pretending a full specialist analysis ran.',
    'Use chat only for genuinely unclear/general questions. Ask concise clarifying questions when multiple tools could apply.',
    'Return only structured JSON matching the provided schema. Do not return markdown, code fences, or plain prose outside JSON.',
    'Be helpful, concise, and practical for Canadian real estate users when the location is unclear.',
    'Clearly label assumptions in reportData.assumptions.',
    'Do not claim to provide verified credit bureau results, official credit scores, certified appraisals, legal advice, tax advice, mortgage approvals, or guaranteed investment outcomes.',
    'For credit/profile questions, state that readiness is directional and not an official credit score or verified bureau result.',
    'For valuation questions, state that estimates are directional until recent comparable sales and property details are verified.',
    'For investment questions, include risk-aware next steps and avoid guarantees.',
    'Use status "success" unless the user request is impossible to answer safely.'
  ].join('\n');
}

function buildKimureUserPrompt(message, routingDetails) {
  const dedicatedRoute = getDedicatedRoute(routingDetails.routedTool);

  return [
    `User message: ${message}`,
    '',
    'Backend deterministic routing hint:',
    JSON.stringify({
      routedTool: routingDetails.routedTool,
      normalizedMessage: routingDetails.normalizedMessage,
      intentScores: routingDetails.intentScores,
      matchedSignals: routingDetails.matchedSignals
    }, null, 2),
    '',
    'Response requirements:',
    '- Set tool to the best Kimure tool for this request.',
    '- Include reportData.routedTool and reportData.receivedMessage.',
    `- Include reportData.dedicatedRoute as ${dedicatedRoute || '/ai/chat'}.`,
    `- Include reportData.routingAction as ${routingDetails.routedTool === 'chat' ? 'answer_general_or_clarify' : 'recommend_dedicated_route'}.`,
    '- Include reportData.assumptions as an array.',
    '- Include reportData.missingInformation when the user has not provided enough details.',
    '- Include reportData.nextBestActions as practical next steps.',
    '- Keep the disclaimer clear and conservative.'
  ].join('\n');
}

async function generateGeminiChatResponse({ message, routingDetails }) {
  const parsed = await generateGeminiStructuredJson({
    systemPrompt: buildKimureSystemPrompt(),
    userPrompt: buildKimureUserPrompt(message, routingDetails),
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 1400,
    temperature: 0.2
  });
  const normalized = normalizeGeminiResponse(parsed, message, routingDetails);

  return normalized;
}

async function generateGeminiStructuredJson({
  systemPrompt,
  userPrompt,
  responseSchema,
  maxOutputTokens = 1400,
  temperature = 0.2
}) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new MissingGeminiApiKeyError();
  }

  const url = `${GEMINI_API_ENDPOINT}/${DEFAULT_GEMINI_MODEL}:generateContent`;
  const startedAt = Date.now();
  console.info('[kimure:gemini] request start', {
    model: DEFAULT_GEMINI_MODEL,
    responseMimeType: 'application/json'
  });
  let geminiResponse;

  try {
    geminiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: userPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema
        }
      })
    });
  } catch (error) {
    console.warn('[kimure:gemini] request failed', {
      model: DEFAULT_GEMINI_MODEL,
      durationMs: Date.now() - startedAt,
      errorName: error.name
    });
    throw error;
  }

  console.info('[kimure:gemini] response status', {
    model: DEFAULT_GEMINI_MODEL,
    httpStatus: geminiResponse.status,
    ok: geminiResponse.ok,
    durationMs: Date.now() - startedAt
  });

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini request failed with ${geminiResponse.status}: ${errorText.slice(0, 240)}`);
  }

  const payload = await geminiResponse.json();
  const text = extractGeminiText(payload);
  return parseGeminiJson(text);
}

function extractGeminiText(payload) {
  const text = payload &&
    payload.candidates &&
    payload.candidates[0] &&
    payload.candidates[0].content &&
    payload.candidates[0].content.parts &&
    payload.candidates[0].content.parts
      .map((part) => part.text || '')
      .join('');

  if (!text) {
    throw new Error('Gemini returned no text content');
  }

  return text;
}

function parseGeminiJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Gemini returned invalid JSON');
    }

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      throw new Error('Gemini returned invalid JSON');
    }
  }
}

function normalizeGeminiResponse(parsed, message, routingDetails) {
  const resolvedTool = routingDetails.routedTool !== 'chat'
    ? routingDetails.routedTool
    : normalizeTool(parsed.tool, routingDetails.routedTool);
  const response = createAiResponse({
    status: parsed.status === 'error' ? 'error' : 'success',
    tool: resolvedTool,
    resultType: typeof parsed.resultType === 'string' ? parsed.resultType : 'gemini_chat_response',
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    score: typeof parsed.score === 'number' ? parsed.score : null,
    riskLevel: typeof parsed.riskLevel === 'string' ? parsed.riskLevel : 'unknown',
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    reportData: isPlainObject(parsed.reportData) ? parsed.reportData : {},
    crmSignals: isPlainObject(parsed.crmSignals) ? parsed.crmSignals : {},
    disclaimer: typeof parsed.disclaimer === 'string' ? parsed.disclaimer : DEFAULT_DISCLAIMER
  });

  return {
    ...response,
    reportData: {
      ...response.reportData,
      ...routingDetails,
      routedTool: response.reportData.routedTool || response.tool || routingDetails.routedTool,
      receivedMessage: response.reportData.receivedMessage || message,
      dedicatedRoute: getDedicatedRoute(resolvedTool),
      routingAction: resolvedTool === 'chat' ? 'answer_general_or_clarify' : 'recommend_dedicated_route',
      geminiMode: 'live',
      geminiModel: DEFAULT_GEMINI_MODEL,
      promptVersion: CHAT_PROMPT_VERSION
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

function normalizeTool(tool, fallbackTool) {
  const allowedTools = [
    'chat',
    'mortgage',
    'analyze',
    'scout',
    'valuate',
    'rental',
    'credit-profile',
    'investment-planner'
  ];

  return allowedTools.includes(tool) ? tool : fallbackTool || 'chat';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  generateGeminiChatResponse,
  generateGeminiStructuredJson,
  MissingGeminiApiKeyError
};

