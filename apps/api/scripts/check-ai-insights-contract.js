const assert = require("node:assert/strict");
const {
  AiInsightsService,
  buildAiReportInsertRow,
  shapePersistableDashboardInsight,
  shapeDashboardAiInsight
} = require("../src/ai-insights");

const fixedGeneratedAt = "2026-06-26T00:00:00.000Z";

function assertNoUnsafeAiReportFields(value) {
  const serialized = JSON.stringify(value);

  return ![
    "rawGeminiResponse",
    "prompt",
    "sourceResponse",
    "contentBase64",
    "assessment_id_hash",
    "credit_mortgage_handoff",
    "creditMortgageHandoff",
    "request_payload",
    "response_payload",
    "stack",
    "authorization",
    "apiKey",
    "token",
    "sourceTrust"
  ].some(function (field) {
    return serialized.includes(field);
  });
}

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

const persistableInsight = shapePersistableDashboardInsight(
  {
    id: "gateway-id-should-not-persist",
    tool: "credit-profile",
    summary: "Credit summary",
    sourceResponse: "drop-this",
    reportData: {
      providerStatus: { status: "directional" },
      creditMortgageHandoff: { readinessScore: 80 }
    }
  },
  { generatedAt: fixedGeneratedAt }
);
const insertRow = buildAiReportInsertRow(
  "00000000-0000-4000-8000-000000000001",
  persistableInsight
);

assert.equal(insertRow.user_id, "00000000-0000-4000-8000-000000000001");
assert.equal(insertRow.ai_request_id, null);
assert.equal(insertRow.report_type, "credit_readiness");
assert.equal(insertRow.title, "Credit Readiness Summary");
assert.equal(insertRow.report_data.id, null);
assert.equal(insertRow.report_data.summary, "Credit summary");
assert.equal(insertRow.report_data.safeMetadata.providerStatus, "directional");
assert.equal(assertNoUnsafeAiReportFields(insertRow), true);
assert.equal(JSON.stringify(insertRow).includes("gateway-id-should-not-persist"), false);

const missingConfigService = {
  get: function () {
    return undefined;
  }
};
const skippedService = new AiInsightsService(missingConfigService);

skippedService
  .persistDashboardInsight(
    "00000000-0000-4000-8000-000000000001",
    { tool: "mortgage", summary: "Mortgage summary" },
    { generatedAt: fixedGeneratedAt }
  )
  .then(function (result) {
    assert.equal(result.status, "skipped");
    assert.equal(result.insight.summary, "Mortgage summary");

    const failingConfigService = {
      get: function (key) {
        if (key === "SUPABASE_URL") return "http://localhost:54321";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role";
        return undefined;
      }
    };
    const failingService = new AiInsightsService(failingConfigService);
    failingService.client = {
      from: function (tableName) {
        assert.equal(tableName, "ai_reports");
        return {
          insert: async function (row) {
            assert.equal(row.report_data.summary, "Stored safely");
            assert.equal(assertNoUnsafeAiReportFields(row), true);
            return { error: { message: "simulated insert failure" } };
          }
        };
      }
    };

    return failingService.persistDashboardInsight(
      "00000000-0000-4000-8000-000000000001",
      {
        tool: "scout",
        summary: "Stored safely",
        prompt: "drop-this",
        reportData: {
          sourceResponse: "drop-this"
        }
      },
      { generatedAt: fixedGeneratedAt }
    );
  })
  .then(function (result) {
    assert.equal(result.status, "failed");
    assert.equal(result.insight.summary, "Stored safely");
    assert.equal(assertNoUnsafeAiReportFields(result.insight), true);
    console.log("AI dashboard insight contract checks passed.");
  })
  .catch(function (error) {
    console.error(error);
    process.exit(1);
  });
