const {
  OFFICIAL_ONEVIEW_BASE_URLS,
  OAUTH_TOKEN_EXCHANGE_FLAG,
  TOKEN_STRATEGY_MODES,
  buildEquifaxRuntimeConfig
} = require('./equifax/equifaxProviderConfig');
const {
  getEquifaxAccessToken
} = require('./equifax/equifaxTokenService');
const {
  normalizeEquifaxOneViewResponseV1
} = require('./equifax/equifaxOneViewResponseNormalizer');

const endpointPath = '/reports/credit-report';
const sandboxIdentityMarker = 'equifax_sandbox_test_identity';

async function runEquifaxSandboxVerification(input = {}, options = {}) {
  const env = options.env || process.env;
  const config = buildEquifaxRuntimeConfig(env);
  const gate = validateEquifaxSandboxVerificationInput(input, config, env);

  if (!gate.ok) {
    return blockedResponse(config, gate.blockedReason);
  }

  const tokenResult = await getEquifaxAccessToken({
    config,
    env,
    fetchImpl: options.fetchImpl || global.fetch
  });

  if (!tokenResult.ok || !tokenResult.accessToken) {
    return blockedResponse(config, tokenResult.errorCode || 'provider_not_ready');
  }

  const response = await postSandboxCreditReport({
    url: `${OFFICIAL_ONEVIEW_BASE_URLS.sandbox}${endpointPath}`,
    token: tokenResult.accessToken,
    body: buildSandboxRequestBody(input, config),
    timeoutMs: config.timeoutMs,
    fetchImpl: options.fetchImpl || global.fetch
  });

  if (!response.ok) {
    return {
      status: 'provider_error',
      provider: 'equifax',
      environment: config.environment,
      verified: false,
      providerStatus: 'provider_error',
      transactionId: response.transactionId || null,
      blockedReason: 'equifax_provider_http_error',
      safeToRunLiveCall: false
    };
  }

  const normalized = normalizeEquifaxOneViewResponseV1(response.body, {
    environment: config.environment,
    transactionId: response.transactionId || undefined
  });

  return {
    status: 'success',
    provider: 'equifax',
    environment: config.environment,
    verified: normalized.verificationStatus.bureauDataVerified === true,
    providerStatus: normalized.verificationStatus.status || 'verified_provider',
    transactionId: normalized.referenceIds.transactionId || response.transactionId || null,
    scoreSummary: normalized.scoreSummary || null,
    debtSummary: normalized.debtSummary || null,
    riskFlags: normalized.riskFlags || null,
    blockedReason: null,
    safeToRunLiveCall: false
  };
}

function validateEquifaxSandboxVerificationInput(input = {}, config, env = process.env) {
  const consent = getConsent(input);

  if (!config.enabled) return blocked('equifax_provider_disabled');
  if (config.environment !== 'sandbox') return blocked('equifax_environment_not_sandbox');
  if (config.tokenStrategy !== TOKEN_STRATEGY_MODES.clientCredentials) {
    return blocked('equifax_client_credentials_required');
  }
  if (config.providerCallsEnabled !== true) return blocked('equifax_provider_calls_disabled');
  if (env[OAUTH_TOKEN_EXCHANGE_FLAG] !== 'true') return blocked('equifax_oauth_exchange_disabled');
  if (!config.oauthTokenExchangeReady || !config.providerConfigStatus.tokenReady) {
    return blocked('provider_not_ready');
  }
  if (!config.providerConfigStatus.canAttemptProviderCall) {
    return blocked('provider_not_ready');
  }
  if (consent.provided !== true) return blocked('credit_consent_required');
  if (!getPermissiblePurposeCode(input)) return blocked('credit_permissible_purpose_required');
  if (!hasSandboxIdentityMarker(input)) return blocked('sandbox_identity_required');
  if (containsSocialNumberLikeInput(input)) return blocked('sandbox_identity_required');

  return { ok: true, blockedReason: null };
}

function blocked(blockedReason) {
  return { ok: false, blockedReason };
}

function blockedResponse(config, blockedReason) {
  return {
    status: 'blocked',
    provider: 'equifax',
    environment: config.environment || 'sandbox',
    verified: false,
    providerStatus: 'blocked',
    transactionId: null,
    blockedReason,
    safeToRunLiveCall: false
  };
}

function getConsent(input) {
  const consent = input && typeof input.consent === 'object' && !Array.isArray(input.consent)
    ? input.consent
    : {};

  return {
    provided: input.consentGiven === true ||
      input.creditConsent === true ||
      input.bureauConsent === true ||
      consent.provided === true ||
      consent.consentGiven === true ||
      consent.creditConsent === true ||
      consent.bureauConsent === true
  };
}

function getPermissiblePurposeCode(input) {
  const consent = input && typeof input.consent === 'object' && !Array.isArray(input.consent)
    ? input.consent
    : {};
  return stringOrNull(input.permissiblePurposeCode || consent.permissiblePurposeCode || consent.purposeCode);
}

function hasSandboxIdentityMarker(input) {
  return input.sandboxIdentity === true ||
    input.sandboxTestIdentity === true ||
    input.sandboxIdentityMarker === sandboxIdentityMarker ||
    input.testIdentityMarker === sandboxIdentityMarker;
}

function containsSocialNumberLikeInput(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsSocialNumberLikeInput);

  return Object.entries(value).some(([key, nestedValue]) => {
    if (/ssn|sin|social/i.test(key)) return true;
    if (typeof nestedValue === 'string' && /\b\d{3}-?\d{2}-?\d{4}\b/.test(nestedValue)) {
      return true;
    }
    return containsSocialNumberLikeInput(nestedValue);
  });
}

function buildSandboxRequestBody(input, config) {
  return {
    customerReferenceIdentifier: 'KimureBackendSandboxVerification',
    customerConfiguration: {
      equifaxUSConsumerCreditReport: {
        memberNumber: config.memberNumber,
        securityCode: config.securityCode,
        customerCode: config.customerCode || 'IAPI',
        ECOAInquiryType: 'Individual',
        pdfComboIndicator: 'N',
        endUserInformation: {
          endUsersName: 'KimureBackendSandboxVerification',
          permissiblePurposeCode: getPermissiblePurposeCode(input)
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

async function postSandboxCreditReport({ url, token, body, timeoutMs, fetchImpl }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs || 10000);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const parsedBody = parseJsonSafely(await response.text());

    return {
      ok: response.ok,
      httpStatus: response.status,
      body: parsedBody,
      transactionId: getHeaderValue(response.headers, 'efx-transaction-id') ||
        getHeaderValue(response.headers, 'x-transaction-id') ||
        getHeaderValue(response.headers, 'x-correlation-id')
    };
  } finally {
    clearTimeout(timeout);
  }
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

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = {
  runEquifaxSandboxVerification,
  validateEquifaxSandboxVerificationInput,
  sandboxIdentityMarker
};
