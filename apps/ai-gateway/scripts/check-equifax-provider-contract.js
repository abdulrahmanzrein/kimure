const assert = require('node:assert/strict');
const {
  buildEquifaxOneViewRequestV1,
  ONEVIEW_API_CONTRACT,
  ONEVIEW_BASE_URLS,
  ONEVIEW_CREDIT_REPORT_PATH,
  ONEVIEW_OAUTH_SCOPE,
  ONEVIEW_PDF_REPORT_PATH_TEMPLATE,
  PORTAL_DOCS_REQUIRED,
  REQUEST_VERSION
} = require('../src/services/equifax/equifaxOneViewRequestBuilder');
const {
  normalizeEquifaxOneViewResponseV1,
  RESPONSE_EXTRACTION_VERSION
} = require('../src/services/equifax/equifaxOneViewResponseNormalizer');
const {
  getEquifaxCreditProfileData
} = require('../src/services/equifaxCreditService');
const {
  runEquifaxSandboxVerification,
  validateEquifaxSandboxVerificationInput
} = require('../src/services/equifaxSandboxVerificationService');
const {
  resetEquifaxTokenCache
} = require('../src/services/equifax/equifaxTokenService');
const {
  resolveCreditProviderName
} = require('../src/services/creditProviders');

async function run() {
  checkRequestBuilderRequiresConsentAndPurpose();
  checkRequestBuilderProducesSafeInternalContract();
  checkResponseNormalizerAllowlist();
  checkResponseNormalizerHandlesEmptyResponse();
  await checkServiceBlocksUnconfirmedRequestBeforeNetwork();
  await checkSandboxVerificationBlocksByDefault();
  await checkSandboxVerificationRequiresConsentPurposeAndMarker();
  await checkSandboxVerificationRejectsSocialNumberInput();
  await checkSandboxVerificationUsesMockedProviderPathSafely();
  checkRegistryStillSupportsFutureProviders();
  console.log('[PASS] Equifax provider request/response contract checks (10 assertion groups)');
}

function checkRequestBuilderRequiresConsentAndPurpose() {
  const request = buildEquifaxOneViewRequestV1({
    providedData: {},
    requestContext: {
      applicant: validApplicant(),
      consent: {
        provided: false
      }
    }
  }, {
    config: {
      environment: 'sandbox',
      reportPath: '/unconfirmed'
    }
  });

  assert.equal(request.requestReady, false);
  assert.equal(request.providerCallReady, false);
  assert.ok(request.missingRequestFields.includes('consent.provided'));
  assert.ok(request.missingRequestFields.includes('consent.permissiblePurpose'));
  assert.equal(request.providerCallBlockedReason, PORTAL_DOCS_REQUIRED);
}

function checkRequestBuilderProducesSafeInternalContract() {
  const request = buildEquifaxOneViewRequestV1({
    providedData: {},
    requestContext: {
      consumerReferenceId: 'safe-reference-id',
      applicant: validApplicant(),
      consent: validConsent(),
      permissiblePurpose: 'credit_profile_assessment'
    }
  }, {
    config: {
      environment: 'test',
      reportPath: '/portal-docs-required'
    }
  });
  const serialized = JSON.stringify(request);

  assert.equal(request.requestVersion, REQUEST_VERSION);
  assert.equal(request.requestReady, true);
  assert.equal(request.providerCallReady, false);
  assert.equal(request.oneViewRequestBody, null);
  assert.equal(request.endpointPath, ONEVIEW_CREDIT_REPORT_PATH);
  assert.equal(request.pdfEndpointPath, ONEVIEW_PDF_REPORT_PATH_TEMPLATE);
  assert.equal(request.operationId, 'requestConsumerCreditReport');
  assert.equal(request.pdfOperationId, 'requestConsumerCreditReportPDF');
  assert.equal(request.auth.type, 'oauth2_bearer');
  assert.equal(request.auth.requiredScope, ONEVIEW_OAUTH_SCOPE);
  assert.equal(request.contentType, 'application/json');
  assert.deepEqual(request.bodyContract.requiredSections, ['consumers', 'customerConfiguration']);
  assert.ok(request.bodyContract.customerConfiguration.secureConfigRequired.includes('memberNumber'));
  assert.ok(request.bodyContract.customerConfiguration.secureConfigRequired.includes('securityCode'));
  assert.equal(request.bodyContract.customerConfiguration.mortgageLoanOriginationPermissiblePurposeCode, '57');
  assert.equal(request.portalDependency.requestBodySchemaConfirmed, true);
  assert.equal(request.portalDependency.canadaProductionApprovalConfirmed, false);
  assert.equal(request.safeDebugMetadata.finalProviderBodyBuilt, false);
  assert.equal(request.safeDebugMetadata.officialSwaggerContractKnown, true);
  assert.equal(request.safeDebugMetadata.containsSocialNum, false);
  assert.equal(request.applicantSnapshot.firstNameProvided, true);
  assert.equal(request.addressSnapshot.postalCodeProvided, true);
  assert.equal(serialized.includes('Test Consumer'), false);
  assert.equal(serialized.includes('100 Example Street'), false);
  assert.equal(serialized.includes('K1A0B1'), false);
  assert.equal(serialized.includes('999999998'), false);
  assert.equal(serialized.includes('sandbox-token-secret-value'), false);
  assert.equal(ONEVIEW_API_CONTRACT.endpoints.consumerCreditReport.path, '/reports/credit-report');
  assert.equal(ONEVIEW_API_CONTRACT.endpoints.consumerCreditReportPdf.path, '/reports/credit-report/{pdf-request-id}');
  assert.equal(ONEVIEW_API_CONTRACT.auth.scope, ONEVIEW_OAUTH_SCOPE);
  assert.equal(ONEVIEW_BASE_URLS.sandbox, 'https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1');
  assert.equal(ONEVIEW_BASE_URLS.uat, 'https://api.uat.equifax.com/business/oneview/consumer-credit/v1');
  assert.equal(ONEVIEW_BASE_URLS.production, 'https://api.equifax.com/business/oneview/consumer-credit/v1');
}

function checkResponseNormalizerAllowlist() {
  const rawResponse = {
    status: 'completed',
    transactionId: 'safe-transaction-id',
    links: [
      {
        rel: 'credit-report-pdf',
        href: 'https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1/reports/credit-report/pdf-request-123'
      }
    ],
    consumers: [
      {
        name: [
          {
            firstName: 'Jane',
            lastName: 'Consumer'
          }
        ],
        equifaxUSConsumerCreditReport: {
          models: [
            {
              scoreValue: 718,
              modelName: 'safe-model-label'
            }
          ],
          totalBalance: '$12,500',
          totalMonthlyPayment: '450',
          revolvingUtilization: '32',
          delinquencyCount: 1,
          bankruptcyIndicator: false,
          fraudAlertIndicator: true,
          securityFreezeIndicator: true,
          trades: [{ accountNumber: 'must-not-leak' }],
          nested: {
            collectionCount: 2
          }
        }
      }
    ],
    reportId: 'safe-report-id',
    creditScore: 718,
    scoreModel: 'safe-model-label',
    totalBalance: '$12,500',
    totalMonthlyPayment: '450',
    revolvingUtilization: '32',
    delinquencyCount: 1,
    bankruptcyIndicator: false,
    fraudAlertIndicator: true,
    tradelines: [{ accountNumber: 'must-not-leak' }],
    consumer: {
      firstName: 'Jane',
      lastName: 'Consumer',
      address: '100 Private Street'
    },
    sourceResponse: { raw: 'must-not-leak' },
    contentBase64: 'bXVzdC1ub3QtbGVhaw==',
    providerDiagnostics: {
      stack: 'must-not-leak'
    },
    nested: {
      collectionCount: 2
    }
  };
  const normalized = normalizeEquifaxOneViewResponseV1(rawResponse, {
    environment: 'sandbox',
    headers: {
      'efx-transaction-id': 'safe-efx-transaction-id'
    }
  });
  const serialized = JSON.stringify(normalized);

  assert.equal(normalized.provider, 'equifax_oneview');
  assert.equal(normalized.bureau, 'equifax');
  assert.equal(normalized.environment, 'sandbox');
  assert.equal(normalized.status, 'completed');
  assert.equal(normalized.extractionVersion, RESPONSE_EXTRACTION_VERSION);
  assert.equal(normalized.mapperStatus, 'normalized');
  assert.equal(normalized.verificationStatus.bureauDataVerified, true);
  assert.equal(normalized.scoreSummary.value, 718);
  assert.equal(normalized.debtSummary.totalBalance, 12500);
  assert.equal(normalized.riskFlags.fraudAlertIndicator, true);
  assert.equal(normalized.riskFlags.securityFreezeIndicator, true);
  assert.equal(normalized.riskFlags.collectionsCount, 2);
  assert.equal(normalized.referenceIds.transactionId, 'safe-efx-transaction-id');
  assert.equal(normalized.referenceIds.pdfRequestId, 'pdf-request-123');
  assert.equal(normalized.linkSummary.pdfLinkAvailable, true);
  assert.equal(normalized.linkSummary.linkCount, 1);
  assert.equal(serialized.includes('must-not-leak'), false);
  assert.equal(serialized.includes('Jane'), false);
  assert.equal(serialized.includes('100 Private Street'), false);
  assert.equal(serialized.includes('bXVzdC1ub3QtbGVhaw=='), false);
  assert.equal(serialized.includes('https://api.sandbox.equifax.com'), false);
}

function checkResponseNormalizerHandlesEmptyResponse() {
  const normalized = normalizeEquifaxOneViewResponseV1(null, {
    environment: 'production'
  });

  assert.equal(normalized.environment, 'production');
  assert.equal(normalized.mapperStatus, 'empty_response');
  assert.equal(normalized.verificationStatus.bureauDataVerified, false);
  assert.equal(normalized.scoreSummary, null);
  assert.equal(normalized.linkSummary.pdfLinkAvailable, false);
}

async function checkServiceBlocksUnconfirmedRequestBeforeNetwork() {
  resetEquifaxTokenCache();
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch must not be called while OneView contract is unconfirmed');
  };

  try {
    const result = await getEquifaxCreditProfileData({
      providedData: {},
      requestContext: {
        applicant: validApplicant(),
        consent: validConsent(),
        permissiblePurpose: 'credit_profile_assessment'
      },
      env: createSandboxStaticTokenEnv()
    });

    assert.equal(fetchCalled, false);
    assert.equal(result.verified, false);
    assert.equal(result.status, 'configuration_missing');
    assert.equal(result.request.providerCallReady, false);
    assert.equal(result.request.providerCallBlockedReason, PORTAL_DOCS_REQUIRED);
    assert.equal(JSON.stringify(result).includes('sandbox-token-secret-value'), false);
    assert.equal(JSON.stringify(result).includes('999999998'), false);
  } finally {
    global.fetch = originalFetch;
  }
}

async function checkSandboxVerificationBlocksByDefault() {
  let fetchCalled = false;
  const result = await runEquifaxSandboxVerification(validSandboxVerificationInput(), {
    env: {},
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('fetch must not be called when disabled');
    }
  });

  assert.equal(fetchCalled, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'equifax_provider_disabled');
  assert.equal(result.safeToRunLiveCall, false);
  assertSandboxVerificationResponseIsSafe(result);
}

async function checkSandboxVerificationRequiresConsentPurposeAndMarker() {
  const env = createSandboxClientCredentialProviderEnv();

  assert.equal(
    validateEquifaxSandboxVerificationInput({
      permissiblePurposeCode: '57',
      sandboxIdentity: true
    }, buildRuntimeConfigForCheck(env), env).blockedReason,
    'credit_consent_required'
  );
  assert.equal(
    validateEquifaxSandboxVerificationInput({
      consent: { provided: true },
      sandboxIdentity: true
    }, buildRuntimeConfigForCheck(env), env).blockedReason,
    'credit_permissible_purpose_required'
  );
  assert.equal(
    validateEquifaxSandboxVerificationInput({
      consent: { provided: true },
      permissiblePurposeCode: '57'
    }, buildRuntimeConfigForCheck(env), env).blockedReason,
    'sandbox_identity_required'
  );
}

async function checkSandboxVerificationRejectsSocialNumberInput() {
  const env = createSandboxClientCredentialProviderEnv();
  const result = await runEquifaxSandboxVerification({
    ...validSandboxVerificationInput(),
    identity: {
      ssn: '123-45-6789'
    }
  }, {
    env,
    fetchImpl: async () => {
      throw new Error('fetch must not be called when social number input is present');
    }
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'sandbox_identity_required');
  assertSandboxVerificationResponseIsSafe(result);
}

async function checkSandboxVerificationUsesMockedProviderPathSafely() {
  const env = createSandboxClientCredentialProviderEnv({
    EQUIFAX_SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_ENABLED: 'true'
  });
  const runtimeConfig = buildRuntimeConfigForCheck(env);
  const observedRequests = [];

  assert.equal(runtimeConfig.providerConfigStatus.canAttemptProviderCall, false);
  assert.equal(runtimeConfig.providerConfigStatus.sandboxVerificationReady, true);
  assert.equal(runtimeConfig.providerConfigStatus.sandboxVerificationBlockedReason, null);

  const result = await runEquifaxSandboxVerification(validSandboxVerificationInput(), {
    env,
    fetchImpl: async (url, options) => {
      observedRequests.push({ url, options });

      if (String(url).includes('/v2/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            access_token: 'oauth-access-token-secret-value',
            expires_in: 3600
          })
        };
      }

      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            return name === 'efx-transaction-id' ? 'safe-transaction-id' : null;
          }
        },
        text: async () => JSON.stringify({
          status: 'completed',
          transactionId: 'safe-transaction-id',
          creditScore: 721,
          totalBalance: '$5,000',
          totalMonthlyPayment: '250',
          fraudAlertIndicator: false,
          tradelines: [{ accountNumber: 'must-not-leak' }],
          consumer: {
            firstName: 'MustNotLeak',
            address: '100 Private Street'
          },
          sourceResponse: {
            raw: 'must-not-leak'
          }
        })
      };
    }
  });

  assert.equal(observedRequests.length, 2);
  assert.equal(result.status, 'success');
  assert.equal(result.verified, true);
  assert.equal(result.transactionId, 'safe-transaction-id');
  assert.equal(result.scoreSummary.value, 721);
  assert.equal(result.sandboxVerificationReady, true);
  assert.equal(result.sandboxVerificationBlockedReason, null);
  assert.equal(result.safeToRunLiveCall, false);
  assertSandboxVerificationResponseIsSafe(result);

  const providerRequestBody = JSON.parse(observedRequests[1].options.body);
  assert.equal(JSON.stringify(providerRequestBody).includes('123-45-6789'), false);
  assert.equal(JSON.stringify(providerRequestBody).includes('DoNotForward'), false);
  assert.equal(providerRequestBody.customerConfiguration.equifaxUSConsumerCreditReport.pdfComboIndicator, 'N');
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
    socialInsuranceNumber: '999999998',
    address: {
      civicNumber: '100',
      streetName: 'Example Street',
      city: 'Ottawa',
      provinceCode: 'ON',
      postalCode: 'K1A0B1'
    }
  };
}

function validConsent() {
  return {
    provided: true,
    permissiblePurpose: 'credit_profile_assessment',
    version: 'kimure-credit-consent-v1',
    capturedAt: '2026-01-01T00:00:00.000Z'
  };
}

function createSandboxStaticTokenEnv() {
  return {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox',
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
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

function createSandboxClientCredentialProviderEnv(overrides = {}) {
  return {
    EQUIFAX_ENABLED: 'true',
    EQUIFAX_ENVIRONMENT: 'sandbox',
    EQUIFAX_TOKEN_STRATEGY: 'client_credentials',
    EQUIFAX_PROVIDER_CALLS_ENABLED: 'true',
    EQUIFAX_OAUTH_TOKEN_EXCHANGE_ENABLED: 'true',
    EQUIFAX_OAUTH_CLIENT_CREDENTIAL_PLACEMENT: 'basic_auth',
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '0',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_PERMISSIBLE_PURPOSE_CODE: '57',
    EQUIFAX_SANDBOX_BASE_URL: 'https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1',
    EQUIFAX_SANDBOX_OAUTH_TOKEN_URL: 'https://api.sandbox.equifax.com/v2/oauth/token',
    EQUIFAX_CLIENT_ID: 'sandbox-client-id-secret-value',
    EQUIFAX_CLIENT_SECRET: 'sandbox-client-secret-value',
    EQUIFAX_SCOPE: 'https://api.equifax.com/business/oneview/consumer-credit/v1',
    EQUIFAX_SANDBOX_MEMBER_NUMBER: 'sandbox-member-secret-value',
    EQUIFAX_SANDBOX_SECURITY_CODE: 'sandbox-security-secret-value',
    EQUIFAX_SANDBOX_CUSTOMER_CODE: 'sandbox-customer-secret-value',
    ...overrides
  };
}

function validSandboxVerificationInput() {
  return {
    consent: {
      provided: true,
      permissiblePurposeCode: '57'
    },
    permissiblePurposeCode: '57',
    sandboxIdentity: true,
    sandboxIdentityMarker: 'equifax_sandbox_test_identity'
  };
}

function buildRuntimeConfigForCheck(env) {
  return require('../src/services/equifax/equifaxProviderConfig').buildEquifaxRuntimeConfig(env);
}

function assertSandboxVerificationResponseIsSafe(result) {
  const serialized = JSON.stringify(result);
  [
    'access_token',
    'Authorization',
    'client_secret',
    'memberNumber',
    'securityCode',
    'customerCode',
    'requestBody',
    'rawProviderResponse',
    'rawReport',
    'tradelines',
    'trades',
    'pdfLink',
    'MustNotLeak',
    '100 Private Street',
    '123-45-6789',
    'oauth-access-token-secret-value',
    'sandbox-client-secret-value',
    'sandbox-member-secret-value',
    'sandbox-security-secret-value'
  ].forEach((forbidden) => {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked`);
  });
}

run().catch((error) => {
  console.error('[FAIL] Equifax provider request/response contract checks');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
