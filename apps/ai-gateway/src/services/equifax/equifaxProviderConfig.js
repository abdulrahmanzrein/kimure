const ONEVIEW_OAUTH_SCOPE = 'https://api.equifax.com/business/oneview/consumer-credit/v1';
const OAUTH_GRANT_TYPE = 'client_credentials';
const OAUTH_TOKEN_METHOD = 'POST';

const OFFICIAL_ONEVIEW_BASE_URLS = Object.freeze({
  sandbox: 'https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1',
  uat: 'https://api.uat.equifax.com/business/oneview/consumer-credit/v1',
  production: 'https://api.equifax.com/business/oneview/consumer-credit/v1'
});

const SUPPORTED_ENVIRONMENTS = new Set(['sandbox', 'test', 'uat', 'production']);

const ENVIRONMENT_PREFIXES = Object.freeze({
  sandbox: 'EQUIFAX_SANDBOX',
  test: 'EQUIFAX_TEST',
  uat: 'EQUIFAX_UAT',
  production: 'EQUIFAX_PRODUCTION'
});

const SHARED_REQUIRED_KEYS = Object.freeze([
  'EQUIFAX_TIMEOUT_MS',
  'EQUIFAX_RETRY_COUNT',
  'EQUIFAX_PRODUCT_CODE',
  'EQUIFAX_CONSENT_VERSION',
  'EQUIFAX_PERMISSIBLE_PURPOSE_CODE'
]);

const ENVIRONMENT_REQUIRED_SUFFIXES = Object.freeze([
  'BASE_URL',
  'CLIENT_ID',
  'CLIENT_SECRET',
  'SCOPE',
  'MEMBER_NUMBER',
  'SECURITY_CODE',
  'CUSTOMER_CODE'
]);

const SECRET_KEY_PATTERNS = [
  /TOKEN/i,
  /SECRET/i,
  /CLIENT_ID/i,
  /MEMBER_NUMBER/i,
  /SECURITY_CODE/i,
  /CUSTOMER_CODE/i,
  /PRODUCT_CODE/i,
  /SCOPE/i,
  /BASE_URL/i,
  /PERMISSIBLE_PURPOSE_CODE/i
];

function validateEquifaxProviderConfig(env = process.env) {
  const enabled = env.EQUIFAX_ENABLED === 'true';
  const environment = normalizeEnvironment(env.EQUIFAX_ENVIRONMENT);
  const mode = enabled ? environment : 'disabled';
  const missingKeys = [];
  const warnings = [];
  const errors = [];

  if (!enabled) {
    return safeStatus({
      enabled,
      environment,
      configReady: false,
      missingKeys,
      warnings: ['EQUIFAX_ENABLED is not true; Equifax provider calls are disabled.'],
      errors,
      mode,
      tokenStrategy: 'none',
      sandboxTokenConfigured: false,
      clientCredentialsConfigured: false,
      memberNumberConfigured: false,
      securityCodeConfigured: false,
      permissiblePurposeConfigured: false,
      scopeConfigured: false,
      oauthBlockedUntilPortalDocs: false,
      oauthGrantTypeConfirmed: true,
      oauthTokenPostConfirmed: true,
      oauthTokenEndpointConfigured: false,
      oauthRequestFormatConfirmed: false,
      providerCallsEnabled: false,
      canAttemptProviderCall: false
    });
  }

  if (!SUPPORTED_ENVIRONMENTS.has(environment)) {
    errors.push('EQUIFAX_ENVIRONMENT must be one of: sandbox, test, uat, production.');
  }

  requirePresentKeys(env, ['EQUIFAX_ENABLED', 'EQUIFAX_ENVIRONMENT', ...SHARED_REQUIRED_KEYS], missingKeys);

  const prefix = ENVIRONMENT_PREFIXES[environment] || ENVIRONMENT_PREFIXES.sandbox;
  const environmentKeys = ENVIRONMENT_REQUIRED_SUFFIXES.map((suffix) => `${prefix}_${suffix}`);
  const credentials = readEnvironmentCredentials(env, prefix);
  const staticSandboxTokenPresent = hasValue(env.EQUIFAX_SANDBOX_ACCESS_TOKEN);
  const staticSandboxTokenAllowed = environment === 'sandbox' && staticSandboxTokenPresent;
  const clientCredentialsConfigured = Boolean(credentials.clientId && credentials.clientSecret && credentials.scope);
  const tokenStrategy = staticSandboxTokenAllowed ? 'sandbox_static_token' : 'client_credentials_pending_docs';
  const providerCallsEnabled = env.EQUIFAX_PROVIDER_CALLS_ENABLED === 'true';
  const requiredEnvironmentKeys = staticSandboxTokenAllowed
    ? environmentKeys.filter((key) => ![
      'EQUIFAX_SANDBOX_CLIENT_ID',
      'EQUIFAX_SANDBOX_CLIENT_SECRET',
      'EQUIFAX_SANDBOX_SCOPE'
    ].includes(key))
    : environmentKeys.filter((key) => {
      if (key === `${prefix}_CLIENT_ID` && hasValue(env.EQUIFAX_CLIENT_ID)) return false;
      if (key === `${prefix}_CLIENT_SECRET` && hasValue(env.EQUIFAX_CLIENT_SECRET)) return false;
      if (key === `${prefix}_SCOPE` && hasValue(env.EQUIFAX_SCOPE)) return false;
      return true;
    });

  requirePresentKeys(env, requiredEnvironmentKeys, missingKeys);

  if (staticSandboxTokenPresent && environment !== 'sandbox') {
    errors.push('EQUIFAX_SANDBOX_ACCESS_TOKEN is only allowed when EQUIFAX_ENVIRONMENT is sandbox.');
  }

  if (environment === 'production') {
    addProductionGuardrails(env, errors);
  } else {
    addNonProductionWarnings(env, environment, warnings);
  }

  addPlaceholderErrors(env, [
    ...SHARED_REQUIRED_KEYS,
    ...environmentKeys,
    'EQUIFAX_SANDBOX_ACCESS_TOKEN'
  ], errors, environment);

  const uniqueMissingKeys = uniqueStrings(missingKeys);
  const uniqueWarnings = uniqueStrings(warnings);
  const uniqueErrors = uniqueStrings(errors);
  const configReady = enabled && uniqueMissingKeys.length === 0 && uniqueErrors.length === 0;
  const tokenConfigured = staticSandboxTokenAllowed || clientCredentialsConfigured;
  const oauthTokenEndpointConfigured = Boolean(credentials.tokenUrl);
  const oauthRequestFormatConfirmed = false;
  const tokenAvailableForProviderCall = staticSandboxTokenAllowed;

  return safeStatus({
    enabled,
    environment,
    configReady,
    missingKeys: uniqueMissingKeys,
    warnings: uniqueWarnings,
    errors: uniqueErrors,
    mode,
    tokenStrategy,
    tokenConfigured,
    sandboxTokenConfigured: staticSandboxTokenAllowed,
    clientCredentialsConfigured,
    memberNumberConfigured: Boolean(credentials.memberNumber),
    securityCodeConfigured: Boolean(credentials.securityCode),
    permissiblePurposeConfigured: hasValue(env.EQUIFAX_PERMISSIBLE_PURPOSE_CODE),
    scopeConfigured: Boolean(credentials.scope),
    oauthGrantTypeConfirmed: true,
    oauthTokenPostConfirmed: true,
    oauthTokenEndpointConfigured,
    oauthRequestFormatConfirmed,
    oauthBlockedUntilPortalDocs: tokenStrategy === 'client_credentials_pending_docs',
    providerCallsEnabled,
    canAttemptProviderCall: configReady &&
      providerCallsEnabled &&
      tokenAvailableForProviderCall &&
      Boolean(credentials.memberNumber) &&
      Boolean(credentials.securityCode) &&
      hasValue(env.EQUIFAX_PERMISSIBLE_PURPOSE_CODE)
  });
}

function buildEquifaxRuntimeConfig(env = process.env) {
  const status = validateEquifaxProviderConfig(env);
  const environment = status.environment;
  const prefix = ENVIRONMENT_PREFIXES[environment] || ENVIRONMENT_PREFIXES.sandbox;

  return {
    enabled: status.enabled,
    environment,
    configReady: status.configReady,
    mode: status.mode,
    tokenStrategy: status.tokenStrategy,
    providerConfigStatus: status,
    providerCallsEnabled: status.providerCallsEnabled,
    baseUrl: valueOrNull(env[`${prefix}_BASE_URL`]),
    reportPath: valueOrNull(env.EQUIFAX_REPORT_PATH) || '/reports/credit-report',
    officialScope: ONEVIEW_OAUTH_SCOPE,
    scope: valueOrNull(env[`${prefix}_SCOPE`]) || valueOrNull(env.EQUIFAX_SCOPE),
    sandboxAccessToken: environment === 'sandbox'
      ? valueOrNull(env.EQUIFAX_SANDBOX_ACCESS_TOKEN)
      : null,
    clientId: valueOrNull(env[`${prefix}_CLIENT_ID`]) || valueOrNull(env.EQUIFAX_CLIENT_ID),
    clientSecret: valueOrNull(env[`${prefix}_CLIENT_SECRET`]) || valueOrNull(env.EQUIFAX_CLIENT_SECRET),
    tokenUrl: valueOrNull(env[`${prefix}_TOKEN_URL`]) || valueOrNull(env.EQUIFAX_TOKEN_URL),
    oauthGrantType: OAUTH_GRANT_TYPE,
    oauthTokenMethod: OAUTH_TOKEN_METHOD,
    oauthTokenEndpointConfigured: status.oauthTokenEndpointConfigured,
    oauthRequestFormatConfirmed: status.oauthRequestFormatConfirmed,
    memberNumber: valueOrNull(env[`${prefix}_MEMBER_NUMBER`]),
    securityCode: valueOrNull(env[`${prefix}_SECURITY_CODE`]),
    customerCode: valueOrNull(env[`${prefix}_CUSTOMER_CODE`]),
    productCode: valueOrNull(env.EQUIFAX_PRODUCT_CODE),
    consentVersion: valueOrNull(env.EQUIFAX_CONSENT_VERSION),
    permissiblePurposeCode: valueOrNull(env.EQUIFAX_PERMISSIBLE_PURPOSE_CODE),
    timeoutMs: parsePositiveInteger(env.EQUIFAX_TIMEOUT_MS, 10000),
    retryCount: parseNonNegativeInteger(env.EQUIFAX_RETRY_COUNT, 0)
  };
}

function normalizeEnvironment(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || 'sandbox';
}

function requirePresentKeys(env, keys, missingKeys) {
  keys.forEach((key) => {
    if (!hasValue(env[key])) {
      missingKeys.push(key);
    }
  });
}

function addProductionGuardrails(env, errors) {
  if (hasValue(env.EQUIFAX_SANDBOX_ACCESS_TOKEN)) {
    errors.push('Production mode must not use EQUIFAX_SANDBOX_ACCESS_TOKEN.');
  }

  if (containsSandboxMarker(env.EQUIFAX_PRODUCTION_BASE_URL)) {
    errors.push('Production mode must not use a sandbox base URL.');
  }

  [
    'EQUIFAX_BASE_URL',
    'EQUIFAX_API_BASE_URL',
    'EQUIFAX_SANDBOX_BASE_URL',
    'EQUIFAX_SANDBOX_TOKEN_URL',
    'EQUIFAX_SANDBOX_CLIENT_ID',
    'EQUIFAX_SANDBOX_CLIENT_SECRET',
    'EQUIFAX_SANDBOX_SCOPE',
    'EQUIFAX_SANDBOX_MEMBER_NUMBER',
    'EQUIFAX_SANDBOX_SECURITY_CODE',
    'EQUIFAX_SANDBOX_CUSTOMER_CODE',
    'EQUIFAX_CLIENT_ID',
    'EQUIFAX_CLIENT_SECRET'
  ].forEach((key) => {
    if (hasValue(env[key])) {
      errors.push(`Production mode must use production-prefixed Equifax config, not ${key}.`);
    }
  });
}

function addNonProductionWarnings(env, environment, warnings) {
  if (environment === 'sandbox' && hasValue(env.EQUIFAX_SANDBOX_ACCESS_TOKEN)) {
    warnings.push('EQUIFAX_SANDBOX_ACCESS_TOKEN is accepted only for sandbox test workflows.');
  }

  if (hasValue(env.EQUIFAX_BASE_URL) || hasValue(env.EQUIFAX_API_BASE_URL)) {
    warnings.push('Use environment-prefixed Equifax base URL keys instead of legacy base URL keys.');
  }
}

function addPlaceholderErrors(env, keys, errors, environment) {
  keys.forEach((key) => {
    if (!hasValue(env[key])) return;
    if (environment !== 'production' && key === 'EQUIFAX_SANDBOX_ACCESS_TOKEN') return;
    if (looksPlaceholder(env[key])) {
      errors.push(`${key} must not use placeholder or demo values.`);
    }
  });
}

function safeStatus(status) {
  return {
    enabled: Boolean(status.enabled),
    environment: status.environment,
    configReady: Boolean(status.configReady),
    missingKeys: sanitizeMessages(status.missingKeys || []),
    warnings: sanitizeMessages(status.warnings || []),
    errors: sanitizeMessages(status.errors || []),
    mode: status.mode,
    tokenStrategy: status.tokenStrategy,
    tokenConfigured: Boolean(status.tokenConfigured),
    sandboxTokenConfigured: Boolean(status.sandboxTokenConfigured),
    clientCredentialsConfigured: Boolean(status.clientCredentialsConfigured),
    memberNumberConfigured: Boolean(status.memberNumberConfigured),
    securityCodeConfigured: Boolean(status.securityCodeConfigured),
    permissiblePurposeConfigured: Boolean(status.permissiblePurposeConfigured),
    scopeConfigured: Boolean(status.scopeConfigured),
    oauthGrantTypeConfirmed: Boolean(status.oauthGrantTypeConfirmed),
    oauthTokenPostConfirmed: Boolean(status.oauthTokenPostConfirmed),
    oauthTokenEndpointConfigured: Boolean(status.oauthTokenEndpointConfigured),
    oauthRequestFormatConfirmed: Boolean(status.oauthRequestFormatConfirmed),
    oauthBlockedUntilPortalDocs: Boolean(status.oauthBlockedUntilPortalDocs),
    providerCallsEnabled: Boolean(status.providerCallsEnabled),
    canAttemptProviderCall: Boolean(status.canAttemptProviderCall)
  };
}

function readEnvironmentCredentials(env, prefix) {
  return {
    clientId: valueOrNull(env[`${prefix}_CLIENT_ID`]) || valueOrNull(env.EQUIFAX_CLIENT_ID),
    clientSecret: valueOrNull(env[`${prefix}_CLIENT_SECRET`]) || valueOrNull(env.EQUIFAX_CLIENT_SECRET),
    scope: valueOrNull(env[`${prefix}_SCOPE`]) || valueOrNull(env.EQUIFAX_SCOPE),
    tokenUrl: valueOrNull(env[`${prefix}_TOKEN_URL`]) || valueOrNull(env.EQUIFAX_TOKEN_URL),
    memberNumber: valueOrNull(env[`${prefix}_MEMBER_NUMBER`]),
    securityCode: valueOrNull(env[`${prefix}_SECURITY_CODE`])
  };
}

function sanitizeMessages(values) {
  return uniqueStrings(values.map((value) => sanitizeMessage(String(value))));
}

function sanitizeMessage(value) {
  return value
    .replace(/https?:\/\/[^\s,)]+/gi, '[REDACTED_URL]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function valueOrNull(value) {
  return hasValue(value) ? value.trim() : null;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function containsSandboxMarker(value) {
  return hasValue(value) && /sandbox/i.test(value);
}

function looksPlaceholder(value) {
  if (!hasValue(value)) return false;
  const normalized = value.trim().toLowerCase();
  return [
    'placeholder',
    'change_me',
    'changeme',
    'todo',
    'demo',
    'example',
    'fake',
    'your_',
    'replace_me'
  ].some((marker) => normalized.includes(marker));
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function statusContainsSecretValue(status, env) {
  const serialized = JSON.stringify(status);

  return Object.entries(env).some(([key, value]) => {
    if (!SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))) return false;
    return hasValue(value) && serialized.includes(value);
  });
}

module.exports = {
  buildEquifaxRuntimeConfig,
  OAUTH_GRANT_TYPE,
  OAUTH_TOKEN_METHOD,
  OFFICIAL_ONEVIEW_BASE_URLS,
  ONEVIEW_OAUTH_SCOPE,
  validateEquifaxProviderConfig,
  statusContainsSecretValue
};
