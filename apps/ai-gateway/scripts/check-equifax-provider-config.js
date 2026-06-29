const assert = require('node:assert/strict');
const {
  buildEquifaxRuntimeConfig,
  OAUTH_GRANT_TYPE,
  OAUTH_TOKEN_CONTENT_TYPE,
  OAUTH_TOKEN_FORM_FIELDS,
  OAUTH_TOKEN_METHOD,
  ONEVIEW_OAUTH_SCOPE,
  SANDBOX_OAUTH_TOKEN_URL,
  statusContainsSecretValue,
  validateEquifaxProviderConfig
} = require('../src/services/equifax/equifaxProviderConfig');
const {
  resolveCreditProviderName
} = require('../src/services/creditProviders');

function run() {
  checkDisabledProvider();
  checkSandboxStaticTokenReady();
  checkSandboxMissingKeys();
  checkProductionRejectsSandboxValues();
  checkProductionRejectsPlaceholders();
  checkProductionRequiresProductionPrefixedKeys();
  checkRuntimeConfigKeepsSecretsInternal();
  checkGenericSandboxClientCredentialsAreDetectedButBlocked();
  checkExplicitProviderCallGateRequired();
  checkRegistryStillSupportsFutureProviders();
  console.log('[PASS] Equifax provider config checks (10 assertion groups)');
}

function checkDisabledProvider() {
  const status = validateEquifaxProviderConfig({});

  assert.equal(status.enabled, false);
  assert.equal(status.configReady, false);
  assert.equal(status.canAttemptProviderCall, false);
  assert.equal(status.tokenStrategy, 'none');
  assert.equal(statusContainsSecretValue(status, {}), false);
}

function checkSandboxStaticTokenReady() {
  const env = createSandboxStaticTokenEnv();
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.enabled, true);
  assert.equal(status.environment, 'sandbox');
  assert.equal(status.configReady, true);
  assert.equal(status.tokenStrategy, 'sandbox_static_token');
  assert.equal(status.sandboxTokenConfigured, true);
  assert.equal(status.clientCredentialsConfigured, false);
  assert.equal(status.memberNumberConfigured, true);
  assert.equal(status.securityCodeConfigured, true);
  assert.equal(status.permissiblePurposeConfigured, true);
  assert.equal(status.oauthGrantTypeConfirmed, true);
  assert.equal(status.oauthTokenPostConfirmed, true);
  assert.equal(status.oauthTokenEndpointConfigured, true);
  assert.equal(status.oauthTokenContentTypeConfirmed, true);
  assert.equal(status.oauthScopeConfirmed, false);
  assert.equal(status.oauthClientCredentialPlacementConfirmed, false);
  assert.equal(status.oauthResponseExpiryConfirmed, false);
  assert.equal(status.oauthRequestFormatConfirmed, false);
  assert.equal(status.providerCallsEnabled, false);
  assert.equal(status.canAttemptProviderCall, false);
  assert.equal(statusContainsSecretValue(status, env), false);
}

function createSandboxStaticTokenEnv() {
  return {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '0',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: '57',
    EQUIFAX_SANDBOX_BASE_URL: 'https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1',
    EQUIFAX_SANDBOX_ACCESS_TOKEN: 'sandbox-token-secret-value',
    EQUIFAX_SANDBOX_MEMBER_NUMBER: 'sandbox-member-secret-value',
    EQUIFAX_SANDBOX_SECURITY_CODE: 'sandbox-security-secret-value',
    EQUIFAX_SANDBOX_CUSTOMER_CODE: 'sandbox-customer-secret-value'
  };
}

function checkSandboxMissingKeys() {
  const env = {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox'
  };
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.configReady, false);
  assert.ok(status.missingKeys.includes('EQUIFAX_PRODUCT_CODE'));
  assert.ok(status.missingKeys.includes('EQUIFAX_PERMISSIBLE_PURPOSE_CODE'));
  assert.ok(status.missingKeys.includes('EQUIFAX_SANDBOX_BASE_URL'));
  assert.equal(status.missingKeys.includes('EQUIFAX_SANDBOX_TOKEN_URL'), false);
  assert.equal(status.missingKeys.some((key) => key.includes('secret-value')), false);
  assert.equal(status.errors.some((message) => message.includes('secret-value')), false);
}

function checkProductionRejectsSandboxValues() {
  const env = {
    ...createProductionEnv(),
    EQUIFAX_PRODUCTION_BASE_URL: 'https://sandbox.equifax.invalid/oneview',
    EQUIFAX_SANDBOX_ACCESS_TOKEN: 'sandbox-token-secret-value'
  };
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.configReady, false);
  assert.ok(status.errors.includes('Production mode must not use a sandbox base URL.'));
  assert.ok(status.errors.includes('Production mode must not use EQUIFAX_SANDBOX_ACCESS_TOKEN.'));
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkProductionRejectsPlaceholders() {
  const env = {
    ...createProductionEnv(),
    EQUIFAX_PRODUCTION_CLIENT_SECRET: 'change_me'
  };
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.configReady, false);
  assert.ok(status.errors.includes('EQUIFAX_PRODUCTION_CLIENT_SECRET must not use placeholder or demo values.'));
  assert.equal(JSON.stringify(status).includes('change_me'), false);
}

function checkProductionRequiresProductionPrefixedKeys() {
  const env = {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'production',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '1',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_BASE_URL: 'https://api.equifax.invalid/legacy',
    EQUIFAX_SANDBOX_CLIENT_ID: 'sandbox-client-id-secret-value'
  };
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.configReady, false);
  assert.ok(status.missingKeys.includes('EQUIFAX_PRODUCTION_BASE_URL'));
  assert.ok(status.missingKeys.includes('EQUIFAX_PRODUCTION_CLIENT_ID'));
  assert.ok(status.errors.includes('Production mode must use production-prefixed Equifax config, not EQUIFAX_BASE_URL.'));
  assert.ok(status.errors.includes('Production mode must use production-prefixed Equifax config, not EQUIFAX_SANDBOX_CLIENT_ID.'));
}

function checkRuntimeConfigKeepsSecretsInternal() {
  const env = createProductionEnv();
  const runtimeConfig = buildEquifaxRuntimeConfig(env);
  const status = runtimeConfig.providerConfigStatus;

  assert.equal(status.configReady, true);
  assert.equal(status.tokenStrategy, 'client_credentials_pending_docs');
  assert.equal(status.oauthBlockedUntilPortalDocs, true);
  assert.equal(status.clientCredentialsConfigured, true);
  assert.equal(status.oauthGrantTypeConfirmed, true);
  assert.equal(status.oauthTokenPostConfirmed, true);
  assert.equal(status.oauthTokenEndpointConfigured, false);
  assert.equal(status.oauthTokenContentTypeConfirmed, true);
  assert.equal(status.oauthScopeConfirmed, true);
  assert.equal(status.oauthClientCredentialPlacementConfirmed, false);
  assert.equal(status.oauthResponseExpiryConfirmed, false);
  assert.equal(status.oauthRequestFormatConfirmed, false);
  assert.equal(runtimeConfig.clientSecret, env.EQUIFAX_PRODUCTION_CLIENT_SECRET);
  assert.equal(runtimeConfig.oauthGrantType, OAUTH_GRANT_TYPE);
  assert.equal(runtimeConfig.oauthTokenMethod, OAUTH_TOKEN_METHOD);
  assert.equal(runtimeConfig.oauthTokenContentType, OAUTH_TOKEN_CONTENT_TYPE);
  assert.equal(runtimeConfig.oauthTokenFormFields.grant_type, 'client_credentials');
  assert.equal(runtimeConfig.oauthTokenFormFields.scope, ONEVIEW_OAUTH_SCOPE);
  assert.equal(runtimeConfig.scope, ONEVIEW_OAUTH_SCOPE);
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkGenericSandboxClientCredentialsAreDetectedButBlocked() {
  const env = {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '0',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: '57',
    EQUIFAX_SANDBOX_BASE_URL: 'https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1',
    EQUIFAX_CLIENT_ID: 'sandbox-client-id-secret-value',
    EQUIFAX_CLIENT_SECRET: 'sandbox-client-secret-value',
    EQUIFAX_SCOPE: ONEVIEW_OAUTH_SCOPE,
    EQUIFAX_SANDBOX_MEMBER_NUMBER: 'sandbox-member-secret-value',
    EQUIFAX_SANDBOX_SECURITY_CODE: 'sandbox-security-secret-value',
    EQUIFAX_SANDBOX_CUSTOMER_CODE: 'sandbox-customer-secret-value',
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true'
  };
  const runtimeConfig = buildEquifaxRuntimeConfig(env);
  const status = runtimeConfig.providerConfigStatus;

  assert.equal(status.configReady, true);
  assert.equal(status.tokenStrategy, 'client_credentials_pending_docs');
  assert.equal(status.clientCredentialsConfigured, true);
  assert.equal(status.oauthBlockedUntilPortalDocs, true);
  assert.equal(status.oauthTokenEndpointConfigured, true);
  assert.equal(status.oauthTokenContentTypeConfirmed, true);
  assert.equal(status.oauthScopeConfirmed, true);
  assert.equal(status.oauthClientCredentialPlacementConfirmed, false);
  assert.equal(status.oauthResponseExpiryConfirmed, false);
  assert.equal(status.oauthRequestFormatConfirmed, false);
  assert.equal(status.providerCallsEnabled, true);
  assert.equal(status.canAttemptProviderCall, false);
  assert.equal(runtimeConfig.clientId, env.EQUIFAX_CLIENT_ID);
  assert.equal(runtimeConfig.tokenUrl, SANDBOX_OAUTH_TOKEN_URL);
  assert.equal(runtimeConfig.oauthTokenContentType, 'application/x-www-form-urlencoded');
  assert.deepEqual(runtimeConfig.oauthTokenFormFields, OAUTH_TOKEN_FORM_FIELDS);
  assert.equal(runtimeConfig.scope, ONEVIEW_OAUTH_SCOPE);
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkExplicitProviderCallGateRequired() {
  const env = {
    ...createSandboxStaticTokenEnv(),
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true'
  };
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.configReady, true);
  assert.equal(status.providerCallsEnabled, true);
  assert.equal(status.tokenStrategy, 'sandbox_static_token');
  assert.equal(status.canAttemptProviderCall, true);
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkRegistryStillSupportsFutureProviders() {
  assert.equal(resolveCreditProviderName('equifax_oneview'), 'equifax_oneview');
  assert.equal(resolveCreditProviderName('thirdstream_equifax'), 'thirdstream_equifax');
  assert.equal(resolveCreditProviderName('thirdstream_transunion'), 'thirdstream_transunion');
  assert.equal(resolveCreditProviderName('directional'), 'directional');
  assert.equal(resolveCreditProviderName('auto', { CREDIT_PROVIDER: 'equifax' }), 'equifax_oneview');
}

function createProductionEnv() {
  return {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'production',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '1',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: '57',
    EQUIFAX_PRODUCTION_BASE_URL: 'https://api.equifax.com/business/oneview/consumer-credit/v1',
    EQUIFAX_PRODUCTION_CLIENT_ID: 'production-client-id-secret-value',
    EQUIFAX_PRODUCTION_CLIENT_SECRET: 'production-client-secret-value',
    EQUIFAX_PRODUCTION_SCOPE: ONEVIEW_OAUTH_SCOPE,
    EQUIFAX_PRODUCTION_MEMBER_NUMBER: 'production-member-secret-value',
    EQUIFAX_PRODUCTION_SECURITY_CODE: 'production-security-secret-value',
    EQUIFAX_PRODUCTION_CUSTOMER_CODE: 'production-customer-secret-value'
  };
}

run();
