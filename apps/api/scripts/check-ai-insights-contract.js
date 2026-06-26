const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  AiInsightsService,
  buildDashboardInsightsResponse,
  buildAiReportInsertRow,
  isDashboardInsightType,
  normalizeAiReportRow,
  shapePersistableDashboardInsight,
  shapeDashboardAiInsight
} = require("../src/ai-insights");
const {
  getDashboardInsightOptionsForAiTool
} = require("../src/ai/ai.controller");

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

assert.deepEqual(getDashboardInsightOptionsForAiTool("credit-profile", {}), {
  insightType: "credit_readiness",
  tool: "credit-profile",
  title: "Credit Readiness Summary"
});
assert.deepEqual(getDashboardInsightOptionsForAiTool("mortgage", {}), {
  insightType: "mortgage_estimate",
  tool: "mortgage",
  title: "Mortgage Estimate Summary"
});
assert.deepEqual(getDashboardInsightOptionsForAiTool("scout", {}), {
  insightType: "marketplace_tool",
  tool: "scout",
  title: "Property Scout Insight"
});
assert.deepEqual(getDashboardInsightOptionsForAiTool("analyze", {}), {
  insightType: "marketplace_tool",
  tool: "analyze",
  title: "Property Analysis Insight"
});
assert.deepEqual(getDashboardInsightOptionsForAiTool("rental", {}), {
  insightType: "marketplace_tool",
  tool: "rental",
  title: "Rental Finder Insight"
});
assert.deepEqual(getDashboardInsightOptionsForAiTool("valuate", {}), {
  insightType: "marketplace_tool",
  tool: "valuate",
  title: "Property Valuation Insight"
});
assert.deepEqual(getDashboardInsightOptionsForAiTool("investment-planner", {}), {
  insightType: "marketplace_tool",
  tool: "investment-planner",
  title: "Investment Planner Insight"
});
assert.equal(getDashboardInsightOptionsForAiTool("chat", {}), null);
assert.deepEqual(
  getDashboardInsightOptionsForAiTool("chat", {
    metadata: { context: "smart_onboarding" }
  }),
  {
    insightType: "onboarding_recommendation",
    tool: "chat",
    title: "Smart Onboarding Recommendation"
  }
);
assert.equal(isDashboardInsightType("credit_readiness"), true);
assert.equal(isDashboardInsightType("mortgage_estimate"), true);
assert.equal(isDashboardInsightType("unsupported"), false);

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

const reportRows = [
  {
    user_id: "user-a",
    report_type: "marketplace_tool",
    created_at: "2026-06-26T03:00:00.000Z",
    report_data: {
      insightType: "marketplace_tool",
      tool: "scout",
      title: "Scout",
      summary: "Newest marketplace",
      sourceLabel: "Gemini-backed",
      status: "success",
      keyInsights: ["Good fit"],
      sourceResponse: "drop-this",
      creditMortgageHandoff: { readinessScore: 99 },
      safeMetadata: {
        generatedAt: "2026-06-26T03:00:00.000Z"
      }
    }
  },
  {
    user_id: "user-a",
    report_type: "credit_readiness",
    created_at: "2026-06-26T02:00:00.000Z",
    report_data: {
      insightType: "credit_readiness",
      tool: "credit-profile",
      title: "Credit",
      summary: "Credit ready",
      status: "success",
      sourceLabel: "Rules-based directional",
      safeMetadata: {
        providerStatus: "not_connected",
        verificationStatus: "directional_only",
        generatedAt: "2026-06-26T02:00:00.000Z"
      }
    }
  },
  {
    user_id: "user-a",
    report_type: "mortgage_estimate",
    created_at: "2026-06-26T01:00:00.000Z",
    report_data: {
      insightType: "mortgage_estimate",
      tool: "mortgage",
      title: "Mortgage",
      summary: "Mortgage estimate",
      status: "success",
      sourceLabel: "Gemini-backed",
      safeMetadata: {
        creditReferenceStatus: "resolved",
        generatedAt: "2026-06-26T01:00:00.000Z"
      }
    }
  },
  {
    user_id: "user-a",
    report_type: "onboarding_recommendation",
    created_at: "2026-06-26T00:00:00.000Z",
    report_data: {
      insightType: "onboarding_recommendation",
      tool: "chat",
      title: "Onboarding",
      summary: "Onboarding match",
      status: "success",
      sourceLabel: "Platform-signal fallback"
    }
  },
  {
    user_id: "user-a",
    report_type: "unsupported",
    created_at: "2026-06-25T00:00:00.000Z",
    report_data: {
      summary: "Must be skipped",
      sourceResponse: "drop-this"
    }
  }
];
const dashboardResponse = buildDashboardInsightsResponse(reportRows);

assert.equal(dashboardResponse.onboardingRecommendation.summary, "Onboarding match");
assert.equal(dashboardResponse.creditReadiness.summary, "Credit ready");
assert.equal(dashboardResponse.mortgageEstimate.summary, "Mortgage estimate");
assert.equal(dashboardResponse.marketplaceTools.length, 1);
assert.equal(dashboardResponse.marketplaceTools[0].summary, "Newest marketplace");
assert.equal(assertNoUnsafeAiReportFields(dashboardResponse), true);
assert.equal(JSON.stringify(dashboardResponse).includes("sourceResponse"), false);
assert.equal(JSON.stringify(dashboardResponse).includes("creditMortgageHandoff"), false);

const malformedInsight = normalizeAiReportRow({
  report_type: "credit_readiness",
  created_at: "2026-06-26T04:00:00.000Z",
  report_data: {
    tool: "credit-profile",
    summary: "SIN 123-456-789 at 123 Main Street",
    sourceResponse: "drop-this",
    assessment_id_hash: "drop-this",
    request_payload: { token: "drop-this" },
    safeMetadata: {
      sourceTrust: "api_resolved_supabase_assessment",
      creditReferenceStatus: "resolved",
      generatedAt: "2026-06-26T04:00:00.000Z"
    }
  }
});

assert.ok(malformedInsight);
assert.equal(malformedInsight.insightType, "credit_readiness");
assert.equal(malformedInsight.safeMetadata.creditReferenceStatus, "resolved");
assert.equal(assertNoUnsafeAiReportFields(malformedInsight), true);
assert.equal(JSON.stringify(malformedInsight).includes("123-456-789"), false);
assert.equal(JSON.stringify(malformedInsight).includes("123 Main Street"), false);

const skippedMalformedInsight = normalizeAiReportRow({
  report_type: "not_supported",
  report_data: { summary: "skip me", sourceResponse: "drop-this" }
});

assert.equal(skippedMalformedInsight, null);

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

    const throwingConfigService = {
      get: function (key) {
        if (key === "SUPABASE_URL") return "http://localhost:54321";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role";
        return undefined;
      }
    };
    const throwingService = new AiInsightsService(throwingConfigService);
    throwingService.client = {
      from: function () {
        return {
          insert: async function () {
            throw new Error("simulated network failure");
          }
        };
      }
    };

    return throwingService.persistDashboardInsight(
      "00000000-0000-4000-8000-000000000001",
      {
        tool: "mortgage",
        summary: "Still returned safely",
        sourceResponse: "drop-this"
      },
      { generatedAt: fixedGeneratedAt }
    );
  })
  .then(function (result) {
    assert.equal(result.status, "failed");
    assert.equal(result.insight.summary, "Still returned safely");
    assert.equal(assertNoUnsafeAiReportFields(result.insight), true);

    const source = fs.readFileSync(
      require("node:path").join(
        __dirname,
        "../src/ai-insights/ai-insights.service.ts"
      ),
      "utf8"
    );

    assert.equal(source.includes('.eq("user_id", userId)'), true);
    assert.equal(source.includes('.select("report_type, report_data, created_at")'), true);
    assert.equal(source.includes("request_payload"), false);
    assert.equal(source.includes("response_payload"), false);
    console.log("AI dashboard insight contract checks passed.");
  })
  .catch(function (error) {
    console.error(error);
    process.exit(1);
  });
