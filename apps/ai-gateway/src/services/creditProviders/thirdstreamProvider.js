const {
  normalizeThirdstreamCreditReport
} = require('./normalizeCreditReport');

const DEFAULT_THIRDSTREAM_BASE_URL = 'https://api.test.thirdstream.ca';
const DEFAULT_EQUIFAX_PATH = '/equifaxconsumercredit/v3/consumer';
const DEFAULT_TRANSUNION_PATH = '/transunionconsumercredit/v3/consumer';
const DEFAULT_API_KEY_HEADER = 'X-API-Key';
const DEFAULT_TIMEOUT_MS = 15000;

function getThirdstreamConfig(providerName, env = process.env) {
  const bureau = providerName === 'thirdstream_transunion' ? 'transunion' : 'equifax';

  return {
    providerName,
    bureau,
    enabled: env.THIRDSTREAM_ENABLED === 'true',
    environment: env.THIRDSTREAM_ENVIRONMENT || 'sandbox',
    baseUrl: env.THIRDSTREAM_BASE_URL || DEFAULT_THIRDSTREAM_BASE_URL,
    endpointPath: bureau === 'transunion'
      ? env.THIRDSTREAM_TRANSUNION_PATH || DEFAULT_TRANSUNION_PATH
      : env.THIRDSTREAM_EQUIFAX_PATH || DEFAULT_EQUIFAX_PATH,
    apiKeyHeaderName: env.THIRDSTREAM_API_KEY_HEADER_NAME || DEFAULT_API_KEY_HEADER,
    apiKey: env.THIRDSTREAM_API_KEY || null,
    timeoutMs: Number(env.THIRDSTREAM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    apiLanguage: cleanString(env.THIRDSTREAM_API_LANGUAGE),
    apiContext: cleanString(env.THIRDSTREAM_API_CONTEXT),
    apiScope: cleanString(env.THIRDSTREAM_API_SCOPE)
  };
}

async function getThirdstreamCreditProfileData({
  providerName,
  providedData,
  requestContext = {},
  env = process.env,
  fetchImpl = fetch
}) {
  const startedAt = new Date().toISOString();
  const config = getThirdstreamConfig(providerName, env);
  const request = buildThirdstreamCreditRequest({
    providerName,
    providedData,
    requestContext
  });

  logInfo('credit-profile request start', {
    provider: providerName,
    bureau: config.bureau,
    environment: config.environment,
    enabled: config.enabled,
    consentProvided: request.consent.provided,
    requestReady: request.requestReady
  });

  if (!request.consent.provided) {
    return createUnavailableResult({
      status: 'consent_required',
      config,
      request,
      startedAt,
      unavailableReason: 'Thirdstream was not called because explicit credit bureau consent was not provided.',
      nextIntegrationStep: 'Capture explicit credit consent, consent timestamp/version, and permissible purpose.'
    });
  }

  if (!request.requestReady) {
    return createUnavailableResult({
      status: 'insufficient_input',
      config,
      request,
      startedAt,
      unavailableReason: `Thirdstream was not called because required consumer fields are missing: ${request.missingRequestFields.join(', ')}.`,
      nextIntegrationStep: 'Collect the missing identity and current-address fields without inventing values.'
    });
  }

  const configValidation = validateThirdstreamConfig(config);

  if (!configValidation.ready) {
    return createUnavailableResult({
      status: 'configuration_missing',
      config,
      request,
      startedAt,
      unavailableReason: `Thirdstream is selected but backend configuration is missing: ${configValidation.missing.join(', ')}. Directional mode was used.`,
      nextIntegrationStep: 'Add an approved Thirdstream subscription key and enable the backend adapter.'
    });
  }

  const endpoint = buildThirdstreamUrl(config);

  try {
    logInfo('provider request start', {
      provider: providerName,
      bureau: config.bureau,
      environment: config.environment,
      endpoint
    });

    const response = await postThirdstreamConsumerInquiry({
      url: endpoint,
      config,
      body: request.requestBody,
      fetchImpl
    });
    const providerStatus = classifyThirdstreamHttpStatus(response.httpStatus, response.ok);

    logInfo('provider response status', {
      provider: providerName,
      bureau: config.bureau,
      httpStatus: response.httpStatus,
      providerStatus,
      durationMs: response.durationMs
    });

    if (!response.ok) {
      return createUnavailableResult({
        status: providerStatus,
        config,
        request,
        startedAt,
        httpStatus: response.httpStatus,
        providerDiagnostics: response.providerDiagnostics,
        unavailableReason: buildProviderFailureMessage(providerStatus, response.httpStatus),
        nextIntegrationStep: 'Confirm subscription access, API key permissions, request schema, and test-environment availability.'
      });
    }

    if (!response.body || typeof response.body !== 'object') {
      return createUnavailableResult({
        status: 'provider_error',
        config,
        request,
        startedAt,
        httpStatus: response.httpStatus,
        unavailableReason: 'Thirdstream returned a successful HTTP status without a usable JSON response. Directional mode was used.',
        nextIntegrationStep: 'Confirm the subscription-specific response content type and schema.'
      });
    }

    const verifiedData = normalizeThirdstreamCreditReport({
      body: response.body,
      providerName,
      bureau: config.bureau,
      environment: config.environment
    });

    return {
      provider: providerName,
      bureau: config.bureau,
      source: providerName,
      status: 'verified',
      equifaxStatus: config.bureau === 'equifax' ? 'verified' : null,
      verified: true,
      dataClassification: config.environment === 'sandbox'
        ? 'verified_sandbox_bureau_data'
        : 'verified_provider_bureau_data',
      dataSource: 'thirdstream_consumer_credit',
      verifiedData,
      rawResponseStored: false,
      config: sanitizeThirdstreamConfig(config),
      request: sanitizeThirdstreamRequest(request),
      transaction: {
        endpoint,
        startedAt,
        completedAt: new Date().toISOString(),
        httpStatus: response.httpStatus,
        durationMs: response.durationMs,
        transactionId: response.transactionId,
        reportId: null
      },
      providerDiagnostics: null,
      unavailableReason: null,
      nextIntegrationStep: 'Validate normalized fields against approved subscription-specific examples before production use.'
    };
  } catch (error) {
    const status = error.name === 'AbortError' ? 'timeout' : 'provider_error';

    logWarn('provider request failed; using directional mode', {
      provider: providerName,
      bureau: config.bureau,
      errorName: error.name,
      status
    });

    return createUnavailableResult({
      status,
      config,
      request,
      startedAt,
      unavailableReason: status === 'timeout'
        ? 'Thirdstream request timed out. Directional mode was used.'
        : 'Thirdstream request failed. Directional mode was used.',
      nextIntegrationStep: 'Check provider availability, network access, timeout settings, and sanitized server logs.'
    });
  }
}

function buildThirdstreamCreditRequest({ providerName, providedData = {}, requestContext = {} }) {
  const bureau = providerName === 'thirdstream_transunion' ? 'transunion' : 'equifax';
  const applicant = normalizeApplicant(requestContext, providedData);
  const consentInput = requestContext.consent || providedData.consent || {};
  const missingRequestFields = getMissingThirdstreamRequestFields(applicant, bureau);
  const requestReady = missingRequestFields.length === 0;

  return {
    requestType: 'consumer_credit_inquiry',
    providerProduct: `${providerName}_consumer_credit`,
    bureau,
    customerReferenceNumber: cleanString(
      requestContext.customerReferenceNumber || requestContext.consumerReferenceId
    ),
    permissiblePurpose: cleanString(
      requestContext.permissiblePurpose || consentInput.permissiblePurpose
    ),
    consent: {
      provided: consentInput.provided === true || consentInput.accepted === true,
      capturedAt: consentInput.capturedAt || null,
      version: consentInput.version || null
    },
    applicantSnapshot: {
      firstNameProvided: Boolean(applicant.firstName),
      lastNameProvided: Boolean(applicant.lastName),
      dateOfBirthProvided: Boolean(applicant.dateOfBirth),
      socialInsuranceNumberProvided: Boolean(applicant.socialInsuranceNumber),
      phoneNumberProvided: Boolean(applicant.phoneNumber),
      currentAddressProvided: isCompleteAddress(applicant.currentAddress),
      previousAddressProvided: isAddressPresent(applicant.previousAddress)
    },
    requestReady,
    missingRequestFields,
    requestBody: requestReady
      ? buildThirdstreamRequestBody({
        bureau,
        applicant,
        customerReferenceNumber: requestContext.customerReferenceNumber || requestContext.consumerReferenceId
      })
      : null
  };
}

function normalizeApplicant(requestContext, providedData) {
  const applicant = requestContext.applicant || {};
  const profile = providedData.additionalProfile || {};
  const currentAddress = applicant.currentAddress || applicant.address || requestContext.currentAddress || requestContext.address || {};
  const previousAddress = applicant.previousAddress || requestContext.previousAddress || {};

  return {
    firstName: cleanString(applicant.firstName || applicant.givenName || profile.firstName),
    middleName: cleanString(applicant.middleName || profile.middleName),
    lastName: cleanString(applicant.lastName || applicant.familyName || profile.lastName),
    dateOfBirth: cleanDate(applicant.dateOfBirth || applicant.dob || profile.dateOfBirth || profile.dob),
    socialInsuranceNumber: cleanSensitiveNumber(
      applicant.socialInsuranceNumber || applicant.socialNumber || applicant.sin || profile.socialInsuranceNumber || profile.sin
    ),
    phoneNumber: cleanPhoneNumber(applicant.phoneNumber || applicant.phone || profile.phoneNumber || profile.phone),
    currentAddress: normalizeAddress(currentAddress),
    previousAddress: normalizeAddress(previousAddress)
  };
}

function normalizeAddress(address = {}) {
  return {
    unitNumber: cleanString(address.unitNumber || address.unit),
    civicNumber: cleanString(address.civicNumber || address.streetNumber),
    streetName: cleanString(address.streetName || address.street),
    city: cleanString(address.city || address.cityName || address['city/cityName']),
    provinceCode: cleanString(address.provinceCode || address.province || address.region),
    postalCode: cleanString(address.postalCode || address.postal || address.zip)
  };
}

function getMissingThirdstreamRequestFields(applicant, bureau) {
  const missing = [];
  const cityField = bureau === 'transunion' ? 'currentAddress.city' : 'currentAddress.cityName';

  if (!applicant.firstName) missing.push('firstName');
  if (!applicant.lastName) missing.push('lastName');
  if (!applicant.dateOfBirth) missing.push('dateOfBirth');
  if (!applicant.currentAddress.streetName) missing.push('currentAddress.streetName');
  if (!applicant.currentAddress.city) missing.push(cityField);
  if (!applicant.currentAddress.provinceCode) missing.push('currentAddress.provinceCode');
  if (!applicant.currentAddress.postalCode) missing.push('currentAddress.postalCode');

  return missing;
}

function buildThirdstreamRequestBody({ bureau, applicant, customerReferenceNumber }) {
  const subject = compactObject({
    firstName: applicant.firstName,
    middleName: applicant.middleName,
    lastName: applicant.lastName,
    dateOfBirth: applicant.dateOfBirth,
    socialInsuranceNumber: applicant.socialInsuranceNumber,
    phoneNumber: applicant.phoneNumber,
    currentAddress: buildProviderAddress(applicant.currentAddress, bureau),
    previousAddress: isAddressPresent(applicant.previousAddress)
      ? buildProviderAddress(applicant.previousAddress, bureau)
      : null
  });

  return compactObject({
    customerReferenceNumber: cleanString(customerReferenceNumber),
    subject
  });
}

function buildProviderAddress(address, bureau) {
  const cityKey = bureau === 'transunion' ? 'city' : 'cityName';

  return compactObject({
    unitNumber: address.unitNumber,
    civicNumber: address.civicNumber,
    streetName: address.streetName,
    [cityKey]: address.city,
    provinceCode: address.provinceCode,
    postalCode: address.postalCode
  });
}

function validateThirdstreamConfig(config) {
  const missing = [];

  if (!config.enabled) missing.push('THIRDSTREAM_ENABLED=true');
  if (!config.baseUrl) missing.push('THIRDSTREAM_BASE_URL');
  if (!config.endpointPath) missing.push(config.bureau === 'transunion' ? 'THIRDSTREAM_TRANSUNION_PATH' : 'THIRDSTREAM_EQUIFAX_PATH');
  if (!config.apiKeyHeaderName) missing.push('THIRDSTREAM_API_KEY_HEADER_NAME');
  if (!config.apiKey) missing.push('THIRDSTREAM_API_KEY');
  if (!['sandbox', 'production'].includes(config.environment)) missing.push('THIRDSTREAM_ENVIRONMENT=sandbox|production');
  if (config.environment === 'production' && config.baseUrl === DEFAULT_THIRDSTREAM_BASE_URL) {
    missing.push('production THIRDSTREAM_BASE_URL');
  }

  return {
    ready: missing.length === 0,
    missing
  };
}

async function postThirdstreamConsumerInquiry({ url, config, body, fetchImpl }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();

  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [config.apiKeyHeaderName]: config.apiKey
    };

    if (config.apiLanguage) headers['X-API-Language'] = config.apiLanguage;
    if (config.apiContext) headers['X-API-Context'] = config.apiContext;
    if (config.apiScope) headers['X-API-Scope'] = config.apiScope;

    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const responseText = await response.text();
    const parsedBody = parseJsonSafely(responseText);

    return {
      ok: response.ok,
      httpStatus: response.status,
      body: parsedBody,
      durationMs: Date.now() - startedAt,
      transactionId: getHeader(response.headers, 'x-transaction-id') ||
        getHeader(response.headers, 'x-correlation-id') || null,
      providerDiagnostics: response.ok ? null : sanitizeProviderDiagnostics(parsedBody)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classifyThirdstreamHttpStatus(httpStatus, ok = false) {
  if (ok) return 'verified';
  if (httpStatus === 401) return 'unauthorized';
  if (httpStatus === 403) return 'forbidden';
  if ([400, 409, 422].includes(httpStatus)) return 'provider_validation_error';
  if (httpStatus === 408) return 'timeout';
  if (httpStatus === 429 || httpStatus >= 500) return 'provider_unavailable';
  return 'provider_error';
}

function createUnavailableResult({
  status,
  config,
  request,
  startedAt,
  unavailableReason,
  nextIntegrationStep,
  httpStatus = null,
  providerDiagnostics = null
}) {
  return {
    provider: config.providerName,
    bureau: config.bureau,
    source: config.providerName,
    status,
    equifaxStatus: config.bureau === 'equifax' ? status : null,
    verified: false,
    dataClassification: 'unverified',
    dataSource: 'none',
    verifiedData: null,
    rawResponseStored: false,
    config: sanitizeThirdstreamConfig(config),
    request: sanitizeThirdstreamRequest(request),
    transaction: {
      endpoint: buildThirdstreamUrl(config),
      startedAt,
      completedAt: new Date().toISOString(),
      httpStatus,
      transactionId: providerDiagnostics && providerDiagnostics.transactionId || null,
      reportId: null
    },
    providerDiagnostics,
    unavailableReason,
    nextIntegrationStep
  };
}

function sanitizeThirdstreamConfig(config) {
  return {
    enabled: config.enabled,
    environment: config.environment,
    bureau: config.bureau,
    baseUrlConfigured: Boolean(config.baseUrl),
    endpointPath: config.endpointPath,
    apiKeyConfigured: Boolean(config.apiKey),
    apiKeyHeaderName: config.apiKeyHeaderName,
    apiLanguageConfigured: Boolean(config.apiLanguage),
    apiContextConfigured: Boolean(config.apiContext),
    apiScopeConfigured: Boolean(config.apiScope),
    timeoutMs: config.timeoutMs
  };
}

function sanitizeThirdstreamRequest(request) {
  return {
    requestType: request.requestType,
    providerProduct: request.providerProduct,
    bureau: request.bureau,
    customerReferenceNumber: request.customerReferenceNumber,
    permissiblePurpose: request.permissiblePurpose,
    consent: request.consent,
    applicantSnapshot: request.applicantSnapshot,
    requestReady: request.requestReady,
    missingRequestFields: request.missingRequestFields,
    requestBodyFieldsSent: request.requestBody ? Object.keys(request.requestBody) : []
  };
}

function sanitizeProviderDiagnostics(body) {
  if (!body || typeof body !== 'object') return null;

  return {
    code: findSafeValue(body, ['code', 'errorCode', 'statusCode']),
    message: findSafeValue(body, ['message', 'errorMessage', 'description']),
    transactionId: findSafeValue(body, ['transactionId', 'correlationId'])
  };
}

function findSafeValue(source, keys) {
  if (!source || typeof source !== 'object') return null;

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findSafeValue(item, keys);
      if (found !== null) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(source)) {
    if (/token|key|secret|social|sin|birth|address|sourceResponse|contentBase64/i.test(key)) continue;
    if (keys.includes(key) && ['string', 'number'].includes(typeof value)) return String(value).slice(0, 300);

    const found = findSafeValue(value, keys);
    if (found !== null) return found;
  }

  return null;
}

function buildProviderFailureMessage(status, httpStatus) {
  const messages = {
    unauthorized: 'Thirdstream rejected the subscription key (HTTP 401). Directional mode was used.',
    forbidden: 'Thirdstream denied access to the selected product (HTTP 403). Directional mode was used.',
    provider_validation_error: `Thirdstream rejected the consumer inquiry payload (HTTP ${httpStatus}). Directional mode was used.`,
    provider_unavailable: `Thirdstream is unavailable or rate limited (HTTP ${httpStatus}). Directional mode was used.`,
    timeout: 'Thirdstream request timed out. Directional mode was used.'
  };

  return messages[status] || `Thirdstream returned HTTP ${httpStatus}. Directional mode was used.`;
}

function buildThirdstreamUrl(config) {
  return `${String(config.baseUrl).replace(/\/$/, '')}/${String(config.endpointPath).replace(/^\//, '')}`;
}

function isCompleteAddress(address) {
  return Boolean(address.streetName && address.city && address.provinceCode && address.postalCode);
}

function isAddressPresent(address) {
  return Boolean(address && Object.values(address).some(Boolean));
}

function compactObject(value) {
  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (nestedValue !== null && nestedValue !== undefined && nestedValue !== '') {
      result[key] = nestedValue;
    }
    return result;
  }, {});
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanDate(value) {
  const cleaned = cleanString(value);
  return cleaned && /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function cleanSensitiveNumber(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/\D/g, '');
  return cleaned || null;
}

function cleanPhoneNumber(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const original = String(value).trim();
  const digits = original.replace(/\D/g, '');
  if (!digits) return null;
  return original.startsWith('+') ? `+${digits}` : digits;
}

function parseJsonSafely(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function getHeader(headers, name) {
  return headers && typeof headers.get === 'function' ? headers.get(name) : null;
}

function logInfo(message, details) {
  console.info(`[kimure:thirdstream] ${message}`, details);
}

function logWarn(message, details) {
  console.warn(`[kimure:thirdstream] ${message}`, details);
}

module.exports = {
  getThirdstreamCreditProfileData,
  getThirdstreamConfig,
  buildThirdstreamCreditRequest,
  buildThirdstreamRequestBody,
  validateThirdstreamConfig,
  classifyThirdstreamHttpStatus
};

