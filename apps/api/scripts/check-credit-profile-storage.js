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
const {
  AiController
} = require("../src/ai/ai.controller");

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

  const providerControllerChecks = await runControllerFlow({
    input: providerInput,
    gatewayResponse: shapedCreditResponse
  });

  assert.equal(providerControllerChecks.response, shapedCreditResponse);
  assert.equal(providerControllerChecks.consentCalls.length, 1);
  assert.equal(providerControllerChecks.consentCalls[0].providerChoice, "equifax_oneview");
  assert.equal(providerControllerChecks.creditAssessmentCalls.length, 1);
  assert.equal(providerControllerChecks.creditProfileCalls.length, 1);
  assert.equal(providerControllerChecks.creditProfileCalls[0].providerChoice, "equifax_oneview");

  const directionalControllerChecks = await runControllerFlow({
    input: directionalInput,
    gatewayResponse: shapedCreditResponse
  });

  assert.equal(directionalControllerChecks.response, shapedCreditResponse);
  assert.equal(directionalControllerChecks.consentCalls.length, 0);
  assert.equal(directionalControllerChecks.creditProfileCalls.length, 1);

  const mortgageControllerChecks = await runMortgageControllerFlow();
  assert.equal(mortgageControllerChecks.response.summary, "Mortgage estimate");
  assert.equal(mortgageControllerChecks.mortgageCalls.length, 1);
  assert.equal(mortgageControllerChecks.mortgageCalls[0].request.annualGross, 110000);
  assert.equal(
    JSON.stringify(mortgageControllerChecks.mortgageCalls[0]).includes("creditMortgageHandoff"),
    false
  );

  const failureSafeChecks = await runControllerFlow({
    input: providerInput,
    gatewayResponse: shapedCreditResponse,
    throwFromPersistence: true
  });
  assert.equal(failureSafeChecks.response, shapedCreditResponse);
}

runServiceChecks().then(() => {
  console.log("Credit consent and financial profile storage checks passed.");
});

async function runControllerFlow({
  input,
  gatewayResponse,
  throwFromPersistence = false
}) {
  const consentCalls = [];
  const creditAssessmentCalls = [];
  const creditProfileCalls = [];
  const gateway = {
    execute(tool, payload) {
      assert.equal(tool, "credit-profile");
      return Promise.resolve(gatewayResponse);
    }
  };
  const creditAssessments = {
    persistCreditProfileResponse(id, response) {
      creditAssessmentCalls.push({ id, response });
      if (throwFromPersistence) throw new Error("persist failed");
      return Promise.resolve({ status: "stored", response });
    }
  };
  const creditConsents = {
    persistConsent(id, normalized) {
      consentCalls.push({
        id,
        providerChoice: normalized.providerChoice
      });
      if (throwFromPersistence) throw new Error("consent failed");
      return Promise.resolve({ status: normalized.providerChoice === "directional" ? "skipped" : "stored" });
    }
  };
  const userFinancialProfiles = {
    upsertFromCreditProfile(id, normalized, response) {
      creditProfileCalls.push({
        id,
        providerChoice: normalized.providerChoice,
        response
      });
      if (throwFromPersistence) throw new Error("profile failed");
      return Promise.resolve({ status: "stored" });
    },
    upsertFromMortgage() {
      throw new Error("unexpected mortgage upsert");
    }
  };

  const controller = new AiController(
    gateway,
    creditAssessments,
    creditConsents,
    userFinancialProfiles
  );
  const response = await controller.runTool("credit-profile", input, buildRequest());

  return {
    response,
    consentCalls,
    creditAssessmentCalls,
    creditProfileCalls
  };
}

async function runMortgageControllerFlow() {
  const mortgageCalls = [];
  const gateway = {
    execute(tool) {
      assert.equal(tool, "mortgage");
      return Promise.resolve({
        summary: "Mortgage estimate",
        reportData: {
          sourceResponse: "drop-this"
        }
      });
    }
  };
  const creditAssessments = {
    resolveForMortgage() {
      return Promise.resolve({ status: "not_provided" });
    },
    buildMortgageGatewayInput(input) {
      return input;
    }
  };
  const creditConsents = {
    persistConsent() {
      throw new Error("unexpected consent persist");
    }
  };
  const userFinancialProfiles = {
    upsertFromCreditProfile() {
      throw new Error("unexpected credit upsert");
    },
    upsertFromMortgage(id, request, response) {
      mortgageCalls.push({ id, request, response });
      return Promise.resolve({ status: "stored" });
    }
  };
  const controller = new AiController(
    gateway,
    creditAssessments,
    creditConsents,
    userFinancialProfiles
  );
  const response = await controller.runTool(
    "mortgage",
    {
      annualGross: 110000,
      monthlyDebtPayments: 700,
      creditMortgageHandoff: {
        rawProviderPayload: "drop-this"
      }
    },
    buildRequest()
  );

  return { response, mortgageCalls };
}

function buildRequest() {
  return {
    user: { id: userId },
    headers: {
      authorization: "Bearer test-token"
    }
  };
}
