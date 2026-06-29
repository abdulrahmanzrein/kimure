const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  OFFICIAL_ONEVIEW_BASE_URLS,
  ONEVIEW_OAUTH_SCOPE,
  SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG,
  SANDBOX_STATIC_TOKEN_TEST_FLAG,
  TOKEN_STRATEGY_MODES,
  buildEquifaxRuntimeConfig,
  statusContainsSecretValue,
  validateEquifaxProviderConfig
} = require('../src/services/equifax/equifaxProviderConfig');
const {
  getEquifaxAccessToken,
  getEquifaxTokenStatus,
  resetEquifaxTokenCache
} = require('../src/services/equifax/equifaxTokenService');

const smokeScriptPath = path.join(__dirname, 'run-equifax-sandbox-smoke-test.js');

async function run() {
  checkSmokeScriptExistsAndIsGated();
  checkSmokeScriptDefaultRunIsBlocked();
  checkSmokeScriptRuntimeGates();
  checkSandboxStaticTokenTestDisabledByDefault();
  checkExplicitReadinessGate();
  checkProviderCallsFlagRequired();
  checkNonSandboxUrlRejected();
  checkLiveSmokeFlagDoesNotEnableNetworkPath();
  await checkTokenValueIsNeverPrinted();
  checkClientCredentialsRemainBlocked();
  console.log('[PASS] Equifax sandbox static-token path checks (10 assertion groups)');
}

function checkSmokeScriptExistsAndIsGated() {
  assert.equal(fs.existsSync(smokeScriptPath), true);
  const source = fs.readFileSync(smokeScriptPath, 'utf8');
  const packageJson = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');

  assert.ok(packageJson.includes('"smoke:equifax-sandbox"'));
  assert.ok(source.includes('EQUIFAX_ENABLED'));
  assert.ok(source.includes('EQUIFAX_ENVIRONMENT'));
  assert.ok(source.includes('EQUIFAX_TOKEN_STRATEGY'));
  assert.ok(source.includes('EQUIFAX_PROVIDER_CALLS_ENABLED'));
  assert.ok(source.includes(SANDBOX_STATIC_TOKEN_TEST_FLAG));
  assert.ok(source.includes(SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG));
  assert.ok(source.includes('OFFICIAL_ONEVIEW_BASE_URLS.sandbox'));
  assert.ok(source.includes("env.EQUIFAX_TOKEN_STRATEGY !== TOKEN_STRATEGY_MODES.sandboxStaticToken"));
  assert.ok(source.includes("config.baseUrl !== OFFICIAL_ONEVIEW_BASE_URLS.sandbox"));
  assert.ok(source.includes("normalizeEquifaxOneViewResponseV1"));
  assert.equal(source.includes('oauth_client_credentials'), false);
  assert.equal(/console\.(log|error)\([^)]*(token|Authorization|memberNumber|securityCode|requestBody|body|raw)/i.test(source), false);
}

function checkSmokeScriptDefaultRunIsBlocked() {
  const result = spawnSync(process.execPath, [smokeScriptPath], {
    env: {
      PATH: process.env.PATH || ''
    },
    encoding: 'utf8'
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.notEqual(result.status, 0);
  assert.ok(output.includes('equifax_provider_disabled'));
  assert.equal(output.includes('sandbox-token-secret-value'), false);
  assert.equal(output.includes('Authorization'), false);
  assert.equal(output.includes('memberNumber'), false);
  assert.equal(output.includes('securityCode'), false);
  assert.equal(output.includes('requestBody'), false);
}

function checkSmokeScriptRuntimeGates() {
  const { validateSmokeTestGates } = require(smokeScriptPath);
  const validEnv = createSandboxStaticTokenEnv({
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    EQUIFAX_TOKEN_STRATEGY: TOKEN_STRATEGY_MODES.sandboxStaticToken,
    [SANDBOX_STATIC_TOKEN_TEST_FLAG]: 'true',
    [SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG]: 'true'
  });
  const validConfig = buildEquifaxRuntimeConfig(validEnv);
  assert.equal(validateSmokeTestGates(validConfig, validEnv).ok, true);

  const nonSandboxEnv = {
    ...validEnv,
    EQUIFAX_ENVIRONMENT: 'production',
    EQUIFAX_PRODUCTION_BASE_URL: OFFICIAL_ONEVIEW_BASE_URLS.production,
    EQUIFAX_PRODUCTION_MEMBER_NUMBER: 'production-member-secret-value',
    EQUIFAX_PRODUCTION_SECURITY_CODE: 'production-security-secret-value',
    EQUIFAX_PRODUCTION_CUSTOMER_CODE: 'production-customer-secret-value'
  };
  const nonSandboxGate = validateSmokeTestGates(buildEquifaxRuntimeConfig(nonSandboxEnv), nonSandboxEnv);
  assert.equal(nonSandboxGate.ok, false);
  assert.equal(nonSandboxGate.blockedReason, 'sandbox_environment_required');

  const wrongBaseUrlEnv = {
    ...validEnv,
    EQUIFAX_SANDBOX_BASE_URL: OFFICIAL_ONEVIEW_BASE_URLS.production
  };
  const wrongBaseUrlGate = validateSmokeTestGates(buildEquifaxRuntimeConfig(wrongBaseUrlEnv), wrongBaseUrlEnv);
  assert.equal(wrongBaseUrlGate.ok, false);
  assert.equal(wrongBaseUrlGate.blockedReason, 'official_sandbox_base_url_required');

  const missingLiveFlagEnv = {
    ...validEnv,
    [SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG]: 'false'
  };
  const missingLiveFlagGate = validateSmokeTestGates(buildEquifaxRuntimeConfig(missingLiveFlagEnv), missingLiveFlagEnv);
  assert.equal(missingLiveFlagGate.ok, false);
  assert.equal(missingLiveFlagGate.blockedReason, 'sandbox_static_token_live_smoke_test_disabled');
}

function checkSandboxStaticTokenTestDisabledByDefault() {
  const env = createSandboxStaticTokenEnv({
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    EQUIFAX_TOKEN_STRATEGY: TOKEN_STRATEGY_MODES.sandboxStaticToken
  });
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.configReady, true);
  assert.equal(status.tokenStrategy, 'sandbox_static_token');
  assert.equal(status.tokenReady, true);
  assert.equal(status.sandboxTokenConfigured, true);
  assert.equal(status.sandboxStaticTokenTestEnabled, false);
  assert.equal(status.sandboxStaticTokenTestReady, false);
  assert.equal(status.sandboxStaticTokenTestBlockedReason, 'sandbox_static_token_test_disabled');
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkExplicitReadinessGate() {
  const env = createSandboxStaticTokenEnv({
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    EQUIFAX_TOKEN_STRATEGY: TOKEN_STRATEGY_MODES.sandboxStaticToken,
    [SANDBOX_STATIC_TOKEN_TEST_FLAG]: 'true'
  });
  const runtimeConfig = buildEquifaxRuntimeConfig(env);
  const status = runtimeConfig.providerConfigStatus;

  assert.equal(status.configReady, true);
  assert.equal(status.environment, 'sandbox');
  assert.equal(status.providerCallsEnabled, true);
  assert.equal(status.requestedTokenStrategy, 'sandbox_static_token');
  assert.equal(status.tokenStrategy, 'sandbox_static_token');
  assert.equal(status.tokenReady, true);
  assert.equal(status.sandboxStaticTokenTestEnabled, true);
  assert.equal(status.sandboxStaticTokenLiveSmokeTestEnabled, false);
  assert.equal(status.sandboxStaticTokenTestUrlAllowed, true);
  assert.equal(status.sandboxStaticTokenTestReady, true);
  assert.equal(status.sandboxStaticTokenTestBlockedReason, null);
  assert.equal(runtimeConfig.baseUrl, OFFICIAL_ONEVIEW_BASE_URLS.sandbox);
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkProviderCallsFlagRequired() {
  const env = createSandboxStaticTokenEnv({
    EQUIFAX_TOKEN_STRATEGY: TOKEN_STRATEGY_MODES.sandboxStaticToken,
    [SANDBOX_STATIC_TOKEN_TEST_FLAG]: 'true'
  });
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.providerCallsEnabled, false);
  assert.equal(status.canAttemptProviderCall, false);
  assert.equal(status.sandboxStaticTokenTestReady, false);
  assert.equal(status.sandboxStaticTokenTestBlockedReason, 'provider_calls_enabled_required');
  assert.equal(status.oauthBlockedUntilProviderCallsEnabled, true);
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkNonSandboxUrlRejected() {
  const env = createSandboxStaticTokenEnv({
    EQUIFAX_SANDBOX_BASE_URL: OFFICIAL_ONEVIEW_BASE_URLS.production,
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    EQUIFAX_TOKEN_STRATEGY: TOKEN_STRATEGY_MODES.sandboxStaticToken,
    [SANDBOX_STATIC_TOKEN_TEST_FLAG]: 'true'
  });
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.configReady, false);
  assert.equal(status.sandboxStaticTokenTestUrlAllowed, false);
  assert.equal(status.sandboxStaticTokenTestReady, false);
  assert.ok(status.errors.includes('Sandbox static-token test path requires the official Equifax sandbox OneView base URL.'));
  assert.equal(statusContainsSecretValue(status, env), false);
}

function checkLiveSmokeFlagDoesNotEnableNetworkPath() {
  const env = createSandboxStaticTokenEnv({
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    EQUIFAX_TOKEN_STRATEGY: TOKEN_STRATEGY_MODES.sandboxStaticToken,
    [SANDBOX_STATIC_TOKEN_TEST_FLAG]: 'true',
    [SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_FLAG]: 'true'
  });
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.sandboxStaticTokenLiveSmokeTestEnabled, true);
  assert.equal(status.sandboxStaticTokenTestReady, false);
  assert.equal(status.sandboxStaticTokenTestBlockedReason, 'sandbox_static_token_live_smoke_test_not_implemented');
  assert.equal(status.canAttemptProviderCall, false);
  assert.equal(statusContainsSecretValue(status, env), false);
}

async function checkTokenValueIsNeverPrinted() {
  resetEquifaxTokenCache();
  const env = createSandboxStaticTokenEnv({
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    EQUIFAX_TOKEN_STRATEGY: TOKEN_STRATEGY_MODES.sandboxStaticToken,
    [SANDBOX_STATIC_TOKEN_TEST_FLAG]: 'true'
  });
  const tokenResult = await getEquifaxAccessToken({ env });
  const safeStatus = getEquifaxTokenStatus({ env });
  const serialized = JSON.stringify({
    status: tokenResult.status,
    errorCode: tokenResult.errorCode,
    safeStatus
  });

  assert.equal(tokenResult.ok, true);
  assert.equal(serialized.includes(env.EQUIFAX_SANDBOX_ACCESS_TOKEN), false);
  assert.equal(serialized.includes(env.EQUIFAX_SANDBOX_MEMBER_NUMBER), false);
  assert.equal(serialized.includes(env.EQUIFAX_SANDBOX_SECURITY_CODE), false);
}

function checkClientCredentialsRemainBlocked() {
  const env = createSandboxClientCredentialEnv({
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    [SANDBOX_STATIC_TOKEN_TEST_FLAG]: 'true'
  });
  const status = validateEquifaxProviderConfig(env);

  assert.equal(status.tokenStrategy, 'client_credentials_pending_docs');
  assert.equal(status.clientCredentialsConfigured, true);
  assert.equal(status.tokenReady, false);
  assert.equal(status.oauthBlockedUntilPortalDocs, true);
  assert.equal(status.oauthBlockedUntilCredentialPlacement, true);
  assert.equal(status.sandboxStaticTokenTestReady, false);
  assert.equal(status.sandboxStaticTokenTestBlockedReason, 'sandbox_static_token_strategy_required');
  assert.equal(statusContainsSecretValue(status, env), false);
}

function createSandboxStaticTokenEnv(overrides = {}) {
  return {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '0',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: '57',
    EQUIFAX_SANDBOX_BASE_URL: OFFICIAL_ONEVIEW_BASE_URLS.sandbox,
    EQUIFAX_SANDBOX_ACCESS_TOKEN: 'sandbox-token-secret-value',
    EQUIFAX_SANDBOX_MEMBER_NUMBER: 'sandbox-member-secret-value',
    EQUIFAX_SANDBOX_SECURITY_CODE: 'sandbox-security-secret-value',
    EQUIFAX_SANDBOX_CUSTOMER_CODE: 'sandbox-customer-secret-value',
    ...overrides
  };
}

function createSandboxClientCredentialEnv(overrides = {}) {
  return {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '0',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: '57',
    EQUIFAX_SANDBOX_BASE_URL: OFFICIAL_ONEVIEW_BASE_URLS.sandbox,
    EQUIFAX_SANDBOX_CLIENT_ID: 'sandbox-client-id-secret-value',
    EQUIFAX_SANDBOX_CLIENT_SECRET: 'sandbox-client-secret-value',
    EQUIFAX_SANDBOX_SCOPE: ONEVIEW_OAUTH_SCOPE,
    EQUIFAX_SANDBOX_MEMBER_NUMBER: 'sandbox-member-secret-value',
    EQUIFAX_SANDBOX_SECURITY_CODE: 'sandbox-security-secret-value',
    EQUIFAX_SANDBOX_CUSTOMER_CODE: 'sandbox-customer-secret-value',
    ...overrides
  };
}

run().catch((error) => {
  console.error('[FAIL] Equifax sandbox static-token path checks');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
