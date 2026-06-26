const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildCreditAssessmentRow,
  buildMortgageGatewayInputForResolution,
  hashCreditAssessmentId
} = require("../src/ai/credit-assessments.service");
const { normalizeMortgageInput } = require("../src/ai/credit-ai.contract");

const secret = "test-secret";
const assessmentId = "ca_12345678901234567890123456789012";
const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

const shapedCreditResponse = {
  status: "success",
  tool: "credit-profile",
  resultType: "credit_profile_directional_assessment",
  score: 74,
  riskLevel: "moderate",
  reportData: {
    providerStatus: {
      provider: "directional",
      status: "not_connected",
      sourceResponse: "drop-this"
    },
    verificationStatus: {
      status: "directional_only",
      bureauDataVerified: false
    },
    creditAssessment: {
      assessmentId,
      expiresAt
    },
    creditMortgageHandoff: {
      verificationStatus: {
        status: "directional_only",
        bureauDataVerified: false,
        provider: "directional"
      },
      providerStatus: {
        provider: "directional",
        status: "not_connected",
        verified: false
      },
      readinessScore: 74,
      riskLevel: "moderate",
      affordabilityWarningFlags: ["credit_not_provider_verified"],
      sourceResponse: "drop-this",
      contentBase64: "drop-this"
    }
  }
};

const row = buildCreditAssessmentRow(
  "00000000-0000-4000-8000-000000000001",
  shapedCreditResponse,
  secret
);

assert.ok(row);
assert.equal(row.assessment_id_hash, hashCreditAssessmentId(assessmentId, secret));
assert.notEqual(row.assessment_id_hash, assessmentId);
assert.equal(JSON.stringify(row).includes(assessmentId), false);
assert.equal(JSON.stringify(row).includes("sourceResponse"), false);
assert.equal(JSON.stringify(row).includes("contentBase64"), false);
assert.equal(row.user_id, "00000000-0000-4000-8000-000000000001");
assert.equal(row.status, "active");
assert.equal(row.expires_at, expiresAt);

const normalizedMortgage = normalizeMortgageInput({
  targetPurchasePrice: 600000,
  creditAssessmentId: assessmentId,
  creditMortgageHandoff: {
    readinessScore: 99,
    verificationStatus: { bureauDataVerified: true }
  }
});

assert.equal(normalizedMortgage.creditAssessmentId, assessmentId);
assert.equal(normalizedMortgage.creditMortgageHandoff, undefined);
assert.equal(normalizedMortgage.creditProfileContext, undefined);

const trustedMortgageInput = buildMortgageGatewayInputForResolution(
  normalizedMortgage,
  {
    status: "resolved",
    creditMortgageHandoff: row.credit_mortgage_handoff,
    expiresAt
  }
);

assert.equal(trustedMortgageInput.creditAssessmentId, undefined);
assert.equal(
  trustedMortgageInput.creditMortgageHandoffTrust,
  "api_resolved_trusted"
);
assert.equal(
  trustedMortgageInput.creditAssessment.sourceTrust,
  "api_resolved_trusted"
);

const missingMortgageInput = buildMortgageGatewayInputForResolution(
  normalizedMortgage,
  { status: "not_found_or_expired" }
);

assert.equal(missingMortgageInput.creditAssessmentId, undefined);
assert.equal(missingMortgageInput.creditMortgageHandoff, undefined);
assert.equal(
  missingMortgageInput.creditAssessment.warning,
  "credit_assessment_not_found_or_expired"
);

const serviceSource = fs.readFileSync(
  path.join(__dirname, "../src/ai/credit-assessments.service.ts"),
  "utf8"
);

assert.equal(serviceSource.includes('.eq("user_id", userId)'), true);
assert.equal(serviceSource.includes('.eq("status", "active")'), true);
assert.equal(serviceSource.includes('.is("revoked_at", null)'), true);
assert.equal(serviceSource.includes('.gt("expires_at", new Date().toISOString())'), true);

console.log("Credit assessment persistence checks passed.");
