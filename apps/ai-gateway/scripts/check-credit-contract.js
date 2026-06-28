const assert = require('node:assert/strict');
const {
  normalizeCreditProfileRequest
} = require('../src/services/creditProfile/normalizeCreditProfileRequest');
const {
  createCreditProfile
} = require('../src/services/creditProfileService');
const {
  createMortgageAssessment,
  normalizeMortgageInput
} = require('../src/services/mortgageService');
const {
  buildEquifaxCreditRequest
} = require('../src/services/equifaxCreditService');
const {
  createCreditAssessmentRecord,
  getCreditAssessmentRecord,
  clearCreditAssessmentStore
} = require('../src/services/creditProfile/creditAssessmentStore');
const {
  routeMockChatMessage
} = require('../src/services/aiRouter');

async function run() {
  clearCreditAssessmentStore();
  checkNestedNormalization();
  checkDirectionalFinancialProfileOnly();
  checkLegacyNormalization();
  await checkInvalidDateAndUnknownFields();
  checkDirectEquifaxCanonicalAddress();
  const directionalResponse = await checkDirectionalResponseAndSensitiveData();
  checkCreditAssessmentRecord(directionalResponse);
  checkTrustedMortgageAssessmentResolution();
  checkApiResolvedTrustedMortgageHandoff();
  checkMissingAssessmentResolution();
  await checkExpiredAssessmentResolution();
  await checkNoConsentProviderFallback();
  await checkMissingKeyFallback();
  await checkAutoProviderRequiresConfiguration();
  await checkInsufficientProviderInput();
  checkMortgageHandoffAllowlist();
  await checkMortgageResponseDoesNotLeakHandoff();
  checkAskKimureRouting();
  clearCreditAssessmentStore();
  console.log('[PASS] Credit-profile contract alignment checks (18 groups)');
}

function checkNestedNormalization() {
  const normalized = normalizeCreditProfileRequest(buildNestedPayload());

  assert.equal(normalized.providerChoice, 'thirdstream_transunion');
  assert.equal(normalized.identity.firstName, 'Test');
  assert.equal(normalized.currentAddress.streetName, 'Example Street');
  assert.equal(normalized.financialProfile.annualIncome, 100000);
  assert.equal(normalized.financialProfile.monthlyDebt, 450);
  assert.equal(normalized.financialProfile.targetPurchasePrice, 600000);
  assert.equal(normalized.providedData.income.annualGross, 100000);
  assert.equal(normalized.providedData.liabilities.monthlyPayments, 450);
  assert.equal(normalized.providedData.identity.socialInsuranceNumberProvided, true);
  assert.equal(JSON.stringify(normalized.providedData).includes('999999998'), false);
  assert.equal(normalized.consent.provided, true);
}

function checkDirectionalFinancialProfileOnly() {
  const normalized = normalizeCreditProfileRequest({
    providerChoice: 'directional',
    financialProfile: {
      annualIncome: 90000,
      monthlyDebt: 300,
      savings: 60000,
      targetPurchasePrice: 500000,
      timeline: '6-12 months',
      location: 'Ottawa'
    }
  });

  assert.equal(normalized.providerChoice, 'directional');
  assert.equal(normalized.financialProfile.annualIncome, 90000);
  assert.equal(normalized.identity.firstName, null);
  assert.equal(normalized.consent.provided, false);
}

function checkLegacyNormalization() {
  const normalized = normalizeCreditProfileRequest({
    goal: 'buy a home',
    income: {
      annualGross: 100000,
      employmentType: 'full-time',
      stability: '3 years'
    },
    debt: [{
      type: 'car loan',
      balance: 15000,
      monthlyPayment: 450
    }],
    availableFunds: 90000,
    downPayment: 80000,
    budget: {
      targetPurchasePrice: 600000
    },
    timeline: '6-12 months',
    location: 'Ottawa',
    additionalProfile: {
      firstTimeBuyer: true,
      riskTolerance: 'moderate'
    }
  });

  assert.equal(normalized.sourceMetadata.inputShape, 'legacy_or_mixed');
  assert.equal(normalized.financialProfile.annualIncome, 100000);
  assert.equal(normalized.financialProfile.monthlyDebt, 450);
  assert.equal(normalized.financialProfile.savings, 90000);
  assert.equal(normalized.financialProfile.firstTimeBuyer, true);
}

async function checkInvalidDateAndUnknownFields() {
  const payload = buildNestedPayload();
  payload.identity.dateOfBirth = '2025-02-30';
  payload.unknownTopLevel = { sourceResponse: 'must-be-ignored' };
  payload.identity.unknownIdentityField = 'must-be-ignored';
  const normalized = normalizeCreditProfileRequest(payload);

  assert.equal(normalized.identity.dateOfBirth, null);
  assert.ok(normalized.normalizedInputSummary.invalidFields.includes('identity.dateOfBirth'));
  assert.ok(normalized.normalizedInputSummary.missingProviderIdentityFields.includes('identity.dateOfBirth'));
  assert.equal('unknownTopLevel' in normalized, false);
  assert.equal('unknownIdentityField' in normalized.identity, false);
  assert.equal(JSON.stringify(normalized.providerRequestContext).includes('must-be-ignored'), false);

  await withProviderEnv(createThirdstreamEnv(), async () => {
    const response = await createCreditProfile(payload);
    assert.equal(response.reportData.providerStatus.status, 'insufficient_input');
    assert.equal(response.reportData.verificationStatus.bureauDataVerified, false);
  });
}

function checkDirectEquifaxCanonicalAddress() {
  const normalized = normalizeCreditProfileRequest(buildNestedPayload());
  const request = buildEquifaxCreditRequest({
    providedData: normalized.providedData,
    requestContext: normalized.providerRequestContext,
    config: {
      reportPath: '/reports/credit-report',
      productCode: 'ONEVIEW',
      memberNumber: null,
      securityCode: null,
      customerCode: null
    }
  });
  const serialized = JSON.stringify(request);

  assert.equal(request.requestReady, true);
  assert.equal(request.providerCallReady, false);
  assert.equal(request.oneViewRequestBody, null);
  assert.equal(request.addressSnapshot.addressLine1Provided, true);
  assert.equal(request.addressSnapshot.cityProvided, true);
  assert.equal(request.addressSnapshot.regionProvided, true);
  assert.equal(serialized.includes('100 Example Street'), false);
  assert.equal(serialized.includes('K1A0B1'), false);
}

async function checkDirectionalResponseAndSensitiveData() {
  return withProviderEnv({
    CREDIT_PROVIDER: 'directional',
    GEMINI_API_KEY: ''
  }, async () => {
    const payload = buildNestedPayload();
    payload.providerChoice = 'directional';
    delete payload.identity;
    delete payload.currentAddress;
    delete payload.consent;
    const response = await createCreditProfile(payload);

    assert.equal(response.status, 'success');
    assert.equal(response.tool, 'credit-profile');
    assert.equal(response.reportData.verificationStatus.status, 'directional_only');
    assert.deepEqual(Object.keys(response.reportData).sort(), [
      'creditAssessment',
      'creditMortgageHandoff',
      'missingFields',
      'providerStatus',
      'verificationStatus'
    ]);
    assert.equal(response.reportData.providerStatus.provider, 'directional');
    assert.ok(Array.isArray(response.reportData.missingFields));
    assert.ok(response.reportData.creditMortgageHandoff);
    assert.ok(response.reportData.creditAssessment.assessmentId);
    assert.equal(response.reportData.creditAssessment.storageMode, 'ephemeral_memory_dev');
    assert.equal(response.reportData.creditAssessment.productionPersistenceRequired, true);
    assert.equal(response.crmSignals.leadIntent, 'credit_profile_readiness');
    assert.equal(typeof response.crmSignals.missingInfoCount, 'number');
    assert.equal(JSON.stringify(response).includes('999999998'), false);
    assert.equal(JSON.stringify(response).includes('sourceResponse'), false);
    assert.equal(JSON.stringify(response).includes('contentBase64'), false);
    assert.equal(JSON.stringify(response).includes('providerData'), false);
    assert.equal(JSON.stringify(response).includes('providedData'), false);
    assert.equal(JSON.stringify(response).includes('providerDiagnostics'), false);
    return response;
  });
}

function checkCreditAssessmentRecord(response) {
  const assessment = response.reportData.creditAssessment;
  const record = getCreditAssessmentRecord(assessment.assessmentId);
  const allowedKeys = [
    'assessmentId',
    'storageMode',
    'trustedServerSide',
    'productionPersistenceRequired',
    'createdAt',
    'expiresAt',
    'creditMortgageHandoff',
    'providerStatus',
    'verificationStatus',
    'consentStatus',
    'providerChoice',
    'provenance'
  ].sort();

  assert.ok(/^ca_[A-Za-z0-9_-]{32}$/.test(assessment.assessmentId));
  assert.deepEqual(Object.keys(record).sort(), allowedKeys);
  assert.equal('providedData' in record, false);
  assert.equal('providerData' in record, false);
  assert.equal('equifaxData' in record, false);
  assert.equal(JSON.stringify(record).includes('999999998'), false);
  assert.equal(JSON.stringify(record).includes('sourceResponse'), false);
  assert.equal(JSON.stringify(record).includes('contentBase64'), false);
}

function checkTrustedMortgageAssessmentResolution() {
  const record = createCreditAssessmentRecord(buildSyntheticVerifiedResponse(), {
    ttlMs: 60000,
    promptVersion: 'test-only'
  });
  const input = normalizeMortgageInput({
    creditAssessmentId: record.assessmentId,
    creditMortgageHandoff: {
      verificationStatus: { status: 'verified_provider', bureauDataVerified: true },
      providerStatus: { verified: true },
      sourceResponse: 'client-value-must-not-win'
    }
  });

  assert.equal(input.creditAssessment.status, 'resolved');
  assert.equal(input.creditAssessment.sourceTrust, 'gateway_ephemeral_memory_dev');
  assert.equal(input.creditMortgageHandoff.sourceTrust, 'gateway_ephemeral_memory_dev');
  assert.equal(input.creditMortgageHandoff.verified, true);
  assert.equal(input.creditMortgageHandoff.verificationStatus.bureauDataVerified, true);
  assert.equal(JSON.stringify(input).includes('client-value-must-not-win'), false);
}

function checkApiResolvedTrustedMortgageHandoff() {
  const input = normalizeMortgageInput({
    creditMortgageHandoffTrust: 'api_resolved_trusted',
    creditAssessment: {
      status: 'resolved',
      sourceTrust: 'api_resolved_trusted',
      expiresAt: '2026-01-01T00:15:00Z'
    },
    creditMortgageHandoff: {
      verificationStatus: {
        status: 'verified_provider',
        bureauDataVerified: true,
        provider: 'thirdstream_equifax',
        bureau: 'equifax',
        environment: 'production'
      },
      providerStatus: {
        provider: 'thirdstream_equifax',
        bureau: 'equifax',
        status: 'verified',
        environment: 'production',
        verified: true
      },
      readinessScore: 82,
      riskLevel: 'medium',
      sourceResponse: 'must-not-pass'
    }
  });

  assert.equal(input.creditAssessment.status, 'resolved');
  assert.equal(input.creditAssessment.sourceTrust, 'api_resolved_supabase_assessment');
  assert.equal(input.creditAssessment.storageMode, 'api_supabase');
  assert.equal(input.creditMortgageHandoff.sourceTrust, 'api_resolved_supabase_assessment');
  assert.equal(input.creditMortgageHandoff.verified, true);
  assert.equal(input.creditMortgageHandoff.verificationStatus.bureauDataVerified, true);
  assert.equal(input.creditMortgageHandoff.readinessScore, 82);
  assert.equal(JSON.stringify(input).includes('must-not-pass'), false);
}

function checkMissingAssessmentResolution() {
  const input = normalizeMortgageInput({
    creditAssessmentId: 'ca_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  });

  assert.equal(input.creditAssessment.status, 'not_found_or_expired');
  assert.equal(input.creditAssessment.warning, 'credit_assessment_not_found_or_expired');
  assert.equal(input.creditMortgageHandoff.verified, false);
}

async function checkExpiredAssessmentResolution() {
  const record = createCreditAssessmentRecord(buildSyntheticVerifiedResponse(), {
    ttlMs: 1
  });
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(getCreditAssessmentRecord(record.assessmentId), null);
  const input = normalizeMortgageInput({ creditAssessmentId: record.assessmentId });
  assert.equal(input.creditAssessment.warning, 'credit_assessment_not_found_or_expired');
  assert.equal(input.creditMortgageHandoff.verified, false);
}

async function checkNoConsentProviderFallback() {
  const payload = buildNestedPayload();
  payload.consent.creditConsent = false;
  payload.consent.consentGiven = false;

  await withProviderEnv(createThirdstreamEnv(), async () => {
    const response = await createCreditProfile(payload);
    assert.equal(response.reportData.providerStatus.status, 'consent_required');
    assert.equal(response.reportData.verificationStatus.status, 'consent_required');
    assert.equal(JSON.stringify(response).includes('providerData'), false);
  });
}

async function checkMissingKeyFallback() {
  const env = createThirdstreamEnv();
  env.THIRDSTREAM_API_KEY = '';

  await withProviderEnv(env, async () => {
    const response = await createCreditProfile(buildNestedPayload());
    assert.equal(response.reportData.providerStatus.status, 'configuration_missing');
    assert.equal(response.reportData.verificationStatus.status, 'provider_unavailable');
    assert.equal(JSON.stringify(response).includes('providerData'), false);
  });
}

async function checkAutoProviderRequiresConfiguration() {
  const payload = buildNestedPayload();
  payload.providerChoice = 'auto';

  await withProviderEnv({
    CREDIT_PROVIDER: 'directional',
    THIRDSTREAM_ENABLED: 'false',
    GEMINI_API_KEY: ''
  }, async () => {
    const response = await createCreditProfile(payload);
    assert.equal(response.reportData.providerStatus.provider, 'auto');
    assert.equal(response.reportData.providerStatus.status, 'configuration_missing');
    assert.equal(response.reportData.verificationStatus.status, 'provider_unavailable');
  });
}

async function checkInsufficientProviderInput() {
  const payload = buildNestedPayload();
  delete payload.identity.dateOfBirth;
  delete payload.currentAddress.streetName;

  await withProviderEnv(createThirdstreamEnv(), async () => {
    const response = await createCreditProfile(payload);
    assert.equal(response.reportData.providerStatus.status, 'insufficient_input');
    assert.ok(response.reportData.missingFields.some((field) => field.includes('dateOfBirth')));
  });
}

function checkAskKimureRouting() {
  const creditResponse = routeMockChatMessage('Am I financially ready to buy a home?');
  const mortgageResponse = routeMockChatMessage('How much mortgage can I afford?');

  assert.equal(creditResponse.tool, 'credit-profile');
  assert.equal(creditResponse.reportData.dedicatedRoute, '/ai/credit-profile');
  assert.equal(mortgageResponse.tool, 'mortgage');
  assert.equal(mortgageResponse.reportData.dedicatedRoute, '/ai/mortgage');
}

function checkMortgageHandoffAllowlist() {
  const input = normalizeMortgageInput({
    income: { annualGross: 125000 },
    creditMortgageHandoff: {
      verificationStatus: {
        status: 'verified_sandbox',
        bureauDataVerified: true,
        provider: 'thirdstream_transunion',
        bureau: 'transunion',
        environment: 'sandbox'
      },
      providerStatus: {
        provider: 'thirdstream_transunion',
        bureau: 'transunion',
        status: 'verified',
        environment: 'sandbox',
        verified: true
      },
      readinessScore: 78,
      riskLevel: 'medium',
      debtRisk: { band: 'elevated', ratio: 0.4 },
      affordabilityWarningFlags: ['mortgage_inputs_incomplete'],
      missingInfoForMortgage: ['verified income'],
      recommendedMortgageNextSteps: ['Confirm income documents.'],
      providerData: { raw: 'must-not-pass' },
      socialInsuranceNumber: '999999998',
      sourceResponse: 'must-not-pass'
    }
  });

  assert.equal(input.creditMortgageHandoff.verified, false);
  assert.equal(input.creditMortgageHandoff.verificationClaimed, false);
  assert.equal(input.creditMortgageHandoff.sourceTrust, 'client_supplied_untrusted');
  assert.equal(input.creditMortgageHandoff.readinessScore, null);
  assert.equal('providerData' in input.creditMortgageHandoff, false);
  assert.equal('socialInsuranceNumber' in input.creditMortgageHandoff, false);
  assert.equal(JSON.stringify(input.creditMortgageHandoff).includes('must-not-pass'), false);
}

async function checkMortgageResponseDoesNotLeakHandoff() {
  await withProviderEnv({ GEMINI_API_KEY: '' }, async () => {
    const response = await createMortgageAssessment({
      income: { annualGross: 125000 },
      creditMortgageHandoff: {
        verificationStatus: {
          status: 'verified_provider',
          bureauDataVerified: true
        },
        providerStatus: { verified: true },
        readinessScore: 99,
        sourceResponse: 'must-not-pass',
        socialInsuranceNumber: '999999998'
      }
    });
    const serialized = JSON.stringify(response);

    assert.equal(response.status, 'success');
    assert.equal(response.reportData.creditReferenceStatus.sourceTrust, 'client_supplied_untrusted');
    assert.equal(response.reportData.creditReferenceStatus.verifiedCredit, false);
    assert.equal('creditMortgageHandoff' in response.reportData.mortgageInput, false);
    assert.equal(serialized.includes('must-not-pass'), false);
    assert.equal(serialized.includes('999999998'), false);
    assert.equal(serialized.includes('sourceResponse'), false);
    assert.equal(serialized.includes('contentBase64'), false);
  });
}

function buildSyntheticVerifiedResponse() {
  return {
    tool: 'credit-profile',
    resultType: 'credit_profile_assessment',
    riskLevel: 'medium',
    reportData: {
      creditMortgageHandoff: {
        verificationStatus: {
          status: 'verified_sandbox',
          bureauDataVerified: true,
          provider: 'thirdstream_transunion',
          bureau: 'transunion',
          environment: 'sandbox'
        },
        providerStatus: {
          provider: 'thirdstream_transunion',
          bureau: 'transunion',
          status: 'verified',
          environment: 'sandbox',
          verified: true
        },
        readinessScore: 81,
        riskLevel: 'medium',
        debtRisk: { band: 'lower', ratio: 0.3 },
        incomeStabilitySignal: {
          employmentType: 'full-time',
          stability: '3 years',
          incomeVerified: false,
          status: 'provided_unverified'
        },
        downPaymentReadiness: { band: 'strong_directional', ratio: 0.2 },
        affordabilityWarningFlags: [],
        missingInfoForMortgage: ['verified income'],
        recommendedMortgageNextSteps: ['Confirm income documents.'],
        disclaimer: 'Test-only minimized handoff; not lender approval.',
        socialInsuranceNumber: '999999998',
        sourceResponse: 'must-not-store'
      },
      providerStatus: {
        provider: 'thirdstream_transunion',
        bureau: 'transunion',
        status: 'verified',
        environment: 'sandbox',
        verified: true,
        providerDiagnostics: { raw: 'must-not-store' }
      },
      verificationStatus: {
        status: 'verified_sandbox',
        provider: 'thirdstream_transunion',
        bureau: 'transunion',
        providerStatus: 'verified',
        bureauDataVerified: true,
        providerEnvironment: 'sandbox',
        durableAuthReady: false
      },
      consentStatus: {
        status: 'granted',
        explicitConsent: true,
        providerCallAllowed: true,
        capturedAt: '2026-01-01T00:00:00Z',
        version: 'test-only',
        permissiblePurpose: 'test-only'
      },
      providerChoice: {
        requested: 'thirdstream_transunion',
        resolved: 'thirdstream_transunion',
        backendControlled: true,
        requestOverrideApplied: false
      },
      providerData: {
        sourceResponse: 'must-not-store',
        contentBase64: 'must-not-store'
      },
      providedData: {
        identity: { socialInsuranceNumber: '999999998' }
      }
    }
  };
}

function buildNestedPayload() {
  return {
    providerChoice: 'thirdstream_transunion',
    goal: 'buy a home',
    identity: {
      firstName: 'Test',
      middleName: 'Example',
      lastName: 'Consumer',
      dateOfBirth: '1990-01-15',
      phoneNumber: '+14035552811',
      socialInsuranceNumber: '999999998'
    },
    currentAddress: {
      civicNumber: '100',
      streetName: 'Example Street',
      city: 'Ottawa',
      provinceCode: 'ON',
      postalCode: 'K1A0B1'
    },
    consent: {
      creditConsent: true,
      consentGiven: true,
      permissiblePurpose: 'test-only',
      consentTimestamp: '2026-01-01T00:00:00Z',
      consentVersion: 'test-only'
    },
    financialProfile: {
      annualIncome: 100000,
      monthlyDebt: 450,
      employmentStatus: 'full-time',
      employmentStability: '3 years',
      currentHousingPayment: 2200,
      savings: 90000,
      downPayment: 80000,
      targetPurchasePrice: 600000,
      timeline: '6-12 months',
      location: 'Ottawa',
      firstTimeBuyer: true,
      riskTolerance: 'moderate'
    }
  };
}

function createThirdstreamEnv() {
  return {
    CREDIT_PROVIDER: 'directional',
    THIRDSTREAM_ENABLED: 'true',
    THIRDSTREAM_ENVIRONMENT: 'sandbox',
    THIRDSTREAM_BASE_URL: 'https://api.test.thirdstream.ca',
    THIRDSTREAM_API_KEY_HEADER_NAME: 'X-API-Key',
    THIRDSTREAM_API_KEY: 'test-key-never-sent',
    GEMINI_API_KEY: ''
  };
}

async function withProviderEnv(values, callback) {
  const keys = Object.keys(values);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = value;
  });

  try {
    return await callback();
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

run().catch((error) => {
  console.error('[FAIL] Credit-profile contract alignment checks');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
