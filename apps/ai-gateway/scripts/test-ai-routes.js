require('dotenv').config();

const DEFAULT_BASE_URL = 'http://localhost:4000';
const DEFAULT_TIMEOUT_MS = 30000;

const baseUrl = String(process.env.KIMURE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const timeoutMs = Number(process.env.KIMURE_TEST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
const skipChat = process.env.KIMURE_SKIP_CHAT === 'true' || !process.env.GEMINI_API_KEY;
const skipChatReason = process.env.KIMURE_SKIP_CHAT === 'true'
  ? 'KIMURE_SKIP_CHAT=true'
  : 'GEMINI_API_KEY is not configured';

const SHARED_CONTRACT_FIELDS = [
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
];

const ROUTE_TESTS = [
  {
    path: '/ai/credit-profile',
    expectedTool: 'credit-profile',
    requiresDisclaimer: true,
    payload: {
      providerChoice: 'directional',
      goal: 'buy a first home',
      financialProfile: {
        annualIncome: 95000,
        monthlyDebt: 420,
        employmentStatus: 'full-time',
        employmentStability: '2+ years',
        currentHousingPayment: 2200,
        savings: 90000,
        downPayment: 80000,
        targetPurchasePrice: 600000,
        timeline: '6-12 months',
        location: 'Ottawa',
        firstTimeBuyer: true,
        riskTolerance: 'moderate'
      },
      consent: {
        consentGiven: false
      },
      sourceMetadata: {
        source: 'gateway-contract-test',
        contractVersion: 'official-v1',
        clientPlatform: 'test'
      }
    }
  },
  {
    path: '/ai/mortgage',
    expectedTool: 'mortgage',
    requiresDisclaimer: true,
    payload: {
      targetPurchasePrice: 650000,
      downPayment: 90000,
      totalAssets: 150000,
      totalDebt: 16000,
      monthlyPaymentObligations: 390,
      creditScore: 710,
      location: 'Ottawa',
      timeline: '6-12 months',
      income: {
        annualGross: 145000,
        employmentType: 'full-time'
      },
      assumptions: {
        interestRate: 5.25,
        propertyTaxMonthly: 540,
        insuranceMonthly: 140
      }
    }
  },
  {
    path: '/ai/investment-planner',
    expectedTool: 'investment-planner',
    requiresDisclaimer: true,
    payload: {
      goal: 'build a small rental portfolio',
      timeline: '5 years',
      location: 'Ottawa',
      riskTolerance: 'moderate',
      availableFunds: 120000,
      investmentCapacity: {
        monthly: 1800
      },
      targetProperties: 2,
      targetPortfolioOutcome: 'own two resilient rental properties',
      income: {
        annualGross: 140000
      },
      debt: [
        {
          type: 'car loan',
          balance: 16000,
          monthlyPayment: 390
        }
      ]
    }
  },
  {
    path: '/ai/scout',
    expectedTool: 'scout',
    requiresDisclaimer: false,
    payload: {
      intent: 'buy',
      budget: {
        min: 500000,
        max: 650000
      },
      location: 'Ottawa',
      propertyType: 'townhouse',
      bedrooms: 3,
      bathrooms: 2,
      timeline: '3-6 months',
      mustHaves: [
        'parking',
        'family-friendly area'
      ],
      niceToHaves: [
        'near transit'
      ]
    }
  },
  {
    path: '/ai/analyze',
    expectedTool: 'analyze',
    requiresDisclaimer: true,
    payload: {
      intent: 'invest',
      propertyAddress: '123 Example Street, Ottawa, ON',
      listingPrice: 725000,
      location: 'Ottawa',
      propertyType: 'duplex',
      bedrooms: 4,
      bathrooms: 2,
      expectedRentalIncome: 4200,
      budget: {
        max: 750000
      },
      assumptions: {
        mortgagePaymentMonthly: 3400,
        propertyTaxMonthly: 520,
        insuranceMonthly: 180,
        maintenanceMonthly: 300,
        vacancyPercent: 5
      },
      listing: {
        daysOnMarket: 18,
        squareFeet: 1900,
        condition: 'older but rentable'
      }
    }
  },
  {
    path: '/ai/valuate',
    expectedTool: 'valuate',
    requiresDisclaimer: true,
    payload: {
      intent: 'buy',
      listingPrice: 689000,
      location: 'Ottawa',
      propertyType: 'townhouse',
      bedrooms: 3,
      bathrooms: 2,
      squareFootage: 1650,
      condition: 'updated kitchen, older roof',
      comparablePriceContext: {
        count: 4,
        median: 655000,
        low: 630000,
        high: 675000,
        notes: 'Fake user-provided comparable context for contract testing only.'
      }
    }
  },
  {
    path: '/ai/rental',
    expectedTool: 'rental',
    requiresDisclaimer: true,
    payload: {
      intent: 'rent',
      monthlyRentBudget: 2800,
      desiredLocation: 'Ottawa',
      familySize: 4,
      lifestyleDescription: 'Near transit, parks, and everyday services.',
      accessibilityConsiderations: [
        'step-free entry'
      ],
      rentalType: 'long-term'
    }
  },
  {
    path: '/ai/chat',
    expectedTool: 'scout',
    requiresDisclaimer: false,
    payload: {
      message: 'Find me homes under $600K in Ottawa.'
    }
  }
];

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    let body;

    try {
      body = JSON.parse(text);
    } catch (error) {
      const parseError = new Error(`Response was not valid JSON (HTTP ${response.status})`);
      parseError.code = 'INVALID_JSON';
      parseError.responseText = text.slice(0, 240);
      throw parseError;
    }

    return {
      body,
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      ok: response.ok
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function hasUsefulOutput(body) {
  return Boolean(
    typeof body.summary === 'string' && body.summary.trim() ||
    Array.isArray(body.keyInsights) && body.keyInsights.length ||
    Array.isArray(body.recommendations) && body.recommendations.length ||
    body.reportData && typeof body.reportData === 'object' && Object.keys(body.reportData).length
  );
}

function detectFallback(body) {
  const source = body.reportData && body.reportData.source;
  const aiReasoningMode = body.reportData &&
    body.reportData.aiReasoning &&
    body.reportData.aiReasoning.mode;
  const geminiMode = body.reportData && body.reportData.geminiMode;
  const verificationStatus = body.reportData && body.reportData.verificationStatus;
  const providerStatus = body.reportData && body.reportData.providerStatus;

  if (source === 'fallback') {
    return body.reportData.geminiMode || 'structured_fallback';
  }

  if (aiReasoningMode === 'rules_directional') {
    return 'rules_directional';
  }

  if (typeof geminiMode === 'string' && geminiMode !== 'live') {
    return geminiMode;
  }

  if (body.tool === 'credit-profile' && verificationStatus && verificationStatus.bureauDataVerified !== true) {
    return `credit-profile:${providerStatus && providerStatus.status || verificationStatus.status || 'directional_only'}`;
  }

  return 'none';
}

function validateRouteResult(test, result) {
  const failures = [];
  const warnings = [];
  const body = result.body || {};
  const missingFields = SHARED_CONTRACT_FIELDS.filter((field) => !(field in body));

  if (!result.ok) {
    failures.push(`HTTP ${result.httpStatus}`);
  }

  if (result.httpStatus >= 500) {
    failures.push('server error response');
  }

  if (body.status === 'error') {
    failures.push(`response status is error (${body.resultType || 'unknown resultType'})`);
  }

  if (!hasUsefulOutput(body)) {
    failures.push('no summary or useful output');
  } else if (typeof body.summary !== 'string' || !body.summary.trim()) {
    warnings.push('summary is missing but other useful output exists');
  }

  if (test.requiresDisclaimer && (typeof body.disclaimer !== 'string' || !body.disclaimer.trim())) {
    failures.push('required disclaimer is missing');
  } else if (!test.requiresDisclaimer && (typeof body.disclaimer !== 'string' || !body.disclaimer.trim())) {
    warnings.push('disclaimer is missing');
  }

  if (missingFields.length) {
    warnings.push(`shared contract fields missing: ${missingFields.join(', ')}`);
  }

  if (body.tool !== test.expectedTool) {
    warnings.push(`expected tool ${test.expectedTool}, received ${body.tool || 'missing'}`);
  }

  if (test.path === '/ai/credit-profile') {
    validateCreditProfileProvenance(body, failures, warnings);
  }

  if ([
    '/ai/scout',
    '/ai/analyze',
    '/ai/rental',
    '/ai/valuate',
    '/ai/investment-planner'
  ].includes(test.path)) {
    const source = body.reportData && body.reportData.source;
    if (!['gemini', 'fallback'].includes(source)) {
      failures.push(`recommendation source is invalid (${source || 'missing'})`);
    }
  }

  return {
    failures,
    warnings,
    fallback: detectFallback(body),
    tool: body.tool || 'missing'
  };
}

function validateCreditProfileProvenance(body, failures, warnings) {
  const reportData = body.reportData && typeof body.reportData === 'object'
    ? body.reportData
    : {};
  const verificationStatus = reportData.verificationStatus || {};
  const validVerificationStatuses = [
    'directional_only',
    'consent_required',
    'provider_unavailable',
    'verified_sandbox',
    'verified_provider'
  ];

  const allowedReportFields = [
    'providerStatus',
    'verificationStatus',
    'missingFields',
    'creditAssessment',
    'creditMortgageHandoff'
  ];
  const extraReportFields = Object.keys(reportData).filter((field) => !allowedReportFields.includes(field));

  if (extraReportFields.length > 0) {
    failures.push(`credit-profile exposes non-contract report fields: ${extraReportFields.join(', ')}`);
  }

  if (!validVerificationStatuses.includes(verificationStatus.status)) {
    failures.push(`credit-profile verificationStatus.status is invalid (${verificationStatus.status || 'missing'})`);
  }

  if (!reportData.providerStatus || typeof reportData.providerStatus !== 'object') {
    failures.push('credit-profile providerStatus is missing');
  }

  if (!Array.isArray(reportData.missingFields)) {
    failures.push('credit-profile missingFields is missing or invalid');
  }

  if (!reportData.creditMortgageHandoff || typeof reportData.creditMortgageHandoff !== 'object') {
    failures.push('credit-profile creditMortgageHandoff is missing');
  }

  const creditAssessment = reportData.creditAssessment || {};
  if (!/^ca_[A-Za-z0-9_-]{32}$/.test(creditAssessment.assessmentId || '')) {
    failures.push('credit-profile creditAssessment.assessmentId is missing or invalid');
  }

  if (creditAssessment.storageMode !== 'ephemeral_memory_dev') {
    failures.push('credit-profile creditAssessment.storageMode is not ephemeral_memory_dev');
  }

  if (creditAssessment.productionPersistenceRequired !== true) {
    failures.push('credit-profile creditAssessment.productionPersistenceRequired is not true');
  }

  [
    'leadIntent',
    'readinessBand',
    'riskBand',
    'providerVerificationStatus',
    'missingInfoCount',
    'recommendedFollowUp',
    'mortgageReadiness',
    'shouldRouteToAdvisor',
    'shouldPromptForBureauConsent',
    'shouldPromptForMissingFields'
  ].forEach((field) => {
    if (!(field in (body.crmSignals || {}))) failures.push(`credit-profile crmSignals.${field} is missing`);
  });

  const forbiddenKeys = findForbiddenKeys(body, new Set([
    'providedData',
    'providerData',
    'equifaxData',
    'sourceResponse',
    'contentBase64',
    'providerDiagnostics',
    'apiKey',
    'accessToken',
    'socialInsuranceNumber',
    'sin',
    'ssn'
  ]));

  if (forbiddenKeys.length > 0) {
    failures.push(`credit-profile response contains forbidden fields: ${[...new Set(forbiddenKeys)].join(', ')}`);
  }
}

function findForbiddenKeys(value, forbiddenKeys) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => findForbiddenKeys(item, forbiddenKeys));
  }

  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const matches = forbiddenKeys.has(key) ? [key] : [];
    return matches.concat(findForbiddenKeys(nestedValue, forbiddenKeys));
  });
}

async function preflight() {
  const result = await requestJson('/health');

  if (!result.ok || result.body.status !== 'ok') {
    throw new Error(`Health check failed with HTTP ${result.httpStatus}`);
  }

  console.log(`[PASS] GET /health (${result.durationMs}ms)`);
}

async function run() {
  if (typeof fetch !== 'function') {
    console.error('[FAIL] This script requires a Node.js runtime with built-in fetch support.');
    process.exitCode = 1;
    return;
  }

  console.log(`Kimure AI route contract test: ${baseUrl}`);
  console.log(`Timeout per request: ${timeoutMs}ms`);

  try {
    await preflight();
  } catch (error) {
    console.error(`[FAIL] Backend is unreachable or unhealthy at ${baseUrl}`);
    console.error(`       ${error.message}`);
    console.error('       Start the gateway with: npm start');
    process.exitCode = 1;
    return;
  }

  let passCount = 0;
  let warningCount = 0;
  let failureCount = 0;

  for (const test of ROUTE_TESTS) {
    if (test.path === '/ai/chat' && skipChat) {
      console.log(`[SKIP] POST /ai/chat (${skipChatReason})`);
      continue;
    }

    try {
      const result = await requestJson(test.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestId: 'route-contract-test',
          capability: test.path.replace('/ai/', ''),
          user: { id: 'synthetic-test-user' },
          input: test.payload
        })
      });
      const validation = validateRouteResult(test, result);
      const details = `HTTP ${result.httpStatus}, tool=${validation.tool}, fallback=${validation.fallback}, ${result.durationMs}ms`;

      if (validation.failures.length) {
        failureCount += 1;
        console.error(`[FAIL] POST ${test.path} (${details})`);
        validation.failures.forEach((failure) => console.error(`       ${failure}`));
      } else {
        passCount += 1;
        console.log(`[PASS] POST ${test.path} (${details})`);
      }

      validation.warnings.forEach((warning) => {
        warningCount += 1;
        console.warn(`       [WARN] ${warning}`);
      });
    } catch (error) {
      failureCount += 1;
      console.error(`[FAIL] POST ${test.path}`);
      console.error(`       ${error.message}`);
      if (error.responseText) {
        console.error(`       Response: ${error.responseText}`);
      }
    }
  }

  console.log('');
  console.log(`Summary: ${passCount} passed, ${warningCount} warnings, ${failureCount} failed`);

  if (failureCount > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('[FAIL] Unexpected test runner error');
  console.error(error.message);
  process.exitCode = 1;
});
