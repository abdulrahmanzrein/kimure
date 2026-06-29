const ONEVIEW_CREDIT_REPORT_PATH = '/reports/credit-report';
const {
  buildEquifaxRuntimeConfig,
  validateEquifaxProviderConfig
} = require('./equifax/equifaxProviderConfig');
const {
  getEquifaxAccessToken
} = require('./equifax/equifaxTokenService');
const {
  buildEquifaxOneViewRequestV1
} = require('./equifax/equifaxOneViewRequestBuilder');
const {
  normalizeEquifaxOneViewResponseV1
} = require('./equifax/equifaxOneViewResponseNormalizer');

// Equifax OneView integration boundary.
// Keep all Equifax credentials, tokens, raw payloads, and provider-specific request details here.
// Do not expose Equifax secrets or raw bureau payloads to frontend clients or Gemini.

function getEquifaxConfig(env = process.env) {
  const config = buildEquifaxRuntimeConfig(env);
  return {
    ...config,
    reportPath: config.reportPath || ONEVIEW_CREDIT_REPORT_PATH
  };
}

async function getEquifaxCreditProfileData({ providedData, requestContext = {}, env = process.env }) {
  const startedAt = new Date().toISOString();
  const config = getEquifaxConfig(env);
  const request = buildEquifaxCreditRequest({
    providedData,
    requestContext,
    config
  });
  const configValidation = config.providerConfigStatus || validateEquifaxConfig(config);

  logInfo('credit-profile request start', {
    provider: 'equifax',
    environment: config.environment,
    enabled: config.enabled,
    requestReady: request.requestReady,
    consentProvided: request.consent.provided
  });

  if (!configValidation.enabled) {
    logInfo('Equifax disabled; using safe fallback', {
      equifaxStatus: 'not_connected'
    });

    return createUnavailableEquifaxResult({
      equifaxStatus: 'not_connected',
      unavailableReason: 'Equifax integration is disabled. Set EQUIFAX_ENABLED=true only after approved environment credentials and consent controls are configured.',
      config,
      request,
      startedAt,
      nextIntegrationStep: 'Enable Equifax only after Sandbox/Test/Production credentials, consent capture, and request fields are ready.'
    });
  }

  if (!request.consent.provided) {
    logWarn('Equifax consent missing; using safe fallback', {
      equifaxStatus: 'consent_required'
    });

    return createUnavailableEquifaxResult({
      equifaxStatus: 'consent_required',
      unavailableReason: 'Equifax request was not made because explicit user consent/permissible purpose was not provided.',
      config,
      request,
      startedAt,
      nextIntegrationStep: 'Capture consent and permissible-purpose metadata before making bureau requests.'
    });
  }

  if (!configValidation.canAttemptProviderCall) {
    logWarn('Equifax config missing; using safe fallback', {
      missing: configValidation.missingKeys,
      errors: configValidation.errors
    });

    return createUnavailableEquifaxResult({
      equifaxStatus: 'configuration_missing',
      unavailableReason: `Equifax integration is enabled but provider config is not ready: ${configValidation.missingKeys.join(', ') || configValidation.errors.join(', ')}.`,
      config,
      request,
      startedAt,
      nextIntegrationStep: 'Add the missing Equifax backend environment variables from the approved Equifax portal environment.'
    });
  }

  if (!request.requestReady) {
    logWarn('Equifax input insufficient; using safe fallback', {
      missing: request.missingRequestFields
    });

    return createUnavailableEquifaxResult({
      equifaxStatus: 'insufficient_input',
      unavailableReason: `Equifax request was not made because required applicant fields are missing: ${request.missingRequestFields.join(', ')}.`,
      config,
      request,
      startedAt,
      nextIntegrationStep: 'Collect the missing identity/address fields from onboarding or pass a sandbox social number when legally appropriate.'
    });
  }

  try {
    const oneViewUrl = buildOneViewUrl(config);
    const tokenResult = await getEquifaxAccessToken({ config, env });

    if (!tokenResult.ok) {
      logWarn('Equifax token unavailable; using safe fallback', {
        tokenStatus: tokenResult.status.lastTokenStatus,
        environment: tokenResult.status.environment
      });

      return createUnavailableEquifaxResult({
        equifaxStatus: 'configuration_missing',
        unavailableReason: `Equifax token is not available: ${tokenResult.errorCode}.`,
        config: {
          ...config,
          tokenStatus: tokenResult.status
        },
        request,
        startedAt,
        nextIntegrationStep: 'Implement the Equifax portal-approved token flow after signed-in OneView documentation is available.'
      });
    }

    if (!request.providerCallReady) {
      logWarn('Equifax request contract unconfirmed; using safe fallback', {
        blockedReason: request.providerCallBlockedReason,
        builderVersion: request.requestVersion
      });

      return createUnavailableEquifaxResult({
        equifaxStatus: 'configuration_missing',
        unavailableReason: `Equifax OneView request contract is not ready: ${request.providerCallBlockedReason}.`,
        config: {
          ...config,
          tokenStatus: tokenResult.status
        },
        request,
        startedAt,
        nextIntegrationStep: 'Confirm the signed-in Equifax OneView endpoint, headers, request body, response schema, and retention/display rules before live provider calls.'
      });
    }

    logInfo('Equifax request start', {
      endpoint: oneViewUrl,
      requestMode: request.requestMode,
      hasSocialNumber: request.applicantSnapshot.socialNumberProvided
    });

    const response = await postOneViewCreditReport({
      url: oneViewUrl,
      token: tokenResult.accessToken,
      body: request.oneViewRequestBody,
      timeoutMs: config.timeoutMs
    });

    logInfo('Equifax response status', {
      httpStatus: response.httpStatus,
      ok: response.ok,
      transactionId: response.transactionId || null
    });

    if (!response.ok) {
      return createUnavailableEquifaxResult({
        equifaxStatus: 'provider_error',
        unavailableReason: `Equifax provider returned HTTP ${response.httpStatus}.`,
        config,
        request,
        startedAt,
        providerDiagnostics: response.providerDiagnostics,
        nextIntegrationStep: 'Check the OneView request schema, sandbox test data, token scope, and provider error details.'
      });
    }

    const verifiedData = normalizeEquifaxVerifiedData(response.body, {
      environment: config.environment
    });

    return {
      provider: 'equifax',
      source: `equifax_oneview_${config.environment}`,
      equifaxStatus: 'verified',
      status: 'verified',
      verified: true,
      dataClassification: config.environment === 'sandbox'
        ? 'verified_sandbox_bureau_data'
        : 'verified_provider_bureau_data',
      dataSource: 'equifax_oneview_consumer_credit_report',
      verifiedData,
      rawResponseStored: false,
      config: sanitizeEquifaxConfig(config),
      request: sanitizeEquifaxRequest(request),
      transaction: {
        endpoint: buildOneViewUrl(config),
        startedAt,
        completedAt: new Date().toISOString(),
        httpStatus: response.httpStatus,
        transactionId: response.transactionId || verifiedData.referenceIds.transactionId || null,
        reportId: verifiedData.referenceIds.reportId || null
      },
      unavailableReason: null,
      nextIntegrationStep: 'Review sanitized verifiedData mapping against the signed-in Equifax OneView response schema before production.'
    };
  } catch (error) {
    logWarn('Equifax request failed; using safe fallback', {
      errorName: error.name,
      message: error.message
    });

    return createUnavailableEquifaxResult({
      equifaxStatus: error.name === 'AbortError' ? 'timeout' : 'request_failed',
      unavailableReason: error.message,
      config,
      request,
      startedAt,
      nextIntegrationStep: 'Check network access, token validity, endpoint URL, and OneView sandbox request schema.'
    });
  }
}

function buildEquifaxCreditRequest({ providedData, requestContext = {}, config = getEquifaxConfig() }) {
  return buildEquifaxOneViewRequestV1({
    providedData,
    requestContext
  }, {
    config
  });
}

function normalizeApplicantInput({ providedData, requestContext }) {
  const profile = providedData.additionalProfile || {};
  const applicant = requestContext.applicant || profile.applicant || profile.identity || profile.consumer || {};
  const address = applicant.address || profile.address || requestContext.address || {};

  return {
    firstName: cleanString(applicant.firstName || applicant.givenName || profile.firstName),
    middleName: cleanString(applicant.middleName || profile.middleName),
    lastName: cleanString(applicant.lastName || applicant.familyName || profile.lastName),
    dateOfBirth: cleanDate(applicant.dateOfBirth || applicant.dob || profile.dateOfBirth || profile.dob),
    socialNumber: cleanSensitiveString(
      applicant.socialNumber ||
      applicant.ssn ||
      applicant.sin ||
      applicant.socialInsuranceNumber ||
      profile.socialNumber ||
      profile.ssn ||
      profile.sin ||
      requestContext.socialNumber
    ),
    address: {
      addressLine1: cleanString(address.addressLine1 || address.line1 || address.streetAddress) ||
        joinAddressLine(address.civicNumber || address.streetNumber, address.streetName || address.street),
      addressLine2: cleanString(address.addressLine2 || address.line2 || address.unit || address.unitNumber),
      city: cleanString(address.city || address.cityName),
      region: cleanString(address.region || address.province || address.state || address.provinceCode),
      postalCode: cleanString(address.postalCode || address.postal || address.zip),
      country: cleanString(address.country) || 'CA'
    }
  };
}

function joinAddressLine(civicNumber, streetName) {
  const parts = [cleanString(civicNumber), cleanString(streetName)].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function getMissingEquifaxRequestFields(applicant) {
  const missing = [];

  if (!applicant.firstName) missing.push('firstName');
  if (!applicant.lastName) missing.push('lastName');

  if (!applicant.socialNumber) {
    if (!applicant.address.addressLine1) missing.push('address.addressLine1');
    if (!applicant.address.city) missing.push('address.city');
    if (!applicant.address.region) missing.push('address.region');
    if (!applicant.address.postalCode) missing.push('address.postalCode');
  }

  return missing;
}

function buildOneViewRequestBody({ applicant, requestContext, config }) {
  const consumer = {
    name: [
      removeEmptyValues({
        identifier: 'current',
        firstName: applicant.firstName,
        middleName: applicant.middleName,
        lastName: applicant.lastName
      })
    ]
  };

  if (applicant.dateOfBirth) {
    consumer.dateOfBirth = applicant.dateOfBirth;
  }

  if (applicant.socialNumber) {
    consumer.socialNum = [
      {
        identifier: 'current',
        number: applicant.socialNumber
      }
    ];
  }

  if (applicant.address.addressLine1) {
    consumer.addresses = [
      removeEmptyValues({
        identifier: 'current',
        addressLine1: applicant.address.addressLine1,
        addressLine2: applicant.address.addressLine2,
        cityName: applicant.address.city,
        province: applicant.address.region,
        postalCode: applicant.address.postalCode,
        country: applicant.address.country
      })
    ];
  }

  return removeEmptyValues({
    customerReferenceIdentifier: requestContext.consumerReferenceId || undefined,
    customerConfiguration: removeEmptyValues({
      productCode: config.productCode,
      memberNumber: config.memberNumber,
      securityCode: config.securityCode,
      customerCode: config.customerCode,
      permissiblePurpose: requestContext.permissiblePurpose || undefined
    }),
    consumers: [
      consumer
    ]
  });
}

function validateEquifaxConfig(config) {
  const status = config.providerConfigStatus || validateEquifaxProviderConfig();
  return {
    ...status,
    ready: status.configReady,
    missing: status.missingKeys,
    tokenGenerationReady: status.tokenStrategy === 'client_credentials' && status.configReady
  };
}

async function postOneViewCreditReport({ url, token, body, timeoutMs }) {
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
      transactionId: getHeaderValue(response.headers, 'x-transaction-id') ||
        getHeaderValue(response.headers, 'x-correlation-id') ||
        getHeaderValue(response.headers, 'efx-transaction-id'),
      providerDiagnostics: response.ok ? null : sanitizeProviderError(parsedBody, responseText)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeEquifaxVerifiedData(responseBody, options = {}) {
  return normalizeEquifaxOneViewResponseV1(responseBody, options);
}

function normalizeCreditScore(responseBody) {
  const value = findFirstNumber(responseBody, [
    'creditScore',
    'score',
    'riskScore',
    'beaconScore'
  ]);

  if (value === null) {
    return null;
  }

  return {
    value,
    model: findFirstValue(responseBody, [
      'scoreModel',
      'model',
      'scoreName',
      'scoreType'
    ]),
    source: 'equifax_oneview'
  };
}

function createUnavailableEquifaxResult({
  equifaxStatus,
  unavailableReason,
  config,
  request,
  startedAt,
  nextIntegrationStep,
  providerDiagnostics = null
}) {
  return {
    provider: 'equifax',
    source: `equifax_oneview_${config.environment}`,
    equifaxStatus,
    status: equifaxStatus,
    verified: false,
    dataClassification: 'unverified_placeholder',
    dataSource: 'none',
    verifiedData: null,
    rawResponseStored: false,
    config: sanitizeEquifaxConfig(config),
    request: sanitizeEquifaxRequest(request),
    transaction: {
      endpoint: buildOneViewUrl(config),
      startedAt,
      completedAt: new Date().toISOString(),
      httpStatus: null,
      transactionId: null,
      reportId: null
    },
    providerDiagnostics,
    unavailableReason,
    nextIntegrationStep
  };
}

function sanitizeEquifaxConfig(config) {
  return {
    enabled: config.enabled,
    environment: config.environment,
    baseUrlConfigured: Boolean(config.baseUrl),
    scopeConfigured: Boolean(config.scope),
    sandboxAccessTokenConfigured: Boolean(config.sandboxAccessToken),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    tokenUrlConfigured: Boolean(config.tokenUrl),
    memberNumberConfigured: Boolean(config.memberNumber),
    securityCodeConfigured: Boolean(config.securityCode),
    customerCodeConfigured: Boolean(config.customerCode),
    productCodeConfigured: Boolean(config.productCode),
    timeoutMs: config.timeoutMs,
    retryCount: config.retryCount,
    configReady: Boolean(config.configReady),
    tokenStrategy: config.tokenStrategy || 'none',
    tokenReady: Boolean(config.tokenReady),
    sandboxStaticTokenTestEnabled: Boolean(config.sandboxStaticTokenTestEnabled),
    sandboxStaticTokenTestReady: Boolean(config.sandboxStaticTokenTestReady),
    sandboxStaticTokenTestBlockedReason: config.sandboxStaticTokenTestBlockedReason || null,
    tokenStatus: config.tokenStatus || null,
    warnings: config.providerConfigStatus ? config.providerConfigStatus.warnings : [],
    errors: config.providerConfigStatus ? config.providerConfigStatus.errors : []
  };
}

function sanitizeEquifaxRequest(request) {
  return {
    requestType: request.requestType,
    providerProduct: request.providerProduct,
    endpointPath: request.endpointPath,
    consumerReferenceId: request.consumerReferenceId,
    permissiblePurpose: request.permissiblePurpose,
    consent: request.consent,
    requestedProducts: request.requestedProducts,
    applicantSnapshot: request.applicantSnapshot,
    requestMode: request.requestMode,
    requestReady: request.requestReady,
    missingRequestFields: request.missingRequestFields,
    providerCallReady: request.providerCallReady,
    providerCallBlockedReason: request.providerCallBlockedReason,
    portalDependency: request.portalDependency,
    safeDebugMetadata: request.safeDebugMetadata,
    requestBodyFieldsSent: request.oneViewRequestBody ? Object.keys(request.oneViewRequestBody) : []
  };
}

function buildOneViewUrl(config) {
  if (!config.baseUrl) return null;
  return `${config.baseUrl.replace(/\/$/, '')}${config.reportPath}`;
}

function sanitizeProviderError(parsedBody, responseText) {
  if (parsedBody) {
    return pickSafeProviderDiagnostics(redactSensitiveValues(parsedBody));
  }

  return responseText ? responseText.slice(0, 500) : null;
}

function pickSafeProviderDiagnostics(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  return {
    code: findFirstValue(value, [
      'code',
      'errorCode',
      'statusCode'
    ]),
    message: findFirstValue(value, [
      'message',
      'errorMessage',
      'description'
    ]),
    status: findFirstValue(value, [
      'status',
      'statusText'
    ]),
    transactionId: findFirstValue(value, [
      'transactionId',
      'correlationId'
    ])
  };
}

function redactSensitiveValues(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, nestedValue]) => {
      if (/token|secret|password|social|ssn|sin/i.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveValues(nestedValue);
      }

      return result;
    }, {});
  }

  return value;
}

function findFirstValue(source, keys) {
  const found = findFirstByKey(source, keys);
  return found === undefined || found === null ? null : String(found);
}

function findFirstNumber(source, keys) {
  const found = findFirstByKey(source, keys);
  const number = Number(found);

  return Number.isFinite(number) ? number : null;
}

function findFirstMoney(source, keys) {
  const found = findFirstByKey(source, keys);

  if (typeof found === 'number') {
    return found;
  }

  if (typeof found === 'string') {
    const number = Number(found.replace(/[$,\s]/g, ''));
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function findFirstBoolean(source, keys) {
  const found = findFirstByKey(source, keys);

  if (typeof found === 'boolean') {
    return found;
  }

  if (typeof found === 'string') {
    if (['true', 'yes', 'y'].includes(found.toLowerCase())) return true;
    if (['false', 'no', 'n'].includes(found.toLowerCase())) return false;
  }

  return null;
}

function findFirstByKey(source, keys) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findFirstByKey(item, keys);
      if (found !== undefined && found !== null) {
        return found;
      }
    }

    return undefined;
  }

  for (const [key, value] of Object.entries(source)) {
    if (keys.includes(key)) {
      return value;
    }

    const found = findFirstByKey(value, keys);
    if (found !== undefined && found !== null) {
      return found;
    }
  }

  return undefined;
}

function removeEmptyValues(value) {
  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (nestedValue === undefined || nestedValue === null || nestedValue === '') {
      return result;
    }

    if (Array.isArray(nestedValue)) {
      result[key] = nestedValue;
      return result;
    }

    if (nestedValue && typeof nestedValue === 'object') {
      const cleaned = removeEmptyValues(nestedValue);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
      return result;
    }

    result[key] = nestedValue;
    return result;
  }, {});
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function getHeaderValue(headers, name) {
  return headers && typeof headers.get === 'function' ? headers.get(name) : null;
}

function hasLiabilityData(liabilities) {
  if (Array.isArray(liabilities)) {
    return liabilities.some((item) => item.balance || item.monthlyPayment);
  }

  return Boolean(liabilities && (liabilities.totalBalance || liabilities.monthlyPayments));
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanDate(value) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function cleanSensitiveString(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const cleaned = String(value).replace(/\D/g, '');
  return cleaned || null;
}

function logInfo(message, details = {}) {
  console.info(`[kimure:equifax] ${message}`, details);
}

function logWarn(message, details = {}) {
  console.warn(`[kimure:equifax] ${message}`, details);
}

// Backward-compatible alias for existing callers.
async function getEquifaxCreditProfile(providedData) {
  return getEquifaxCreditProfileData({
    providedData
  });
}

module.exports = {
  getEquifaxCreditProfileData,
  getEquifaxCreditProfile,
  getEquifaxConfig,
  buildEquifaxCreditRequest,
  validateEquifaxConfig,
  normalizeEquifaxVerifiedData
};
