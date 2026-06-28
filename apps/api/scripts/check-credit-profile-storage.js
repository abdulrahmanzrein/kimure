const assert = require("node:assert/strict");
const {
  CreditConsentsService,
  buildCreditConsentRow,
  resolveCreditProviderTarget
} = require("../src/ai/credit-consents.service");
const {
  UserFinancialProfilesService,
  buildUserFinancialProfileRowFromCreditProfile,
  buildUserFinancialProfileRowFromMortgage
} = require("../src/ai/user-financial-profiles.service");
const {
  normalizeCreditProfileInput
} = require("../src/ai/credit-ai.contract");

const userId = "00000000-0000-4000-8000-000000000001";
const providerInput = normalizeCreditProfileInput({
  providerChoice: "equifax_oneview",
  identity: {
    firstName: "Test",
    lastName: "Applicant",
    dateOfBirth: "1990-01-01",
    socialInsuranceNumber: "123456789"
  },
  currentAddress: {
    civicNumber: "1",
    streetName: "Example Street",
    city: "Ottawa",
    provinceCode: "ON",
    postalCode: "A1A1A1"
  },
  consent: {
    creditConsent: true,
    consentGiven: true,
    bureauConsent: true,
    permissiblePurpose: "credit_profile_assessment",
    consentTimestamp: "2026-01-01T00:00:00.000Z",
    consentVersion: "kimure-credit-profile-v1"
  },
  financialProfile: {
    annualIncome: 90000,
    monthlyDebt: 500,
    currentHousingPayment: 1800,
    savings: 40000,
    downPayment: 35000,
    targetPurchasePrice: 650000,
    employmentStatus: "full-time",
    employmentStability: "2-plus-years",
    timeline: "3-6-months",
    location: "Ottawa",
    firstTimeBuyer: true,
    riskTolerance: "moderate"
  }
});

const directionalInput = normalizeCreditProfileInput({
  providerChoice: "directional",
  financialProfile: {
    annualIncome: 90000,
    monthlyDebt: 500
  }
});

const consentRow = buildCreditConsentRow(userId, providerInput, {
  expiresAt: "2027-01-01T00:00:00.000Z",
  source: "credit-profile"
});

assert.ok(consentRow);
assert.equal(consentRow.provider_choice, "equifax_oneview");
assert.equal(consentRow.provider, "equifax");
assert.equal(consentRow.bureau, "equifax");
assert.equal(consentRow.permissible_purpose, "credit_profile_assessment");
assert.equal(consentRow.status, "active");
assert.equal(JSON.stringify(consentRow).includes("123456789"), false);
assert.equal(JSON.stringify(consentRow).includes("1990-01-01"), false);
assert.equal(JSON.stringify(consentRow).includes("Example Street"), false);
assert.equal(JSON.stringify(consentRow).includes("sourceResponse"), false);
assert.equal(JSON.stringify(consentRow).includes("contentBase64"), false);

assert.equal(buildCreditConsentRow(userId, directionalInput), null);

assert.deepEqual(resolveCreditProviderTarget("equifax_oneview"), {
  provider: "equifax",
  bureau: "equifax"
});
assert.deepEqual(resolveCreditProviderTarget("thirdstream_equifax"), {
  provider: "thirdstream",
  bureau: "equifax"
});
assert.deepEqual(resolveCreditProviderTarget("thirdstream_transunion"), {
  provider: "thirdstream",
  bureau: "transunion"
});
assert.deepEqual(resolveCreditProviderTarget("future_provider"), {
  provider: "future_provider",
  bureau: "none"
});

const shapedCreditResponse = {
  status: "success",
  tool: "credit-profile",
  score: 76,
  riskLevel: "moderate",
  reportData: {
    providerStatus: {
      provider: "equifax",
      bureau: "equifax",
      verified: true,
      sourceResponse: "drop-this"
    },
    verificationStatus: {
      bureauDataVerified: true,
      provider: "equifax",
      bureau: "equifax"
    },
    creditAssessment: {
      assessmentId: "ca_test_should_not_store",
      expiresAt: "2027-01-01T00:00:00.000Z"
    },
    providerData: {
      rawProviderPayload: "drop-this"
    }
  },
  rawGeminiResponse: "drop-this"
};

const financialRow = buildUserFinancialProfileRowFromCreditProfile(
  userId,
  providerInput,
  shapedCreditResponse
);

assert.equal(financialRow.annual_income, 90000);
assert.equal(financialRow.monthly_debt, 500);
assert.equal(financialRow.current_housing_payment, 1800);
assert.equal(financialRow.savings, 40000);
assert.equal(financialRow.down_payment, 35000);
assert.equal(financialRow.target_purchase_price, 650000);
assert.equal(financialRow.employment_status, "full-time");
assert.equal(financialRow.latest_credit_readiness_score, 76);
assert.equal(financialRow.latest_risk_level, "moderate");
assert.equal(financialRow.latest_credit_verified, true);
assert.equal(financialRow.latest_credit_provider, "equifax");
assert.equal(financialRow.latest_credit_bureau, "equifax");
assert.equal(JSON.stringify(financialRow).includes("123456789"), false);
assert.equal(JSON.stringify(financialRow).includes("1990-01-01"), false);
assert.equal(JSON.stringify(financialRow).includes("Example Street"), false);
assert.equal(JSON.stringify(financialRow).includes("rawProviderPayload"), false);
assert.equal(JSON.stringify(financialRow).includes("rawGeminiResponse"), false);
assert.equal(JSON.stringify(financialRow).includes("ca_test_should_not_store"), false);

const mortgageRow = buildUserFinancialProfileRowFromMortgage(
  userId,
  {
    annualGross: 110000,
    monthlyDebtPayments: 700,
    downPayment: 60000,
    targetPurchasePrice: 720000,
    location: "Toronto",
    employmentType: "contract",
    creditMortgageHandoff: {
      rawProviderPayload: "drop-this"
    }
  },
  {
    summary: "Mortgage estimate",
    reportData: {
      sourceResponse: "drop-this"
    }
  }
);

assert.equal(mortgageRow.annual_income, 110000);
assert.equal(mortgageRow.monthly_debt, 700);
assert.equal(mortgageRow.down_payment, 60000);
assert.equal(mortgageRow.target_purchase_price, 720000);
assert.equal(mortgageRow.target_location, "Toronto");
assert.equal(mortgageRow.employment_status, "contract");
assert.equal(JSON.stringify(mortgageRow).includes("creditMortgageHandoff"), false);
assert.equal(JSON.stringify(mortgageRow).includes("sourceResponse"), false);

class EmptyConfig {
  get() {
    return undefined;
  }
}

const missingConfigConsentService = new CreditConsentsService(new EmptyConfig());
const missingConfigFinancialService = new UserFinancialProfilesService(
  new EmptyConfig()
);

async function runServiceChecks() {
  assert.deepEqual(
    await missingConfigConsentService.persistConsent(userId, providerInput),
    { status: "skipped" }
  );
  assert.deepEqual(
    await missingConfigFinancialService.upsertFromCreditProfile(
      userId,
      providerInput,
      shapedCreditResponse
    ),
    { status: "skipped" }
  );

  const failingClient = {
    from() {
      return {
        insert() {
          return Promise.resolve({ error: { message: "insert failed" } });
        },
        upsert() {
          return Promise.resolve({ error: { message: "upsert failed" } });
        }
      };
    }
  };

  const failingConsentService = new CreditConsentsService(
    new EmptyConfig(),
    failingClient
  );
  const failingFinancialService = new UserFinancialProfilesService(
    new EmptyConfig(),
    failingClient
  );

  assert.deepEqual(
    await failingConsentService.persistConsent(userId, providerInput),
    { status: "failed" }
  );
  assert.deepEqual(
    await failingFinancialService.upsertFromCreditProfile(
      userId,
      providerInput,
      shapedCreditResponse
    ),
    { status: "failed" }
  );
}

runServiceChecks().then(() => {
  console.log("Credit consent and financial profile storage checks passed.");
});
