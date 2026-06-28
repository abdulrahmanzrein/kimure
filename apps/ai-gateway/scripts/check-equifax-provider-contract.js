const assert = require('node:assert/strict');
const {
  buildEquifaxOneViewRequestV1,
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
  checkRegistryStillSupportsFutureProviders();
  console.log('[PASS] Equifax provider request/response contract checks (6 assertion groups)');
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
  assert.equal(request.portalDependency.requestBodySchemaConfirmed, false);
  assert.equal(request.safeDebugMetadata.finalProviderBodyBuilt, false);
  assert.equal(request.applicantSnapshot.firstNameProvided, true);
  assert.equal(request.addressSnapshot.postalCodeProvided, true);
  assert.equal(serialized.includes('Test'), false);
  assert.equal(serialized.includes('Consumer'), false);
  assert.equal(serialized.includes('100 Example Street'), false);
  assert.equal(serialized.includes('K1A0B1'), false);
  assert.equal(serialized.includes('999999998'), false);
  assert.equal(serialized.includes('sandbox-token-secret-value'), false);
}

function checkResponseNormalizerAllowlist() {
  const rawResponse = {
    transactionId: 'safe-transaction-id',
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
    environment: 'sandbox'
  });
  const serialized = JSON.stringify(normalized);

  assert.equal(normalized.provider, 'equifax_oneview');
  assert.equal(normalized.bureau, 'equifax');
  assert.equal(normalized.environment, 'sandbox');
  assert.equal(normalized.extractionVersion, RESPONSE_EXTRACTION_VERSION);
  assert.equal(normalized.mapperStatus, 'normalized');
  assert.equal(normalized.verificationStatus.bureauDataVerified, true);
  assert.equal(normalized.scoreSummary.value, 718);
  assert.equal(normalized.debtSummary.totalBalance, 12500);
  assert.equal(normalized.riskFlags.fraudAlertIndicator, true);
  assert.equal(normalized.riskFlags.collectionsCount, 2);
  assert.equal(normalized.referenceIds.transactionId, 'safe-transaction-id');
  assert.equal(serialized.includes('must-not-leak'), false);
  assert.equal(serialized.includes('Jane'), false);
  assert.equal(serialized.includes('100 Private Street'), false);
  assert.equal(serialized.includes('bXVzdC1ub3QtbGVhaw=='), false);
}

function checkResponseNormalizerHandlesEmptyResponse() {
  const normalized = normalizeEquifaxOneViewResponseV1(null, {
    environment: 'production'
  });

  assert.equal(normalized.environment, 'production');
  assert.equal(normalized.mapperStatus, 'empty_response');
  assert.equal(normalized.verificationStatus.bureauDataVerified, false);
  assert.equal(normalized.scoreSummary, null);
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
    EQUIFAX_TIMEOUT_MS: '10000',
    EQUIFAX_RETRY_COUNT: '0',
    EQUIFAX_PRODUCT_CODE: 'portal-product-code',
    EQUIFAX_CONSENT_VERSION: 'kimure-credit-consent-v1',
    EQUIFAX_SANDBOX_BASE_URL: 'https://sandbox.equifax.invalid/oneview',
    EQUIFAX_SANDBOX_ACCESS_TOKEN: 'sandbox-token-secret-value',
    EQUIFAX_SANDBOX_MEMBER_NUMBER: 'sandbox-member-secret-value',
    EQUIFAX_SANDBOX_SECURITY_CODE: 'sandbox-security-secret-value',
    EQUIFAX_SANDBOX_CUSTOMER_CODE: 'sandbox-customer-secret-value'
  };
}

run().catch((error) => {
  console.error('[FAIL] Equifax provider request/response contract checks');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
