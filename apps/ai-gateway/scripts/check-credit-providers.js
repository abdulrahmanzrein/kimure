const assert = require('node:assert/strict');
const {
  getThirdstreamCreditProfileData,
  buildThirdstreamCreditRequest,
  classifyThirdstreamHttpStatus
} = require('../src/services/creditProviders/thirdstreamProvider');

const validApplicant = {
  firstName: 'Test',
  lastName: 'Consumer',
  dateOfBirth: '1990-01-15',
  currentAddress: {
    civicNumber: '100',
    streetName: 'Example Street',
    city: 'Ottawa',
    provinceCode: 'ON',
    postalCode: 'K1A0B1'
  }
};

const consent = {
  provided: true,
  capturedAt: '2026-01-01T00:00:00Z',
  version: 'test-only',
  permissiblePurpose: 'test-only'
};

async function run() {
  await checkNoConsent();
  await checkInsufficientInput();
  await checkMissingApiKey();
  checkAddressMappings();
  checkErrorClassification();
  await checkSuccessfulMinimizedResponse();
  console.log('[PASS] Credit provider adapter checks (7 assertion groups)');
}

async function checkNoConsent() {
  let fetchCalled = false;
  const result = await getThirdstreamCreditProfileData({
    providerName: 'thirdstream_equifax',
    providedData: {},
    requestContext: {
      applicant: validApplicant,
      consent: { provided: false }
    },
    env: createConfiguredEnv(),
    fetchImpl: async () => {
      fetchCalled = true;
    }
  });

  assert.equal(result.status, 'consent_required');
  assert.equal(result.verified, false);
  assert.equal(fetchCalled, false);
}

async function checkInsufficientInput() {
  const result = await getThirdstreamCreditProfileData({
    providerName: 'thirdstream_transunion',
    providedData: {},
    requestContext: {
      applicant: {
        firstName: 'Test',
        lastName: 'Consumer'
      },
      consent
    },
    env: createConfiguredEnv(),
    fetchImpl: failIfCalled
  });

  assert.equal(result.status, 'insufficient_input');
  assert.ok(result.request.missingRequestFields.includes('dateOfBirth'));
}

async function checkMissingApiKey() {
  const env = createConfiguredEnv();
  delete env.THIRDSTREAM_API_KEY;

  const result = await getThirdstreamCreditProfileData({
    providerName: 'thirdstream_equifax',
    providedData: {},
    requestContext: {
      applicant: validApplicant,
      consent
    },
    env,
    fetchImpl: failIfCalled
  });

  assert.equal(result.status, 'configuration_missing');
  assert.equal(result.verified, false);
}

function checkAddressMappings() {
  const equifaxRequest = buildThirdstreamCreditRequest({
    providerName: 'thirdstream_equifax',
    providedData: {},
    requestContext: {
      applicant: validApplicant,
      consent
    }
  });
  const transunionRequest = buildThirdstreamCreditRequest({
    providerName: 'thirdstream_transunion',
    providedData: {},
    requestContext: {
      applicant: validApplicant,
      consent
    }
  });

  assert.equal(equifaxRequest.requestBody.subject.currentAddress.cityName, 'Ottawa');
  assert.equal('city' in equifaxRequest.requestBody.subject.currentAddress, false);
  assert.equal(transunionRequest.requestBody.subject.currentAddress.city, 'Ottawa');
  assert.equal('cityName' in transunionRequest.requestBody.subject.currentAddress, false);
}

function checkErrorClassification() {
  assert.equal(classifyThirdstreamHttpStatus(401), 'unauthorized');
  assert.equal(classifyThirdstreamHttpStatus(403), 'forbidden');
  assert.equal(classifyThirdstreamHttpStatus(422), 'provider_validation_error');
  assert.equal(classifyThirdstreamHttpStatus(429), 'provider_unavailable');
  assert.equal(classifyThirdstreamHttpStatus(503), 'provider_unavailable');
  assert.equal(classifyThirdstreamHttpStatus(418), 'provider_error');
}

async function checkSuccessfulMinimizedResponse() {
  let capturedUrl;
  let capturedOptions;
  const env = {
    ...createConfiguredEnv(),
    THIRDSTREAM_API_LANGUAGE: 'en-CA',
    THIRDSTREAM_API_CONTEXT: 'credit-profile-test',
    THIRDSTREAM_API_SCOPE: 'test-scope'
  };
  const result = await getThirdstreamCreditProfileData({
    providerName: 'thirdstream_transunion',
    providedData: {},
    requestContext: {
      customerReferenceNumber: 'safe-test-reference',
      applicant: validApplicant,
      consent
    },
    env,
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => name === 'x-transaction-id' ? 'safe-test-transaction' : null
        },
        text: async () => JSON.stringify({
          customerReferenceNumber: 'safe-test-reference',
          hitIndicator: 'hit',
          creditScore: 710,
          inquiryCount: 2,
          collectionCount: 0,
          sourceResponse: { raw: 'must-not-escape' },
          contentBase64: 'bXVzdC1ub3QtZXNjYXBl'
        })
      };
    }
  });

  assert.equal(capturedUrl, 'https://api.test.thirdstream.ca/transunionconsumercredit/v3/consumer');
  assert.equal(capturedOptions.headers['X-API-Key'], 'test-key-never-sent');
  assert.equal(capturedOptions.headers['X-API-Language'], 'en-CA');
  assert.equal(capturedOptions.headers['X-API-Context'], 'credit-profile-test');
  assert.equal(capturedOptions.headers['X-API-Scope'], 'test-scope');
  assert.equal(result.status, 'verified');
  assert.equal(result.verifiedData.scoreSummary.value, 710);
  assert.equal(JSON.stringify(result).includes('must-not-escape'), false);
  assert.equal(JSON.stringify(result).includes('bXVzdC1ub3QtZXNjYXBl'), false);
}

function createConfiguredEnv() {
  return {
    THIRDSTREAM_ENABLED: 'true',
    THIRDSTREAM_ENVIRONMENT: 'sandbox',
    THIRDSTREAM_BASE_URL: 'https://api.test.thirdstream.ca',
    THIRDSTREAM_API_KEY_HEADER_NAME: 'X-API-Key',
    THIRDSTREAM_API_KEY: 'test-key-never-sent'
  };
}

async function failIfCalled() {
  throw new Error('fetch must not be called for a gated provider result');
}

run().catch((error) => {
  console.error('[FAIL] Credit provider adapter checks');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

