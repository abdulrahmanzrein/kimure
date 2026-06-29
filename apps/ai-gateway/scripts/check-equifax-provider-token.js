const assert = require('node:assert/strict');
const {
  getEquifaxAccessToken,
  getEquifaxTokenStatus,
  resetEquifaxTokenCache
} = require('../src/services/equifax/equifaxTokenService');
const {
  buildEquifaxRuntimeConfig,
  OAUTH_GRANT_TYPE,
  OAUTH_TOKEN_CONTENT_TYPE,
  OAUTH_TOKEN_FORM_FIELDS,
  OAUTH_TOKEN_METHOD,
  ONEVIEW_OAUTH_SCOPE,
  POSTMAN_COLLECTION_AUTH_MODE,
  POSTMAN_CREDENTIAL_PLACEMENT_CONFIRMED,
  POSTMAN_TOKEN_REQUEST_AUTH_MODE,
  SANDBOX_OAUTH_TOKEN_URL
} = require('../src/services/equifax/equifaxProviderConfig');
const {
  getEquifaxCreditProfileData
} = require('../src/services/equifaxCreditService');
const {
  resolveCreditProviderName
} = require('../src/services/creditProviders');

async function run() {
  await checkDisabledProviderDoesNotAttemptToken();
  await checkInvalidConfigDoesNotAttemptToken();
  await checkSandboxStaticTokenWorksOnlyInSandbox();
  await checkSandboxStaticTokenRejectedOutsideSandbox();
  await checkPortalBackedTokenTodoIsSafe();
  checkPostmanAuthFindingIsReflectedInTokenStatus();
  await checkConfiguredCredentialPlacementStillDoesNotCallNetwork();
  await checkMissingSecureRequestConfigBlocksTokenAttempt();
  await checkCacheMetadataIsSafe();
  await checkEquifaxServiceDoesNotCallNetworkWithoutPortalTokenFlow();
  checkRegistryStillSupportsFutureProviders();
  console.log('[PASS] Equifax token service checks (11 assertion groups)');
}

async function checkDisabledProviderDoesNotAttemptToken() {
  resetEquifaxTokenCache();
  const result = await getEquifaxAccessToken({
    env: {},
    fetchImpl: failIfCalled
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'equifax_provider_disabled');
  assert.equal(result.status.lastTokenStatus, 'disabled');
  assertSafeStatus(result, {});
}

async function checkInvalidConfigDoesNotAttemptToken() {
  resetEquifaxTokenCache();
  const env = {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox'
  };
  const result = await getEquifaxAccessToken({
    env,
    fetchImpl: failIfCalled
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'equifax_configuration_not_ready');
  assert.equal(result.status.lastTokenStatus, 'configuration_not_ready');
  assertSafeStatus(result, env);
}

async function checkSandboxStaticTokenWorksOnlyInSandbox() {
  resetEquifaxTokenCache();
  const env = createSandboxStaticTokenEnv();
  const result = await getEquifaxAccessToken({
    env,
    fetchImpl: failIfCalled
  });

  assert.equal(result.ok, true);
  assert.equal(result.accessToken, env.EQUIFAX_SANDBOX_ACCESS_TOKEN);
  assert.equal(result.status.environment, 'sandbox');
  assert.equal(result.status.tokenConfigured, true);
  assert.equal(result.status.sandboxTokenConfigured, true);
  assert.equal(result.status.clientCredentialsConfigured, false);
  assert.equal(result.status.memberNumberConfigured, true);
  assert.equal(result.status.securityCodeConfigured, true);
  assert.equal(result.status.permissiblePurposeConfigured, true);
  assert.equal(result.status.oauthGrantTypeConfirmed, true);
  assert.equal(result.status.oauthTokenPostConfirmed, true);
  assert.equal(result.status.oauthTokenEndpointConfigured, true);
  assert.equal(result.status.oauthTokenContentTypeConfirmed, true);
  assert.equal(result.status.oauthScopeConfirmed, false);
  assert.equal(result.status.oauthClientCredentialPlacementConfirmed, false);
  assert.equal(result.status.oauthClientCredentialPlacementConfigured, false);
  assert.equal(result.status.oauthClientCredentialPlacementMode, 'unset');
  assert.equal(result.status.postmanTokenRequestAuthMode, POSTMAN_TOKEN_REQUEST_AUTH_MODE);
  assert.equal(result.status.postmanCollectionAuthMode, POSTMAN_COLLECTION_AUTH_MODE);
  assert.equal(result.status.postmanCredentialPlacementConfirmed, POSTMAN_CREDENTIAL_PLACEMENT_CONFIRMED);
  assert.equal(result.status.oauthResponseExpiryConfirmed, false);
  assert.equal(result.status.oauthRequestFormatConfirmed, false);
  assert.equal(result.status.oauthBlockedUntilCredentialPlacement, false);
  assert.equal(result.status.oauthBlockedUntilResponseExpiry, false);
  assert.equal(result.status.oauthBlockedUntilProviderCallsEnabled, true);
  assert.equal(result.status.providerCallsEnabled, false);
  assert.equal(result.status.tokenStrategy, 'sandbox_static_token');
  assert.equal(OAUTH_GRANT_TYPE, 'client_credentials');
  assert.equal(OAUTH_TOKEN_METHOD, 'POST');
  assert.equal(OAUTH_TOKEN_CONTENT_TYPE, 'application/x-www-form-urlencoded');
  assert.deepEqual(OAUTH_TOKEN_FORM_FIELDS, {
    grant_type: 'client_credentials',
    scope: ONEVIEW_OAUTH_SCOPE
  });
  assert.equal(result.status.tokenCached, true);
  assert.equal(result.status.lastTokenStatus, 'sandbox_static_token');
  assertSafeStatus(result, env);
}

async function checkSandboxStaticTokenRejectedOutsideSandbox() {
  resetEquifaxTokenCache();
  const testEnv = {
    ...createTestClientCredentialEnv(),
    EQUIFAX_SANDBOX_ACCESS_TOKEN: 'sandbox-token-secret-value'
  };
  const productionEnv = {
    ...createProductionClientCredentialEnv(),
    EQUIFAX_SANDBOX_ACCESS_TOKEN: 'sandbox-token-secret-value'
  };

  const testResult = await getEquifaxAccessToken({ env: testEnv, fetchImpl: failIfCalled });
  const productionResult = await getEquifaxAccessToken({ env: productionEnv, fetchImpl: failIfCalled });

  assert.equal(testResult.ok, false);
  assert.equal(testResult.errorCode, 'equifax_configuration_not_ready');
  assert.equal(productionResult.ok, false);
  assert.equal(productionResult.errorCode, 'equifax_configuration_not_ready');
  assertSafeStatus(testResult, testEnv);
  assertSafeStatus(productionResult, productionEnv);
}

async function checkPortalBackedTokenTodoIsSafe() {
  resetEquifaxTokenCache();
  const env = createSandboxClientCredentialEnv();
  const runtimeConfig = buildEquifaxRuntimeConfig(env);
  const result = await getEquifaxAccessToken({
    env,
    fetchImpl: failIfCalled
  });

  assert.equal(result.ok, false);
  assert.equal(result.accessToken, null);
  assert.equal(result.errorCode, 'equifax_token_flow_requires_portal_docs');
  assert.equal(result.status.lastTokenStatus, 'equifax_token_flow_requires_portal_docs');
  assert.equal(result.status.tokenConfigured, true);
  assert.equal(result.status.clientCredentialsConfigured, true);
  assert.equal(result.status.oauthBlockedUntilPortalDocs, true);
  assert.equal(result.status.oauthGrantTypeConfirmed, true);
  assert.equal(result.status.oauthTokenPostConfirmed, true);
  assert.equal(result.status.oauthTokenEndpointConfigured, true);
  assert.equal(result.status.oauthTokenContentTypeConfirmed, true);
  assert.equal(result.status.oauthScopeConfirmed, true);
  assert.equal(result.status.oauthClientCredentialPlacementConfirmed, false);
  assert.equal(result.status.oauthClientCredentialPlacementConfigured, false);
  assert.equal(result.status.oauthClientCredentialPlacementMode, 'unset');
  assert.equal(result.status.postmanTokenRequestAuthMode, POSTMAN_TOKEN_REQUEST_AUTH_MODE);
  assert.equal(result.status.postmanCollectionAuthMode, POSTMAN_COLLECTION_AUTH_MODE);
  assert.equal(result.status.postmanCredentialPlacementConfirmed, false);
  assert.equal(result.status.oauthResponseExpiryConfirmed, false);
  assert.equal(result.status.oauthRequestFormatConfirmed, false);
  assert.equal(result.status.oauthBlockedUntilCredentialPlacement, true);
  assert.equal(result.status.oauthBlockedUntilResponseExpiry, true);
  assert.equal(result.status.tokenStrategy, 'client_credentials_pending_docs');
  assert.equal(runtimeConfig.tokenUrl, SANDBOX_OAUTH_TOKEN_URL);
  assertSafeStatus(result, env);
}

function checkPostmanAuthFindingIsReflectedInTokenStatus() {
  resetEquifaxTokenCache();
  const env = createSandboxClientCredentialEnv();
  const status = getEquifaxTokenStatus({ env });

  assert.equal(status.postmanTokenRequestAuthMode, 'inherit_auth_from_parent');
  assert.equal(status.postmanCollectionAuthMode, 'no_auth');
  assert.equal(status.postmanCredentialPlacementConfirmed, false);
  assert.equal(status.oauthClientCredentialPlacementMode, 'unset');
  assert.equal(status.oauthClientCredentialPlacementConfirmed, false);
  assert.equal(status.oauthBlockedUntilCredentialPlacement, true);
  assert.equal(status.providerCallsEnabled, false);
  assertSafeStatus({ status, errorCode: null }, env);
}

async function checkConfiguredCredentialPlacementStillDoesNotCallNetwork() {
  resetEquifaxTokenCache();
  const env = {
    ...createSandboxClientCredentialEnv(),
    EQUIFAX_OAUTH_CLIENT_CREDENTIAL_PLACEMENT: 'basic_auth'
  };
  const result = await getEquifaxAccessToken({
    env,
    fetchImpl: failIfCalled
  });

  assert.equal(result.ok, false);
  assert.equal(result.accessToken, null);
  assert.equal(result.errorCode, 'equifax_token_flow_requires_portal_docs');
  assert.equal(result.status.oauthClientCredentialPlacementConfigured, true);
  assert.equal(result.status.oauthClientCredentialPlacementMode, 'basic_auth');
  assert.equal(result.status.oauthClientCredentialPlacementConfirmed, false);
  assert.equal(result.status.postmanCredentialPlacementConfirmed, false);
  assert.equal(result.status.oauthBlockedUntilCredentialPlacement, false);
  assert.equal(result.status.oauthBlockedUntilResponseExpiry, true);
  assert.equal(result.status.oauthRequestFormatConfirmed, false);
  assert.equal(result.status.providerCallsEnabled, false);
  assertSafeStatus(result, env);
}

async function checkMissingSecureRequestConfigBlocksTokenAttempt() {
  resetEquifaxTokenCache();
  const env = {
    ...createSandboxClientCredentialEnv(),
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: ''
  };
  const result = await getEquifaxAccessToken({
    env,
    fetchImpl: failIfCalled
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'equifax_configuration_not_ready');
  assert.equal(result.status.lastTokenStatus, 'configuration_not_ready');
  assert.equal(result.status.tokenConfigured, true);
  assert.equal(result.status.permissiblePurposeConfigured, false);
  assertSafeStatus(result, env);
}

function checkCacheMetadataIsSafe() {
  resetEquifaxTokenCache();
  const env = createSandboxStaticTokenEnv();
  const before = getEquifaxTokenStatus({ env });

  assert.equal(before.tokenCached, false);
  assert.equal(before.lastTokenStatus, 'not_requested');

  return getEquifaxAccessToken({ env }).then((result) => {
    const after = getEquifaxTokenStatus({ env });

    assert.equal(result.ok, true);
    assert.equal(after.tokenCached, true);
    assert.equal(after.expiresSoon, false);
    assert.equal(after.oauthGrantTypeConfirmed, true);
    assert.equal(after.oauthTokenPostConfirmed, true);
    assert.equal(after.oauthTokenEndpointConfigured, true);
    assert.equal(after.oauthTokenContentTypeConfirmed, true);
    assert.equal(after.oauthClientCredentialPlacementMode, 'unset');
    assert.equal(after.postmanCredentialPlacementConfirmed, false);
    assert.equal(JSON.stringify(after).includes(env.EQUIFAX_SANDBOX_ACCESS_TOKEN), false);
  });
}

async function checkEquifaxServiceDoesNotCallNetworkWithoutPortalTokenFlow() {
  resetEquifaxTokenCache();
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch must not be called without portal token flow');
  };

  try {
    const result = await getEquifaxCreditProfileData({
      providedData: {},
      requestContext: {
        applicant: validApplicant(),
        consent: {
          provided: true,
          permissiblePurpose: 'credit_profile_assessment',
          version: 'kimure-credit-consent-v1',
          capturedAt: '2026-01-01T00:00:00.000Z'
        },
        permissiblePurpose: 'credit_profile_assessment'
      },
      env: createSandboxClientCredentialEnv()
    });

    assert.equal(fetchCalled, false);
    assert.equal(result.verified, false);
    assert.equal(result.status, 'configuration_missing');
    assert.equal(result.config.tokenStatus, null);
    assert.equal(JSON.stringify(result).includes('secret-value'), false);
  } finally {
    global.fetch = originalFetch;
  }
}

function checkRegistryStillSupportsFutureProviders() {
  assert.equal(resolveCreditProviderName('equifax_oneview'), 'equifax_oneview');
  assert.equal(resolveCreditProviderName('thirdstream_equifax'), 'thirdstream_equifax');
  assert.equal(resolveCreditProviderName('thirdstream_transunion'), 'thirdstream_transunion');
  assert.equal(resolveCreditProviderName('auto', { CREDIT_PROVIDER: 'equifax' }), 'equifax_oneview');
}

function validApplicant() {
  return {
    firstName: 'Test',
    lastName: 'Consumer',
    dateOfBirth: '1990-01-15',
    address: {
      civicNumber: '100',
      streetName: 'Example Street',
      city: 'Ottawa',
      provinceCode: 'ON',
      postalCode: 'K1A0B1'
    }
  };
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

function createSandboxClientCredentialEnv() {
  return {
    ...createSandboxStaticTokenEnv(),
    EQUIFAX_SANDBOX_ACCESS_TOKEN: '',
    EQUIFAX_SANDBOX_CLIENT_ID: 'sandbox-client-id-secret-value',
    EQUIFAX_SANDBOX_CLIENT_SECRET: 'sandbox-client-secret-value',
    EQUIFAX_SANDBOX_SCOPE: ONEVIEW_OAUTH_SCOPE
  };
}

function createTestClientCredentialEnv() {
  return {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'test',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '0',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: '57',
    EQUIFAX_TEST_BASE_URL: 'https://api.uat.equifax.com/business/oneview/consumer-credit/v1',
    EQUIFAX_TEST_CLIENT_ID: 'test-client-id-secret-value',
    EQUIFAX_TEST_CLIENT_SECRET: 'test-client-secret-value',
    EQUIFAX_TEST_SCOPE: ONEVIEW_OAUTH_SCOPE,
    EQUIFAX_TEST_MEMBER_NUMBER: 'test-member-secret-value',
    EQUIFAX_TEST_SECURITY_CODE: 'test-security-secret-value',
    EQUIFAX_TEST_CUSTOMER_CODE: 'test-customer-secret-value'
  };
}

function createProductionClientCredentialEnv() {
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

function assertSafeStatus(result, env) {
  const serializedStatus = JSON.stringify({
    status: result.status,
    errorCode: result.errorCode
  });

  Object.values(env).forEach((value) => {
    if (typeof value === 'string' && value.includes('secret-value')) {
      assert.equal(serializedStatus.includes(value), false);
    }
  });
}

async function failIfCalled() {
  throw new Error('token service skeleton must not make live network calls');
}

run().catch((error) => {
  console.error('[FAIL] Equifax token service checks');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
