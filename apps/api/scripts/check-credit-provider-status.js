const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CreditProviderStatusService
} = require("../src/credit/credit-provider-status.service");
const {
  buildGatewayVerificationInput,
  shapeProviderVerificationResponse,
  validateSandboxVerificationInput
} = require("../src/credit/credit-provider-verification.service");

const apiRoot = path.resolve(__dirname, "..");

[
  "src/credit/credit-provider-status.controller.ts",
  "src/credit/credit-provider-status.service.ts",
  "src/credit/credit-provider-verification.service.ts"
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
const verificationSource = fs.readFileSync(
  path.join(apiRoot, "src/credit/credit-provider-verification.service.ts"),
  "utf8"
);

assert.equal(controllerSource.includes('@Controller("credit")'), true);
assert.equal(controllerSource.includes('@Get("provider-status")'), true);
assert.equal(controllerSource.includes('@Post("provider-sandbox-verification")'), true);
assert.equal(controllerSource.includes("SupabaseAuthGuard"), true);
assert.equal(
  /@Post\("provider-sandbox-verification"\)\s+@UseGuards\(SupabaseAuthGuard\)\s+verifySandboxProvider/s.test(
    controllerSource
  ),
  true,
  "provider sandbox verification route must be protected by SupabaseAuthGuard"
);
assert.equal(
  controllerSource.includes("request.user!.id"),
  true,
  "provider sandbox verification must depend on authenticated user context"
);
assert.equal(
  controllerSource.includes("request.headers.authorization"),
  true,
  "provider sandbox verification should forward only the authenticated API bearer context"
);
assert.equal(controllerSource.includes("getEquifaxProviderStatus"), true);
assert.equal(serviceSource.includes("fetch("), false);
assert.equal(serviceSource.includes("axios"), false);
assert.equal(serviceSource.includes("Authorization"), false);
assert.equal(serviceSource.includes("Bearer "), false);
assert.equal(verificationSource.includes("SupabaseAuthGuard"), false);
assert.equal(verificationSource.includes("provider-sandbox-verification"), false);
assert.equal(
  verificationSource.includes("/ai/equifax-sandbox-verification"),
  true,
  "provider execution must stay behind the API-to-Gateway boundary"
);
assert.equal(
  verificationSource.includes("validateSandboxVerificationInput"),
  true,
  "provider execution must validate request safety before forwarding"
);

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
  EQUIFAX_PROVIDER_CALLS_ENABLED: "true",
  EQUIFAX_TOKEN_STRATEGY: "client_credentials"
}));

assert.equal(clientCredentialsBlocked.oauthClientCredentialsConfigured, true);
assert.equal(clientCredentialsBlocked.tokenStrategy, "client_credentials");
assert.equal(clientCredentialsBlocked.tokenReady, false);
assert.equal(
  clientCredentialsBlocked.blockedReason,
  "equifax_oauth_exchange_disabled"
);
assert.equal(clientCredentialsBlocked.safeToRunLiveCall, false);
assertSafePayload(clientCredentialsBlocked, createSandboxClientCredentialEnv());

const clientCredentialsReady = createStatus(createSandboxClientCredentialEnv({
  EQUIFAX_PROVIDER_CALLS_ENABLED: "true",
  EQUIFAX_TOKEN_STRATEGY: "client_credentials",
  EQUIFAX_OAUTH_TOKEN_EXCHANGE_ENABLED: "true",
  EQUIFAX_OAUTH_CLIENT_CREDENTIAL_PLACEMENT: "basic_auth",
  EQUIFAX_SANDBOX_OAUTH_TOKEN_URL: "https://api.sandbox.equifax.com/v2/oauth/token"
}));

assert.equal(clientCredentialsReady.tokenStrategy, "client_credentials");
assert.equal(clientCredentialsReady.tokenReady, true);
assert.equal(clientCredentialsReady.sandboxVerificationReady, true);
assert.equal(clientCredentialsReady.sandboxVerificationBlockedReason, null);
assert.equal(clientCredentialsReady.blockedReason, "ready_for_safe_client_credentials_provider_check");
assert.equal(clientCredentialsReady.safeToRunLiveCall, false);
assertSafePayload(clientCredentialsReady, createSandboxClientCredentialEnv());

assert.equal(
  validateSandboxVerificationInput({}).blockedReason,
  "credit_consent_required"
);
assert.deepEqual(
  validateSandboxVerificationInput({
    consent: true,
    permissiblePurposeCode: "57",
    sandboxIdentity: true
  }),
  { ok: true, blockedReason: null }
);
assert.equal(
  validateSandboxVerificationInput({
    consent: { provided: true },
    sandboxIdentity: true
  }).blockedReason,
  "credit_permissible_purpose_required"
);
assert.equal(
  validateSandboxVerificationInput({
    consent: { provided: true },
    permissiblePurposeCode: "57"
  }).blockedReason,
  "sandbox_identity_required"
);
assert.throws(
  () =>
    validateSandboxVerificationInput({
      consent: { provided: true },
      permissiblePurposeCode: "57",
      sandboxIdentity: true,
      identity: {
        ssn: "123-45-6789"
      }
    }),
  /Sandbox verification does not accept/
);

const gatewayInput = buildGatewayVerificationInput({
  consent: { provided: true },
  permissiblePurposeCode: "57",
  sandboxIdentity: true,
  identity: {
    firstName: "Do not forward"
  }
});
assert.deepEqual(gatewayInput, {
  consent: {
    provided: true,
    permissiblePurposeCode: "57"
  },
  permissiblePurposeCode: "57",
  sandboxIdentity: true,
  sandboxIdentityMarker: "equifax_sandbox_test_identity"
});

const shaped = shapeProviderVerificationResponse({
  status: "success",
  provider: "equifax",
  environment: "sandbox",
  verified: true,
  providerStatus: "verified_provider",
  transactionId: "safe-transaction-id",
  scoreSummary: { value: 700, sourceResponse: "drop-this" },
  debtSummary: { totalBalance: 1000 },
  riskFlags: { fraudAlertIndicator: false },
  rawProviderResponse: "drop-this",
  sourceResponse: "drop-this",
  contentBase64: "drop-this",
  token: "drop-this"
});
assert.equal(shaped.provider, "equifax");
assert.equal(shaped.verified, true);
assert.equal(JSON.stringify(shaped).includes("rawProviderResponse"), false);
assert.equal(JSON.stringify(shaped).includes("sourceResponse"), false);
assert.equal(JSON.stringify(shaped).includes("contentBase64"), false);
assert.equal(JSON.stringify(shaped).includes("drop-this"), false);
assertSafePayload(shaped, {});

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
    EQUIFAX_TIMEOUT_MS: "10000",
    EQUIFAX_RETRY_COUNT: "0",
    EQUIFAX_PRODUCT_CODE: "oneview-consumer-credit-report",
    EQUIFAX_CONSENT_VERSION: "kimure-credit-consent-v1",
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: "57",
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
    EQUIFAX_TIMEOUT_MS: "10000",
    EQUIFAX_RETRY_COUNT: "0",
    EQUIFAX_PRODUCT_CODE: "oneview-consumer-credit-report",
    EQUIFAX_CONSENT_VERSION: "kimure-credit-consent-v1",
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: "57",
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
