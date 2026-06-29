const ONEVIEW_OAUTH_SCOPE = 'https://api.equifax.com/business/oneview/consumer-credit/v1';
const OAUTH_GRANT_TYPE = 'client_credentials';
const OAUTH_TOKEN_METHOD = 'POST';
const SANDBOX_OAUTH_TOKEN_URL = 'https://api.sandbox.equifax.com/v2/oauth/token';
const OAUTH_TOKEN_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const OAUTH_TOKEN_FORM_FIELDS = Object.freeze({
  grant_type: OAUTH_GRANT_TYPE,
  scope: ONEVIEW_OAUTH_SCOPE
});
const POSTMAN_TOKEN_REQUEST_AUTH_MODE = 'inherit_auth_from_parent';
const POSTMAN_COLLECTION_AUTH_MODE = 'no_auth';
const POSTMAN_CREDENTIAL_PLACEMENT_CONFIRMED = false;
const OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES = Object.freeze({
  unset: 'unset',
  basicAuth: 'basic_auth',
  formBody: 'form_body'
});
const ALLOWED_OAUTH_CLIENT_CREDENTIAL_PLACEMENTS = new Set(Object.values(OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES));
const TOKEN_STRATEGY_MODES = Object.freeze({
  auto: 'auto',
  sandboxStaticToken: 'sandbox_static_token',
  clientCredentials: 'client_credentials',
  clientCredentialsPendingDocs: 'client_credentials_pending_docs'
});
const ALLOWED_TOKEN_STRATEGIES = new Set(Object.values(TOKEN_STRATEGY_MODES));
const OAUTH_TOKEN_EXCHANGE_FLAG = 'EQUIFAX_OAUTH_TOKEN_EXCHANGE_ENABLED';
const SANDBOX_STATIC_TOKEN_TEST_FLAG = 'EQUIFAX_SANDBOX_STATIC_TOKEN_TEST_ENABLED';
const SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG = 'EQUIFAX_SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_ENABLED';

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
      requestedTokenStrategy: TOKEN_STRATEGY_MODES.auto,
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
      oauthTokenContentTypeConfirmed: true,
      oauthScopeConfirmed: true,
      oauthClientCredentialPlacementConfirmed: false,
      oauthClientCredentialPlacementConfigured: false,
      oauthClientCredentialPlacementMode: OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.unset,
      postmanTokenRequestAuthMode: POSTMAN_TOKEN_REQUEST_AUTH_MODE,
      postmanCollectionAuthMode: POSTMAN_COLLECTION_AUTH_MODE,
      postmanCredentialPlacementConfirmed: POSTMAN_CREDENTIAL_PLACEMENT_CONFIRMED,
      oauthResponseExpiryConfirmed: false,
      oauthRequestFormatConfirmed: false,
      oauthBlockedUntilCredentialPlacement: false,
      oauthBlockedUntilResponseExpiry: false,
      oauthBlockedUntilProviderCallsEnabled: false,
      oauthTokenExchangeEnabled: false,
      oauthTokenExchangeReady: false,
      oauthBlockedUntilTokenExchangeEnabled: false,
      oauthBlockedUntilSandboxTokenUrl: false,
      sandboxStaticTokenTestEnabled: false,
      sandboxStaticTokenLiveSmokeTestEnabled: false,
      sandboxStaticTokenTestReady: false,
      sandboxStaticTokenTestUrlAllowed: false,
      sandboxStaticTokenTestBlockedReason: 'equifax_provider_disabled',
      tokenReady: false,
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
  const requestedTokenStrategy = resolveTokenStrategy(env);
  const requestedOauthClientCredentialPlacementMode = resolveClientCredentialPlacement(env, prefix);
  const oauthClientCredentialPlacementMode = ALLOWED_OAUTH_CLIENT_CREDENTIAL_PLACEMENTS.has(requestedOauthClientCredentialPlacementMode)
    ? requestedOauthClientCredentialPlacementMode
    : OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.unset;
  const oauthClientCredentialPlacementConfigured = oauthClientCredentialPlacementMode !== OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.unset;
  const staticSandboxTokenPresent = hasValue(env.EQUIFAX_SANDBOX_ACCESS_TOKEN);
  const sandboxStaticTokenStrategyRequested = requestedTokenStrategy === TOKEN_STRATEGY_MODES.sandboxStaticToken;
  const clientCredentialsStrategyRequested = requestedTokenStrategy === TOKEN_STRATEGY_MODES.clientCredentials;
  const clientCredentialsPendingDocsStrategyRequested = requestedTokenStrategy === TOKEN_STRATEGY_MODES.clientCredentialsPendingDocs;
  const staticSandboxTokenAllowed = environment === 'sandbox' && staticSandboxTokenPresent;
  const clientCredentialsConfigured = Boolean(credentials.clientId && credentials.clientSecret && credentials.scope);
  const tokenStrategy = sandboxStaticTokenStrategyRequested || (staticSandboxTokenAllowed && !clientCredentialsStrategyRequested && !clientCredentialsPendingDocsStrategyRequested)
    ? TOKEN_STRATEGY_MODES.sandboxStaticToken
    : clientCredentialsStrategyRequested
      ? TOKEN_STRATEGY_MODES.clientCredentials
      : TOKEN_STRATEGY_MODES.clientCredentialsPendingDocs;
  const providerCallsEnabled = env.EQUIFAX_PROVIDER_CALLS_ENABLED === 'true';
  const oauthTokenExchangeEnabled = env[OAUTH_TOKEN_EXCHANGE_FLAG] === 'true';
  const sandboxStaticTokenMode = tokenStrategy === TOKEN_STRATEGY_MODES.sandboxStaticToken;
  const clientCredentialsMode = tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentials;
  const sandboxStaticTokenTestEnabled = env[SANDBOX_STATIC_TOKEN_TEST_FLAG] === 'true';
  const sandboxStaticTokenLiveSmokeTestEnabled = env[SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG] === 'true';
  const sandboxStaticTokenTestUrlAllowed = isOfficialSandboxBaseUrl(credentials.baseUrl);
  const requiredEnvironmentKeys = sandboxStaticTokenMode
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

  if (clientCredentialsMode && environment === 'sandbox' && !hasValue(env.EQUIFAX_SANDBOX_OAUTH_TOKEN_URL)) {
    missingKeys.push('EQUIFAX_SANDBOX_OAUTH_TOKEN_URL');
  }

  if (staticSandboxTokenPresent && environment !== 'sandbox') {
    errors.push('EQUIFAX_SANDBOX_ACCESS_TOKEN is only allowed when EQUIFAX_ENVIRONMENT is sandbox.');
  }

  if (!ALLOWED_OAUTH_CLIENT_CREDENTIAL_PLACEMENTS.has(requestedOauthClientCredentialPlacementMode)) {
    errors.push('EQUIFAX_OAUTH_CLIENT_CREDENTIAL_PLACEMENT must be one of: unset, basic_auth, form_body.');
  }

  if (!ALLOWED_TOKEN_STRATEGIES.has(requestedTokenStrategy)) {
    errors.push('EQUIFAX_TOKEN_STRATEGY must be one of: auto, sandbox_static_token, client_credentials, client_credentials_pending_docs.');
  }

  if (sandboxStaticTokenStrategyRequested && environment !== 'sandbox') {
    errors.push('EQUIFAX_TOKEN_STRATEGY=sandbox_static_token is only allowed when EQUIFAX_ENVIRONMENT is sandbox.');
  }

  if (clientCredentialsStrategyRequested && environment !== 'sandbox') {
    errors.push('EQUIFAX_TOKEN_STRATEGY=client_credentials is currently allowed only when EQUIFAX_ENVIRONMENT is sandbox.');
  }

  if (clientCredentialsMode && environment === 'sandbox' && hasValue(env.EQUIFAX_SANDBOX_OAUTH_TOKEN_URL) && env.EQUIFAX_SANDBOX_OAUTH_TOKEN_URL.trim() !== SANDBOX_OAUTH_TOKEN_URL) {
    errors.push('EQUIFAX_SANDBOX_OAUTH_TOKEN_URL must exactly match the official Equifax sandbox OAuth token URL.');
  }

  if (sandboxStaticTokenMode && !staticSandboxTokenPresent) {
    missingKeys.push('EQUIFAX_SANDBOX_ACCESS_TOKEN');
  }

  if (sandboxStaticTokenTestEnabled && !sandboxStaticTokenTestUrlAllowed) {
    errors.push('Sandbox static-token test path requires the official Equifax sandbox OneView base URL.');
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
  const oauthTokenEndpointConfigured = environment === 'sandbox'
    ? (clientCredentialsMode ? credentials.tokenUrl === SANDBOX_OAUTH_TOKEN_URL : true)
    : Boolean(credentials.tokenUrl);
  const oauthClientCredentialPlacementConfirmed = false;
  const oauthResponseExpiryConfirmed = clientCredentialsMode;
  const oauthRequestFormatConfirmed = clientCredentialsMode;
  const oauthScopeMatchesOneView = Boolean(credentials.scope && credentials.scope === ONEVIEW_OAUTH_SCOPE);
  const oauthTokenExchangeReady = enabled &&
    uniqueErrors.length === 0 &&
    clientCredentialsMode &&
    environment === 'sandbox' &&
    oauthTokenExchangeEnabled &&
    providerCallsEnabled &&
    clientCredentialsConfigured &&
    oauthScopeMatchesOneView &&
    oauthClientCredentialPlacementConfigured &&
    credentials.tokenUrl === SANDBOX_OAUTH_TOKEN_URL;
  const tokenReady = tokenStrategy === TOKEN_STRATEGY_MODES.sandboxStaticToken
    ? staticSandboxTokenAllowed
    : oauthTokenExchangeReady;
  const tokenAvailableForProviderCall = tokenReady;
  const oauthBlockedUntilCredentialPlacement = (tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentialsPendingDocs ||
    tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentials) &&
    !oauthClientCredentialPlacementConfigured;
  const oauthBlockedUntilResponseExpiry = tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentialsPendingDocs &&
    !oauthResponseExpiryConfirmed;
  const oauthBlockedUntilProviderCallsEnabled = !providerCallsEnabled;
  const oauthBlockedUntilTokenExchangeEnabled = tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentials &&
    !oauthTokenExchangeEnabled;
  const oauthBlockedUntilSandboxTokenUrl = tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentials &&
    environment === 'sandbox' &&
    credentials.tokenUrl !== SANDBOX_OAUTH_TOKEN_URL;
  const sandboxStaticTokenTestBlockedReason = getSandboxStaticTokenTestBlockedReason({
    environment,
    tokenStrategy,
    staticSandboxTokenPresent,
    providerCallsEnabled,
    sandboxStaticTokenTestEnabled,
    sandboxStaticTokenTestUrlAllowed,
    sandboxStaticTokenLiveSmokeTestEnabled
  });
  const sandboxStaticTokenTestReady = configReady && sandboxStaticTokenTestBlockedReason === null;

  return safeStatus({
    enabled,
    environment,
    configReady,
    missingKeys: uniqueMissingKeys,
    warnings: uniqueWarnings,
    errors: uniqueErrors,
    mode,
    tokenStrategy,
    requestedTokenStrategy,
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
    oauthTokenContentTypeConfirmed: true,
    oauthScopeConfirmed: oauthScopeMatchesOneView,
    oauthClientCredentialPlacementConfirmed,
    oauthClientCredentialPlacementConfigured,
    oauthClientCredentialPlacementMode,
    postmanTokenRequestAuthMode: POSTMAN_TOKEN_REQUEST_AUTH_MODE,
    postmanCollectionAuthMode: POSTMAN_COLLECTION_AUTH_MODE,
    postmanCredentialPlacementConfirmed: POSTMAN_CREDENTIAL_PLACEMENT_CONFIRMED,
    oauthResponseExpiryConfirmed,
    oauthRequestFormatConfirmed,
    oauthBlockedUntilPortalDocs: tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentialsPendingDocs,
    oauthBlockedUntilCredentialPlacement,
    oauthBlockedUntilResponseExpiry,
    oauthBlockedUntilProviderCallsEnabled,
    oauthTokenExchangeEnabled,
    oauthTokenExchangeReady,
    oauthBlockedUntilTokenExchangeEnabled,
    oauthBlockedUntilSandboxTokenUrl,
    sandboxStaticTokenTestEnabled,
    sandboxStaticTokenLiveSmokeTestEnabled,
    sandboxStaticTokenTestReady,
    sandboxStaticTokenTestUrlAllowed,
    sandboxStaticTokenTestBlockedReason,
    tokenReady,
    providerCallsEnabled,
    canAttemptProviderCall: configReady &&
      providerCallsEnabled &&
      !sandboxStaticTokenLiveSmokeTestEnabled &&
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
    requestedTokenStrategy: status.requestedTokenStrategy,
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
    tokenUrl: resolveTokenUrl(env, environment, prefix),
    oauthGrantType: OAUTH_GRANT_TYPE,
    oauthTokenMethod: OAUTH_TOKEN_METHOD,
    oauthTokenContentType: OAUTH_TOKEN_CONTENT_TYPE,
    oauthTokenFormFields: OAUTH_TOKEN_FORM_FIELDS,
    oauthTokenEndpointConfigured: status.oauthTokenEndpointConfigured,
    oauthTokenContentTypeConfirmed: status.oauthTokenContentTypeConfirmed,
    oauthScopeConfirmed: status.oauthScopeConfirmed,
    oauthTokenExchangeEnabled: status.oauthTokenExchangeEnabled,
    oauthTokenExchangeReady: status.oauthTokenExchangeReady,
    oauthBlockedUntilTokenExchangeEnabled: status.oauthBlockedUntilTokenExchangeEnabled,
    oauthBlockedUntilSandboxTokenUrl: status.oauthBlockedUntilSandboxTokenUrl,
    oauthClientCredentialPlacementConfirmed: status.oauthClientCredentialPlacementConfirmed,
    oauthClientCredentialPlacementConfigured: status.oauthClientCredentialPlacementConfigured,
    oauthClientCredentialPlacementMode: status.oauthClientCredentialPlacementMode,
    postmanTokenRequestAuthMode: status.postmanTokenRequestAuthMode,
    postmanCollectionAuthMode: status.postmanCollectionAuthMode,
    postmanCredentialPlacementConfirmed: status.postmanCredentialPlacementConfirmed,
    sandboxStaticTokenTestEnabled: status.sandboxStaticTokenTestEnabled,
    sandboxStaticTokenLiveSmokeTestEnabled: status.sandboxStaticTokenLiveSmokeTestEnabled,
    sandboxStaticTokenTestReady: status.sandboxStaticTokenTestReady,
    sandboxStaticTokenTestUrlAllowed: status.sandboxStaticTokenTestUrlAllowed,
    sandboxStaticTokenTestBlockedReason: status.sandboxStaticTokenTestBlockedReason,
    tokenReady: status.tokenReady,
    oauthResponseExpiryConfirmed: status.oauthResponseExpiryConfirmed,
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
    'EQUIFAX_SANDBOX_OAUTH_TOKEN_URL',
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
    requestedTokenStrategy: ALLOWED_TOKEN_STRATEGIES.has(status.requestedTokenStrategy)
      ? status.requestedTokenStrategy
      : TOKEN_STRATEGY_MODES.auto,
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
    oauthTokenContentTypeConfirmed: Boolean(status.oauthTokenContentTypeConfirmed),
    oauthScopeConfirmed: Boolean(status.oauthScopeConfirmed),
    oauthClientCredentialPlacementConfirmed: Boolean(status.oauthClientCredentialPlacementConfirmed),
    oauthClientCredentialPlacementConfigured: Boolean(status.oauthClientCredentialPlacementConfigured),
    oauthClientCredentialPlacementMode: ALLOWED_OAUTH_CLIENT_CREDENTIAL_PLACEMENTS.has(status.oauthClientCredentialPlacementMode)
      ? status.oauthClientCredentialPlacementMode
      : OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.unset,
    postmanTokenRequestAuthMode: status.postmanTokenRequestAuthMode === POSTMAN_TOKEN_REQUEST_AUTH_MODE
      ? POSTMAN_TOKEN_REQUEST_AUTH_MODE
      : null,
    postmanCollectionAuthMode: status.postmanCollectionAuthMode === POSTMAN_COLLECTION_AUTH_MODE
      ? POSTMAN_COLLECTION_AUTH_MODE
      : null,
    postmanCredentialPlacementConfirmed: Boolean(status.postmanCredentialPlacementConfirmed),
    oauthResponseExpiryConfirmed: Boolean(status.oauthResponseExpiryConfirmed),
    oauthRequestFormatConfirmed: Boolean(status.oauthRequestFormatConfirmed),
    oauthBlockedUntilPortalDocs: Boolean(status.oauthBlockedUntilPortalDocs),
    oauthBlockedUntilCredentialPlacement: Boolean(status.oauthBlockedUntilCredentialPlacement),
    oauthBlockedUntilResponseExpiry: Boolean(status.oauthBlockedUntilResponseExpiry),
    oauthBlockedUntilProviderCallsEnabled: Boolean(status.oauthBlockedUntilProviderCallsEnabled),
    oauthTokenExchangeEnabled: Boolean(status.oauthTokenExchangeEnabled),
    oauthTokenExchangeReady: Boolean(status.oauthTokenExchangeReady),
    oauthBlockedUntilTokenExchangeEnabled: Boolean(status.oauthBlockedUntilTokenExchangeEnabled),
    oauthBlockedUntilSandboxTokenUrl: Boolean(status.oauthBlockedUntilSandboxTokenUrl),
    sandboxStaticTokenTestEnabled: Boolean(status.sandboxStaticTokenTestEnabled),
    sandboxStaticTokenLiveSmokeTestEnabled: Boolean(status.sandboxStaticTokenLiveSmokeTestEnabled),
    sandboxStaticTokenTestReady: Boolean(status.sandboxStaticTokenTestReady),
    sandboxStaticTokenTestUrlAllowed: Boolean(status.sandboxStaticTokenTestUrlAllowed),
    sandboxStaticTokenTestBlockedReason: status.sandboxStaticTokenTestBlockedReason || null,
    tokenReady: Boolean(status.tokenReady),
    providerCallsEnabled: Boolean(status.providerCallsEnabled),
    canAttemptProviderCall: Boolean(status.canAttemptProviderCall)
  };
}

function readEnvironmentCredentials(env, prefix) {
  return {
    baseUrl: valueOrNull(env[`${prefix}_BASE_URL`]),
    clientId: valueOrNull(env[`${prefix}_CLIENT_ID`]) || valueOrNull(env.EQUIFAX_CLIENT_ID),
    clientSecret: valueOrNull(env[`${prefix}_CLIENT_SECRET`]) || valueOrNull(env.EQUIFAX_CLIENT_SECRET),
    scope: valueOrNull(env[`${prefix}_SCOPE`]) || valueOrNull(env.EQUIFAX_SCOPE),
    tokenUrl: valueOrNull(env[`${prefix}_OAUTH_TOKEN_URL`]) ||
      valueOrNull(env[`${prefix}_TOKEN_URL`]) ||
      valueOrNull(env.EQUIFAX_OAUTH_TOKEN_URL) ||
      valueOrNull(env.EQUIFAX_TOKEN_URL),
    memberNumber: valueOrNull(env[`${prefix}_MEMBER_NUMBER`]),
    securityCode: valueOrNull(env[`${prefix}_SECURITY_CODE`])
  };
}

function resolveTokenUrl(env, environment, prefix) {
  const configuredTokenUrl = valueOrNull(env[`${prefix}_OAUTH_TOKEN_URL`]) ||
    valueOrNull(env[`${prefix}_TOKEN_URL`]) ||
    valueOrNull(env.EQUIFAX_OAUTH_TOKEN_URL) ||
    valueOrNull(env.EQUIFAX_TOKEN_URL);
  if (configuredTokenUrl) return configuredTokenUrl;
  return environment === 'sandbox' ? SANDBOX_OAUTH_TOKEN_URL : null;
}

function resolveClientCredentialPlacement(env, prefix) {
  const value = valueOrNull(env[`${prefix}_OAUTH_CLIENT_CREDENTIAL_PLACEMENT`]) ||
    valueOrNull(env.EQUIFAX_OAUTH_CLIENT_CREDENTIAL_PLACEMENT);
  return value
    ? value.toLowerCase()
    : OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.unset;
}

function resolveTokenStrategy(env) {
  const value = valueOrNull(env.EQUIFAX_TOKEN_STRATEGY);
  return value
    ? value.toLowerCase()
    : TOKEN_STRATEGY_MODES.auto;
}

function isOfficialSandboxBaseUrl(value) {
  return valueOrNull(value) === OFFICIAL_ONEVIEW_BASE_URLS.sandbox;
}

function getSandboxStaticTokenTestBlockedReason({
  environment,
  tokenStrategy,
  staticSandboxTokenPresent,
  providerCallsEnabled,
  sandboxStaticTokenTestEnabled,
  sandboxStaticTokenTestUrlAllowed,
  sandboxStaticTokenLiveSmokeTestEnabled
}) {
  if (!sandboxStaticTokenTestEnabled) return 'sandbox_static_token_test_disabled';
  if (sandboxStaticTokenLiveSmokeTestEnabled) return 'sandbox_static_token_live_smoke_test_not_implemented';
  if (environment !== 'sandbox') return 'sandbox_environment_required';
  if (tokenStrategy !== TOKEN_STRATEGY_MODES.sandboxStaticToken) return 'sandbox_static_token_strategy_required';
  if (!staticSandboxTokenPresent) return 'sandbox_access_token_required';
  if (!providerCallsEnabled) return 'provider_calls_enabled_required';
  if (!sandboxStaticTokenTestUrlAllowed) return 'official_sandbox_base_url_required';
  return null;
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
    if (isSafeControlKey(key)) return false;
    if (!SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))) return false;
    return hasValue(value) && serialized.includes(value);
  });
}

function isSafeControlKey(key) {
  return key === 'EQUIFAX_TOKEN_STRATEGY' ||
    key === OAUTH_TOKEN_EXCHANGE_FLAG ||
    key === SANDBOX_STATIC_TOKEN_TEST_FLAG ||
    key === SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG ||
    /_ENABLED$/.test(key);
}

module.exports = {
  buildEquifaxRuntimeConfig,
  OAUTH_GRANT_TYPE,
  OAUTH_TOKEN_METHOD,
  OAUTH_TOKEN_CONTENT_TYPE,
  OAUTH_TOKEN_FORM_FIELDS,
  OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES,
  TOKEN_STRATEGY_MODES,
  OAUTH_TOKEN_EXCHANGE_FLAG,
  SANDBOX_STATIC_TOKEN_TEST_FLAG,
  SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG,
  POSTMAN_TOKEN_REQUEST_AUTH_MODE,
  POSTMAN_COLLECTION_AUTH_MODE,
  POSTMAN_CREDENTIAL_PLACEMENT_CONFIRMED,
  OFFICIAL_ONEVIEW_BASE_URLS,
  ONEVIEW_OAUTH_SCOPE,
  SANDBOX_OAUTH_TOKEN_URL,
  validateEquifaxProviderConfig,
  statusContainsSecretValue
};
