const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CreditProviderStatusService
} = require("../src/credit/credit-provider-status.service");

const apiRoot = path.resolve(__dirname, "..");

[
  "src/credit/credit-provider-status.controller.ts",
  "src/credit/credit-provider-status.service.ts"
].forEach((file) => {
  assert.equal(fs.existsSync(path.join(apiRoot, file)), true, `${file} should exist`);
});

const controllerSource = fs.readFileSync(
  path.join(apiRoot, "src/credit/credit-provider-status.controller.ts"),
  "utf8"
);
const serviceSource = fs.readFileSync(
  path.join(apiRoot, "src/credit/credit-provider-status.service.ts"),
  "utf8"
);

assert.equal(controllerSource.includes('@Controller("credit")'), true);
assert.equal(controllerSource.includes('@Get("provider-status")'), true);
assert.equal(controllerSource.includes("getEquifaxProviderStatus"), true);
assert.equal(serviceSource.includes("fetch("), false);
assert.equal(serviceSource.includes("axios"), false);
assert.equal(serviceSource.includes("Authorization"), false);
assert.equal(serviceSource.includes("Bearer "), false);

const disabled = createStatus({});
assert.equal(disabled.provider, "equifax");
assert.equal(disabled.enabled, false);
assert.equal(disabled.providerCallsEnabled, false);
assert.equal(disabled.tokenStrategy, "disabled");
assert.equal(disabled.tokenReady, false);
assert.equal(disabled.sandboxStaticTokenTestReady, false);
assert.equal(disabled.blockedReason, "equifax_provider_disabled");
assert.equal(disabled.safeToRunLiveCall, false);
assertSafePayload(disabled, {});

const sandboxReady = createStatus(createSandboxStaticTokenEnv({
  EQUIFAX_PROVIDER_CALLS_ENABLED: "true",
  EQUIFAX_TOKEN_STRATEGY: "sandbox_static_token",
  EQUIFAX_SANDBOX_STATIC_TOKEN_TEST_ENABLED: "true"
}));

assert.equal(sandboxReady.environment, "sandbox");
assert.equal(sandboxReady.enabled, true);
assert.equal(sandboxReady.providerCallsEnabled, true);
assert.equal(sandboxReady.tokenStrategy, "sandbox_static_token");
assert.equal(sandboxReady.tokenReady, true);
assert.equal(sandboxReady.sandboxStaticTokenTestEnabled, true);
assert.equal(sandboxReady.sandboxStaticTokenTestReady, true);
assert.equal(sandboxReady.blockedReason, "ready_for_safe_static_token_readiness_check");
assert.equal(sandboxReady.safeToRunLiveCall, false);
assertSafePayload(sandboxReady, createSandboxStaticTokenEnv());

const disabledTestPath = createStatus(createSandboxStaticTokenEnv({
  EQUIFAX_PROVIDER_CALLS_ENABLED: "true",
  EQUIFAX_TOKEN_STRATEGY: "sandbox_static_token"
}));

assert.equal(disabledTestPath.sandboxStaticTokenTestEnabled, false);
assert.equal(disabledTestPath.sandboxStaticTokenTestReady, false);
assert.equal(disabledTestPath.blockedReason, "sandbox_static_token_test_disabled");
assert.equal(disabledTestPath.safeToRunLiveCall, false);

const providerCallsBlocked = createStatus(createSandboxStaticTokenEnv({
  EQUIFAX_TOKEN_STRATEGY: "sandbox_static_token",
  EQUIFAX_SANDBOX_STATIC_TOKEN_TEST_ENABLED: "true"
}));

assert.equal(providerCallsBlocked.providerCallsEnabled, false);
assert.equal(providerCallsBlocked.blockedReason, "provider_calls_enabled_required");
assert.equal(providerCallsBlocked.safeToRunLiveCall, false);

const clientCredentialsBlocked = createStatus(createSandboxClientCredentialEnv({
  EQUIFAX_PROVIDER_CALLS_ENABLED: "true"
}));

assert.equal(clientCredentialsBlocked.oauthClientCredentialsConfigured, true);
assert.equal(clientCredentialsBlocked.tokenStrategy, "client_credentials_pending_docs");
assert.equal(clientCredentialsBlocked.tokenReady, false);
assert.equal(
  clientCredentialsBlocked.blockedReason,
  "oauth_client_credentials_blocked_pending_docs"
);
assert.equal(clientCredentialsBlocked.safeToRunLiveCall, false);
assertSafePayload(clientCredentialsBlocked, createSandboxClientCredentialEnv());

console.log("Credit provider status check passed.");

function createStatus(env) {
  const config = {
    get(key) {
      return env[key];
    }
  };
  const service = new CreditProviderStatusService(config);
  return service.getEquifaxProviderStatus();
}

function createSandboxStaticTokenEnv(overrides = {}) {
  return {
    EQUIFAX_ENABLED: "true",
    EQUIFAX_ENVIRONMENT: "sandbox",
    EQUIFAX_SANDBOX_ACCESS_TOKEN: "sandbox-token-secret-value",
    EQUIFAX_SANDBOX_BASE_URL: "https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1",
    EQUIFAX_SANDBOX_MEMBER_NUMBER: "sandbox-member-secret-value",
    EQUIFAX_SANDBOX_SECURITY_CODE: "sandbox-security-secret-value",
    EQUIFAX_SANDBOX_CUSTOMER_CODE: "sandbox-customer-secret-value",
    ...overrides
  };
}

function createSandboxClientCredentialEnv(overrides = {}) {
  return {
    EQUIFAX_ENABLED: "true",
    EQUIFAX_ENVIRONMENT: "sandbox",
    EQUIFAX_SANDBOX_CLIENT_ID: "sandbox-client-id-secret-value",
    EQUIFAX_SANDBOX_CLIENT_SECRET: "sandbox-client-secret-value",
    EQUIFAX_SANDBOX_SCOPE: "https://api.equifax.com/business/oneview/consumer-credit/v1",
    EQUIFAX_SANDBOX_BASE_URL: "https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1",
    EQUIFAX_SANDBOX_MEMBER_NUMBER: "sandbox-member-secret-value",
    EQUIFAX_SANDBOX_SECURITY_CODE: "sandbox-security-secret-value",
    EQUIFAX_SANDBOX_CUSTOMER_CODE: "sandbox-customer-secret-value",
    ...overrides
  };
}

function assertSafePayload(payload, env) {
  const serialized = JSON.stringify(payload);
  const forbiddenKeys = [
    "accessToken",
    "clientId",
    "clientSecret",
    "memberNumber",
    "securityCode",
    "customerCode",
    "baseUrl",
    "requestBody",
    "rawProviderResponse",
    "rawReport",
    "reportPayload",
    "tradelines",
    "trades",
    "pdfLink",
    "fullIdentity",
    "fullAddress",
    "sin",
    "ssn"
  ];

  forbiddenKeys.forEach((key) => {
    assert.equal(serialized.includes(key), false, `${key} must not be returned`);
  });

  Object.values(env).forEach((value) => {
    if (typeof value === "string" && value.includes("secret-value")) {
      assert.equal(serialized.includes(value), false, "secret fixture value leaked");
    }
  });
}
