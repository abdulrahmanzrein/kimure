const {
  OFFICIAL_ONEVIEW_BASE_URLS,
  SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG,
  SANDBOX_STATIC_TOKEN_TEST_FLAG,
  TOKEN_STRATEGY_MODES,
  buildEquifaxRuntimeConfig
} = require('../src/services/equifax/equifaxProviderConfig');
const {
  getEquifaxAccessToken
} = require('../src/services/equifax/equifaxTokenService');
const {
  normalizeEquifaxOneViewResponseV1
} = require('../src/services/equifax/equifaxOneViewResponseNormalizer');

const endpointPath = '/reports/credit-report';
const REQUIRED_SMOKE_TEST_GATES = Object.freeze([
  'EQUIFAX_ENABLED',
  'EQUIFAX_ENVIRONMENT',
  'EQUIFAX_TOKEN_STRATEGY',
  'EQUIFAX_PROVIDER_CALLS_ENABLED',
  'EQUIFAX_SANDBOX_STATIC_TOKEN_TEST_ENABLED',
  'EQUIFAX_SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_ENABLED',
  'EQUIFAX_SANDBOX_BASE_URL',
  'EQUIFAX_SANDBOX_ACCESS_TOKEN',
  'EQUIFAX_SANDBOX_MEMBER_NUMBER',
  'EQUIFAX_SANDBOX_SECURITY_CODE',
  'EQUIFAX_SANDBOX_CUSTOMER_CODE',
  'EQUIFAX_PERMISSIBLE_PURPOSE_CODE',
  'EQUIFAX_CONSENT_VERSION'
]);

async function run() {
  const config = buildEquifaxRuntimeConfig(process.env);
  const gate = validateSmokeTestGates(config, process.env);

  if (!gate.ok) {
    printSafe({
      provider: 'equifax',
      environment: config.environment,
      endpointPath,
      blockedReason: gate.blockedReason,
      safeToRunLiveCall: false
    }, true);
    process.exitCode = 1;
    return;
  }

  const tokenResult = await getEquifaxAccessToken({
    config,
    env: process.env
  });

  if (!tokenResult.ok || !tokenResult.accessToken) {
    printSafe({
      provider: 'equifax',
      environment: config.environment,
      endpointPath,
      blockedReason: tokenResult.errorCode || 'equifax_access_token_unavailable',
      safeToRunLiveCall: false
    }, true);
    process.exitCode = 1;
    return;
  }

  const url = `${OFFICIAL_ONEVIEW_BASE_URLS.sandbox}${endpointPath}`;
  const response = await postSandboxCreditReport({
    url,
    token: tokenResult.accessToken,
    body: buildSandboxRequestBody(config),
    timeoutMs: config.timeoutMs
  });

  if (!response.ok) {
    printSafe({
      provider: 'equifax',
      environment: config.environment,
      endpointPath,
      httpStatus: response.httpStatus,
      transactionId: response.transactionId,
      status: 'provider_http_error',
      providerError: response.providerError,
      safeToRunLiveCall: false
    }, true);
    process.exitCode = 1;
    return;
  }

  const normalized = normalizeEquifaxOneViewResponseV1(response.body, {
    environment: config.environment,
    transactionId: response.transactionId
  });

  printSafe({
    provider: 'equifax',
    environment: config.environment,
    endpointPath,
    httpStatus: response.httpStatus,
    transactionId: response.transactionId,
    normalizedStatus: normalized.verificationStatus.status,
    mapperStatus: normalized.mapperStatus,
    scoreSummary: normalized.scoreSummary,
    debtSummary: normalized.debtSummary,
    riskFlags: normalized.riskFlags,
    safeToRunLiveCall: false
  });
}

function validateSmokeTestGates(config, env) {
  if (env.EQUIFAX_ENABLED !== 'true') {
    return blocked('equifax_provider_disabled');
  }

  if (env.EQUIFAX_ENVIRONMENT !== 'sandbox' || config.environment !== 'sandbox') {
    return blocked('sandbox_environment_required');
  }

  if (env.EQUIFAX_TOKEN_STRATEGY !== TOKEN_STRATEGY_MODES.sandboxStaticToken) {
    return blocked('sandbox_static_token_strategy_required');
  }

  if (env.EQUIFAX_PROVIDER_CALLS_ENABLED !== 'true') {
    return blocked('provider_calls_enabled_required');
  }

  if (env[SANDBOX_STATIC_TOKEN_TEST_FLAG] !== 'true') {
    return blocked('sandbox_static_token_test_disabled');
  }

  if (env[SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG] !== 'true') {
    return blocked('sandbox_static_token_live_smoke_test_disabled');
  }

  if (config.baseUrl !== OFFICIAL_ONEVIEW_BASE_URLS.sandbox) {
    return blocked('official_sandbox_base_url_required');
  }

  if (!config.sandboxAccessToken) {
    return blocked('sandbox_access_token_required');
  }

  if (!config.memberNumber) {
    return blocked('sandbox_member_number_required');
  }

  if (!config.securityCode) {
    return blocked('sandbox_security_code_required');
  }

  if (!config.permissiblePurposeCode) {
    return blocked('permissible_purpose_code_required');
  }

  if (!config.consentVersion) {
    return blocked('consent_version_required');
  }

  return { ok: true, blockedReason: null };
}

function blocked(blockedReason) {
  return { ok: false, blockedReason };
}

function buildSandboxRequestBody(config) {
  return {
    customerReferenceIdentifier: 'KimureSandboxSmokeTest',
    customerConfiguration: {
      equifaxUSConsumerCreditReport: {
        memberNumber: config.memberNumber,
        securityCode: config.securityCode,
        customerCode: config.customerCode || 'IAPI',
        ECOAInquiryType: 'Individual',
        pdfComboIndicator: 'N',
        endUserInformation: {
          endUsersName: 'KimureSandboxSmokeTest',
          permissiblePurposeCode: config.permissiblePurposeCode
        }
      }
    },
    consumers: [
      {
        name: [
          {
            identifier: 'current',
            firstName: 'Sandbox',
            lastName: 'Consumer'
          }
        ],
        dateOfBirth: '01011990',
        addresses: [
          {
            identifier: 'current',
            houseNumber: '100',
            streetName: 'Sandbox Street',
            cityName: 'Sandbox City',
            stateAbbreviation: 'GA',
            zipCode: '30301'
          }
        ]
      }
    ]
  };
}

async function postSandboxCreditReport({ url, token, body, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const responseText = await response.text();
    const parsedBody = parseJsonSafely(responseText);

    return {
      ok: response.ok,
      httpStatus: response.status,
      body: parsedBody,
      transactionId: getHeaderValue(response.headers, 'efx-transaction-id') ||
        getHeaderValue(response.headers, 'x-transaction-id') ||
        getHeaderValue(response.headers, 'x-correlation-id'),
      providerError: response.ok ? null : pickSafeProviderError(parsedBody)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function pickSafeProviderError(body) {
  if (!body || typeof body !== 'object') return null;
  return compact({
    code: findFirstString(body, ['code', 'errorCode', 'statusCode']),
    message: findFirstString(body, ['message', 'errorMessage', 'description']),
    status: findFirstString(body, ['status', 'statusText'])
  });
}

function findFirstString(source, keys) {
  const found = findFirstByKey(source, keys);
  return typeof found === 'string' && found.trim()
    ? sanitizeProviderMessage(found.trim()).slice(0, 200)
    : null;
}

function sanitizeProviderMessage(value) {
  return value
    .replace(/https?:\/\/[^\s,)]+/gi, '[REDACTED_URL]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_ID]')
    .replace(/\b\d{6,}\b/g, '[REDACTED_NUMBER]');
}

function findFirstByKey(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findFirstByKey(item, keys);
      if (found !== undefined && found !== null) return found;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(source)) {
    if (/token|authorization|secret|member|security|customer|consumer|address|social|ssn|sin|trade|tradeline|pdf|raw|report/i.test(key)) {
      continue;
    }
    if (keys.includes(key)) return value;
    const found = findFirstByKey(value, keys);
    if (found !== undefined && found !== null) return found;
  }

  return undefined;
}

function parseJsonSafely(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getHeaderValue(headers, name) {
  return headers && typeof headers.get === 'function' ? headers.get(name) : null;
}

function compact(value) {
  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (nestedValue !== null && nestedValue !== undefined && nestedValue !== '') {
      result[key] = nestedValue;
    }
    return result;
  }, {});
}

function printSafe(payload, error = false) {
  const serialized = JSON.stringify(payload, null, 2);
  if (error) {
    console.error(serialized);
    return;
  }
  console.log(serialized);
}

if (require.main === module) {
  run().catch((error) => {
    printSafe({
      provider: 'equifax',
      environment: 'sandbox',
      endpointPath,
      status: 'request_failed',
      errorName: error && error.name ? error.name : 'Error',
      safeToRunLiveCall: false
    }, true);
    process.exitCode = 1;
  });
}

module.exports = {
  buildSandboxRequestBody,
  validateSmokeTestGates
};
