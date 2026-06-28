const assert = require("node:assert/strict");
const {
  DashboardService,
  emptyDashboard,
  shapeAiInsight,
  shapeConsent,
  shapeCreditReadiness,
  shapeFinancialProfile,
  shapeMortgageReadiness,
  shapeOnboarding,
  shapeProfile
} = require("../src/dashboard/dashboard.service");

const userId = "00000000-0000-4000-8000-000000000001";

const profile = shapeProfile({
  id: userId,
  full_name: "Test User",
  email: "drop@example.com",
  role: "individual",
  city: "Ottawa",
  country: "Canada",
  kyc_status: "not_started"
});

assert.equal(profile.id, userId);
assert.equal(profile.fullName, "Test User");
assert.equal(profile.email, undefined);

const onboarding = shapeOnboarding({
  intent: "buy",
  budget_min: 500000,
  budget_max: 750000,
  timeline: "3-6-months",
  risk_level: "moderate",
  location_preferences: [{ fullAddress: "drop" }, "Ottawa"],
  property_preferences: ["detached", "townhouse"],
  financial_inputs: {
    available_funds: 80000,
    monthly_rental_income: 0,
    rawGeminiResponse: "drop-this"
  }
});

assert.equal(onboarding.intent, "buy");
assert.deepEqual(onboarding.locationPreferences, ["Ottawa"]);
assert.equal(JSON.stringify(onboarding).includes("rawGeminiResponse"), false);
assert.equal(JSON.stringify(onboarding).includes("fullAddress"), false);

const financial = shapeFinancialProfile({
  annual_income: 110000,
  monthly_debt: 700,
  savings: 90000,
  down_payment: 75000,
  target_purchase_price: 700000,
  employment_status: "full-time",
  employment_stability: "2-plus-years",
  target_location: "Toronto",
  latest_credit_readiness_score: 78,
  latest_risk_level: "moderate",
  latest_credit_verified: true,
  latest_credit_provider: "equifax",
  latest_credit_bureau: "equifax",
  socialInsuranceNumber: "drop-this"
});

assert.equal(financial.annualIncome, 110000);
assert.equal(financial.latestCreditVerified, true);
assert.equal(JSON.stringify(financial).includes("socialInsuranceNumber"), false);

const creditReadiness = shapeCreditReadiness(
  {
    status: "active",
    provider_choice: "equifax_oneview",
    assessment_id_hash: "drop-this",
    provider_status: {
      provider: "equifax",
      bureau: "equifax",
      status: "verified",
      verified: true,
      providerDiagnostics: "drop-this"
    },
    verification_status: {
      status: "verified_provider",
      bureauDataVerified: true,
      sourceResponse: "drop-this"
    },
    credit_mortgage_handoff: {
      raw: "drop-this"
    },
    readiness_score: 78,
    risk_level: "moderate",
    expires_at: "2027-01-01T00:00:00.000Z"
  },
  financial
);

assert.equal(creditReadiness.readinessScore, 78);
assert.equal(creditReadiness.provider, "equifax");
assert.equal(creditReadiness.bureauDataVerified, true);
assert.equal(JSON.stringify(creditReadiness).includes("assessment_id_hash"), false);
assert.equal(JSON.stringify(creditReadiness).includes("credit_mortgage_handoff"), false);
assert.equal(JSON.stringify(creditReadiness).includes("sourceResponse"), false);
assert.equal(JSON.stringify(creditReadiness).includes("providerDiagnostics"), false);

const consent = shapeConsent({
  provider_choice: "equifax_oneview",
  provider: "equifax",
  bureau: "equifax",
  permissible_purpose: "credit_profile_assessment",
  consent_version: "kimure-credit-profile-v1",
  consent_text_hash: "drop-this",
  status: "active",
  expires_at: "2027-01-01T00:00:00.000Z"
});

assert.equal(consent.providerChoice, "equifax_oneview");
assert.equal(consent.consentTextHash, undefined);

const aiInsight = shapeAiInsight({
  report_type: "credit_readiness",
  title: "Credit readiness",
  request_payload: { raw: "drop-this" },
  response_payload: { raw: "drop-this" },
  report_data: {
    insightType: "credit_readiness",
    tool: "credit-profile",
    title: "Credit readiness",
    summary: "You are directionally ready.",
    score: 78,
    riskLevel: "moderate",
    keyInsights: ["Income supports the target range."],
    recommendations: ["Confirm documents."],
    nextSteps: ["Run mortgage estimate."],
    sourceResponse: "drop-this",
    contentBase64: "drop-this",
    rawGeminiResponse: "drop-this",
    safeMetadata: {
      providerStatus: "verified",
      verificationStatus: "verified_provider",
      missingFieldCount: 0,
      generatedAt: "2026-01-01T00:00:00.000Z",
      assessment_id_hash: "drop-this"
    }
  }
});

assert.equal(aiInsight.summary, "You are directionally ready.");
assert.equal(JSON.stringify(aiInsight).includes("request_payload"), false);
assert.equal(JSON.stringify(aiInsight).includes("response_payload"), false);
assert.equal(JSON.stringify(aiInsight).includes("sourceResponse"), false);
assert.equal(JSON.stringify(aiInsight).includes("contentBase64"), false);
assert.equal(JSON.stringify(aiInsight).includes("rawGeminiResponse"), false);
assert.equal(JSON.stringify(aiInsight).includes("assessment_id_hash"), false);

const mortgageReadiness = shapeMortgageReadiness([
  {
    report_type: "mortgage_estimate",
    created_at: "2026-01-01T00:00:00.000Z",
    report_data: {
      summary: "Mortgage estimate ready.",
      score: 72,
      riskLevel: "medium",
      affordabilityRange: "$550K-$650K",
      paymentRange: "$3,000-$3,600",
      creditMortgageHandoff: { raw: "drop-this" },
      safeMetadata: {
        creditReferenceStatus: "resolved"
      }
    }
  }
]);

assert.equal(mortgageReadiness.summary, "Mortgage estimate ready.");
assert.equal(JSON.stringify(mortgageReadiness).includes("creditMortgageHandoff"), false);

assert.deepEqual(emptyDashboard().consents, []);
assert.equal(emptyDashboard().profile, null);

function createQueryBuilder(table, calls) {
  const builder = {
    select() {
      return builder;
    },
    eq(column, value) {
      calls.push({ table, column, value });
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    }
  };
  return builder;
}

async function runServiceCheck() {
  const calls = [];
  const client = {
    from(table) {
      return createQueryBuilder(table, calls);
    }
  };
  const service = new DashboardService(
    { get: () => undefined },
    client
  );
  const result = await service.getAiCreditDashboard(userId);

  assert.deepEqual(result.consents, []);
  assert.equal(result.profile, null);

  const filteredTables = new Set(calls.map((call) => call.table));
  [
    "profiles",
    "onboarding_profiles",
    "user_financial_profiles",
    "credit_assessments",
    "credit_consents",
    "ai_reports"
  ].forEach((table) => assert.equal(filteredTables.has(table), true));

  calls.forEach((call) => {
    if (call.table === "profiles") {
      assert.equal(call.column, "id");
    } else {
      assert.equal(call.column, "user_id");
    }
    assert.equal(call.value, userId);
  });
}

runServiceCheck().then(() => {
  console.log("Dashboard AI credit checks passed.");
});
