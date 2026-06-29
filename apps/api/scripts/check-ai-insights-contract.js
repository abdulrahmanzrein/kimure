const assert = require("node:assert/strict");
const {
  shapeDashboardAiInsight
} = require("../src/ai-insights");

const fixedGeneratedAt = "2026-06-26T00:00:00.000Z";

const unsafeInsight = shapeDashboardAiInsight(
  {
    id: "report-1",
    tool: "credit-profile",
    status: "success",
    source: "gemini",
    title: "Credit result",
    summary:
      "Applicant SIN 123-456-789, DOB 1990-01-01, address 123 Main Street should not leak.",
    score: 72,
    riskLevel: "medium",
    keyInsights: ["Income is stable.", 42, null],
    recommendations: "not-an-array",
    nextSteps: ["Review down payment."],
    prompt: "drop-this",
    rawGeminiResponse: { text: "drop-this" },
    sourceResponse: "drop-this",
    contentBase64: "drop-this",
    assessment_id_hash: "drop-this",
    credit_mortgage_handoff: { readinessScore: 99 },
    request_payload: { token: "drop-this" },
    response_payload: { providerData: "drop-this" },
    stack: "drop-this",
    reportData: {
      providerStatus: {
        status: "not_connected",
        sourceResponse: "drop-this"
      },
      verificationStatus: {
        status: "directional_only",
        fullDateOfBirth: "1990-01-01"
      },
      missingFields: ["employmentStatus", 123],
      creditAssessment: {
        assessmentId: "drop-this",
        expiresAt: "2026-06-26T01:00:00.000Z"
      },
      creditMortgageHandoff: {
        readinessScore: 72,
        sourceResponse: "drop-this"
      }
    },
    crmSignals: {
      leadIntent: "mortgage_readiness",
      leadTemperature: "warm",
      extraRawSignal: "drop-this"
    }
  },
  { generatedAt: fixedGeneratedAt }
);

assert.equal(unsafeInsight.id, "report-1");
assert.equal(unsafeInsight.insightType, "credit_readiness");
assert.equal(unsafeInsight.tool, "credit-profile");
assert.equal(unsafeInsight.sourceLabel, "Gemini-backed");
assert.equal(unsafeInsight.status, "success");
assert.deepEqual(unsafeInsight.keyInsights, ["Income is stable."]);
assert.deepEqual(unsafeInsight.recommendations, []);
assert.deepEqual(unsafeInsight.nextSteps, ["Review down payment."]);
assert.equal(unsafeInsight.safeMetadata.providerStatus, "not_connected");
assert.equal(unsafeInsight.safeMetadata.verificationStatus, "directional_only");
assert.equal(unsafeInsight.safeMetadata.missingFieldCount, 1);
assert.equal(unsafeInsight.safeMetadata.generatedAt, fixedGeneratedAt);
assert.equal(unsafeInsight.crmSignals.leadIntent, "mortgage_readiness");
assert.equal(unsafeInsight.crmSignals.extraRawSignal, undefined);

const serializedUnsafeInsight = JSON.stringify(unsafeInsight);
[
  "123-456-789",
  "1990-01-01",
  "123 Main Street",
  "rawGeminiResponse",
  "prompt",
  "sourceResponse",
  "contentBase64",
  "assessment_id_hash",
  "credit_mortgage_handoff",
  "request_payload",
  "response_payload",
  "stack",
  "fullDateOfBirth",
  "extraRawSignal"
].forEach((unsafeField) => {
  assert.equal(
    serializedUnsafeInsight.includes(unsafeField),
    false,
    `${unsafeField} should not be in dashboard insight`
  );
});

const fallbackInsight = shapeDashboardAiInsight(
  {
    tool: "scout",
    source: "fallback",
    reportData: {
      geminiMode: "gemini_error"
    }
  },
  { generatedAt: fixedGeneratedAt }
);

assert.equal(fallbackInsight.insightType, "marketplace_tool");
assert.equal(fallbackInsight.summary, null);
assert.equal(fallbackInsight.score, null);
assert.deepEqual(fallbackInsight.keyInsights, []);
assert.deepEqual(fallbackInsight.recommendations, []);
assert.equal(fallbackInsight.status, "fallback");
assert.equal(fallbackInsight.sourceLabel, "Platform-signal fallback");

const expiredMortgageInsight = shapeDashboardAiInsight(
  {
    tool: "mortgage",
    reportData: {
      creditReferenceStatus: {
        sourceTrust: "api_resolved_supabase_assessment",
        warning: "credit_assessment_not_found_or_expired",
        assessmentId: "drop-this"
      }
    }
  },
  { generatedAt: fixedGeneratedAt }
);

assert.equal(expiredMortgageInsight.insightType, "mortgage_estimate");
assert.equal(expiredMortgageInsight.status, "expired");
assert.equal(
  expiredMortgageInsight.safeMetadata.creditReferenceStatus,
  "not_found_or_expired"
);
assert.equal(
  JSON.stringify(expiredMortgageInsight).includes("api_resolved_supabase_assessment"),
  false
);
assert.equal(JSON.stringify(expiredMortgageInsight).includes("assessmentId"), false);

const onboardingInsight = shapeDashboardAiInsight(
  { tool: "chat", reportData: { aiReasoning: { mode: "rules_directional" } } },
  {
    insightType: "onboarding_recommendation",
    title: "Onboarding Match",
    generatedAt: fixedGeneratedAt
  }
);

assert.equal(onboardingInsight.insightType, "onboarding_recommendation");
assert.equal(onboardingInsight.title, "Onboarding Match");
assert.equal(onboardingInsight.sourceLabel, "Rules-based directional");

console.log("AI dashboard insight contract checks passed.");
